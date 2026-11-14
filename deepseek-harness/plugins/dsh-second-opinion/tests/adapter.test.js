import test from "node:test";
import assert from "node:assert/strict";
import { createAdapter } from "../adapter.js";

function host() {
  const effects = new Set();
  const drivers = [];
  const ctx = {
    fiber: { assertActive() {} },
    effect(create) {
      const cleanup = create();
      const dispose = async () => {
        if (effects.delete(dispose)) await cleanup();
      };
      effects.add(dispose);
      return dispose;
    },
  };
  class Session {
    static create(id, seed, header, inheritedEventCount, projections) {
      assert.equal(projections, ctx.sessions.messageProjections);
      return Object.assign(new Session(), {
        id,
        seed,
        header,
        inheritedEventCount,
        seq: seed.length + 1,
      });
    }
    deriveMessages() {
      return [];
    }
  }
  class Driver {
    constructor(loopCtx, id, options, session, projections, lastTurn, lifetimeSignal) {
      assert.ok(lifetimeSignal instanceof AbortSignal);
      drivers.push(this);
      Object.assign(this, {
        loopCtx,
        id,
        options,
        session,
        ctx: loopCtx,
        projections,
        lastTurn,
        lifetimeSignal,
      });
      this.model = {
        select: (selection) => {
          this.selection = selection;
        },
      };
      this.scope = {
        dispose: async () => {
          this.disposed = true;
        },
      };
    }
    runMaintenance(fn) {
      return fn();
    }
    cancel() {}
    whenIdle() {
      return Promise.resolve();
    }
  }
  const source = new Driver(ctx, "parent", {}, new Session(), {}, 0, new AbortController().signal);
  Object.assign(ctx, {
    sessions: { messageProjections: [] },
    agents: {
      get: (id) => (id === "parent" ? source : undefined),
      turnBoundaryOf: () => ({ lastTurn: 7 }),
    },
    agentLoop: {
      runtime: { ctx },
      modelProjectionHandle: { readerFor: () => () => ({}) },
      inboxProjectionHandle: { readerFor: () => () => ({}) },
    },
    llm: {
      resolveCallConfig: async (value) => value,
      resolveModelInfo: async () => ({ inputModalities: ["text"] }),
    },
    sessionController: {
      commands: { forkWorkspace: async () => undefined },
      agents: {
        presetForSession: (session) =>
          session.seed.findLast((e) => e.type === "preset")?.data.id ?? session.header.agentPreset,
        composeAgent: async (id) => ({ agentPreset: id, setup: async () => {} }),
      },
    },
  });
  return { ctx, effects, source, drivers };
}

test("detached driver keeps header preset and fixed prefix without publishing source or preview", async () => {
  const { ctx, effects, source: sourceAgent } = host();
  const source = {
    session: { id: "parent", agentPreset: "header-preset" },
    events: [
      { seq: 0, type: "message" },
      { seq: 1, type: "turn/end" },
      { seq: 2, type: "preset", data: { id: "future-preset" } },
    ],
  };
  const item = { sessionId: "parent", atSeq: 1, provider: "p", model: "B" };
  const adapter = createAdapter(ctx);
  const first = await adapter.prepare(item, source);
  assert.equal(item.meta.agentPreset, "header-preset");
  assert.equal(first.agent.session.seed.length, 2);
  assert.equal(first.agent.lastTurn, 7);
  assert.deepEqual(first.agent.selection, { provider: "p", model: "B" });
  assert.equal(sourceAgent.selection, undefined);
  assert.equal(first.agent.lifetimeSignal.aborted, false);
  await first.dispose();
  assert.equal(first.agent.lifetimeSignal.aborted, true);
  assert.equal(sourceAgent.lifetimeSignal.aborted, false);
  assert.equal(first.agent.disposed, true);
  assert.equal(effects.size, 0);
  source.events[0] = { seq: 0, type: "preset", data: { id: "anchor-preset" } };
  const second = await adapter.prepare(item, source);
  assert.equal(item.meta.agentPreset, "anchor-preset");
  await second.dispose();
});

test("cold source is not resumed to obtain a driver", async () => {
  const { ctx } = host();
  ctx.agents.get = () => undefined;
  ctx.sessionController.resolveAgent = () => assert.fail("must not resume the source");
  await assert.rejects(
    createAdapter(ctx).prepare({ sessionId: "cold" }, {}),
    /先在 DSH 中打开原对话/,
  );
});

test("failed preset setup releases the detached scope and lifecycle effects", async () => {
  const { ctx, effects } = host();
  let failedAgent;
  ctx.sessionController.agents.composeAgent = async () => ({
    setup: async (_ctx, agent) => {
      failedAgent = agent;
      throw new Error("preset failed");
    },
  });
  await assert.rejects(
    createAdapter(ctx).prepare(
      { sessionId: "parent", atSeq: -1, provider: "p", model: "B" },
      { session: { id: "parent" }, events: [] },
    ),
    /preset failed/,
  );
  assert.equal(failedAgent.disposed, true);
  assert.equal(failedAgent.lifetimeSignal.aborted, true);
  assert.equal(effects.size, 0);
});

