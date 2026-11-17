import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../client.js", import.meta.url), "utf8");
const initialModel = {
  id: "existing",
  name: "My name",
  contextWindow: 1000,
  maxTokens: 100,
  input: ["text"],
};
const remoteModel = {
  id: "existing",
  name: "Remote name",
  contextWindow: 2000,
  maxTokens: 200,
  input: ["text", "image"],
};
const preview = {
  token: "review-token",
  provider: "example",
  name: "Example",
  endpoint: "https://example.test/v1/models",
  rows: [
    {
      id: "existing",
      status: "changed",
      current: initialModel,
      remote: remoteModel,
      proposed: initialModel,
      changedFields: ["name", "contextWindow", "maxTokens", "input"],
      missingFields: [],
    },
    {
      id: "new",
      status: "new",
      current: null,
      remote: { id: "new" },
      proposed: { id: "new", name: "New" },
      changedFields: [],
      missingFields: ["contextWindow", "maxTokens", "input"],
    },
    {
      id: "missing",
      status: "missing",
      current: { ...initialModel, id: "missing" },
      remote: null,
      proposed: { ...initialModel, id: "missing" },
      changedFields: [],
      missingFields: [],
    },
    {
      id: "blocked",
      status: "new",
      current: null,
      remote: { ...remoteModel, id: "blocked" },
      proposed: { ...remoteModel, id: "blocked" },
      changedFields: [],
      missingFields: [],
      blockedReason: "Protocol needed",
    },
    {
      id: "voice",
      kind: "unsupported",
      status: "new",
      current: null,
      remote: { id: "voice" },
      proposed: { id: "voice" },
      changedFields: [],
      missingFields: [],
    },
    {
      id: "configured",
      kind: "chat",
      status: "configured",
      current: { ...initialModel, id: "configured" },
      remote: { id: "configured" },
      proposed: { ...initialModel, id: "configured" },
      changedFields: [],
      missingFields: [],
    },
  ],
};

function harness({ partial = false } = {}) {
  let plugin;
  let controller;
  let page;
  let props;
  let sidebar;
  let dictionaries;
  let language = "en";
  const calls = [];
  let failedAction = null;
  const React = {
    Fragment: "Fragment",
    createElement: (type, props, ...children) => ({
      type,
      props: props ?? {},
      children: children.flat(Infinity),
    }),
    useEffect: () => {},
    useSyncExternalStore: (_subscribe, read) => read(),
  };
  const locale = {
    register: (_id, value) => {
      dictionaries = value;
    },
    bind:
      () =>
      (key, values = {}) =>
        Object.entries(values).reduce(
          (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
          dictionaries[language][key] ?? key,
        ),
    subscribe: () => () => {},
    version: 1,
  };
  const primitives = Object.fromEntries(
    [
      "Button",
      "Input",
      "Checkbox",
      "Modal",
      "IconRefreshOutlineRegular",
      "IconDataOutlineRegular",
    ].map((key) => [key, key]),
  );
  vm.runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load: ({ factory }) => {
          plugin = factory((name) => (name === "react" ? React : primitives));
        },
      },
    },
    document: { createElement: () => ({ dataset: {}, remove() {} }), head: { append() {} } },
    structuredClone,
    AbortController,
    __DSH_TRANSPORT__: {
      fetch: async (path, init) => {
        const action = path.split("/").at(-1);
        const body = init.body ? JSON.parse(init.body) : undefined;
        calls.push({ action, method: init.method, body });
        if (action === failedAction)
          return {
            ok: false,
            json: async () => ({ error: "Configuration changed", code: "CONFIG_CONFLICT" }),
          };
        const result =
          action === "providers"
            ? {
                providers: [
                  { id: "example", name: "Example", supported: true },
                  { id: "other", name: "Other", supported: true },
                ],
              }
            : action === "preview"
              ? { ...structuredClone(preview), partial }
              : {
                  saved: body.models.length,
                  preview: {
                    ...structuredClone(preview),
                    token: "saved-token",
                    partial,
                    rows: preview.rows
                      .filter((row) => !body.remove.includes(row.id))
                      .map((row) => {
                        const saved = body.models.find((model) => model.id === row.id);
                        return saved ? { ...row, current: saved, proposed: saved } : row;
                      }),
                  },
                };
        return { ok: true, json: async () => result };
      },
    },
  });
  plugin.apply({
    locale,
    effect: (fn) => fn(),
    slots: {
      inject: (_name, fn) => fn(),
      register: (options, component) => {
        if (options.name === "main") {
          props = options.inject();
          controller = props.controller;
          page = component;
        }
        if (options.name === "sidebar.panellist") sidebar = component;
      },
    },
  });
  const nodes = () => {
    const result = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      result.push(node);
      for (const child of node.children ?? []) walk(child);
    };
    walk(page(props));
    return result;
  };
  return {
    controller,
    calls,
    nodes,
    sidebar: (props) => sidebar(props),
    tick: () => new Promise((resolve) => setImmediate(resolve)),
    fail: (action) => {
      failedAction = action;
    },
    language: (next) => {
      language = next;
      locale.version += 1;
    },
  };
}

