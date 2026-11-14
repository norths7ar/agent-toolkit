import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { apply } from "../index.js";

function fixture() {
  const handlers = new Map();
  const routes = new Map();
  const agents = new Map();
  const cleanups = [];
  let rootOf = (agent) => agent;
  const ctx = {
    inject() {},
    effect(setup) {
      const dispose = setup();
      if (dispose) cleanups.push(dispose);
    },
    on(name, handler) {
      handlers.set(name, handler);
    },
    get(name) {
      return name === "subagents" ? { rootOf: (agent) => rootOf(agent) } : undefined;
    },
    agents: { get: (id) => agents.get(id) },
    sessionTitle: { get: () => ({ title: "Example" }) },
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route.fetch);
          return () => routes.delete(route.path);
        },
      },
    },
  };
  const config = Object.fromEntries(
    ["systemNotification", "taskbarFlash", "completed", "failed", "approval", "question"].map(
      (key) => [key, { get: () => true }],
    ),
  );
  apply(ctx, config);
  return {
    handlers,
    agents,
    rootResolver(resolve) {
      rootOf = resolve;
    },
    async call(action, data, { cursor, signal } = {}) {
      const query = cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`;
      return routes.get(`/api/local-task-notifications/${action}`)(
        new Request(
          `http://localhost/api/local-task-notifications/${action}${query}`,
          data === undefined ? { signal } : { method: "POST", body: JSON.stringify(data), signal },
        ),
      );
    },
    dispose() {
      for (const close of cleanups.reverse()) close();
    },
  };
}

test("only live runtime roots publish completion; forks remain roots", async () => {
  const f = fixture();
  try {
    const { cursor } = await (await f.call("events")).json();
    const rootSession = { id: "root", header: {} };
    const forkSession = { id: "fork", header: { parentSession: "root" } };
    const root = { id: "root", session: rootSession };
    const childSession = { id: "child", header: { origin: "subagent" } };
    const child = { id: "child", session: childSession };
    const orphanSession = { id: "orphan", header: { origin: "subagent" } };
    f.agents.set("root", root);
    f.agents.set("fork", { id: "fork", session: forkSession });
    f.agents.set("child", child);
    f.agents.set("orphan", { id: "orphan", session: orphanSession });
    f.rootResolver((agent) => {
      if (agent.id === "orphan")
        throw Object.assign(new Error("No owner"), { code: "UNAUTHORIZED" });
      return agent === child ? root : agent;
    });
    const ended = f.handlers.get("session/event");
    const event = { type: "turn/end", data: { reason: { kind: "completed" } } };
    ended(childSession, event);
    ended(orphanSession, event);
    ended({ id: "root", header: {} }, event);
    ended({ id: "preview", header: {} }, event);
    ended(forkSession, event);
    const { events } = await (await f.call("events", undefined, { cursor })).json();
    assert.equal(events.length, 1);
    const [result] = events;
    assert.equal(result.sessionId, "fork");
    assert.match(result.id, /:1$/);
    const firstClaim = await (await f.call("claim", { id: result.id })).json();
    const duplicateClaim = await (await f.call("claim", { id: result.id })).json();
    assert.deepEqual(firstClaim, { accepted: true });
    assert.deepEqual(duplicateClaim, { accepted: false });
  } finally {
    f.dispose();
  }
});

test("resolved human requests cannot be claimed after delivery", async () => {
  const f = fixture();
  try {
    const { cursor } = await (await f.call("events")).json();
    const observe = f.handlers.get("approval/request");
    const answered = Promise.withResolvers();
    const observation = observe({ agent: { session: { id: "root" } } }, () => answered.promise);
    const {
      events: [result],
    } = await (await f.call("events", undefined, { cursor })).json();
    answered.resolve("allowed");
    await observation;
    assert.deepEqual(await (await f.call("claim", { id: result.id })).json(), { accepted: false });
  } finally {
    f.dispose();
  }
});

