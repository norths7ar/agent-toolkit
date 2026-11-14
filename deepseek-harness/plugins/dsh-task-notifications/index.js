import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";

export const name = "task-notifications";
export const inject = ["sessions", "agents", "sessionTitle", "connection"];
export const Config = z.object({
  systemNotification: z.boolean().default(true).volatile(),
  taskbarFlash: z.boolean().default(true).volatile(),
  completed: z.boolean().default(true).volatile(),
  failed: z.boolean().default(true).volatile(),
  approval: z.boolean().default(true).volatile(),
  question: z.boolean().default(true).volatile(),
});

const API = "/api/local-task-notifications";
const helperPath = fileURLToPath(new URL("./flash-taskbar.ps1", import.meta.url));
const compact = (text, limit) =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);

export function apply(ctx, config) {
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
  const lifetime = new AbortController();
  const waiters = new Set();
  const pending = new Map();
  const instance = randomUUID();
  let sequence = 0;
  let flashInFlight;

  function publish(kind, session, detail = "") {
    if (!config[kind].get() || lifetime.signal.aborted) return;
    const event = {
      id: `${instance}:${++sequence}`,
      kind,
      sessionId: session?.id,
      title: compact(session && ctx.sessionTitle.get(session)?.title, 100) || "DSH 会话",
      detail: compact(detail, 160),
    };
    pending.set(event.id, { event, sequence, claimed: false, flashed: false });
    // Only a short-lived delivery ledger, never a copy of chat history.
    if (pending.size > 256) pending.delete(pending.keys().next().value);
    for (const finish of [...waiters]) finish();
    return event.id;
  }

  ctx.on(
    "session/event",
    (session, event) => {
      if (event.type !== "turn/end") return;
      // Only the exact registered session can produce a new task result. A
      // detached preview or a replayed seed is not a user-facing completion.
      const agent = ctx.agents.get(session.id);
      if (!agent || agent.session !== session) return;
      const subagents = ctx.get("subagents");
      if (subagents) {
        try {
          if (subagents.rootOf(agent) !== agent) return;
        } catch (error) {
          // Delegated sessions without a live owner are not independent roots.
          if (error.code === "UNAUTHORIZED") return;
          throw error;
        }
      }
      const reason = event.data.reason;
      if (reason.kind === "completed") publish("completed", session);
      else if (reason.kind === "error") publish("failed", session, reason.error.message);
    },
    { global: true },
  );

  async function observeRequest(kind, request, next) {
    if (request.signal?.aborted) return next();
    const session = request.agent?.session;
    let id;
    try {
      id = publish(kind, session);
    } catch (error) {
      console.warn("[task-notifications] Could not publish reminder:", error.message);
    }
    // This observer never answers or delays the human-interaction waterfall.
    // An answered/cancelled request cannot be claimed later by a slow client.
    let continued = false;
    try {
      return await next();
    } catch (error) {
      continued = kind === "question" && request.wait?.timed && error?.code === "ASK_TIMED_OUT";
      const entry = pending.get(id);
      if (continued && entry) {
        entry.stillPending = () =>
          ctx
            .get("sessionProjections")
            ?.stateOf(session, "userQuestions")
            ?.questions.active.some((question) => question.callId === request.wait.callId) === true;
      }
      throw error;
    } finally {
      if (id && !continued) pending.delete(id);
    }
  }
  ctx.on("approval/request", (request, next) => observeRequest("approval", request, next), {
    prepend: true,
    global: true,
  });
  ctx.on("user-questions/request", (request, next) => observeRequest("question", request, next), {
    prepend: true,
    global: true,
  });

  async function events(request) {
    const cursor = new URL(request.url).searchParams.get("cursor");
    const prefix = `${instance}:`;
    const after = cursor?.startsWith(prefix) ? Number(cursor.slice(prefix.length)) : NaN;
    const continuing = Number.isSafeInteger(after) && after >= 0 && after <= sequence;
    const collect = () =>
      continuing
        ? [...pending.values()]
            .filter((entry) => entry.sequence > after)
            .map((entry) => entry.event)
        : [];
    // A fresh page or a restarted Host begins live-only. During normal request
    // rotation, the cursor retains events arriving between two HTTP requests.
    if (
      continuing &&
      collect().length === 0 &&
      !request.signal.aborted &&
      !lifetime.signal.aborted
    ) {
      await new Promise((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          waiters.delete(finish);
          request.signal.removeEventListener("abort", finish);
          resolve();
        };
        // Desktop update locks admission and drains HTTP requests. Every wait
        // ends well inside its 10-second deadline, even when no event arrives.
        const timer = setTimeout(finish, 3000);
        waiters.add(finish);
        request.signal.addEventListener("abort", finish, { once: true });
        if (request.signal.aborted) finish();
      });
    }
    return Response.json(
      { cursor: `${instance}:${sequence}`, events: collect() },
      {
        headers: { "cache-control": "no-store" },
      },
    );
  }

  function flash() {
    if (
      process.platform !== "win32" ||
      !/^DeepSeek Harness\.exe$/i.test(basename(process.execPath))
    ) {
      return Promise.resolve({ status: "unsupported" });
    }
    if (flashInFlight) return flashInFlight;
    // The desktop Host runs under the same Electron executable as its main window.
    // No shell interpolation, registry writes, shortcut setup or focus change.
    flashInFlight = new Promise((resolve, reject) => {
      execFile(
        "pwsh.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-WindowStyle",
          "Hidden",
          "-File",
          helperPath,
          "-ExecutablePath",
          process.execPath,
        ],
        { windowsHide: true, encoding: "utf8", signal: lifetime.signal, timeout: 15000 },
        (error, stdout) => {
          if (error) return reject(error);
          try {
            resolve(JSON.parse(stdout.trim()));
          } catch (parseError) {
            reject(parseError);
          }
        },
      );
    }).finally(() => {
      flashInFlight = undefined;
    });
    return flashInFlight;
  }

  function route(path, methods, fetch) {
    ctx.effect(() =>
      ctx.connection.fetch.register({
        path: `${API}/${path}`,
        methods,
        requestBody: "buffered",
        fetch,
      }),
    );
  }
  route("events", ["GET"], events);
  route("claim", ["POST"], async (request) => {
    let data;
    try {
      data = await request.json();
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    const entry = pending.get(data?.id);
    const accepted = Boolean(
      entry && !entry.claimed && config[entry.event.kind].get() && (entry.stillPending?.() ?? true),
    );
    if (accepted) entry.claimed = true;
    return Response.json({ accepted });
  });
  route("flash", ["POST"], async (request) => {
    let data;
    try {
      data = await request.json();
    } catch {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    if (!config.taskbarFlash.get()) return Response.json({ status: "disabled" });
    if (data?.test !== true) {
      const entry = pending.get(data?.id);
      if (!entry?.claimed || entry.flashed) return Response.json({ status: "skipped" });
      entry.flashed = true;
    }
    try {
      return Response.json(await flash());
    } catch (error) {
      if (!lifetime.signal.aborted)
        console.warn("[task-notifications] Taskbar flash failed:", error.message);
      return Response.json({ status: "error" }, { status: 500 });
    }
  });
  ctx.effect(() => () => {
    lifetime.abort();
    for (const finish of [...waiters]) finish();
    pending.clear();
  });
}
