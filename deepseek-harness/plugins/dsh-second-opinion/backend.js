import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CandidateStore } from './store.js';
import { forkBoundary, opinionResult, hasClosedReply } from './history.js';
import { composePrompt, DEFAULT_PROMPT } from './prompt.js';

const API = '/api/local-second-opinion';
const active = item => ['queued', 'running'].includes(item.status);
const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };

export async function startBackend(ctx, config, adapter) {
  const store = new CandidateStore(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'second-opinion', 'candidates.json'));
  await store.load();
  const jobs = new Map(), locks = new Set();
  let disposed = false;
  const defaultPrompt = () => config?.defaultPrompt?.get() ?? DEFAULT_PROMPT;
  const warn = error => ctx.logger.warn(`第二意见：${error.message}`);
  function requireId(value) {
    if (typeof value !== 'string' || !value.trim()) fail('缺少会话或消息标识。', 400);
    return value;
  }
  function publicItem(item) {
    const { meta, selection, sourceHeader, continuationId, inheritedEventCount, baseCount, draft, hasReply, streamRevision, ...visible } = item;
    return { ...visible, canContinue: !active(item) && !jobs.has(item.id) && (!!item.childSessionId || !!hasReply) };
  }
  async function preview(item) {
    if (!item.draft && item.childSessionId) {
      try {
        const read = await ctx.sessionQuery.readSession(item.childSessionId);
        item.resultThroughSeq ??= read.events.at(-1)?.seq ?? item.childStartSeq;
        return { ...publicItem(item), text: opinionResult(read.events.filter(event => event.seq <= item.resultThroughSeq), item.childStartSeq).text };
      } catch { return { ...publicItem(item), error: item.error || '分支暂时无法读取，可能已被删除。' }; }
    }
    return publicItem(item);
  }
  for (const item of store.items) if (!item.draft && item.childSessionId && item.resultThroughSeq === undefined) await preview(item);
  await store.save();

  async function run(item, prepared) {
    const { agent } = prepared;
    const disposers = [];
    let timer;
    const checkpoint = () => store.saveDraft(item, agent.session.snapshotEvents());
    const scheduleSave = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = undefined; void checkpoint().catch(warn); }, 500);
    };
    try {
      prepared.bindCheckpoint?.(async () => {
        await checkpoint();
        await store.save();
      });
      const tools = agent.ctx.get('tools');
      if (!tools) throw new Error('当前会话缺少工具范围服务，无法建立仅意见模式。');
      disposers.push(tools.restrict({ allow: [] }));
      disposers.push(tools.guard(() => '第二意见预览仅生成文字，不执行工具。'));
      let admitted = false;
      disposers.push(agent.ctx.on('agent/pre-step', async (_event, next) => {
        if (admitted) return { kind: 'reject' };
        const decision = await next();
        if (decision.kind !== 'reject') admitted = true;
        return decision;
      }, { prepend: true }));
      disposers.push(agent.ctx.on('agent/assistant-stream', ({ frame }) => {
        item.streamRevision = frame.revision ?? (item.streamRevision ?? 0) + 1;
        if (frame.type === 'start') item.text = '';
        if (frame.type === 'chunk' && frame.chunk.type === 'text-delta') item.text += frame.chunk.text;
        scheduleSave();
      }));
      if (disposed || item.status === 'cancelled') return;
      item.status = 'running'; await store.save();
      if (disposed || item.status === 'cancelled') return;
      agent.followup({ id: randomUUID(), role: 'user', content: [{ type: 'text', text: item.promptText }],
        source: { kind: 'user', secondOpinion: { id: item.id, parentSessionId: item.sessionId, anchorMessageId: item.anchorMessageId } } });
      await agent.whenIdle();
      const result = opinionResult(agent.session.snapshotEvents(), item.childStartSeq);
      item.text = result.text || item.text;
      if (item.status !== 'cancelled') {
        item.status = disposed ? 'interrupted' : result.cancelled ? 'cancelled' : result.failed ? 'error' : 'completed';
        if (result.failed && item.status === 'error') item.error = result.error || '本次回复未完整完成，已保留收到的内容。';
      }
    } catch (error) {
      if (item.status !== 'cancelled') { item.status = disposed ? 'interrupted' : 'error'; item.error = error.message; }
    } finally {
      clearTimeout(timer);
      item.resultThroughSeq = agent.session.seq - 1;
      item.hasReply = hasClosedReply(agent.session.snapshotEvents(), item.childStartSeq);
      while (disposers.length) disposers.pop()();
      try { await checkpoint(); }
      finally { await prepared.dispose(); }
      await store.save();
    }
  }

  async function invite(data) {
    requireId(data.anchorMessageId); requireId(data.requestId); requireId(data.provider); requireId(data.model);
    const existing = store.items.find(item => item.sessionId === data.sessionId && item.id === data.requestId);
    if (existing) return preview(existing);
    if (store.items.some(item => item.sessionId === data.sessionId && (active(item) || jobs.has(item.id)))) fail('请等待当前意见完成，或先停止它。');
    const instruction = typeof data.instruction === 'string' ? data.instruction.trim() : '';
    const promptText = composePrompt(defaultPrompt(), instruction);
    if (!promptText) fail('请填写本次提问，或在设置中填写默认提示词。', 400);
    const source = await ctx.sessionQuery.readSession(data.sessionId);
    const item = { id: data.requestId, sessionId: data.sessionId, anchorMessageId: data.anchorMessageId,
      atSeq: forkBoundary(source.events, data.anchorMessageId), provider: data.provider, model: data.model,
      instruction, promptText, text: '', createdAt: new Date().toISOString(), status: 'queued' };
    const prepared = await adapter.prepare(item, source);
    store.items.push(item);
    try { await store.saveDraft(item, prepared.agent.session.snapshotEvents(), true); await store.save(); }
    catch (error) { store.items.splice(store.items.indexOf(item), 1); await prepared.dispose(); throw error; }
    const job = Promise.resolve().then(() => run(item, prepared)).catch(warn).finally(() => jobs.delete(item.id));
    jobs.set(item.id, { agent: prepared.agent, job });
    return publicItem(item);
  }
  async function continueChat(data) {
    const item = store.items.find(item => item.id === data.id && item.sessionId === data.sessionId);
    if (!item) fail('意见不存在。', 404);
    if (active(item) || jobs.has(item.id)) fail('请等待回复结束，或先停止生成。');
    if (item.childSessionId) return { sessionId: item.childSessionId };
    if (!publicItem(item).canContinue) fail('还没有可继续的回复。');
    item.continuationId ??= `session-${randomUUID()}`;
    await store.save();
    const sessionId = await adapter.promote(item, await store.readDraft(item));
    item.childSessionId = sessionId;
    await store.save();
    return { sessionId };
  }
  function route(path, method, handler) {
    ctx.effect(() => ctx.connection.fetch.register({ path: `${API}/${path}`, methods: [method], requestBody: 'buffered',
      async fetch(request) {
        let lock;
        try {
          if (disposed) fail('插件正在停止，请稍后重试。');
          const data = method === 'GET' ? { sessionId: new URL(request.url).searchParams.get('sessionId') } : await request.json();
          requireId(data.sessionId);
          if (path === 'invite' || path === 'continue') {
            const key = path === 'invite' ? `invite:${data.sessionId}` : `continue:${data.sessionId}:${requireId(data.id)}`;
            if (locks.has(key)) fail('正在处理，请稍候。');
            locks.add(key); lock = key;
          }
          return Response.json(await handler(data));
        } catch (error) { return Response.json({ error: error.message }, { status: error.status ?? 500 }); }
        finally { if (lock) locks.delete(lock); }
      }
    }));
  }
  route('state', 'GET', async data => ({ defaultPrompt: defaultPrompt(),
    candidates: await Promise.all(store.items.filter(item => item.sessionId === data.sessionId).map(preview)) }));
  route('invite', 'POST', invite);
  route('continue', 'POST', continueChat);
  route('cancel', 'POST', async data => {
    const item = store.items.find(item => item.id === data.id && item.sessionId === data.sessionId);
    if (!item) fail('意见不存在。', 404);
    if (active(item)) { item.status = 'cancelled'; jobs.get(item.id)?.agent.cancel({ kind: 'user' }); await store.save(); }
    return publicItem(item);
  });
  ctx.effect(() => async () => {
    disposed = true;
    for (const { agent } of jobs.values()) agent.cancel({ kind: 'disposed' });
    await Promise.all([...jobs.values()].map(({ job }) => job));
  });
}
