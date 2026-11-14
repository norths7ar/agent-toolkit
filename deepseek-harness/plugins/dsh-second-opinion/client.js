window.__ModuleLoader__.load({
  id: "dsh-second-opinion",
  factory: (require) => {
    const React = require("react");
    const { Button, Modal, MarkdownText, DisclosureRow, Tooltip, Input, Menu, MenuGroup, MenuItemButton,
      IconUsersOutlineRegular, IconChevronDownOutlineRegular, IconSearchOutlineRegular, IconCheckOutlineRegular,
      IconStopFillRegular } = require("@deepseek-ai/dsh-client-ui-primitives");
    const h = React.createElement;
    const API = "/api/local-second-opinion";
    const ENTRY = "local-second-opinion";
    const DEFAULT_PROMPT = "请阅读以上讨论，给出你的看法。";
    const statusLabels = { queued: "等待中", running: "生成中", completed: "已完成", error: "失败", cancelled: "已停止", interrupted: "已中断" };
    const markdownLabels = { code: { copyLabel: "复制", copiedLabel: "已复制", toolbarLabels: { codeLabel: "代码", wrapLabel: "自动换行", unwrapLabel: "取消换行" } }, footnotes: "脚注" };
    const active = candidate => candidate.status === "queued" || candidate.status === "running";
    const modelKey = (provider, model) => JSON.stringify([provider, model]);
    const groupName = group => group.provider?.name ?? group.label ?? group.name ?? group.id;
    function composePrompt(base, question) {
      const prompt = base.trim(), input = question.trim();
      return prompt && input ? `${prompt}\n\n请围绕以下问题回答：\n${input}` : prompt || input;
    }
    // Layout belongs to this plugin; surface, controls and reading styles come from DSH.
    const CSS = `
      .dso-action { width:calc(28px + var(--dsh-content-font-delta,0px)); height:calc(28px + var(--dsh-content-font-delta,0px)); border-radius:var(--dsw-radius-sm); color:var(--dsw-alias-label-tertiary); cursor:pointer; background:none; border:0; display:inline-flex; align-items:center; justify-content:center; padding:6px; }
      .dso-action svg { width:calc(17px + var(--dsh-content-font-delta,0px)); height:calc(17px + var(--dsh-content-font-delta,0px)); }
      .dso-action:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); }
      .dso-action:focus-visible { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:2px; }
      .dso-modal { width:min(720px,calc(100vw - 48px)); max-width:none; max-height:calc(100dvh - 112px); overflow-y:auto; }
      .dso-form,.dso-settings { display:flex; flex-direction:column; gap:16px; min-width:0; color:var(--dsw-alias-label-primary); font:14px/22px var(--dsw-font-family); }
      .dso-field { display:flex; flex-direction:column; gap:8px; min-width:0; }
      .dso-label { font-size:13px; line-height:20px; font-weight:500; }
      .dso-textarea { box-sizing:border-box; width:100%; min-height:88px; margin:0; padding:10px 12px; resize:vertical; border:.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font:inherit; line-height:1.6; }
      .dso-textarea::placeholder { color:var(--dsw-alias-label-dimmed); }
      .dso-textarea:hover:not(:disabled) { border-color:var(--dsw-alias-border-l3); }
      .dso-textarea:focus { outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)); outline-offset:1px; }
      .dso-textarea:disabled { opacity:.6; }
      .dso-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .dso-model-menu { display:block; min-width:0; }
      .dso-model-trigger { width:100%; justify-content:space-between; text-align:left; }
      .dso-model-copy { min-width:0; display:flex; align-items:baseline; gap:8px; overflow:hidden; }
      .dso-model-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dso-model-list { width:min(400px,calc(100vw - 80px)); max-height:320px; }
      .dso-model-search { padding:4px 8px 8px; }
      .dso-model-search > span { width:100%; box-sizing:border-box; }
      .dso-model-empty { padding:12px; }
      .dso-muted { color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; }
      .dso-error { color:var(--dsw-alias-state-error-primary); overflow-wrap:anywhere; margin:12px 0 0; }
      .dso-hint { margin:0; }
      .dso-prompt { color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; }
      .dso-prompt summary { cursor:pointer; width:fit-content; }
      .dso-prompt-text { white-space:pre-wrap; overflow-wrap:anywhere; margin:8px 0 0; line-height:1.6; }
      .dso-opinions { margin-top:24px; border-top:.5px solid var(--dsw-alias-border-l4); }
      .dso-opinion { padding:12px 0; border-bottom:.5px solid var(--dsw-alias-border-l4); }
      .dso-opinion:last-child { border-bottom:0; }
      .dso-opinion-title { color:var(--dsw-alias-label-primary); }
      .dso-opinion-meta { display:inline-flex; align-items:center; gap:8px; margin-left:8px; min-width:0; }
      .dso-provider { max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .dso-status { white-space:nowrap; }
      .dso-opinion-body { min-width:0; margin:12px 0 0; }
      .dso-opinion-body > .dso-row { margin-top:16px; }
      .dso-opinion-body > .dso-prompt { margin-top:12px; }
      .dso-settings h2 { margin:0; font-size:16px; line-height:24px; font-weight:500; }
      .dso-settings p { margin:0; }
      .dso-settings .dso-textarea { min-height:180px; }
      @media (max-width:600px) { .dso-modal { width:calc(100vw - 24px); } .dso-provider { max-width:100px; } }
    `;

    function ModelPicker({ groups, value, onChange, disabled }) {
      const [open, setOpen] = React.useState(false);
      const [query, setQuery] = React.useState("");
      const id = React.useId();
      const search = React.useRef(null);
      const close = React.useCallback(() => setOpen(false), []);
      React.useEffect(() => { if (open) search.current?.focus(); else setQuery(""); }, [open]);
      React.useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
      const selectedGroup = groups?.find(group => group.models.some(model => modelKey(group.id, model.id) === value));
      const selected = selectedGroup?.models.find(model => modelKey(selectedGroup.id, model.id) === value);
      const needle = query.trim().toLocaleLowerCase();
      const filtered = (groups ?? []).map(group => ({ ...group, models: group.models.filter(model =>
        `${model.label ?? model.name ?? model.id} ${model.id} ${groupName(group)}`.toLocaleLowerCase().includes(needle)) })).filter(group => group.models.length);
      return h("div", { className: "dso-field" },
        h("span", { className: "dso-label", id }, "模型"),
        h(Menu, { open, onClose: close, className: "dso-model-menu", listClassName: "dso-model-list", minWidthFromAnchor: true,
          anchor: h(Button, { variant: "outline", className: "dso-model-trigger", disabled, "aria-labelledby": id,
            "aria-haspopup": "menu", "aria-expanded": open, onClick: () => setOpen(value => !value) },
            h("span", { className: "dso-model-copy" }, h("span", { className: "dso-model-name" }, selected?.label ?? selected?.name ?? selected?.id ?? (groups === null ? "正在加载模型…" : "选择模型")),
              selectedGroup && h("span", { className: "dso-muted" }, groupName(selectedGroup))), h(IconChevronDownOutlineRegular, { size: 14 })) },
          h("div", { className: "dso-model-search" }, h(Input, { ref: search, value: query, role: "searchbox", "aria-label": "搜索模型", placeholder: "搜索模型…", icon: h(IconSearchOutlineRegular, { size: 14 }),
            onChange: event => setQuery(event.target.value), onKeyDown: event => { if (event.key === "Enter") event.preventDefault(); } })),
          ...filtered.map(group => h(MenuGroup, { key: group.id, label: groupName(group) },
            ...group.models.map(model => { const key = modelKey(group.id, model.id); return h(MenuItemButton, { key, current: value === key,
              icon: value === key ? h(IconCheckOutlineRegular, { size: 14 }) : undefined,
              onSelect: () => { onChange(key); close(); } }, model.label ?? model.name ?? model.id); }))),
          !filtered.length && h("div", { className: "dso-muted dso-model-empty" }, "没有匹配的模型")));
    }

    function PromptPreview({ text, label = "查看本次提示词" }) {
      return h("details", { className: "dso-prompt" }, h("summary", null, label),
        h("div", { className: "dso-prompt-text" }, text || "填写本次提问，或在设置中添加默认提示词。"));
    }

    function Panel({ sessionId, messageId, request, catalog, openSession, close }) {
      const [models, setModels] = React.useState(null);
      const [selection, setSelection] = React.useState("");
      const [instruction, setInstruction] = React.useState("");
      const [defaultPrompt, setDefaultPrompt] = React.useState(null);
      const [candidates, setCandidates] = React.useState([]);
      const [expanded, setExpanded] = React.useState(null);
      const [error, setError] = React.useState("");
      const [loadError, setLoadError] = React.useState("");
      const [pending, setPending] = React.useState(false);
      const [action, setAction] = React.useState(null);
      const [catalogAttempt, setCatalogAttempt] = React.useState(0);
      const lifetime = React.useRef(null);
      const refresh = React.useRef(null);
      const retry = React.useRef(null);
      const initialized = React.useRef(false);
      const revision = React.useRef(0);
      const instructionId = React.useId();

      React.useEffect(() => {
        const controller = new AbortController();
        lifetime.current = controller;
        let loading = false;
        async function poll() {
          if (loading || controller.signal.aborted) return;
          loading = true;
          const current = revision.current;
          try {
            const result = await request(`state?sessionId=${encodeURIComponent(sessionId)}`, undefined, controller.signal);
            if (!controller.signal.aborted && current === revision.current) {
              // The client can reload before the already-running backend module.
              // Do not enable invitations against the old eager-fork protocol.
              if (typeof result.defaultPrompt !== "string") {
                setDefaultPrompt(null);
                setLoadError("第二意见后端尚未更新。请在插件页面停用后重新启用，再重新打开此窗口。");
                return;
              }
              setCandidates(result.candidates);
              setDefaultPrompt(result.defaultPrompt);
              if (!initialized.current) {
                initialized.current = true;
                setExpanded(result.candidates.filter(item => String(item.anchorMessageId) === String(messageId)).at(-1)?.id ?? null);
              }
              setLoadError("");
            }
          } catch (failure) { if (!controller.signal.aborted) setLoadError(failure.message); }
          finally { loading = false; }
        }
        refresh.current = poll;
        void poll();
        const timer = setInterval(poll, 1000);
        return () => { controller.abort(); clearInterval(timer); refresh.current = null; };
      }, [sessionId, messageId, request]);

      React.useEffect(() => {
        let live = true;
        setModels(null);
        catalog().then(value => {
          if (!live) return;
          setModels(value.groups);
          if (value.failures?.length) setError("部分模型提供方未能加载，请检查模型配置。");
        }).catch(failure => { if (live) { setModels([]); setError(failure.message); } });
        return () => { live = false; };
      }, [catalog, catalogAttempt]);

      const promptText = defaultPrompt === null ? "" : composePrompt(defaultPrompt, instruction);
      const busy = candidates.some(active);
      async function invite(event) {
        event.preventDefault();
        if (!selection || pending || busy || !promptText) return;
        const [provider, model] = JSON.parse(selection);
        const payload = { sessionId, anchorMessageId: messageId, provider, model, instruction };
        const fingerprint = JSON.stringify({ ...payload, promptText });
        if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, requestId: crypto.randomUUID() };
        setPending(true); setError(""); revision.current++;
        try {
          const candidate = await request("invite", { ...payload, requestId: retry.current.requestId }, lifetime.current.signal);
          if (lifetime.current.signal.aborted) return;
          revision.current++;
          retry.current = null;
          initialized.current = true;
          setCandidates(items => [...items.filter(item => item.id !== candidate.id), candidate]);
          setExpanded(candidate.id);
          void refresh.current?.();
        } catch (failure) { if (!lifetime.current.signal.aborted) setError(failure.message); }
        finally { if (!lifetime.current.signal.aborted) setPending(false); }
      }
      async function candidateAction(kind, candidate) {
        if (action) return;
        setAction({ kind, id: candidate.id }); setError("");
        try {
          const result = await request(kind, { sessionId, id: candidate.id }, lifetime.current.signal);
          if (lifetime.current.signal.aborted) return;
          if (kind === "continue") { await openSession(result.sessionId); close(); }
          else { revision.current++; void refresh.current?.(); }
        } catch (failure) { if (!lifetime.current.signal.aborted) setError(failure.message); }
        finally { if (!lifetime.current.signal.aborted) setAction(null); }
      }
      const matching = candidates.filter(candidate => String(candidate.anchorMessageId) === String(messageId));
      return h(Modal, { open: true, onClose: close, title: "第二意见", closeLabel: "关闭", className: "dso-modal",
        description: "邀请另一模型给出看法，想追问时再继续聊。" },
        h("form", { className: "dso-form", onSubmit: invite },
          h(ModelPicker, { groups: models, value: selection, onChange: setSelection, disabled: pending || models === null }),
          h("div", { className: "dso-field" }, h("label", { className: "dso-label", htmlFor: instructionId }, "本次提问（可选）"),
            h("textarea", { id: instructionId, className: "dso-textarea", value: instruction, disabled: pending,
              placeholder: "例如：你觉得这段分析写得怎么样？", onChange: event => setInstruction(event.target.value) })),
          defaultPrompt !== null && h(PromptPreview, { text: promptText }),
          h("div", { className: "dso-row" }, h(Button, { type: "submit", variant: "primary", size: "sm", disabled: !selection || pending || busy || !promptText }, pending ? "正在邀请…" : "邀请回应"),
            models?.length === 0 && h(Button, { variant: "ghost", size: "sm", onClick: () => { setError(""); setCatalogAttempt(value => value + 1); } }, "重新加载模型"),
            busy && h("span", { className: "dso-muted" }, "等待当前意见完成，或先停止生成。"))),
        error && h("p", { className: "dso-error", role: "alert" }, error),
        loadError && h("p", { className: "dso-error", role: "status" }, `状态更新失败：${loadError}`),
        matching.length > 0 && h("div", { className: "dso-opinions", "aria-label": "模型意见" },
          ...matching.map(candidate => {
            const group = models?.find(item => item.id === candidate.provider);
            const model = group?.models.find(item => item.id === candidate.model);
            const name = model?.label ?? model?.name ?? candidate.model;
            const running = active(candidate);
            return h(DisclosureRow, { key: candidate.id, className: "dso-opinion", titleClassName: "dso-opinion-title",
              title: name, icon: h(IconUsersOutlineRegular, { size: 14 }), open: expanded === candidate.id, expandable: true,
              expandOnRowClick: true, keepContentWhenOpen: true, running,
              onToggle: () => setExpanded(value => value === candidate.id ? null : candidate.id),
              collapsedContent: h("span", { className: "dso-muted dso-opinion-meta" },
                h("span", { className: "dso-provider" }, group ? groupName(group) : candidate.provider),
                h("span", { className: "dso-status", role: "status" }, statusLabels[candidate.status] ?? candidate.status)) },
              h("div", { className: "dso-opinion-body" },
                candidate.text ? h(MarkdownText, { text: candidate.text, streaming: running, labels: markdownLabels }) :
                  running && h("p", { className: "dso-muted dso-hint" }, "正在等待回复…"),
                candidate.error && h("p", { className: "dso-error", role: "alert" }, candidate.error),
                candidate.promptText && h(PromptPreview, { text: candidate.promptText, label: "查看本次提示词" }),
                h("div", { className: "dso-row" },
                  running ? h(Button, { size: "sm", variant: "ghost", icon: h(IconStopFillRegular, { size: 14 }), disabled: action !== null,
                    onClick: () => candidateAction("cancel", candidate) }, action?.id === candidate.id ? "正在停止…" : "停止") :
                    candidate.canContinue && h(Button, { size: "sm", variant: "outline", disabled: action !== null,
                      onClick: () => candidateAction("continue", candidate) }, action?.id === candidate.id ? "正在打开…" : "继续聊"))));
          })));
    }

    function Settings({ form }) {
      const subscribe = React.useCallback(listener => form.subscribe(listener), [form]);
      const read = React.useCallback(() => form.getSnapshot(), [form]);
      const snapshot = React.useSyncExternalStore(subscribe, read);
      const [draft, setDraft] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      const [feedback, setFeedback] = React.useState(null);
      const id = React.useId();
      const ready = snapshot.status === "ready";
      const value = draft ?? snapshot.value?.defaultPrompt ?? DEFAULT_PROMPT;
      const disabled = !ready || !snapshot.writable || saving;
      const dirty = draft !== null && draft !== snapshot.value?.defaultPrompt;
      async function save() {
        setSaving(true); setFeedback(null);
        try {
          if (await form.set("defaultPrompt", value)) { setDraft(null); setFeedback({ text: "已保存" }); }
          else setFeedback({ error: true, text: "未能保存，请重试。" });
        } catch (failure) { setFeedback({ error: true, text: failure.message }); }
        finally { setSaving(false); }
      }
      return h("section", { className: "dso-settings", "aria-label": "第二意见" },
        h("h2", null, "第二意见"), h("p", { className: "dso-muted" }, "设置邀请其他模型时使用的默认提示词。本次提问在邀请时填写。"),
        !ready && h("p", { role: "status" }, snapshot.status === "unavailable" ? "插件配置不可用。" : "正在加载设置…"),
        ready && !snapshot.writable && h("p", { role: "status" }, "当前配置为只读。"),
        h("div", { className: "dso-field" }, h("label", { className: "dso-label", htmlFor: id }, "默认提示词"),
          h("textarea", { id, className: "dso-textarea", value, disabled, onChange: event => { setDraft(event.target.value); setFeedback(null); } }),
          h("p", { className: "dso-muted" }, "可以留空，只发送本次提问。修改仅影响之后邀请的意见。")),
        h("div", { className: "dso-row" },
          h(Button, { size: "sm", variant: "primary", disabled: disabled || !dirty, onClick: save }, saving ? "正在保存…" : "保存"),
          h(Button, { size: "sm", variant: "ghost", disabled, onClick: () => { setDraft(DEFAULT_PROMPT); setFeedback(null); } }, "恢复默认"),
          feedback && h("span", { className: feedback.error ? "dso-error" : "dso-muted", role: feedback.error ? "alert" : "status" }, feedback.text)));
    }

    function Action(props) {
      const [open, setOpen] = React.useState(false);
      return h(React.Fragment, null,
        h(Tooltip, { label: "第二意见", side: "bottom" }, h("button", { type: "button", className: "dso-action", "aria-label": "第二意见",
          onClick: () => setOpen(true), "aria-haspopup": "dialog" }, h(IconUsersOutlineRegular))),
        open && h(Panel, { ...props, key: `${props.sessionId}:${props.messageId}`, close: () => setOpen(false) }));
    }

    function apply(ctx) {
      const send = globalThis.__DSH_TRANSPORT__?.fetch ?? ((url, init) => globalThis.fetch(url, init));
      async function request(path, data, signal) {
        const response = await send(`${API}/${path}`, data === undefined ? { signal } : {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data), signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `请求失败 (${response.status})`);
        return result;
      }
      async function catalog() {
        const result = await ctx.remote.session.modelCatalog();
        if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
        return result.value;
      }
      ctx.effect(() => {
        const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
        return () => style.remove();
      });
      ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
        name: "conversation.chat.assistant-actions", id: ENTRY, order: 20,
        inject: () => ({ request, catalog, openSession: id => ctx.uiWorkspace.openSession(id) }),
      }, Action));
      const form = ctx.configForms.get(ENTRY);
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section", id: ENTRY, order: 45, label: () => "第二意见", inject: () => ({ form }),
      }, Settings));
    }
    return { apply, inject: ["slots", "remote", "remote.session", "uiWorkspace", "configForms"] };
  },
});
