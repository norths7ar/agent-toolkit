import assert from "node:assert/strict";
import test from "node:test";
import {
  compareCatalog,
  fetchCatalog,
  listingTarget,
  mergeModels,
  parseCatalog,
} from "../catalog.js";

test("native Zen requires authentication while custom addresses stay custom", () => {
  assert.equal(
    listingTarget({ provider: "opencode" }, {}).endpoint,
    "https://opencode.ai/inference/v1/models",
  );
  assert.equal(
    listingTarget(
      { provider: "opencode" },
      { baseURL: "https://proxy.example/v1", api: "openai-completions" },
    ).endpoint,
    "https://proxy.example/v1/models",
  );
});

test("configured order wins, then natural versions and alias before dated snapshots", () => {
  const ids = ["gpt-5", "gpt-5.2-2026-01-01", "gpt-5.10", "gpt-5.2", "tts-1", "gpt-4", "missing"];
  const remote = parseCatalog({ data: ids.slice(0, -1).map((id) => ({ id })) });
  const rows = compareCatalog([{ id: "missing" }, { id: "gpt-4" }], remote, [], true);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["missing", "gpt-4", "gpt-5.10", "gpt-5.2", "gpt-5.2-2026-01-01", "gpt-5", "tts-1"],
  );
});

test("OpenAI non-chat IDs are classified without type and catalog dates are retained", () => {
  const ids = [
    "gpt-audio",
    "gpt-4o-mini-tts",
    "gpt-4o-transcribe",
    "gpt-realtime",
    "whisper-1",
    "gpt-image-1",
    "dall-e-3",
    "text-embedding-3-large",
    "omni-moderation-latest",
  ];
  const rows = parseCatalog({
    data: ids.map((id) => ({
      id,
      created: 123,
      shutdown_date: "2026-12-11",
      release_date: "2026-01-01",
      family: "fixture",
    })),
  });
  assert.ok(rows.every((row) => row.kind === "unsupported"));
  assert.equal(rows[0].created, 123);
  assert.equal(rows[0].shutdown_date, "2026-12-11");
  assert.equal(rows[0].release_date, "2026-01-01");
  assert.equal(rows[0].family, "fixture");
});

test("MiMo speech models are displayed but cannot be selected", () => {
  const remote = parseCatalog({
    data: [{ id: "mimo-asr-v2" }, { id: "mimo-tts-v2" }, { id: "mimo-v2.6-pro" }],
  });
  const rows = compareCatalog([], remote, [], true);
  assert.equal(rows[0].kind, "chat");
  assert.equal(rows[1].category, "audio");
  assert.equal(rows[1].kind, "unsupported");
  assert.equal(rows[2].kind, "unsupported");
  assert.throws(() => mergeModels([], rows, [rows[1].proposed]), /不是对话模型/);
});

test("MiMo versioned ASR and TTS IDs match the live directory", () => {
  const ids = [
    "mimo-v2.5-asr",
    "mimo-v2.5-tts",
    "mimo-v2.5-tts-voiceclone",
    "mimo-v2.5-tts-voicedesign",
    "mimo-v2.6-flash",
    "mimo-v2.6-pro",
    "mimo-v2.6-pro-ultraspeed",
  ];
  const remote = parseCatalog({
    data: ids.map((id) => ({ id, object: "model", owned_by: "xiaomi" })),
  });
  assert.deepEqual(
    remote.map((model) => model.kind),
    ["unsupported", "unsupported", "unsupported", "unsupported", "chat", "chat", "chat"],
  );
  assert.equal(compareCatalog([{ id: ids[4] }], remote, [], true)[0].status, "configured");
});

test("ID-only configured models are not reported as verified unchanged", () => {
  const rows = compareCatalog([{ id: "a", contextWindow: 100 }], [{ id: "a" }], [], true);
  assert.equal(rows[0].status, "configured");
  assert.deepEqual(mergeModels([{ id: "a", compat: { keep: true } }], rows, [rows[0].proposed]), [
    { id: "a", compat: { keep: true } },
  ]);
});

test("only explicit original removals apply, including missing models", () => {
  const originals = [{ id: "old", compat: { keep: true } }, { id: "a" }];
  const rows = compareCatalog(originals, [{ id: "a" }], [], true);
  assert.deepEqual(mergeModels(originals, rows, [], ["old"]), [{ id: "a" }]);
  assert.deepEqual(mergeModels(originals, rows, []), originals);
  assert.throws(() => mergeModels(originals, rows, [], ["unknown"]), /待移除/);
  assert.throws(() => mergeModels(originals, rows, [{ id: "a" }], ["a"]), /不一致/);
  assert.throws(() => mergeModels(originals, rows, [], ["old", "a"]), /至少保留/);
});

