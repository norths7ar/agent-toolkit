export const MODEL_FIELDS = ["name", "contextWindow", "maxTokens", "input"];

const positive = (value) => (Number.isSafeInteger(value) && value > 0 ? value : undefined);
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function inputTypes(value) {
  if (!Array.isArray(value)) return undefined;
  const result = [];
  if (value.includes("text")) result.push("text");
  if (
    value.some(
      (item) => item === "image" || (typeof item === "string" && item.startsWith("image/")),
    )
  )
    result.push("image");
  return result.length ? result : undefined;
}

export function modelValues(value) {
  const result = { id: value.id };
  if (text(value.name)) result.name = value.name.trim();
  if (positive(value.contextWindow)) result.contextWindow = value.contextWindow;
  if (positive(value.maxTokens)) result.maxTokens = value.maxTokens;
  const input = inputTypes(value.input);
  if (input) result.input = input;
  return result;
}

/** Normalize only facts actually disclosed by the listing endpoint. */
export function parseCatalog(payload) {
  let entries;
  if (Array.isArray(payload.data)) entries = payload.data;
  else if (Array.isArray(payload.models)) entries = payload.models;
  else if (payload.models && typeof payload.models === "object") {
    entries = Object.entries(payload.models).map(([id, item]) => ({ ...item, id }));
  } else throw new Error("目录响应没有 data 或 models 列表。");
  const rows = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const id = text(entry.id) ?? text(entry.name)?.replace(/^models\//, "");
    if (!id || rows.has(id)) continue;
    const audio =
      ["asr", "tts", "speech", "audio"].includes(entry.type) ||
      /^gpt-live-transcribe(?:-|$)/i.test(id) ||
      /^(?:tts-|whisper-|(?:gpt-\d[^/]*|gpt)-(?:audio|realtime|transcribe|tts)(?:-|$))/i.test(id) ||
      /^mimo-(?:v\d+(?:\.\d+)*-)?(?:asr|tts)(?:-|$)/i.test(id);
    const unsupported =
      (entry.type && !["chat", "text", "language", "model"].includes(entry.type)) ||
      audio ||
      /^(?:(?:chatgpt|gpt)-image(?:-|$)|gpt-live(?:-|$)|dall-e-|text-embedding-|(?:omni|text)-moderation-)/i.test(
        id,
      ) ||
      (Array.isArray(entry.supportedGenerationMethods) &&
        !entry.supportedGenerationMethods.includes("generateContent"));
    const model = modelValues({
      id,
      name: entry.displayName ?? (entry.id ? entry.name : undefined),
      contextWindow:
        entry.limit?.context ??
        entry.contextWindow ??
        entry.context_window ??
        entry.inputTokenLimit,
      maxTokens:
        entry.limit?.output ?? entry.maxTokens ?? entry.max_output_tokens ?? entry.outputTokenLimit,
      input: entry.modalities?.input ?? entry.inputModalities ?? entry.input,
    });
    rows.set(id, {
      ...model,
      kind: unsupported ? "unsupported" : "chat",
      ...(audio ? { category: "audio" } : {}),
      ...Object.fromEntries(
        ["created", "shutdown_date", "release_date", "family"]
          .filter((key) => entry[key] !== undefined)
          .map((key) => [key, entry[key]]),
      ),
      ...(unsupported
        ? {
            unsupportedReason: /^gpt-live-(?!transcribe)/i.test(id)
              ? "此型号的调用接口尚未适配，暂不能加入聊天模型配置。"
              : "此型号不是对话模型，不能加入聊天模型配置。",
          }
        : {}),
    });
  }
  return [...rows.values()];
}

