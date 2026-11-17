import assert from "node:assert/strict";
import test from "node:test";
import { createController } from "../index.js";

function harness({
  declared = true,
  provider = "fixture",
  api = "openai-completions",
  baseURL = "https://example.com/v1",
  inherited = false,
  apiKeyEnv = "FIXTURE_KEY",
  credential = "secret-key",
} = {}) {
  let revision = 1;
  const original = {
    id: "a",
    name: "Mine",
    contextWindow: 100,
    maxTokens: 20,
    input: ["text"],
    compat: { retained: true },
  };
  let profile = { api, baseURL, apiKeyEnv, models: [original] };
  if (inherited)
    profile = {
      api,
      baseURL,
      apiKeyEnv: "FIXTURE_KEY",
      modelOverrides: { a: { name: "Personal", compat: { retained: true }, contextWindow: 80 } },
    };
  const requests = [];
  const writes = [];
  const ctx = {
    get: (name) =>
      name === "credentials" ? { resolve: async () => ({ value: credential }) } : undefined,
    settings: {
      describe: () => [
        { ns: "llm-pi-ai", revision, value: { providers: { [provider]: profile } } },
      ],
      mutate: async (ns, ops, expectedRevision) => {
        assert.equal(expectedRevision, revision);
        writes.push({ ns, ops, expectedRevision });
        for (const op of ops) profile = { ...profile, [op.path.at(-1)]: op.value };
        revision++;
      },
    },
    llm: {
      listConfigurableProviders: () => [
        {
          provider,
          displayName: "Fixture",
          settingsNs: "llm-pi-ai",
          settingsPath: ["providers", provider],
          declared,
          defaultBaseURL: baseURL,
          nativeAuth: { env: ["OPENCODE_API_KEY"] },
        },
      ],
      discoverModels: async () =>
        inherited
          ? [
              {
                id: "a",
                name: "Default",
                contextWindow: 100,
                maxTokens: 20,
                inputModalities: ["text"],
              },
            ]
          : [],
    },
  };
  const controller = createController(ctx, async (url, options) => {
    requests.push({ url, options });
    return Response.json({
      data: [
        { id: "a", name: "Remote", context_window: 200, max_output_tokens: 30 },
        { id: "new", context_window: 500, max_output_tokens: 100, input: ["text"] },
      ],
    });
  });
  return { controller, requests, writes, conflict: () => revision++, profile: () => profile };
}

test("provider listing does not query endpoints and never exposes credentials", () => {
  const app = harness();
  const view = app.controller.providers();
  assert.equal(app.requests.length, 0);
  assert.equal(view.providers[0].supported, true);
  assert.ok(!JSON.stringify(view).includes("secret-key"));
  assert.ok(!JSON.stringify(view).includes("FIXTURE_KEY"));
});

test("explicit preview fetches catalog with stored credentials, apply only changes reviewed fields", async () => {
  const app = harness();
  const review = await app.controller.preview({ provider: "fixture" });
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].url, "https://example.com/v1/models");
  assert.equal(app.requests[0].options.method, "GET");
  assert.equal(app.requests[0].options.headers.get("authorization"), "Bearer secret-key");
  assert.ok(!JSON.stringify(review).includes("secret-key"));
  assert.equal(app.writes.length, 0);
  await app.controller.apply({
    token: review.token,
    models: [{ ...review.rows[0].proposed, contextWindow: 200 }],
  });
  assert.deepEqual(app.writes[0].ops[0].path, ["providers", "fixture", "models"]);
  assert.deepEqual(app.profile().models[0].compat, { retained: true });
  assert.equal(app.profile().models[0].name, "Mine");
  assert.equal(app.profile().models[0].contextWindow, 200);
  assert.equal(app.requests.length, 1);
});

test("concurrent configuration change blocks apply", async () => {
  const app = harness();
  const review = await app.controller.preview({ provider: "fixture" });
  app.conflict();
  await assert.rejects(
    app.controller.apply({ token: review.token, models: [review.rows[0].proposed] }),
    { code: "CONFIG_CONFLICT" },
  );
  assert.equal(app.writes.length, 0);
});