test("owner shutdown during model resolution creates no detached scope", async () => {
  const { ctx, effects, drivers } = host();
  const resolving = Promise.withResolvers();
  const entered = Promise.withResolvers();
  ctx.llm.resolveCallConfig = (value) => {
    entered.resolve();
    return resolving.promise.then(() => value);
  };
  const preparing = createAdapter(ctx).prepare(
    { sessionId: "parent", atSeq: -1, provider: "p", model: "B" },
    { session: { id: "parent" }, events: [] },
  );
  await entered.promise;
  ctx.fiber.assertActive = () => {
    throw new Error("owner stopped");
  };
  resolving.resolve();
  await assert.rejects(preparing, /owner stopped/);
  assert.equal(drivers.length, 1); // Only the original conversation exists.
  assert.equal(effects.size, 0);
});

test("failed lifecycle registration releases the constructed scope and earlier effect", async () => {
  const { ctx, effects, drivers } = host();
  const effect = ctx.effect;
  let registrations = 0;
  ctx.effect = (create) => {
    if (++registrations === 2) throw new Error("host stopped during registration");
    return effect(create);
  };
  await assert.rejects(
    createAdapter(ctx).prepare(
      { sessionId: "parent", atSeq: -1, provider: "p", model: "B" },
      { session: { id: "parent" }, events: [] },
    ),
    /host stopped during registration/,
  );
  assert.equal(drivers.length, 2);
  assert.equal(drivers[1].disposed, true);
  assert.equal(drivers[1].lifetimeSignal.aborted, true);
  assert.equal(effects.size, 0);
});

test("host and plugin teardown share one cancellation and await idle before scope release", async () => {
  const { ctx, effects } = host();
  const prepared = await createAdapter(ctx).prepare(
    { sessionId: "parent", atSeq: -1, provider: "p", model: "B" },
    { session: { id: "parent" }, events: [] },
  );
  let cancellations = 0;
  const idle = Promise.withResolvers();
  prepared.agent.cancel = (cause) => {
    assert.equal(cause.kind, "disposed");
    assert.equal(prepared.agent.lifetimeSignal.aborted, true);
    cancellations++;
  };
  prepared.agent.whenIdle = () => idle.promise;
  const unloading = Promise.all([...effects].map((dispose) => dispose()));
  assert.equal(cancellations, 1);
  assert.equal(prepared.agent.disposed, undefined);
  idle.resolve();
  await unloading;
  await prepared.dispose();
  assert.equal(prepared.agent.disposed, true);
  assert.equal(cancellations, 1);
  assert.equal(effects.size, 0);
});

test("owner shutdown during preset setup prevents its commit and model selection", async () => {
  const { ctx, effects, drivers } = host();
  const entered = Promise.withResolvers();
  const setup = Promise.withResolvers();
  ctx.sessionController.agents.composeAgent = async () => ({
    setup: () => {
      entered.resolve();
      return setup.promise;
    },
  });
  const preparing = createAdapter(ctx).prepare(
    { sessionId: "parent", atSeq: -1, provider: "p", model: "B" },
    { session: { id: "parent" }, events: [] },
  );
  await entered.promise;
  const unloading = Promise.all([...effects].map((dispose) => dispose()));
  setup.resolve({ commit: () => assert.fail("disposed preview must not commit setup") });
  await assert.rejects(preparing, /Second opinion disposed/);
  await unloading;
  assert.equal(drivers[1].lifetimeSignal.aborted, true);
  assert.equal(drivers[1].selection, undefined);
  assert.equal(drivers[1].disposed, true);
  assert.equal(effects.size, 0);
});

test("cancellation failure still waits for idle before releasing the scope", async () => {
  const { ctx, effects } = host();
  const prepared = await createAdapter(ctx).prepare(
    { sessionId: "parent", atSeq: -1, provider: "p", model: "B" },
    { session: { id: "parent" }, events: [] },
  );
  const idle = Promise.withResolvers();
  prepared.agent.cancel = () => {
    throw new Error("cancel failed");
  };
  prepared.agent.whenIdle = () => idle.promise;
  const disposing = prepared.dispose();
  assert.equal(prepared.agent.lifetimeSignal.aborted, true);
  assert.equal(prepared.agent.disposed, undefined);
  idle.resolve();
  await assert.rejects(disposing, /cancel failed/);
  assert.equal(prepared.agent.disposed, true);
  assert.equal(effects.size, 0);
});

test("continuation resolves the workspace through the nested command controller", async () => {
  const header = { id: "parent" };
  let attached;
  const { ctx } = host();
  ctx.agents.get = () => ({});
  const commands = {
    async forkWorkspace(source) {
      assert.equal(this, commands);
      assert.equal(source, header);
      return {
        attachSession: async (id) => {
          attached = id;
        },
      };
    },
  };
  ctx.sessionController.commands = commands;
  const result = await createAdapter(ctx).promote(
    { continuationId: "branch", sourceHeader: header },
    [],
  );
  assert.equal(result, "branch");
  assert.equal(attached, "branch");
});