export function compareCatalog(current, remote, defaults, canAddUnknown) {
  const originals = new Map(current.map((model) => [model.id, modelValues(model)]));
  const inherited = new Map(defaults.map((model) => [model.id, modelValues(model)]));
  const rows = remote.map((model) => {
    const previous = originals.get(model.id);
    const proposed = { ...inherited.get(model.id), ...modelValues(model), ...previous };
    const comparable = MODEL_FIELDS.some((key) => model[key] !== undefined);
    const changedFields = previous
      ? MODEL_FIELDS.filter((key) => model[key] !== undefined && !same(previous[key], model[key]))
      : [];
    return {
      id: model.id,
      status: previous
        ? changedFields.length
          ? "changed"
          : comparable
            ? "unchanged"
            : "configured"
        : "new",
      kind: model.kind ?? "chat",
      ...(model.category ? { category: model.category } : {}),
      ...(model.unsupportedReason ? { unsupportedReason: model.unsupportedReason } : {}),
      current: previous ?? null,
      remote: model,
      proposed,
      changedFields,
      missingFields: ["contextWindow", "maxTokens", "input"].filter(
        (key) => proposed[key] === undefined,
      ),
      ...(!previous && !inherited.has(model.id) && !canAddUnknown
        ? {
            blockedReason:
              "内置目录尚未提供这个模型的协议信息，请先在 DSH 中配置对应协议的提供商。",
          }
        : {}),
    };
  });
  const returned = new Set(remote.map((model) => model.id));
  for (const previous of current) {
    if (returned.has(previous.id)) continue;
    rows.push({
      id: previous.id,
      status: "missing",
      current: modelValues(previous),
      remote: null,
      proposed: modelValues(previous),
      changedFields: [],
      missingFields: [],
    });
  }
  const order = new Map(current.map((model, index) => [model.id, index]));
  const natural = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  const parts = (row) => {
    const base = row.id.replace(/-(?:\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/, "");
    return {
      base,
      snapshot: base !== row.id,
      family:
        row.remote?.family ?? base.match(/^[a-z]+(?:-[a-z]+)*(?=-?\d)/i)?.[0] ?? base.split("-")[0],
    };
  };
  return rows.sort((a, b) => {
    if (order.has(a.id) || order.has(b.id))
      return (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity);
    const unsupported = Number(a.kind === "unsupported") - Number(b.kind === "unsupported");
    if (unsupported) return unsupported;
    const left = parts(a);
    const right = parts(b);
    const family = natural.compare(left.family, right.family);
    if (family) return family;
    const version = natural.compare(right.base, left.base);
    if (version) return version;
    if (left.snapshot !== right.snapshot) return Number(left.snapshot) - Number(right.snapshot);
    return natural.compare(b.id, a.id);
  });
}

/** Remove only explicitly deselected originals; retain non-edited configuration fields. */
export function mergeModels(originals, rows, selected, remove = []) {
  if (!Array.isArray(selected) || !Array.isArray(remove)) throw new Error("模型选择格式无效。");
  const allowed = new Map(rows.map((row) => [row.id, row]));
  const removed = new Set(remove);
  if (
    removed.size !== remove.length ||
    remove.some((id) => !originals.some((model) => model.id === id))
  )
    throw new Error("待移除模型与当前配置不一致，请重新获取。");
  const next = originals
    .filter((model) => !removed.has(model.id))
    .map((model) => structuredClone(model));
  const seen = new Set();
  for (const selection of selected) {
    const row = allowed.get(selection?.id);
    if (!row || row.status === "missing" || seen.has(selection.id) || removed.has(selection.id))
      throw new Error("模型选择与当前预览不一致，请重新获取。");
    if (row.blockedReason) throw new Error(row.blockedReason);
    if (row.kind === "unsupported") throw new Error(row.unsupportedReason);
    seen.add(selection.id);
    const values = modelValues(selection);
    if (
      !row.current &&
      (!values.contextWindow || !values.maxTokens || !values.input?.includes("text"))
    )
      throw new Error(`请补齐 ${selection.id} 的上下文、输出上限和输入类型。`);
    const index = next.findIndex((model) => model.id === selection.id);
    if (index < 0) next.push(values);
    else {
      const current = row.current ?? {};
      // Effective defaults shown in the UI are not needlessly turned into overrides.
      for (const field of MODEL_FIELDS) {
        if (values[field] !== undefined && !same(values[field], current[field]))
          next[index][field] = values[field];
      }
    }
  }
  if (next.length === 0)
    throw new Error("请至少保留一个模型；DSH 的空模型列表会恢复内置目录，不能表示全部移除。");
  return next;
}

export function listingTarget(provider, profile) {
  const base =
    profile.baseURL ??
    provider.defaultBaseURL ??
    (provider.provider === "opencode" ? "https://opencode.ai" : undefined);
  if (!base) return { reason: "请先在 DSH 中填写此提供商的 API 地址。" };
  let url;
  try {
    url = new URL(base);
  } catch {
    return { reason: "此提供商的 API 地址无效。" };
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    return { reason: "目录地址需要使用 HTTP 或 HTTPS，且不能包含登录凭据。" };
  if (provider.provider === "opencode" && url.hostname === "opencode.ai")
    return {
      endpoint: "https://opencode.ai/inference/v1/models",
      requiresAuth: true,
      api: "openai-completions",
    };
  const api =
    profile.api ??
    {
      xiaomi: "openai-completions",
      openai: "openai-responses",
      anthropic: "anthropic-messages",
      google: "google-generative-ai",
      deepseek: "openai-completions",
    }[provider.provider];
  if (
    ![
      "openai-completions",
      "openai-responses",
      "anthropic-messages",
      "google-generative-ai",
    ].includes(api)
  )
    return { reason: "此提供商的目录协议尚未支持，请在 DSH 中手动添加模型。" };
  url.hash = "";
  url.search = "";
  let path = url.pathname.replace(/\/$/, "");
  if (api === "anthropic-messages" && !path.endsWith("/v1")) path += "/v1";
  if (api === "google-generative-ai" && !/\/v1(beta)?$/.test(path)) path += "/v1beta";
  url.pathname = path + "/models";
  if (api === "google-generative-ai") url.searchParams.set("pageSize", "1000");
  if (api === "anthropic-messages") url.searchParams.set("limit", "1000");
  return { endpoint: url.href, api };
}

export async function fetchCatalog(endpoint, headers, fetcher = fetch, signal) {
  const response = await fetcher(endpoint, { method: "GET", headers, redirect: "error", signal });
  if (!response.ok) throw new Error(`模型目录返回 HTTP ${response.status}。`);
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8 * 1024 * 1024) throw new Error("模型目录响应超过 8 MB。");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("模型目录没有返回有效 JSON。");
  }
  const models = parseCatalog(payload);
  return { models, partial: Boolean(payload.has_more || payload.nextPageToken) };
}