test("save returns a renewed review with saved values and remaining remote differences", async () => {
  const app = harness();
  const first = await app.controller.preview({ provider: "fixture" });
  const { preview } = await app.controller.apply({
    token: first.token,
    models: [{ ...first.rows[0].proposed, contextWindow: 200 }],
  });
  assert.notEqual(preview.token, first.token);
  assert.equal(preview.fetchedAt, first.fetchedAt);
  assert.equal(preview.rows[0].current.contextWindow, 200);
  assert.ok(!preview.rows[0].changedFields.includes("contextWindow"));
  assert.ok(preview.rows[0].changedFields.includes("maxTokens"));
  await assert.rejects(app.controller.apply({ token: first.token, models: [] }), {
    code: "REVIEW_EXPIRED",
  });
  await app.controller.apply({
    token: preview.token,
    models: [{ ...preview.rows[0].proposed, maxTokens: 30 }],
  });
  assert.equal(app.profile().models[0].maxTokens, 30);
  assert.equal(app.requests.length, 1);
});

test("confirmed removal can be combined with addition without another catalog request", async () => {
  const app = harness();
  const review = await app.controller.preview({ provider: "fixture" });
  const result = await app.controller.apply({
    token: review.token,
    models: [review.rows[1].proposed],
    remove: [review.rows[0].id],
  });
  assert.equal(result.removed, 1);
  assert.equal(app.profile().models.length, 1);
  assert.equal(app.profile().models[0].id, review.rows[1].id);
  assert.equal(app.requests.length, 1);
});

test("OpenCode catalog uses the configured credential", async () => {
  const app = harness({ provider: "opencode", baseURL: "https://opencode.ai/zen/v1" });
  await app.controller.preview({ provider: "opencode" });
  assert.equal(app.requests[0].url, "https://opencode.ai/inference/v1/models");
  assert.equal(app.requests[0].options.headers.get("authorization"), "Bearer secret-key");
});

test("a fresh preview invalidates previous review and save does not auto-fetch", async () => {
  const app = harness();
  const first = await app.controller.preview({ provider: "fixture" });
  const second = await app.controller.preview({ provider: "fixture" });
  await assert.rejects(
    app.controller.apply({ token: first.token, models: [first.rows[0].proposed] }),
    { code: "REVIEW_EXPIRED" },
  );
  await app.controller.apply({ token: second.token, models: [second.rows[1].proposed] });
  assert.equal(app.requests.length, 2);
  assert.equal(app.profile().models.length, 2);
});

test("materializing inherited catalogs preserves modelOverrides and clears the mutually exclusive dictionary", async () => {
  const app = harness({ declared: false, inherited: true });
  const review = await app.controller.preview({ provider: "fixture" });
  assert.equal(review.rows[0].current.name, "Personal");
  assert.equal(review.rows[0].current.contextWindow, 80);
  await app.controller.apply({ token: review.token, models: [review.rows[1].proposed] });
  assert.equal(app.profile().models[0].name, "Personal");
  assert.equal(app.profile().models[0].contextWindow, 80);
  assert.deepEqual(app.profile().models[0].compat, { retained: true });
  assert.deepEqual(app.profile().modelOverrides, {});
  assert.equal(app.writes[0].ops.length, 2);
});

test("Zen uses its native credential reference and never falls back to anonymous listing", async () => {
  const app = harness({ provider: "opencode", baseURL: "https://opencode.ai", apiKeyEnv: null });
  await app.controller.preview({ provider: "opencode" });
  assert.equal(app.requests[0].options.headers.get("authorization"), "Bearer secret-key");
  const missing = harness({
    provider: "opencode",
    baseURL: "https://opencode.ai",
    apiKeyEnv: null,
    credential: null,
  });
  await assert.rejects(missing.controller.preview({ provider: "opencode" }), {
    code: "CREDENTIAL_UNAVAILABLE",
  });
  assert.equal(missing.requests.length, 0);
});