test("fresh subscriptions skip old notifications; cursor rotation retains gap events", async () => {
  const f = fixture();
  try {
    const session = { id: "root" };
    f.agents.set(session.id, { id: session.id, session });
    const ended = f.handlers.get("session/event");
    const event = { type: "turn/end", data: { reason: { kind: "completed" } } };
    ended(session, event);
    const baseline = await (await f.call("events")).json();
    assert.deepEqual(baseline.events, []);
    ended(session, event);
    ended(session, event);
    const batch = await (await f.call("events", undefined, { cursor: baseline.cursor })).json();
    assert.equal(batch.events.length, 2);
    assert.match(batch.events[0].id, /:2$/);
    assert.match(batch.events[1].id, /:3$/);
    const reconnect = await (await f.call("events")).json();
    assert.deepEqual(reconnect.events, []);
    assert.equal(reconnect.cursor, batch.cursor);
    const replacedHost = await (
      await f.call("events", undefined, { cursor: "old-instance:1" })
    ).json();
    assert.deepEqual(replacedHost.events, []);
  } finally {
    f.dispose();
  }
});

test("idle event requests drain within three seconds for desktop update", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  try {
    const { cursor } = await (await f.call("events")).json();
    let drained = false;
    // Mirrors the updater's pending-request lifetime: request AND response
    // consumption must settle, not only return response headers.
    const pending = f
      .call("events", undefined, { cursor })
      .then((response) => response.json())
      .then((batch) => {
        drained = true;
        return batch;
      });
    t.mock.timers.tick(2999);
    await Promise.resolve();
    assert.equal(drained, false);
    t.mock.timers.tick(1);
    assert.deepEqual(await pending, { cursor, events: [] });
    assert.equal(drained, true);
  } finally {
    f.dispose();
  }
});

test("waiting requests return immediately on new events and close on abort or unload", async () => {
  const f = fixture();
  try {
    const { cursor } = await (await f.call("events")).json();
    const waiting = f.call("events", undefined, { cursor });
    const session = { id: "root" };
    f.agents.set(session.id, { id: session.id, session });
    f.handlers.get("session/event")(session, {
      type: "turn/end",
      data: { reason: { kind: "error", error: { message: "failed" } } },
    });
    const batch = await (await waiting).json();
    assert.equal(batch.events[0].kind, "failed");
    const aborted = new AbortController();
    const cancelWait = f.call("events", undefined, {
      cursor: batch.cursor,
      signal: aborted.signal,
    });
    aborted.abort();
    assert.deepEqual((await (await cancelWait).json()).events, []);
    const unloadWait = f.call("events", undefined, { cursor: batch.cursor });
    f.dispose();
    assert.deepEqual((await (await unloadWait).json()).events, []);
  } finally {
    f.dispose();
  }
});

test("client keeps connected state across bounded request rotation and aborts on disposal", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  const cleanups = [];
  const states = [];
  let client;
  let runtime;
  let requests = 0;
  let lastSignal;
  const source = readFileSync(new URL("../client.js", import.meta.url), "utf8");
  const context = {
    window: {
      __ModuleLoader__: {
        load(definition) {
          client = definition.factory(() => ({ createElement() {} }));
        },
      },
    },
    document: { createElement: () => ({ dataset: {}, remove() {} }), head: { append() {} } },
    __DSH_TRANSPORT__: {
      fetch(url, init) {
        requests++;
        lastSignal = init.signal;
        const cursor = new URL(url, "http://localhost/").searchParams.get("cursor") ?? undefined;
        return f.call("events", undefined, { cursor, signal: init.signal });
      },
    },
    AbortController,
    setTimeout,
    clearTimeout,
    console,
  };
  runInNewContext(source, context);
  try {
    client.apply({
      configForms: { get: () => ({ getSnapshot: () => ({ status: "ready", value: {} }) }) },
      effect(setup) {
        const cleanup = setup();
        if (cleanup) cleanups.push(cleanup);
      },
      slots: {
        inject(_name, setup) {
          setup();
        },
        register(options) {
          runtime = options.inject().runtime;
        },
      },
    });
    runtime.subscribe(() => states.push(runtime.getSnapshot().connected));
    await new Promise(setImmediate);
    assert.equal(runtime.getSnapshot().connected, true);
    assert.equal(requests, 2);
    t.mock.timers.tick(3000);
    await new Promise(setImmediate);
    assert.equal(requests, 3);
    assert.deepEqual(states, [true]);
    for (const cleanup of cleanups.reverse()) cleanup();
    assert.equal(lastSignal.aborted, true);
    await new Promise(setImmediate);
    assert.equal(requests, 3);
  } finally {
    f.dispose();
  }
});
