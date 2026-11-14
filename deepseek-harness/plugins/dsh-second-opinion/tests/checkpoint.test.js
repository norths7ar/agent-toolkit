import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdapter } from '../adapter.js';

function fixture() {
  const cleanups = [];
  const normal = { id: 'normal' };
  let normalFlushes = 0;
  let accessors = 0;
  class Session {
    static create(id) { return Object.assign(new Session(), { id, seq: 1, inheritedEventCount: 0 }); }
    deriveMessages() { return []; }
  }
  class Driver {
    constructor(loopCtx, id, _options, session) {
      Object.assign(this, { loopCtx, id, session, ctx: loopCtx });
      this.model = { select() {} };
      this.scope = { async dispose() {} };
    }
    runMaintenance(fn) { return fn(); }
    cancel() {}
    async whenIdle() {}
  }
  const sessions = {
    messageProjections: [],
    async flush(session) {
      assert.equal(this, sessions);
      if (session !== normal) throw new Error('not live in this store');
      normalFlushes++;
      return true;
    },
  };
  const ctx = {
    sessions,
    fiber: { assertActive() {} },
    effect(create) {
      let cleanup = create();
      return async () => { const callback = cleanup; cleanup = undefined; await callback?.(); };
    },
    accessor(name, { get }) {
      assert.equal(name, 'sessions.flush');
      accessors++;
      const descriptor = Object.getOwnPropertyDescriptor(sessions, 'flush');
      Object.defineProperty(sessions, 'flush', { configurable: true, get: () => get(sessions) });
      const dispose = () => Object.defineProperty(sessions, 'flush', descriptor);
      cleanups.push(dispose);
      return dispose;
    },
    llm: { resolveCallConfig: async value => value, resolveModelInfo: async () => ({ inputModalities: ['text'] }) },
    sessionController: {
      agents: { presetForSession() {}, composeAgent: async () => ({ setup() {} }) },
      commands: { forkWorkspace() {} },
    },
  };
  const source = new Driver(ctx, 'parent', {}, new Session());
  ctx.agents = { get: () => source, turnBoundaryOf: () => ({ lastTurn: 0 }) };
  ctx.agentLoop = { runtime: { ctx }, modelProjectionHandle: { readerFor: () => () => ({}) }, inboxProjectionHandle: { readerFor: () => () => ({}) } };
  const adapter = createAdapter(ctx);
  return { ctx, normal, cleanups, counts: () => ({ normalFlushes, accessors }),
    prepare: () => adapter.prepare({ atSeq: -1, sessionId: 'parent', provider: 'offline', model: 'B' },
      { session: { id: 'parent' }, events: [] }) };
}

test('checkpoint routing is session-specific and leaves normal flushes intact', async () => {
  const host = fixture();
  const first = await host.prepare(), second = await host.prepare();
  let firstSaves = 0, secondSaves = 0;
  first.bindCheckpoint(async () => { firstSaves++; });
  second.bindCheckpoint(async () => { secondSaves++; });
  try {
    assert.equal(await host.ctx.sessions.flush(first.agent.session), true);
    assert.equal(await host.ctx.sessions.flush(second.agent.session), true);
    assert.equal(await host.ctx.sessions.flush(host.normal), true);
    assert.deepEqual([firstSaves, secondSaves], [1, 1]);
    assert.deepEqual(host.counts(), { normalFlushes: 1, accessors: 1 });
    await first.dispose();
    await assert.rejects(host.ctx.sessions.flush(first.agent.session), /not live/);
    await host.ctx.sessions.flush(second.agent.session);
    assert.equal(secondSaves, 2);
    await second.dispose();
    await assert.rejects(host.ctx.sessions.flush(second.agent.session), /not live/);
  } finally { for (const cleanup of host.cleanups.reverse()) cleanup(); }
  assert.equal(await host.ctx.sessions.flush(host.normal), true);
});

test('a failed opinion checkpoint rejects before downstream model dispatch', async () => {
  const host = fixture(), prepared = await host.prepare();
  prepared.bindCheckpoint(async () => { throw new Error('snapshot write failed'); });
  let dispatched = false;
  try {
    await assert.rejects((async () => {
      await host.ctx.sessions.flush(prepared.agent.session);
      dispatched = true;
    })(), /snapshot write failed/);
    assert.equal(dispatched, false);
  } finally {
    await prepared.dispose();
    for (const cleanup of host.cleanups.reverse()) cleanup();
  }
});
