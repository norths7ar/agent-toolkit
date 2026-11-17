window.__ModuleLoader__.load({
  id: "dsh-model-catalog",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const {
      Button,
      Input,
      Checkbox,
      Modal,
      IconRefreshOutlineRegular,
      IconDataOutlineRegular,
    } = require("@deepseek-ai/dsh-client-ui-primitives");
    const ENTRY = "local-model-catalog";
    const API = "api/local-model-catalog";
    const FIELDS = ["name", "contextWindow", "maxTokens", "input"];
    const DICTIONARIES = {
      zh: {
        title: "模型目录",
        provider: "提供商",
        chooseProvider: "选择提供商",
        refreshProviders: "重新读取提供商",
        fetch: "获取模型",
        fetching: "正在获取…",
        loading: "正在读取提供商…",
        emptyProviders: "尚未配置可查询的提供商。",
        begin: "选择提供商，获取最新模型目录。",
        search: "搜索模型名或 ID",
        all: "全部",
        available: "可添加",
        unsaved: "未保存",
        parameter: "参数",
        adopted: "已采用",
        view: "查看参数",
        changed: "参数有差异",
        configured: "已配置",
        unsupported: "不支持接入",
        confirmTitle: "保存模型配置？",
        add: "添加",
        modify: "更新",
        remove: "移除",
        missing: "远端未返回",
        empty: "没有匹配的模型。",
        details: "编辑参数",
        collapse: "收起",
        name: "显示名称",
        contextWindow: "上下文窗口",
        maxTokens: "最大输出 token 数",
        input: "输入类型",
        text: "文本",
        image: "图片",
        unknown: "未提供",
        current: "本地配置",
        remote: "提供商返回",
        useRemote: "采用",
        selectModel: "选择 {name}",
        save: "保存",
        saving: "正在保存…",
        saved: "模型配置已保存。",
        incomplete: "请补全所选模型的上下文窗口、最大输出和输入类型。",
        keepOne: "请至少保留一个模型；DSH 的空列表会恢复内置目录。",
        blocked: "此模型需要先补充提供商配置。",
        loadFailed: "无法读取提供商，请重试。",
        requestFailed: "请求失败，请重试。",
        conflict: "配置已变化，请重新获取目录后保存。",
        discardTitle: "放弃当前选择和编辑？",
        discard: "放弃并继续",
        cancel: "取消",
        close: "关闭",
        count: "{count} 个模型",
        source: "来源",
        shutdownDate: "{date} 下线",
        partial: "目录还有后续分页，本次仅显示已返回的模型。",
      },
      en: {
        title: "Model catalog",
        provider: "Provider",
        chooseProvider: "Select a provider",
        refreshProviders: "Reload providers",
        fetch: "Fetch models",
        fetching: "Fetching…",
        loading: "Loading providers…",
        emptyProviders: "No providers are configured for discovery yet.",
        begin: "Choose a provider to fetch its latest model catalog.",
        search: "Search model name or ID",
        all: "All",
        available: "Available",
        unsaved: "Unsaved",
        parameter: "Parameter",
        adopted: "Applied",
        view: "View metadata",
        changed: "Values differ",
        configured: "Configured",
        unsupported: "Not supported",
        confirmTitle: "Save model configuration?",
        add: "Add",
        modify: "Update",
        remove: "Remove",
        missing: "Not returned",
        empty: "No matching models.",
        details: "Edit metadata",
        collapse: "Collapse",
        name: "Display name",
        contextWindow: "Context window",
        maxTokens: "Maximum output tokens",
        input: "Input types",
        text: "Text",
        image: "Image",
        unknown: "Not provided",
        current: "Local configuration",
        remote: "Provider values",
        useRemote: "Apply",
        selectModel: "Select {name}",
        save: "Save",
        saving: "Saving…",
        saved: "Model configuration saved.",
        incomplete: "Complete context window, maximum output, and input types for selected models.",
        keepOne: "Keep at least one model. DSH restores its built-in catalog for an empty list.",
        blocked: "This model needs additional provider configuration first.",
        loadFailed: "Could not load providers. Try again.",
        requestFailed: "Request failed. Try again.",
        conflict: "Configuration changed. Fetch the catalog again before saving.",
        discardTitle: "Discard the current selection and edits?",
        discard: "Discard and continue",
        cancel: "Cancel",
        close: "Close",
        count: "Models: {count}",
        source: "Source",
        shutdownDate: "Shutdown: {date}",
        partial: "More catalog pages are available. Only models returned on this page are shown.",
      },
    };

    const CSS = `
      .dmc-root { height:100%; min-height:0; display:flex; flex-direction:column; color:var(--dsw-alias-label-primary); font-size:14px; line-height:22px; }
      .dmc-root *, .dmc-dialog * { box-sizing:border-box; }
      .dmc-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; }
      .dmc-page { width:100%; max-width:1056px; padding:28px clamp(24px,4vw,48px); margin:auto; }
      .dmc-header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:28px; }
      .dmc-title { font-size:20px; font-weight:500; line-height:28px; margin:0; }
      .dmc-muted { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; margin:0; overflow-wrap:anywhere; }
      .dmc-toolbar, .dmc-filters, .dmc-actions, .dmc-inputTypes { display:flex; align-items:center; gap:12px; }
      .dmc-toolbar { flex-wrap:wrap; margin-bottom:20px; }
      .dmc-picker { position:relative; width:216px; max-width:100%; }
      .dmc-picker summary { list-style:none; display:flex; align-items:center; justify-content:space-between; gap:20px; height:36px; padding:0 12px; cursor:pointer; border:var(--dsh-hairline-width,1px) solid var(--dsw-alias-border-l4); border-radius:10px; background:var(--dsw-alias-bg-layer-1); }
      .dmc-picker summary::-webkit-details-marker { display:none; }
      .dmc-picker summary[aria-disabled="true"] { opacity:.5; cursor:default; }
      .dmc-providerName { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dmc-menu { position:absolute; z-index:5; top:42px; left:0; min-width:100%; max-height:300px; overflow:auto; padding:5px; border:var(--dsh-hairline-width,1px) solid var(--dsw-alias-border-l4); border-radius:12px; background:var(--dsw-alias-bg-layer-1); box-shadow:0 6px 22px #17202b18; }
      .dmc-menu button { width:100%; justify-content:flex-start; white-space:nowrap; }
      .dmc-menu button[aria-current="true"] { background:var(--dsw-alias-interactive-bg-hover); }
      .dmc-filters { flex-wrap:wrap; gap:20px; margin:24px 0 12px; }
      .dmc-search { width:280px; max-width:100%; min-width:0; }
      .dmc-tabs { display:flex; flex-wrap:wrap; gap:4px; }
      .dmc-tabs button[aria-pressed="true"] { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
      .dmc-list { list-style:none; padding:0; margin:0; }
      .dmc-row { border-bottom:var(--dsh-hairline-width,1px) solid var(--dsw-alias-border-l4); }
      .dmc-rowHead { display:flex; align-items:center; gap:12px; padding:17px 0; min-height:70px; }
      .dmc-rowName { flex:1; min-width:0; overflow-wrap:anywhere; }
      .dmc-name { display:flex; align-items:center; flex-wrap:wrap; gap:8px; font-weight:500; }
      .dmc-row[data-unsupported="true"] .dmc-name { color:var(--dsw-alias-label-secondary); }
      .dmc-status { display:inline-block; padding:0 6px; border-radius:5px; font-size:11px; line-height:20px; font-weight:400; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-2); }
      .dmc-status[data-tone="warning"] { color:var(--dsw-alias-state-warn-label,#a36107); background:var(--dsw-alias-state-warn-bg,#fff1d8); }
      .dmc-status[data-tone="change"] { color:var(--dsw-alias-state-info-label,#43668e); background:var(--dsw-alias-state-info-bg,#eaf0fb); }
      .dmc-details { max-width:700px; margin:0 0 22px 30px; display:grid; gap:16px; }
      .dmc-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
      .dmc-field { display:flex; flex-direction:column; min-width:0; gap:6px; }
      .dmc-field input:not([type="checkbox"]) { width:100%; }
      .dmc-inputTypes > span { display:inline-flex; align-items:center; gap:6px; }
      .dmc-fieldLabel { font-size:12px; color:var(--dsw-alias-label-secondary); }
      .dmc-comparison { border-top:var(--dsh-hairline-width,1px) solid var(--dsw-alias-border-l4); padding-top:14px; margin-top:4px; }
      .dmc-compareHead, .dmc-compareRow { display:grid; grid-template-columns:minmax(90px,1fr) minmax(90px,1fr) minmax(100px,1fr) 72px; gap:12px; align-items:center; }
      .dmc-compareHead { font-size:12px; color:var(--dsw-alias-label-tertiary); margin-bottom:10px; }
      .dmc-compareRow { font-size:13px; min-height:44px; }
      .dmc-compareRow > * { min-width:0; overflow-wrap:anywhere; }
      .dmc-adopted { font-size:12px; text-align:center; color:var(--dsw-alias-state-success-label,#5d7564); }
      .dmc-footer { flex:none; border-top:var(--dsh-hairline-width,1px) solid var(--dsw-alias-border-l4); background:var(--dsw-alias-bg-layer-1); }
      .dmc-footerInner { width:100%; max-width:1056px; margin:auto; padding:14px clamp(24px,4vw,48px); display:flex; align-items:center; justify-content:flex-end; gap:16px; }
      .dmc-message { margin:12px 0; }
      .dmc-error { color:var(--dsw-alias-state-error-primary); }
      .dmc-empty { padding:40px 0; color:var(--dsw-alias-label-tertiary); }
      .dmc-dialog { width:min(440px,100%); }
      .dmc-actions { justify-content:flex-end; }
      .dmc-summary { max-height:50vh; overflow:auto; }
      .dmc-summary h3 { font-size:14px; margin:16px 0 8px; }
      .dmc-summary ul { margin:0; padding-left:20px; overflow-wrap:anywhere; }
      .dmc-picker summary:focus-visible { outline:2px solid var(--dsw-focus-ring-color); outline-offset:2px; }
      @media(max-width:640px) { .dmc-fields { grid-template-columns:minmax(0,1fr); } .dmc-rowHead { gap:8px; } .dmc-details { margin-left:0; } .dmc-filters { gap:12px; } .dmc-search { width:100%; } .dmc-compareHead, .dmc-compareRow { grid-template-columns:minmax(70px,1fr) minmax(55px,1fr) minmax(65px,1fr) 60px; gap:8px; } }
    `;

    function sameValue(a, b) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    function dirtyRow(row, state) {
      return (
        row.kind !== "unsupported" &&
        (state.selected.has(row.id) !== Boolean(row.current) ||
          FIELDS.some(
            (field) => !sameValue(state.drafts.get(row.id)?.[field], row.proposed?.[field]),
          ))
      );
    }

    function parameterDifferences(row) {
      return ["contextWindow", "maxTokens"].filter(
        (field) =>
          row.remote?.[field] !== undefined &&
          !sameValue(row.remote[field], row.current?.[field] ?? row.proposed?.[field]),
      );
    }

    function createController(t) {
      let state = {
        providers: [],
        provider: "",
        loaded: false,
        busy: null,
        preview: null,
        drafts: new Map(),
        selected: new Set(),
        search: "",
        filter: "all",
        expanded: null,
        error: "",
        notice: "",
        pending: null,
        confirmation: null,
      };
      const listeners = new Set();
      const lifetime = new AbortController();
      const send =
        globalThis.__DSH_TRANSPORT__?.fetch ?? ((input, init) => globalThis.fetch(input, init));
      const update = (patch) => {
        state = { ...state, ...patch };
        for (const listener of listeners) listener();
      };
      const request = async (action, data) => {
        const response = await send(`${API}/${action}`, {
          method: data === undefined ? "GET" : "POST",
          ...(data === undefined
            ? {}
            : { headers: { "content-type": "application/json" }, body: JSON.stringify(data) }),
          signal: lifetime.signal,
        });
        const body = await response.json();
        if (!response.ok) {
          throw Object.assign(new Error(body.error || t("requestFailed")), { code: body.code });
        }
        return body;
      };
      const cleared = () => ({
        preview: null,
        drafts: new Map(),
        selected: new Set(),
        expanded: null,
        search: "",
        filter: "all",
        confirmation: null,
      });
      const edited = () => state.preview?.rows.some((row) => dirtyRow(row, state));
      const changes = () => {
        const result = { add: [], modify: [], remove: [] };
        for (const row of state.preview?.rows ?? []) {
          if (row.kind === "unsupported") continue;
          if (!state.selected.has(row.id)) {
            if (row.current) result.remove.push(row);
          } else if (!row.blockedReason && row.status !== "missing") {
            if (!row.current) result.add.push(row);
            else if (
              FIELDS.some(
                (field) =>
                  JSON.stringify(state.drafts.get(row.id)?.[field]) !==
                  JSON.stringify(row.current[field]),
              )
            )
              result.modify.push(row);
          }
        }
        return result;
      };
      const guard = (action) => {
        if (state.busy) return;
        if (edited()) update({ pending: action });
        else void action();
      };
      const fail = (error) => {
        if (lifetime.signal.aborted) return;
        update({
          error: /conflict|revision/i.test(error.code ?? "") ? t("conflict") : error.message,
        });
      };
      const fetchModels = async () => {
        const provider = state.providers.find((item) => item.id === state.provider);
        if (!provider?.supported || state.busy) return;
        update({ busy: "fetch", error: "", notice: "" });
        try {
          const preview = await request("preview", { provider: provider.id });
          update({
            ...cleared(),
            preview,
            drafts: new Map(preview.rows.map((row) => [row.id, structuredClone(row.proposed)])),
            selected: new Set(
              preview.rows
                .filter(
                  (row) =>
                    row.current &&
                    row.kind !== "unsupported" &&
                    (preview.partial || row.status !== "missing"),
                )
                .map((row) => row.id),
            ),
          });
        } catch (error) {
          fail(error);
        } finally {
          update({ busy: null });
        }
      };
      const controller = {
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        getSnapshot: () => state,
        changes,
        async loadProviders(clearPreview = false) {
          if (state.busy) return;
          update({ busy: "providers", error: "" });
          try {
            const { providers } = await request("providers");
            const provider = providers.some((item) => item.id === state.provider)
              ? state.provider
              : (providers.find((item) => item.supported)?.id ?? providers[0]?.id ?? "");
            update({
              ...(clearPreview || provider !== state.provider ? cleared() : {}),
              providers,
              provider,
              loaded: true,
            });
          } catch (error) {
            fail(error);
          } finally {
            update({ busy: null });
          }
        },
        selectProvider(provider) {
          guard(() => update({ ...cleared(), provider, error: "", notice: "" }));
        },
        fetchModels: () => guard(fetchModels),
        refreshProviders: () => guard(() => controller.loadProviders(true)),
        confirmDiscard() {
          const action = state.pending;
          update({ pending: null });
          if (action) void action();
        },
        cancelDiscard: () => update({ pending: null }),
        setSearch: (search) => update({ search }),
        setFilter: (filter) => update({ filter }),
        expand(id) {
          const row = state.preview?.rows.find((item) => item.id === id);
          if (!row || row.kind === "unsupported") return;
          update({ expanded: state.expanded === id ? null : id });
        },
        select(id, checked) {
          if (state.busy) return;
          const row = state.preview?.rows.find((item) => item.id === id);
          if (!row || row.kind === "unsupported" || (row.blockedReason && !row.current)) return;
          const selected = new Set(state.selected);
          if (checked) selected.add(id);
          else selected.delete(id);
          update({ selected, notice: "" });
        },
        edit(id, field, value) {
          if (state.busy || !FIELDS.includes(field)) return;
          const row = state.preview?.rows.find((item) => item.id === id);
          if (!row || row.kind === "unsupported" || row.blockedReason || row.status === "missing")
            return;
          const drafts = new Map(state.drafts);
          drafts.set(id, { ...drafts.get(id), [field]: value });
          update({ drafts, notice: "" });
        },
        useRemote(id, field) {
          if (state.busy || !["contextWindow", "maxTokens"].includes(field)) return;
          const row = state.preview?.rows.find((item) => item.id === id);
          if (
            !row ||
            row.kind === "unsupported" ||
            row.blockedReason ||
            row.status === "missing" ||
            row.remote?.[field] === undefined
          )
            return;
          controller.edit(id, field, row.remote[field]);
        },
        save() {
          if (state.busy || !state.preview) return;
          const summary = changes();
          if (!Object.values(summary).some((rows) => rows.length)) return;
          const retained =
            state.preview.rows.filter((row) => row.current).length - summary.remove.length;
          if (retained + summary.add.length === 0) {
            update({ error: t("keepOne") });
            return;
          }
          const models = [...summary.add, ...summary.modify].map((row) => state.drafts.get(row.id));
          if (models.some((model) => !complete(model))) {
            update({ error: t("incomplete") });
            return;
          }
          update({ confirmation: summary, error: "" });
        },
        cancelSave: () => update({ confirmation: null }),
        async confirmSave() {
          if (state.busy || !state.preview || !state.confirmation) return;
          const summary = state.confirmation;
          const models = [...summary.add, ...summary.modify].map((row) => state.drafts.get(row.id));
          const remove = summary.remove.map((row) => row.id);
          const pendingDrafts = state.drafts;
          update({ busy: "save", error: "", notice: "", confirmation: null });
          try {
            const { preview } = await request("apply", {
              token: state.preview.token,
              models,
              remove,
            });
            update({
              preview,
              drafts: new Map(
                preview.rows.map((row) => [
                  row.id,
                  structuredClone(
                    !row.current && pendingDrafts.has(row.id)
                      ? pendingDrafts.get(row.id)
                      : row.proposed,
                  ),
                ]),
              ),
              selected: new Set(
                preview.rows
                  .filter((row) => row.current && row.kind !== "unsupported")
                  .map((row) => row.id),
              ),
              expanded: preview.rows.some((row) => row.id === state.expanded)
                ? state.expanded
                : null,
              notice: t("saved"),
            });
          } catch (error) {
            fail(error);
          } finally {
            update({ busy: null });
          }
        },
        dispose: () => lifetime.abort(),
      };
      return controller;
    }

    function complete(model) {
      return (
        Number.isInteger(model?.contextWindow) &&
        model.contextWindow > 0 &&
        Number.isInteger(model?.maxTokens) &&
        model.maxTokens > 0 &&
        Array.isArray(model?.input) &&
        model.input.includes("text")
      );
    }

    function CatalogPage({ controller, t, locale }) {
      const state = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot);
      React.useSyncExternalStore(
        (listener) => locale.subscribe(listener),
        () => locale.version,
      );
      React.useEffect(() => {
        if (!controller.getSnapshot().loaded) void controller.loadProviders();
      }, [controller]);
      const busy = state.busy !== null;
      const provider = state.providers.find((item) => item.id === state.provider);
      const query = state.search.trim().toLowerCase();
      const rows = (state.preview?.rows ?? []).filter(
        (row) =>
          (state.filter === "all" ||
            (state.filter === "configured" && Boolean(row.current)) ||
            (state.filter === "available" &&
              !row.current &&
              row.kind !== "unsupported" &&
              !row.blockedReason) ||
            (state.filter === "missing" && row.status === "missing") ||
            (state.filter === "unsaved" && dirtyRow(row, state))) &&
          `${row.id} ${state.drafts.get(row.id)?.name ?? ""}`.toLowerCase().includes(query),
      );
      const button = (label, onClick, props = {}) => h(Button, { onClick, ...props }, label);
      const display = (value) => {
        if (Array.isArray(value)) return value.map((item) => t(item)).join(" / ");
        return value === undefined || value === "" ? t("unknown") : String(value);
      };
      const editFields = (row, model) => {
        const disabled =
          busy ||
          Boolean(row.blockedReason) ||
          row.kind === "unsupported" ||
          row.status === "missing";
        return h(
          "div",
          { className: "dmc-details", id: `dmc-details-${row.id}` },
          row.blockedReason && h("p", { className: "dmc-muted" }, row.blockedReason),
          h(
            "div",
            { className: "dmc-fields" },
            ...["name", "contextWindow", "maxTokens"].map((field) =>
              h(
                "label",
                { key: field, className: "dmc-field" },
                h("span", { className: "dmc-fieldLabel" }, t(field)),
                h(Input, {
                  type: field === "name" ? "text" : "number",
                  ...(field === "name" ? {} : { min: 1, step: 1 }),
                  value: model?.[field] ?? "",
                  disabled,
                  "aria-label": t(field),
                  onChange: (event) =>
                    controller.edit(
                      row.id,
                      field,
                      field === "name" || event.target.value === ""
                        ? event.target.value
                        : Number(event.target.value),
                    ),
                }),
              ),
            ),
            h(
              "div",
              { className: "dmc-field" },
              h("span", { className: "dmc-fieldLabel" }, t("input")),
              h(
                "div",
                { className: "dmc-inputTypes" },
                ...["text", "image"].map((kind) =>
                  h(
                    "span",
                    { key: kind },
                    h(Checkbox, {
                      checked: model?.input?.includes(kind) ?? false,
                      disabled: disabled || (kind === "text" && model?.input?.includes("text")),
                      label: t(kind),
                      onChange: (checked) =>
                        controller.edit(
                          row.id,
                          "input",
                          checked
                            ? [...new Set([...(model?.input ?? []), kind])]
                            : (model?.input ?? []).filter((item) => item !== kind),
                        ),
                    }),
                  ),
                ),
              ),
            ),
          ),
          parameterDifferences(row).length > 0 &&
            h(
              "div",
              { className: "dmc-comparison" },
              h(
                "div",
                { className: "dmc-compareHead" },
                h("span", null, t("parameter")),
                h("span", null, t("current")),
                h("span", null, t("remote")),
                h("span", null),
              ),
              ...parameterDifferences(row).map((field) =>
                h(
                  "div",
                  { key: field, className: "dmc-compareRow" },
                  h("span", null, t(field)),
                  h("span", null, display(row.current?.[field] ?? row.proposed?.[field])),
                  h("span", null, display(row.remote[field])),
                  sameValue(model?.[field], row.remote[field])
                    ? h("span", { className: "dmc-adopted" }, t("adopted"))
                    : button(t("useRemote"), () => controller.useRemote(row.id, field), {
                        variant: "outline",
                        size: "sm",
                        disabled,
                        "aria-label": t("useRemote") + " " + t(field),
                      }),
                ),
              ),
            ),
        );
      };
      return h(
        "section",
        { className: "dmc-root", "aria-label": t("title"), "aria-busy": busy },
        h(
          "div",
          { className: "dmc-scroll" },
          h(
            "div",
            { className: "dmc-page" },
            h(
              "header",
              { className: "dmc-header" },
              h("div", null, h("h1", { className: "dmc-title" }, t("title"))),
            ),
            h(
              "div",
              { className: "dmc-toolbar" },
              h(
                "details",
                {
                  className: "dmc-picker",
                  onKeyDown: (event) => {
                    if (event.key === "Escape") {
                      event.currentTarget.open = false;
                      event.currentTarget.querySelector("summary").focus();
                    }
                  },
                  onBlur: (event) => {
                    if (!event.currentTarget.contains(event.relatedTarget))
                      event.currentTarget.open = false;
                  },
                },
                h(
                  "summary",
                  {
                    "aria-label": t("provider"),
                    "aria-disabled": busy,
                    onClick: (event) => {
                      if (busy) event.preventDefault();
                    },
                  },
                  h(
                    "span",
                    { className: "dmc-providerName" },
                    provider?.name || t("chooseProvider"),
                  ),
                  h(
                    "svg",
                    {
                      width: 14,
                      height: 14,
                      viewBox: "0 0 16 16",
                      fill: "none",
                      "aria-hidden": true,
                    },
                    h("path", {
                      d: "m4 6 4 4 4-4",
                      stroke: "currentColor",
                      strokeWidth: 1.5,
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }),
                  ),
                ),
                h(
                  "div",
                  { className: "dmc-menu" },
                  ...state.providers.map((item) =>
                    button(
                      item.name,
                      (event) => {
                        event.currentTarget.closest("details").open = false;
                        controller.selectProvider(item.id);
                      },
                      {
                        key: item.id,
                        variant: "ghost",
                        disabled: busy,
                        "aria-current": item.id === state.provider,
                      },
                    ),
                  ),
                ),
              ),
              button(null, controller.refreshProviders, {
                variant: "ghost",
                size: "sm",
                icon: h(IconRefreshOutlineRegular, { size: 16, "aria-hidden": true }),
                title: t("refreshProviders"),
                "aria-label": t("refreshProviders"),
                disabled: busy,
              }),
              button(t(state.busy === "fetch" ? "fetching" : "fetch"), controller.fetchModels, {
                variant: "primary",
                disabled: busy || !provider?.supported,
              }),
            ),
            provider && !provider.supported && h("p", { className: "dmc-muted" }, provider.reason),
            state.error &&
              h("p", { className: "dmc-message dmc-error", role: "alert" }, state.error),
            state.notice && h("p", { className: "dmc-message", role: "status" }, state.notice),
            state.preview
              ? h(
                  React.Fragment,
                  null,
                  h("p", { className: "dmc-muted" }, `${t("source")} · ${state.preview.endpoint}`),
                  state.preview.partial && h("p", { className: "dmc-muted" }, t("partial")),
                  h(
                    "div",
                    { className: "dmc-filters" },
                    h(Input, {
                      type: "search",
                      className: "dmc-search",
                      value: state.search,
                      placeholder: t("search"),
                      "aria-label": t("search"),
                      onChange: (event) => controller.setSearch(event.target.value),
                    }),
                    h(
                      "div",
                      { className: "dmc-tabs", role: "group", "aria-label": t("title") },
                      ...["all", "configured", "available", "missing", "unsaved"].map((filter) =>
                        button(t(filter), () => controller.setFilter(filter), {
                          key: filter,
                          variant: "ghost",
                          size: "sm",
                          "aria-pressed": state.filter === filter,
                        }),
                      ),
                    ),
                  ),
                  rows.length
                    ? h(
                        "ul",
                        { className: "dmc-list" },
                        ...rows.map((row) => {
                          const model = state.drafts.get(row.id);
                          const expanded = state.expanded === row.id;
                          return h(
                            "li",
                            {
                              key: row.id,
                              className: "dmc-row",
                              "data-unsupported": row.kind === "unsupported",
                            },
                            h(
                              "div",
                              { className: "dmc-rowHead" },
                              h(Checkbox, {
                                checked: state.selected.has(row.id),
                                disabled:
                                  busy ||
                                  row.kind === "unsupported" ||
                                  Boolean(row.blockedReason && !row.current),
                                "aria-label": t("selectModel", { name: model?.name || row.id }),
                                label: "",
                                onChange: (checked) => controller.select(row.id, checked),
                              }),
                              h(
                                "div",
                                { className: "dmc-rowName" },
                                h(
                                  "div",
                                  { className: "dmc-name" },
                                  model?.name || row.id,
                                  row.kind === "unsupported" &&
                                    h("span", { className: "dmc-status" }, t("unsupported")),
                                  row.kind !== "unsupported" &&
                                    row.status === "missing" &&
                                    h(
                                      "span",
                                      { className: "dmc-status", "data-tone": "warning" },
                                      t("missing"),
                                    ),
                                  row.kind !== "unsupported" &&
                                    row.status !== "missing" &&
                                    parameterDifferences(row).length > 0 &&
                                    h(
                                      "span",
                                      { className: "dmc-status", "data-tone": "change" },
                                      t("changed"),
                                    ),
                                  dirtyRow(row, state) &&
                                    h(
                                      "span",
                                      { className: "dmc-status", "data-tone": "warning" },
                                      t("unsaved"),
                                    ),
                                  row.remote?.shutdown_date &&
                                    h(
                                      "span",
                                      { className: "dmc-status", "data-tone": "warning" },
                                      t("shutdownDate", { date: row.remote.shutdown_date }),
                                    ),
                                ),
                                model?.name &&
                                  model.name !== row.id &&
                                  h("div", { className: "dmc-muted" }, row.id),
                              ),
                              row.kind !== "unsupported" &&
                                button(
                                  t(
                                    expanded
                                      ? "collapse"
                                      : row.status === "missing"
                                        ? "view"
                                        : "details",
                                  ),
                                  () => controller.expand(row.id),
                                  {
                                    variant: "outline",
                                    size: "sm",
                                    "aria-expanded": expanded,
                                    "aria-controls": `dmc-details-${row.id}`,
                                  },
                                ),
                            ),
                            expanded && row.kind !== "unsupported" && editFields(row, model),
                          );
                        }),
                      )
                    : h("p", { className: "dmc-empty" }, t("empty")),
                )
              : !state.notice &&
                  h(
                    "p",
                    { className: "dmc-empty" },
                    t(
                      state.busy === "providers"
                        ? "loading"
                        : state.loaded && state.providers.length === 0
                          ? "emptyProviders"
                          : "begin",
                    ),
                  ),
          ),
        ),
        state.preview &&
          h(
            "footer",
            { className: "dmc-footer" },
            h(
              "div",
              { className: "dmc-footerInner" },
              button(t(state.busy === "save" ? "saving" : "save"), controller.save, {
                variant: "primary",
                disabled: busy || !Object.values(controller.changes()).some((rows) => rows.length),
              }),
            ),
          ),
        h(
          Modal,
          {
            open: state.confirmation !== null,
            title: t("confirmTitle"),
            closeLabel: t("close"),
            className: "dmc-dialog",
            onClose: controller.cancelSave,
            footer: h(
              "div",
              { className: "dmc-actions" },
              button(t("cancel"), controller.cancelSave),
              button(t("save"), controller.confirmSave, { variant: "primary" }),
            ),
          },
          h(
            "div",
            { className: "dmc-summary" },
            ...Object.entries(state.confirmation ?? {})
              .filter(([, rows]) => rows.length)
              .map(([kind, rows]) =>
                h(
                  "section",
                  { key: kind },
                  h("h3", null, `${t(kind)} · ${rows.length}`),
                  h(
                    "ul",
                    null,
                    ...rows.map((row) =>
                      h("li", { key: row.id }, state.drafts.get(row.id)?.name || row.id),
                    ),
                  ),
                ),
              ),
          ),
        ),
        h(Modal, {
          open: state.pending !== null,
          title: t("discardTitle"),
          closeLabel: t("close"),
          className: "dmc-dialog",
          onClose: controller.cancelDiscard,
          footer: h(
            "div",
            { className: "dmc-actions" },
            button(t("cancel"), controller.cancelDiscard),
            button(t("discard"), controller.confirmDiscard, { variant: "primary" }),
          ),
        }),
      );
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(ENTRY, DICTIONARIES), "model-catalog: translations");
      const t = ctx.locale.bind(ENTRY);
      const controller = createController(t);
      ctx.effect(() => () => controller.dispose(), "model-catalog: requests");
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.pluginCss = ENTRY;
        tag.textContent = CSS;
        document.head.append(tag);
        return () => tag.remove();
      }, "model-catalog: styles");
      ctx.slots.inject("main", () =>
        ctx.slots.register(
          { name: "main", key: ENTRY, inject: () => ({ controller, t, locale: ctx.locale }) },
          CatalogPage,
        ),
      );
      ctx.slots.inject("sidebar.panellist", () =>
        ctx.slots.register(
          {
            name: "sidebar.panellist",
            id: ENTRY,
            order: 21,
            label: () => t("title"),
            locale: ENTRY,
          },
          ({ size = 16 }) => h(IconDataOutlineRegular, { size, "aria-hidden": true }),
        ),
      );
    }
    return { apply, inject: ["slots", "locale", "connection"] };
  },
});