test("loading providers never queries their model endpoints; preview and write require explicit actions", async () => {
  const app = harness();
  assert.equal(app.calls.length, 0);
  await app.controller.loadProviders();
  assert.deepEqual(
    app.calls.map((call) => call.action),
    ["providers"],
  );
  app.controller.fetchModels();
  await app.tick();
  assert.deepEqual(
    app.calls.map((call) => call.action),
    ["providers", "preview"],
  );
  assert.equal(app.controller.getSnapshot().selected.size, 2);
  app.controller.save();
  assert.equal(app.controller.getSnapshot().confirmation.remove[0].id, "missing");
  app.controller.cancelSave();
  assert.equal(app.calls.at(-1).action, "preview");
  app.controller.select("missing", false);
  app.controller.setSearch("nothing");
  await app.controller.save();
  assert.equal(app.calls.at(-1).action, "preview");
  assert.equal(app.controller.getSnapshot().confirmation.remove[0].id, "missing");
  await app.controller.confirmSave();
  const call = app.calls.at(-1);
  assert.equal(call.action, "apply");
  assert.deepEqual(call.body.models, []);
  assert.deepEqual(call.body.remove, ["missing"]);
  assert.equal(app.controller.getSnapshot().preview.token, "saved-token");
  assert.ok(app.controller.getSnapshot().notice.includes("saved"));
});

test("remote values replace user values only through the explicit adoption action", async () => {
  const app = harness();
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  assert.equal(app.controller.getSnapshot().drafts.get("existing").name, "My name");
  app.controller.useRemote("existing", "contextWindow");
  assert.equal(app.controller.getSnapshot().drafts.get("existing").maxTokens, 100);
  assert.equal(app.controller.getSnapshot().drafts.get("existing").name, "My name");
  app.controller.useRemote("existing", "maxTokens");
  app.controller.select("existing", true);
  await app.controller.save();
  assert.equal(app.controller.getSnapshot().confirmation.modify[0].id, "existing");
  await app.controller.confirmSave();
  assert.deepEqual(app.calls.at(-1).body.models, [
    { ...initialModel, contextWindow: 2000, maxTokens: 200 },
  ]);
});

test("incomplete new models need manual fields; audio and blocked entries cannot be selected", async () => {
  const app = harness();
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  app.controller.select("missing", true);
  app.controller.select("blocked", true);
  app.controller.select("voice", true);
  assert.equal(app.controller.getSnapshot().selected.size, 3);
  app.controller.select("new", true);
  await app.controller.save();
  assert.equal(app.controller.getSnapshot().confirmation, null);
  assert.equal(app.calls.at(-1).action, "preview");
  for (const [key, value] of Object.entries({
    contextWindow: 4000,
    maxTokens: 1000,
    input: ["text"],
  }))
    app.controller.edit("new", key, value);
  await app.controller.save();
  assert.equal(app.controller.getSnapshot().confirmation.add[0].id, "new");
  await app.controller.confirmSave();
  assert.equal(app.calls.at(-1).action, "apply");
  assert.equal(app.calls.at(-1).body.models[0].contextWindow, 4000);
});

test("refresh requires discard confirmation and failed requests keep the current preview and edits", async () => {
  const app = harness();
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  app.controller.edit("existing", "name", "Draft");
  app.controller.fetchModels();
  assert.equal(app.calls.length, 2);
  assert.ok(app.controller.getSnapshot().pending);
  app.fail("preview");
  app.controller.confirmDiscard();
  await app.tick();
  assert.equal(app.controller.getSnapshot().drafts.get("existing").name, "Draft");
  assert.equal(app.controller.getSnapshot().preview.token, "review-token");
  app.controller.select("existing", false);
  app.fail("apply");
  await app.controller.save();
  await app.controller.confirmSave();
  assert.equal(app.controller.getSnapshot().drafts.get("existing").name, "Draft");
  assert.ok(app.controller.getSnapshot().error.includes("Configuration changed"));
});

test("page keeps one editor open and translates controls without translating model names", async () => {
  const app = harness();
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  app.controller.expand("existing");
  app.controller.expand("new");
  assert.equal(app.nodes().filter((node) => node.props.className === "dmc-details").length, 1);
  app.language("zh");
  assert.ok(app.nodes().some((node) => node.children.includes("获取模型")));
  assert.ok(app.nodes().some((node) => node.children.includes("My name")));
  app.controller.select("existing", false);
  app.controller.selectProvider("other");
  assert.equal(app.controller.getSnapshot().provider, "example");
  app.controller.cancelDiscard();
  assert.equal(app.controller.getSnapshot().selected.size, 1);
});

