import { randomUUID } from "node:crypto";

// 0.2.2-rc.3 compatibility boundary. The host no longer exports a detached
// factory. Reuse the open source conversation's driver class without entering
// either registry; never resume a cold source just to obtain that class.
export function createAdapter(ctx) {
  const controller = ctx.sessionController;
  const composition = controller.agents;
  const checkpoints = new WeakMap();
  let flushAccessor;
  function bindCheckpoint(session, checkpoint) {
    if (!flushAccessor) {
      const originalFlush = ctx.sessions.flush;
      // Cordis service accessors preserve the caller's service receiver. Only
      // this plugin's detached sessions use its own durable opinion snapshots.
      flushAccessor = ctx.accessor("sessions.flush", {
        get(receiver) {
          return async (target, ...args) => {
            const save = checkpoints.get(target);
            if (!save) return Reflect.apply(originalFlush, receiver, [target, ...args]);
            await save();
            return true;
          };
        },
      });
    }
    checkpoints.set(session, checkpoint);
    return () => {
      if (checkpoints.get(session) === checkpoint) checkpoints.delete(session);
    };
  }
  function assertCompatible() {
    for (const fn of [
      composition?.composeAgent,
      composition?.presetForSession,
      controller.commands?.forkWorkspace,
    ]) {
      if (typeof fn !== "function")
        throw new Error("当前 DSH 版本的意见接口不同，需要更新插件适配。");
    }
  }
  return {
    async prepare(item, source) {
      assertCompatible();
      const sourceAgent = ctx.agents.get(item.sessionId);
      if (!sourceAgent) throw new Error("请先在 DSH 中打开原对话，加载完成后再邀请意见。");
      const loop = ctx.agentLoop;
      const loopCtx = loop?.runtime?.ctx;
      const Driver = sourceAgent.constructor;
      const Session = sourceAgent.session.constructor;
      if (
        !loopCtx ||
        sourceAgent.loopCtx !== loopCtx ||
        typeof Session.create !== "function" ||
        typeof loop.modelProjectionHandle?.readerFor !== "function" ||
        typeof loop.inboxProjectionHandle?.readerFor !== "function" ||
        typeof ctx.agents.turnBoundaryOf !== "function" ||
        !Array.isArray(ctx.sessions.messageProjections)
      ) {
        throw new Error("当前 DSH 版本的意见接口不同，需要更新插件适配。");
      }
      // SessionQuery.readSession() returns { session, events }; only retained
      // observeSession() observations expose their metadata as `header`.
      // SessionStore.prepare() objects cannot append before publication in rc.1.
      // Session.create() is the host's independent, writable replay surface.
      const id = `opinion-${randomUUID()}`;
      const session = Session.create(
        id,
        source.events.slice(0, item.atSeq + 1),
        {
          version: 4,
          id,
          createdAt: Date.now(),
          ...(source.session.cwd ? { cwd: source.session.cwd } : {}),
          ...(source.session.agentPreset ? { agentPreset: source.session.agentPreset } : {}),
          parentSession: item.sessionId,
          isSeeded: true,
        },
        item.atSeq + 1,
        ctx.sessions.messageProjections,
      );
      const preset = await composition.composeAgent(composition.presetForSession(session));
      const config = await ctx.llm.resolveCallConfig({
        provider: item.provider,
        model: item.model,
      });
      const info = await ctx.llm.resolveModelInfo(config.provider, config.model);
      if (
        session
          .deriveMessages()
          .some((message) => message.content.some((block) => block.type === "image")) &&
        !info.inputModalities?.includes("image")
      )
        throw new Error("这段历史包含图片，请选择支持图片输入的模型。");
      const selection = {
        provider: config.provider,
        model: config.model,
        ...(config.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: config.reasoningEffort }),
      };
      // Metadata resolution above can outlive plugin/host shutdown. Do not
      // allocate a driver scope after either lifecycle has already ended.
      ctx.fiber.assertActive();
      loopCtx.fiber.assertActive();
      const lifetime = new AbortController();
      const agent = new Driver(
        loopCtx,
        session.id,
        selection,
        session,
        {
          modelSelection: loop.modelProjectionHandle.readerFor(session),
          inbox: loop.inboxProjectionHandle.readerFor(session),
        },
        ctx.agents.turnBoundaryOf(session).lastTurn,
        lifetime.signal,
      );
      let disposing;
      const stop = () =>
        (disposing ??= (async () => {
          // Block future wakes before cancelling the current activity. This
          // signal belongs to the preview, never to the source conversation.
          lifetime.abort(new Error("Second opinion disposed"));
          try {
            agent.cancel({ kind: "disposed" }, { keepInbox: true });
          } finally {
            try {
              await agent.whenIdle();
            } finally {
              await agent.scope.dispose();
            }
          }
        })());
      let releaseOwner, releaseLoop;
      const prepared = {
        agent,
        async dispose() {
          try {
            await stop();
          } finally {
            await Promise.all([releaseOwner?.(), releaseLoop?.()]);
          }
        },
      };
      try {
        releaseOwner = ctx.effect(() => stop);
        releaseLoop = loopCtx.effect(() => stop);
        await prepared.agent.runMaintenance(async () => {
          lifetime.signal.throwIfAborted();
          const setup = await preset.setup?.(prepared.agent.ctx, prepared.agent);
          lifetime.signal.throwIfAborted();
          setup?.commit?.();
          prepared.agent.model.select(selection);
        });
      } catch (error) {
        await prepared.dispose();
        throw error;
      }
      item.selection = selection;
      item.meta = {
        ...(source.session.cwd ? { cwd: source.session.cwd } : {}),
        parentSession: item.sessionId,
        isSeeded: true,
        ...(preset.agentPreset ? { agentPreset: preset.agentPreset } : {}),
      };
      item.sourceHeader = source.session;
      item.inheritedEventCount = session.inheritedEventCount;
      item.childStartSeq = session.seq - 1;
      let releaseCheckpoint;
      return {
        ...prepared,
        bindCheckpoint(checkpoint) {
          releaseCheckpoint?.();
          releaseCheckpoint = bindCheckpoint(session, checkpoint);
          return releaseCheckpoint;
        },
        async dispose() {
          try {
            await prepared.dispose();
          } finally {
            releaseCheckpoint?.();
          }
        },
      };
    },
    async exists(id) {
      if (ctx.agents.get(id)) return true;
      try {
        await ctx.sessionQuery.readSession(id);
        return true;
      } catch (error) {
        if (error.code === "SESSION_QUERY_SESSION_NOT_FOUND" || error.code === "session/not-found")
          return false;
        throw error;
      }
    },
    async promote(item, events) {
      assertCompatible();
      if (!(await this.exists(item.continuationId))) {
        const preset = await composition.composeAgent(item.meta.agentPreset);
        await ctx.agents.create({
          sessionId: item.continuationId,
          seed: events,
          inheritedEventCount: item.inheritedEventCount,
          meta: item.meta,
          agentOptions: item.selection,
          setup: async (agentCtx, agent) => {
            (await preset.setup?.(agentCtx, agent))?.commit?.();
            agent.model.select(item.selection);
          },
        });
      }
      const workspace = await controller.commands.forkWorkspace(item.sourceHeader);
      if (workspace) await workspace.attachSession(item.continuationId);
      return item.continuationId;
    },
  };
}
