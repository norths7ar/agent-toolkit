import { randomUUID } from "node:crypto";
import {
  compareCatalog,
  fetchCatalog,
  listingTarget,
  mergeModels,
  modelValues,
} from "./catalog.js";

export const name = "model-catalog";
export const inject = ["llm", "settings", "connection"];
const API = "/api/local-model-catalog";

function fail(message, code = "INVALID_REQUEST", status = 400) {
  throw Object.assign(new Error(message), { code, status });
}

export function createController(ctx, fetcher = fetch) {
  const reviews = new Map();
  function configured() {
    const forms = ctx.settings.describe();
    return ctx.llm.listConfigurableProviders().flatMap((directory) => {
      const form = forms.find((item) => item.ns === directory.settingsNs);
      const profile = form?.value?.providers?.[directory.provider];
      return profile && Array.isArray(directory.settingsPath) ? [{ directory, form, profile }] : [];
    });
  }
  function resolve(id) {
    const provider = configured().find((item) => item.directory.provider === id);
    if (!provider) fail("此提供商已移除或没有可编辑的模型配置。", "PROVIDER_UNAVAILABLE", 404);
    return provider;
  }
  const providers = () => ({
    providers: configured().map(({ directory, profile }) => {
      const target = listingTarget(directory, profile);
      return {
        id: directory.provider,
        name: profile.displayName ?? directory.displayName,
        supported: !target.reason,
        ...(target.reason ? { reason: target.reason } : { endpoint: target.endpoint }),
      };
    }),
  });

  async function requestHeaders(directory, profile, target) {
    const headers = new Headers({ accept: "application/json" });
    for (const [key, value] of Object.entries(profile.headers ?? {})) headers.set(key, value);
    const refs = profile.apiKeyEnv
      ? [profile.apiKeyEnv]
      : (directory.nativeAuth?.env ?? []).filter((ref) => /API_KEY$/.test(ref));
    let key;
    for (const ref of refs) {
      const resolved = await ctx.get("credentials")?.resolve(ref);
      if (resolved?.value) {
        key = resolved.value;
        break;
      }
    }
    if (!key && profile.apiKeyEnv)
      fail(
        "未找到此提供商已配置的 API Key，请先在 DSH 模型设置中检查凭据。",
        "CREDENTIAL_UNAVAILABLE",
      );
    if (
      !key &&
      directory.nativeAuth?.oauth &&
      !headers.has("authorization") &&
      !headers.has("x-api-key")
    )
      fail("此提供商使用订阅授权；原型暂不读取或刷新 OAuth 凭据。", "OAUTH_UNSUPPORTED");
    if (target.api === "anthropic-messages") {
      headers.set("anthropic-version", "2023-06-01");
      if (key) headers.set("x-api-key", key);
    } else if (target.api === "google-generative-ai") {
      if (key) headers.set("x-goog-api-key", key);
    } else if (key) headers.set("authorization", `Bearer ${key}`);
    if (target.requiresAuth && !headers.get("authorization"))
      fail("请先在 DSH 中配置 OpenCode API Key，以获取账户可用的模型。", "CREDENTIAL_UNAVAILABLE");
    return headers;
  }

  async function preview({ provider }) {
    const { directory, form, profile } = resolve(provider);
    const target = listingTarget(directory, profile);
    if (target.reason) fail(target.reason, "UNSUPPORTED_PROVIDER");
    const headers = await requestHeaders(directory, profile, target);
    let fetched;
    try {
      fetched = await fetchCatalog(target.endpoint, headers, fetcher, AbortSignal.timeout(20000));
    } catch (error) {
      if (/^(模型目录|目录响应)/.test(error.message)) fail(error.message, "CATALOG_FAILED", 502);
      fail("无法获取模型目录，请检查提供商地址和网络连接。", "CATALOG_FAILED", 502);
    }
    let defaults = [];
    if (!directory.declared) {
      defaults = (await ctx.llm.discoverModels(directory.settingsNs, { provider })).map((item) =>
        modelValues({ ...item, input: item.inputModalities }),
      );
    }
    const convertOverrides =
      !profile.models?.length && Object.keys(profile.modelOverrides ?? {}).length > 0;
    if (
      convertOverrides &&
      Object.keys(profile.modelOverrides).some((id) => !defaults.some((item) => item.id === id))
    )
      fail("已有模型覆盖项不在内置目录中，请先在 DSH 中检查模型配置。", "UNKNOWN_OVERRIDE");
    const originals = profile.models?.length
      ? structuredClone(profile.models)
      : defaults.map((item) => ({
          ...item,
          ...structuredClone(profile.modelOverrides?.[item.id] ?? {}),
        }));
    const current = originals.map((item) => ({
      contextWindow: profile.defaultContextWindow,
      maxTokens: profile.defaultMaxTokens,
      input: profile.defaultInput,
      ...defaults.find((base) => base.id === item.id),
      ...item,
    }));
    const canAddUnknown =
      Boolean(profile.api) ||
      ["xiaomi", "openai", "anthropic", "google", "deepseek"].includes(provider);
    const rows = compareCatalog(current, fetched.models, defaults, canAddUnknown);
    const token = randomUUID();
    const review = {
      token,
      provider,
      name: profile.displayName ?? directory.displayName,
      endpoint: target.endpoint,
      fetchedAt: new Date().toISOString(),
      revision: form.revision,
      rows,
      partial: fetched.partial,
    };
    // One active review per provider; opening a fresh preview supersedes the old one.
    for (const [id, previous] of reviews) if (previous.provider === provider) reviews.delete(id);
    reviews.set(token, {
      ...review,
      originals,
      convertOverrides,
      defaults,
      canAddUnknown,
      ns: directory.settingsNs,
      path: directory.settingsPath,
    });
    return review;
  }

  async function apply({ token, models, remove = [] }) {
    const review = reviews.get(token);
    if (!review) fail("预览已失效，请重新获取模型目录。", "REVIEW_EXPIRED", 409);
    const { form } = resolve(review.provider);
    if (form.revision !== review.revision)
      fail("模型配置已变化，请重新获取后确认。", "CONFIG_CONFLICT", 409);
    let next;
    try {
      next = mergeModels(review.originals, review.rows, models, remove);
    } catch (error) {
      fail(error.message);
    }
    try {
      const operations = [{ op: "set", path: [...review.path, "models"], value: next }];
      if (review.convertOverrides)
        operations.push({ op: "set", path: [...review.path, "modelOverrides"], value: {} });
      await ctx.settings.mutate(review.ns, operations, review.revision);
    } catch {
      fail(
        "保存未完成，配置可能已变化或模型参数不被 DSH 接受，请重新获取并检查。",
        "SAVE_FAILED",
        409,
      );
    }
    reviews.delete(token);
    const { form: savedForm, profile } = resolve(review.provider);
    const current = next.map((item) => ({
      contextWindow: profile.defaultContextWindow,
      maxTokens: profile.defaultMaxTokens,
      input: profile.defaultInput,
      ...review.defaults.find((base) => base.id === item.id),
      ...item,
    }));
    const preview = {
      token: randomUUID(),
      provider: review.provider,
      name: review.name,
      endpoint: review.endpoint,
      fetchedAt: review.fetchedAt,
      revision: savedForm.revision,
      partial: review.partial,
      rows: compareCatalog(
        current,
        review.rows.flatMap((row) => (row.remote ? [row.remote] : [])),
        review.defaults,
        review.canAddUnknown,
      ),
    };
    reviews.set(preview.token, {
      ...review,
      ...preview,
      originals: next,
      convertOverrides: false,
    });
    return { saved: models.length, removed: remove.length, preview };
  }
  return { providers, preview, apply, dispose: () => reviews.clear() };
}

export function apply(ctx) {
  const controller = createController(ctx);
  for (const [path, method] of [
    ["providers", "GET"],
    ["preview", "POST"],
    ["apply", "POST"],
  ]) {
    ctx.effect(() =>
      ctx.connection.fetch.register({
        path: `${API}/${path}`,
        methods: [method],
        requestBody: "buffered",
        async fetch(request) {
          try {
            const data = method === "GET" ? {} : await request.json();
            return Response.json(await controller[path](data));
          } catch (error) {
            return Response.json(
              {
                error: error.code ? error.message : "请求未完成，请重新获取模型目录。",
                code: error.code ?? "REQUEST_FAILED",
              },
              { status: error.status ?? 500 },
            );
          }
        },
      }),
    );
  }
  ctx.effect(() => () => controller.dispose());
}