test("configured metadata, missing retention and sidebar sizes match host semantics", async () => {
  const app = harness();
  assert.equal(app.sidebar({ size: 16 }).props.size, 16);
  assert.equal(app.sidebar({ size: 18 }).props.size, 18);
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  app.language("zh");
  assert.ok(app.nodes().some((node) => node.children.includes("已配置")));
  assert.equal(app.controller.getSnapshot().selected.has("missing"), false);
  app.controller.fetchModels();
  await app.tick();
  assert.ok(app.controller.getSnapshot().pending);
  app.controller.cancelDiscard();
  app.controller.select("existing", false);
  app.controller.select("missing", false);
  app.controller.select("configured", false);
  app.controller.save();
  assert.equal(app.controller.getSnapshot().confirmation, null);
  assert.ok(app.controller.getSnapshot().error.includes("至少保留"));
});

test("partial listings retain missing models; saving a retained missing model keeps its selection", async () => {
  const app = harness({ partial: true });
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  assert.equal(app.controller.getSnapshot().selected.has("missing"), true);
  app.controller.fetchModels();
  await app.tick();
  assert.equal(app.controller.getSnapshot().pending, null);
  app.controller.edit("existing", "name", "Changed");
  app.controller.save();
  await app.controller.confirmSave();
  assert.equal(app.controller.getSnapshot().selected.has("missing"), true);
});

test("parameter differences retain saved values after adoption and unsaved filtering follows edits", async () => {
  const app = harness();
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  app.controller.select("missing", true);
  app.controller.expand("existing");
  app.language("zh");
  app.controller.useRemote("existing", "contextWindow");
  app.controller.setFilter("unsaved");
  let nodes = app.nodes();
  assert.equal(nodes.filter((node) => node.props.className === "dmc-row").length, 1);
  assert.equal(nodes.filter((node) => node.props.className === "dmc-compareRow").length, 2);
  assert.ok(nodes.some((node) => node.children.includes("1000")));
  assert.ok(nodes.some((node) => node.children.includes("2000")));
  assert.ok(nodes.some((node) => node.children.includes("已采用")));
  assert.ok(nodes.some((node) => node.children.includes("参数有差异")));
  assert.ok(
    nodes
      .filter(
        (node) =>
          node.type === "Button" &&
          (node.children.includes("采用") || node.children.includes("收起")),
      )
      .every((node) => node.props.variant === "outline"),
  );
  app.controller.setSearch("configured");
  assert.equal(app.nodes().filter((node) => node.props.className === "dmc-row").length, 0);
  app.controller.setSearch("");
  app.controller.save();
  await app.controller.confirmSave();
  assert.equal(app.nodes().filter((node) => node.props.className === "dmc-row").length, 0);
  app.controller.setFilter("all");
  nodes = app.nodes();
  assert.equal(nodes.filter((node) => node.props.className === "dmc-compareRow").length, 1);
});

test("unsupported models have one label and no editor; configured filter includes ID-only metadata", async () => {
  const app = harness();
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  app.language("zh");
  app.controller.expand("voice");
  assert.equal(app.controller.getSnapshot().expanded, null);
  assert.ok(app.nodes().some((node) => node.children.includes("不支持接入")));
  app.controller.setFilter("configured");
  assert.equal(app.nodes().filter((node) => node.props.className === "dmc-row").length, 3);
  app.controller.setFilter("available");
  assert.equal(app.nodes().filter((node) => node.props.className === "dmc-row").length, 1);
});

test("saving selected models preserves unselected new-model edits outside the confirmation", async () => {
  const app = harness();
  await app.controller.loadProviders();
  app.controller.fetchModels();
  await app.tick();
  app.controller.edit("new", "name", "Work in progress");
  app.controller.edit("new", "contextWindow", 4096);
  app.controller.edit("existing", "name", "Saved name");
  app.controller.save();
  assert.equal(app.controller.getSnapshot().confirmation.add.length, 0);
  await app.controller.confirmSave();
  const state = app.controller.getSnapshot();
  assert.equal(state.drafts.get("new").name, "Work in progress");
  assert.equal(state.drafts.get("new").contextWindow, 4096);
  assert.equal(state.selected.has("new"), false);
  assert.equal(state.drafts.get("existing").name, "Saved name");
  app.controller.setFilter("unsaved");
  assert.equal(app.nodes().filter((node) => node.props.className === "dmc-row").length, 1);
  assert.ok(app.nodes().some((node) => node.children.includes("Work in progress")));
});