test("normalizes disclosed metadata and retains unsupported models", () => {
  assert.deepEqual(
    parseCatalog({
      data: [
        { id: "voice", type: "tts" },
        {
          id: "new",
          type: "chat",
          name: "New",
          limit: { context: 1000000, output: 64000 },
          modalities: { input: ["text", "image/png", "audio/wav"] },
        },
        { id: "id-only" },
        { id: "new", name: "Duplicate" },
      ],
    }),
    [
      {
        id: "voice",
        kind: "unsupported",
        category: "audio",
        unsupportedReason: "此型号不是对话模型，不能加入聊天模型配置。",
      },
      {
        id: "new",
        kind: "chat",
        name: "New",
        contextWindow: 1000000,
        maxTokens: 64000,
        input: ["text", "image"],
      },
      { id: "id-only", kind: "chat" },
    ],
  );
});

test("reads Gemini listings without treating embedding models as chat", () => {
  assert.deepEqual(
    parseCatalog({
      models: [
        {
          name: "models/gemini",
          displayName: "Gemini",
          inputTokenLimit: 1000000,
          outputTokenLimit: 65000,
          supportedGenerationMethods: ["generateContent"],
        },
        { name: "models/embed", supportedGenerationMethods: ["embedContent"] },
      ],
    }),
    [
      { id: "gemini", name: "Gemini", contextWindow: 1000000, maxTokens: 65000, kind: "chat" },
      {
        id: "embed",
        kind: "unsupported",
        unsupportedReason: "此型号不是对话模型，不能加入聊天模型配置。",
      },
    ],
  );
});

test("preview retains user choices and represents missing models without deletion", () => {
  const current = [
    { id: "a", name: "Mine", contextWindow: 100, maxTokens: 50, input: ["text"] },
    { id: "old", name: "Old" },
  ];
  const rows = compareCatalog(
    current,
    [{ id: "a", name: "Remote", contextWindow: 200 }, { id: "new" }],
    [],
    true,
  );
  assert.equal(rows[0].status, "changed");
  assert.equal(rows[0].proposed.contextWindow, 100);
  assert.equal(rows[0].proposed.name, "Mine");
  assert.deepEqual(rows[0].changedFields, ["name", "contextWindow"]);
  assert.equal(rows[2].status, "new");
  assert.deepEqual(rows[2].missingFields, ["contextWindow", "maxTokens", "input"]);
  assert.equal(rows[1].status, "missing");
});

test("unknown mixed-protocol models remain blocked", () => {
  const rows = compareCatalog(
    [],
    [{ id: "new", contextWindow: 100, maxTokens: 20, input: ["text"] }],
    [],
    false,
  );
  assert.ok(rows[0].blockedReason);
  assert.throws(() => mergeModels([], rows, [rows[0].proposed]), /协议/);
});

test("saving selected fields preserves raw overrides, other models, and non-visible fields", () => {
  const originals = [
    { id: "a", name: "Mine", compat: { custom: true } },
    { id: "b", name: "Other" },
  ];
  const current = [
    { ...originals[0], contextWindow: 100, maxTokens: 20, input: ["text"] },
    originals[1],
  ];
  const rows = compareCatalog(current, [{ id: "a", contextWindow: 200 }], [], true);
  const next = mergeModels(originals, rows, [{ ...rows[0].proposed, contextWindow: 200 }]);
  assert.deepEqual(next, [
    { id: "a", name: "Mine", compat: { custom: true }, contextWindow: 200 },
    originals[1],
  ]);
  assert.equal(originals[0].contextWindow, undefined);
});

test("new entries require complete editable metadata and cannot smuggle protocol changes", () => {
  const rows = compareCatalog([], [{ id: "new" }], [], true);
  assert.throws(() => mergeModels([], rows, [{ id: "new" }]), /补齐/);
  const next = mergeModels([], rows, [
    {
      id: "new",
      contextWindow: 100,
      maxTokens: 10,
      input: ["text"],
      api: "anthropic-messages",
      headers: { Authorization: "secret" },
    },
  ]);
  assert.deepEqual(next, [{ id: "new", contextWindow: 100, maxTokens: 10, input: ["text"] }]);
});

test("listing endpoints are derived only from configured provider metadata", () => {
  assert.equal(
    listingTarget({ provider: "xiaomi", defaultBaseURL: "https://api.xiaomimimo.com/v1" }, {})
      .endpoint,
    "https://api.xiaomimimo.com/v1/models",
  );
  assert.equal(
    listingTarget(
      { provider: "custom" },
      { api: "anthropic-messages", baseURL: "https://example.com/anthropic" },
    ).endpoint,
    "https://example.com/anthropic/v1/models?limit=1000",
  );
  assert.equal(
    listingTarget({ provider: "opencode", defaultBaseURL: "https://opencode.ai/zen/v1" }, {})
      .requiresAuth,
    true,
  );
  assert.ok(
    listingTarget(
      { provider: "custom" },
      { baseURL: "https://user:password@example.com/v1", api: "openai-completions" },
    ).reason,
  );
});

test("catalog fetch uses GET only and marks partial replies", async () => {
  const calls = [];
  const result = await fetchCatalog(
    "https://example.com/v1/models",
    new Headers(),
    async (url, options) => {
      calls.push({ url, options });
      return Response.json({ data: [{ id: "a" }], has_more: true });
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(result.partial, true);
});
