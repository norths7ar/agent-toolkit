import { randomUUID } from 'node:crypto';
import { SOURCE, message, inspectHistory, editedContent, withdrawalRanges, inboxState } from './history.js';

export const name = 'latest-message-edit';
export const inject = ['agents', 'sessions', 'sessionQuery', 'sessionController', 'connection'];
const API = '/api/local-latest-message-edit';

function fail(text, status = 409) {
  throw Object.assign(new Error(text), { status });
}

export function apply(ctx) {
  const edits = new Map();
  const busy = new Set();
  const cache = new WeakMap();
  const dismissed = new Set();

  async function agentFor(id) {
    if (typeof id !== 'string' || !id) fail('缺少会话。', 400);
    const resolved = await ctx.sessionController.resolveAgent(id);
    if (resolved.error) fail(resolved.error.message);
    const agent = resolved.agent;
    if (!ctx.agents.roots().includes(agent)) fail('请在主会话中修改最新消息。');
    return agent;
  }

  async function snapshot(agent) {
    const session = agent.session;
    const seq = session.seq;
    let entry = cache.get(session);
    if (!entry || entry.seq !== seq) {
      entry = { seq, pending: ctx.sessionQuery.readSession(agent.id) };
      cache.set(session, entry);
    }
    let read;
    try { read = await entry.pending; }
    catch (error) { cache.delete(session); throw error; }
    // Do not combine a stale log with a newer surface.
    if (session.seq !== seq) return snapshot(agent);
    const nodes = [...session.surface.nodes];
    const inbox = inboxState(read.events, read.inheritedEventCount);
    return { ...read, nodes, seq, inbox, claims: inbox.claimed, ...inspectHistory(read.events, nodes) };
  }

  function pendingHuman(agent) {
    return [...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(item => item.source.kind === 'user');
  }

  function checkTarget(agent, state, id) {
    if (state.seq !== agent.session.seq || !state.target || state.target.id !== id
      || pendingHuman(agent) || state.claims.some(claim => claim !== id)) {
      fail('最新消息已变化，请回到对话重新选择。');
    }
  }

  function editView(edit) {
    if (!edit || edit.result) return null;
    return { token: edit.token, targetId: edit.targetId, text: edit.text, mode: edit.mode };
  }

  const recoverable = (intent, idle) => intent && idle && !intent.admitted && !intent.pending && !intent.claimed && !intent.canceled;

  function recoveryView(inbox, idle) {
    const intent = [...inbox.intents.values()].at(-1);
    if (!recoverable(intent, idle) || dismissed.has(intent.meta.token)) return null;
    return { token: intent.meta.token, targetId: intent.meta.targetId, text: intent.text, mode: intent.meta.mode,
      recovery: '修改未进入模型请求，文字已保留，可载入后重试。' };
  }

  function accepted(data, edit, intent) {
    if (data.text !== intent.text) fail('这次修改已发送，请在最新消息上重新开始修改。');
    return edit?.result?.id === intent.input.id ? edit.result
      : { accepted: true, id: intent.input.id, mode: intent.meta.mode };
  }

  async function state(id) {
    const agent = ctx.agents.roots().find(item => item.id === id);
    if (!agent) {
      // Browsing old conversations is read-only. Resume with DSH's own preset
      // policy only when the user actually clicks Edit.
      const read = await ctx.sessionQuery.readSession(id);
      const surface = await ctx.sessionQuery.readSurface(id);
      if (ctx.agents.roots().some(item => item.id === id)) return state(id);
      const view = inspectHistory(read.events, surface.events.map(event => event.seq));
      const inbox = inboxState(read.events, read.inheritedEventCount);
      const aligned = read.events.at(-1)?.seq === surface.capturedThroughSeq;
      return { ...view, target: aligned && view.target && !inbox.claimed.length
        && !inbox.pending.some(item => item.source.kind === 'user')
        ? { ...view.target, running: false } : null, editing: aligned ? recoveryView(inbox, true) : null };
    }
    const view = await snapshot(agent);
    const edit = edits.get(id);
    const provisional = edit && !edit.result && edit.mode === 'withdraw' && view.target?.id === edit.targetId;
    return {
      target: view.target && !pendingHuman(agent) && !view.claims.length ? { ...view.target, running: agent.status === 'running' } : null,
      hidden: provisional ? [...view.hidden, edit.hiddenRange] : view.hidden,
      edits: view.edits, editing: editView(edit) ?? recoveryView(view.inbox, agent.status === 'idle'),
    };
  }

  async function begin(data) {
    const agent = await agentFor(data.sessionId);
    const previous = edits.get(agent.id);
    const before = await snapshot(agent);
    checkTarget(agent, before, data.targetId);
    if (previous && !previous.result && previous.targetId === data.targetId && agent.status === 'idle') return editView(previous);
    agent.cancel({ kind: 'user' }, { keepInbox: true });
    await agent.whenIdle();
    const stopped = await snapshot(agent);
    checkTarget(agent, stopped, data.targetId);
    const edit = { token: randomUUID(), targetId: data.targetId, text: stopped.target.text, mode: stopped.target.mode,
      hiddenRange: { startSeq: stopped.target.seq, endSeq: stopped.seq - 1 } };
    edits.set(agent.id, edit);
    return editView(edit);
  }

  async function commit(data) {
    const agent = await agentFor(data.sessionId);
    let edit = edits.get(agent.id);
    if (edit?.token !== data.token) edit = undefined;
    const before = await snapshot(agent);
    const previous = before.inbox.intents.get(data.token);
    if (!edit && !previous) fail('修改状态已失效。文字仍在输入框中，请重新选择最新消息。');
    if (previous?.canceled) fail('这条修改已取消，请重新开始修改。');
    if (previous && !recoverable(previous, agent.status === 'idle')) return accepted(data, edit, previous);
    if (typeof data.text !== 'string' || !data.text.trim()) fail('请输入修改后的消息。', 400);
    if (agent.status !== 'idle') fail('会话又开始运行了，请先停止后重新修改。');
    if (typeof agent.runMaintenance !== 'function') fail('当前 DSH 版本不支持此编辑流程。');

    return agent.runMaintenance(async signal => {
      const view = await snapshot(agent);
      signal.throwIfAborted();
      const retry = view.inbox.intents.get(data.token);
      if (retry?.canceled) fail('这条修改已取消，请重新开始修改。');
      if (retry && !recoverable(retry, true)) return accepted(data, edit, retry);
      if (retry) {
        if (view.seq !== agent.session.seq || pendingHuman(agent) || view.claims.length
          || view.inbox.latestUser?.data.id !== retry.meta.targetId) {
          fail('最新消息已变化，不能重试这次修改。文字仍已保留。');
        }
      } else checkTarget(agent, view, edit.targetId);
      const target = retry ? view.inbox.latestUser : view.events.find(event => event.seq === view.target.seq);
      const meta = retry?.meta ?? { token: edit.token, targetId: edit.targetId, mode: view.target.mode };
      if (!retry && meta.mode === 'withdraw') meta.hiddenRange = { startSeq: target.seq, endSeq: view.seq - 1 };
      const input = message('user', editedContent(retry?.input.content ?? target.data.content, data.text),
        { kind: 'user', latestMessageEdit: meta });
      // All log and inbox changes below are synchronous. Maintenance holds off
      // model work; flush persists them together before the edited turn wakes.
      // User-role context records support idle surface replacement. Developer
      // records require an open step and must not be appended in maintenance.
      if (!retry && meta.mode === 'withdraw') {
        for (const nodes of withdrawalRanges(view.events, view.nodes, target.seq)) {
          agent.session.append('user/message', message('user', [{ type: 'text',
            text: '此前这段请求或回复已撤回，请以接下来的更正请求为准。' }],
          { kind: SOURCE, latestMessageEdit: meta }), {
            surfaceOp: { op: 'replace', startSeq: nodes[0], endSeq: nodes.at(-1) },
            sourceEventSeqs: nodes,
          });
        }
      } else if (!retry) {
        agent.session.append('user/message', message('user', [{ type: 'text', text:
            '用户正在更正本轮请求，紧接着的用户消息是最新要求。此前的工具调用、结果和已执行操作仍然有效；结合它们继续处理，不要假定此前什么都没有发生。' }],
          { kind: SOURCE, latestMessageEdit: meta }), { surfaceOp: 'append' });
      }
      // Maintenance defers the wake until this callback settles.
      agent.followup(input);
      // Remember admission before awaiting I/O so a lost response never sends twice.
      edit ??= { token: meta.token, targetId: meta.targetId, mode: meta.mode };
      edit.submittedText = data.text;
      edit.result = { accepted: true, id: input.id, mode: meta.mode };
      edits.set(agent.id, edit);
      dismissed.delete(meta.token);
      try { await ctx.sessions.flush(agent.session); }
      catch (error) {
        // The append-only log already changed. Do not claim rollback or repeat it.
        edit.result.warning = `修改已发送，但会话保存失败：${error.message}。请检查会话保存状态，不要重复发送。`;
      }
      return edit.result;
    });
  }

  function route(path, methods, handler) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: `${API}/${path}`, methods, requestBody: 'buffered',
      async fetch(request) {
        let id;
        let locked = false;
        try {
          const data = request.method === 'GET'
            ? { sessionId: new URL(request.url).searchParams.get('sessionId') }
            : await request.json();
          id = data?.sessionId;
          if (request.method !== 'GET') {
            if (busy.has(id)) fail('正在处理这条消息，请稍候。');
            busy.add(id); locked = true;
          }
          return Response.json(await handler(data));
        } catch (error) {
          return Response.json({ error: error.message }, { status: error.status ?? 500 });
        } finally { if (locked) busy.delete(id); }
      },
    }));
  }
  route('state', ['GET'], data => state(data.sessionId));
  route('begin', ['POST'], begin);
  route('commit', ['POST'], commit);
  route('cancel', ['POST'], data => {
    const edit = edits.get(data.sessionId);
    if (typeof data.token === 'string') dismissed.add(data.token);
    if (edit?.token === data.token) edits.delete(data.sessionId);
    return { accepted: true };
  });
  ctx.effect(() => () => { edits.clear(); busy.clear(); dismissed.clear(); });
}
