window.__ModuleLoader__.load({
  id: "dsh-latest-message-edit",
  factory: (require) => {
    const React = require("react");
    const { createPortal } = require("react-dom");
    const { Button, IconEditOutline16, IconEditOutlineRegular, Tooltip } = require("@deepseek-ai/dsh-client-ui-primitives");
    const EditIcon = IconEditOutline16 ?? IconEditOutlineRegular;
    const h = React.createElement;
    const API = "/api/local-latest-message-edit";
    const CSS = `
      .dlme-anchor { display: none; }
      .dlme-action { display: inline-flex; align-items: center; }
      .dlme-pencil { width:calc(28px + var(--dsh-content-font-delta,0px))!important;
        height:calc(28px + var(--dsh-content-font-delta,0px))!important; min-width:0!important; padding:6px!important;
        border:0!important; background:transparent!important; box-shadow:none!important;
        border-radius:var(--dsw-radius-sm)!important; color:var(--dsw-alias-label-tertiary)!important; }
      .dlme-pencil:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover)!important;
        color:var(--dsw-alias-label-secondary)!important; }
      .dlme-pencil svg { width:calc(15px + var(--dsh-content-font-delta,0px)); height:calc(15px + var(--dsh-content-font-delta,0px)); }
      .dlme-bar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 12px; padding:4px 0 8px;
        border-bottom:.5px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-secondary);
        font:12px/18px var(--dsw-font-family); }
      .dlme-bar-copy { flex:1; min-width:160px; overflow-wrap:anywhere; }
      .dlme-bar strong { font-weight:500; color:var(--dsw-alias-label-primary); }
      .dlme-bar button { flex:none; }
      .dlme-error { color:var(--dsw-alias-state-error-primary); }
      .dlme-history { display:flex; justify-content:flex-end; }
      .dlme-history button { font:12px/18px var(--dsw-font-family); }
      [data-dlme-hidden] { display:none!important; }
      [data-dlme-collapsed] > :not(.dlme-history) { display:none!important; }
    `;

    // The installed input facade accepts the same semantic document as DSH's
    // own persisted draft. Keep only reference data, not Lexical occurrence IDs.
    function capture(input, shell) {
      const document = shell.draftSnapshot;
      return {
        document: {
          text: document.text,
          references: document.references.map(reference => ({ ...reference })),
          ...(document.command ? { command: { ...document.command } } : {}),
        },
        ids: [...input.attachmentIds],
      };
    }
    const fingerprint = snapshot => JSON.stringify(snapshot);
    const empty = snapshot => !snapshot.document.text && !snapshot.ids.length;
    const busy = input => input.phase === "adjudicating" || input.phase === "submitting";

    function createRuntime(ctx) {
      const records = new Map();
      const lifetime = new AbortController();
      const send = globalThis.__DSH_TRANSPORT__?.fetch ?? ((url, init) => globalThis.fetch(url, init));
      function record(id) {
        if (!records.has(id)) {
          let saved;
          try { saved = JSON.parse(sessionStorage.getItem(`dsh.latest-message-edit:${id}`)); }
          catch { /* Navigation still retains the in-memory record if storage is unavailable. */ }
          records.set(id, {
            state: null, edit: saved?.edit ?? null, operation: null, restore: saved?.restore ?? null,
            error: "", warning: "", revision: 0, epoch: 0, listeners: new Set(),
            storageKey: `dsh.latest-message-edit:${id}`,
          });
        }
        return records.get(id);
      }
      function persist(r) {
        try {
          if (r.edit || r.restore) sessionStorage.setItem(r.storageKey, JSON.stringify({ edit: r.edit, restore: r.restore }));
          else sessionStorage.removeItem(r.storageKey);
        } catch { /* DSH persists the working draft; the backup also stays in memory. */ }
      }
      function publish(r) {
        r.revision++;
        persist(r);
        for (const listener of r.listeners) listener();
      }
      // Resolve the exact retained binding on every read. No promise callback
      // writes to a captured composer from a previous navigation generation.
      function frame(id, actions) {
        if (lifetime.signal.aborted) return null;
        const binding = ctx.sessions.binding(id);
        const conversation = binding?.ctx.get("conversation");
        const shell = conversation?.input.for(binding.ctx);
        if (!shell || shell.actions !== actions) return null;
        const input = shell.state.getSnapshot();
        return { binding, shell, input, conversation, snapshot: capture(input, shell) };
      }
      // Match the native default-sink path: occurrence offsets address the
      // clipboard projection, and each source owns its model-text serialization.
      async function serializeDraft(current, signal) {
        const draft = current.input.draft;
        const occurrences = current.input.occurrences;
        if (!occurrences.length) return draft.trim();
        const triggers = current.binding.ctx.get("inputTriggers")?.sessionOf(current.binding.ctx);
        if (!triggers) throw new Error("引用暂不可用，请重试。");
        const parts = await Promise.all(occurrences.map(async occurrence => ({
          offset: occurrence.offset, length: occurrence.length,
          text: await triggers.serializeReference(occurrence.source, occurrence.ref, signal),
        })));
        let text = "";
        let cursor = 0;
        for (const part of parts) {
          text += draft.slice(cursor, part.offset) + part.text;
          cursor = part.offset + part.length;
        }
        return (text + draft.slice(cursor)).trim();
      }
      async function request(path, data, signal = lifetime.signal) {
        const response = await send(`${API}/${path}`, data === undefined ? { signal } : {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(data), signal,
        });
        let result;
        try { result = await response.json(); }
        catch { throw new Error(`修改服务返回了无法读取的响应 (${response.status})。请刷新状态后再操作。`); }
        if (!response.ok) throw new Error(result.error || `修改失败 (${response.status})`);
        return result;
      }
      async function action(id, kind, payload, finish) {
        const r = record(id);
        if (r.operation) return;
        const operation = { kind, generation: ++r.epoch };
        r.operation = operation;
        r.error = "";
        publish(r);
        try {
          const data = typeof payload === "function" ? await payload(lifetime.signal) : payload;
          if (lifetime.signal.aborted || r.operation !== operation) return;
          const result = await request(kind, { sessionId: id, ...data });
          if (lifetime.signal.aborted || r.operation !== operation) return;
          finish(result);
        } catch (error) {
          if (lifetime.signal.aborted || r.operation !== operation) return;
          r.error = error.message;
        } finally {
          if (r.operation === operation) {
            r.operation = null;
            r.epoch++;
            publish(r);
          }
        }
      }
      function settle(r, guard, warning = "") {
        r.restore = r.edit?.loaded && r.edit.before ? { snapshot: r.edit.before, guard } : null;
        r.edit = null;
        r.error = "";
        r.warning = typeof warning === "string" ? warning : warning ? String(warning) : "";
      }
      return {
        record, publish, frame,
        active(id) {
          return !lifetime.signal.aborted && document.visibilityState === "visible"
            && ctx.uiSession.current.getSnapshot().key === id
            && (ctx.layout.panelInfo.getSnapshot().activePanelId ?? "conversation") === "conversation";
        },
        async poll(id, signal, valid) {
          const r = record(id);
          const epoch = r.epoch;
          const state = await request(`state?sessionId=${encodeURIComponent(id)}`, undefined, signal);
          if (!valid() || epoch !== r.epoch || r.operation) return;
          r.state = state;
          // Recover an admitted send after a lost HTTP response without sending
          // again. The durable edit record, not a timer, establishes admission.
          if (r.edit?.submitted && !state.editing
            && state.edits.some(edit => edit.targetId === r.edit.targetId)) {
            settle(r, r.edit.submitted, "修改已发送，已从会话记录确认；不会重复发送。");
          } else if (!r.edit && state.editing && !r.restore) {
            r.edit = { ...state.editing, before: null, loaded: false, seed: null };
          }
          if (state.editing?.recovery) r.warning = state.editing.recovery;
          publish(r);
        },
        begin(id, actions, target) {
          const r = record(id);
          const current = frame(id, actions);
          if (!current || busy(current.input) || r.restore || r.edit || r.operation) return;
          const seed = fingerprint(current.snapshot);
          r.warning = "";
          void action(id, "begin", { targetId: target.id }, result => {
            r.edit = { ...result, before: current.snapshot, loaded: false, seed };
          });
        },
        load(id, actions) {
          const r = record(id);
          const current = frame(id, actions);
          if (!current || !r.edit || r.edit.loaded || r.operation || busy(current.input)) return;
          r.edit.before = current.snapshot;
          r.edit.loaded = true;
          // These public actions only detach IDs. Unlike the preview's removal
          // callback, they do not release registry entries or abort uploads.
          actions.pruneAttachments([]);
          actions.setDraft(r.edit.text);
          actions.persistDraft();
          current.shell.focus();
          r.error = "";
          publish(r);
        },
        commit(id, actions) {
          const r = record(id);
          const current = frame(id, actions);
          if (!current || !r.edit?.loaded || r.operation || busy(current.input)) return;
          const snapshot = current.snapshot;
          if (snapshot.ids.length) {
            r.error = "编辑消息暂不支持新增附件。请移除新增附件后发送，或取消编辑保留草稿。";
          } else if (snapshot.document.command) {
            r.error = "编辑消息时不能执行命令，请移除命令芯片。";
          } else if (!current.input.draft.trim()) {
            r.error = "请输入修改后的消息。";
          } else {
            const guard = fingerprint(snapshot);
            r.edit.submitted = guard;
            const token = r.edit.token;
            void action(id, "commit", async signal => ({ token, text: await serializeDraft(current, signal) }), result => {
              if (result.accepted !== true) throw new Error("修改尚未确认，请刷新状态后重试。");
              settle(r, guard, result.warning);
            });
            return;
          }
          publish(r);
        },
        cancel(id, actions) {
          const r = record(id);
          const current = frame(id, actions);
          if (!current || !r.edit || r.operation) return;
          const guard = fingerprint(current.snapshot);
          // New edit-time attachments stay resident too. They cannot be sent by
          // commit, but cancel must not discard them while restoring the text.
          void action(id, "cancel", { token: r.edit.token }, result => {
            if (result.accepted !== true) throw new Error("尚未确认取消，请重试。");
            settle(r, guard);
            if (r.restore) r.restore.snapshot = {
              ...r.restore.snapshot,
              ids: [...new Set([...r.restore.snapshot.ids, ...current.snapshot.ids])],
            };
          });
        },
        restore(id, actions) {
          const r = record(id);
          const current = frame(id, actions);
          if (!r.restore || !current || busy(current.input) || !this.active(id)) return;
          if (fingerprint(current.snapshot) !== r.restore.guard && !empty(current.snapshot)) return;
          const saved = r.restore.snapshot;
          // addAttachments, unlike removing a preview through the attachment UI,
          // does not release files. Keep any still-resident IDs without duplicates.
          const available = new Set(current.conversation.resolveDraftAttachments(saved.ids).map(attachment => attachment.id));
          if (available.size < saved.ids.length) r.warning = [r.warning,
            "原草稿的部分附件已不在浏览器中，请重新添加这些附件。"].filter(Boolean).join(" ");
          const missing = saved.ids.filter(attachment => available.has(attachment) && !current.snapshot.ids.includes(attachment));
          if (missing.length && !actions.addAttachments(missing)) return;
          actions.setDraft(saved.document);
          actions.persistDraft();
          r.restore = null;
          publish(r);
        },
        dispose() {
          lifetime.abort();
          // Navigation only unmounts Bridge, so its parked IDs stay registered.
          // On plugin unload, hand them back to live shells or release orphans.
          for (const [id, r] of records) {
            const saved = r.edit?.loaded ? r.edit.before : r.restore?.snapshot;
            if (!saved?.ids.length) continue;
            const binding = ctx.sessions.binding(id);
            const conversation = binding?.ctx.get("conversation") ?? ctx.get("conversation");
            if (!conversation) continue;
            const ids = conversation.resolveDraftAttachments(saved.ids).map(attachment => attachment.id);
            const shell = binding && conversation.input.for(binding.ctx);
            const release = () => {
              for (const attachment of ids) conversation.releaseDraftAttachment(attachment);
            };
            if (!shell || shell.disposed) { release(); continue; }
            const attach = () => {
              const input = shell.state.getSnapshot();
              const unchanged = r.restore && fingerprint(capture(input, shell)) === r.restore.guard;
              const attached = new Set(input.attachmentIds);
              const accepted = shell.actions.addAttachments(ids.filter(attachment => !attached.has(attachment)));
              if (accepted && unchanged) {
                r.restore.guard = fingerprint(capture(shell.state.getSnapshot(), shell));
                persist(r);
              }
              return accepted;
            };
            if (attach()) continue;
            // A native admission can briefly lock attachment changes. The
            // Session scope owns this handoff if it outlives the plugin.
            let restored = false;
            const off = shell.state.subscribe(() => {
              if (restored) return;
              if (shell.disposed) { off(); release(); return; }
              const locked = busy(shell.state.getSnapshot());
              if (locked) return;
              restored = true;
              attach();
              off();
            });
            binding.ctx.effect(() => () => { off(); if (!restored) release(); });
          }
        },
      };
    }

    // DSH has no public user-action seat or before-submit hook in this installed
    // version. This adapter is deliberately confined to one conversation DOM
    // occurrence and only consumes submission gestures during a transaction.
    function installCapture(root, editing, submit) {
      let composing = false;
      let compositionEnded = -Infinity;
      const inside = event => event.target instanceof Element
        && event.target.closest("[data-conversation-session]") === root;
      const consume = event => { event.preventDefault(); event.stopImmediatePropagation(); };
      const onStart = event => { if (inside(event)) composing = true; };
      const onEnd = event => { if (inside(event)) { composing = false; compositionEnded = performance.now(); } };
      const onKey = event => {
        if (!editing() || !inside(event) || !event.target.closest("[data-composer-input]")) return;
        if (event.key !== "Enter" || event.shiftKey && !event.ctrlKey && !event.metaKey) return;
        if (event.isComposing || event.keyCode === 229 || composing) return;
        // A post-composition Enter must never fall through to ordinary Send.
        if (performance.now() - compositionEnded < 100) { consume(event); return; }
        consume(event);
        if (!event.repeat && !event.altKey && !(event.ctrlKey && event.metaKey) && !event.shiftKey) submit();
      };
      const onClick = event => {
        if (!editing() || !inside(event)) return;
        const button = event.target.closest('button[class*="_primary"]');
        if (!button?.closest("[data-composer-card]")) return;
        consume(event);
        submit();
      };
      const onSubmit = event => {
        if (!editing() || !inside(event) || !event.target.closest("[data-composer-seat]")) return;
        consume(event);
        submit();
      };
      const handlers = { keydown: onKey, click: onClick, submit: onSubmit, compositionstart: onStart, compositionend: onEnd };
      for (const [type, listener] of Object.entries(handlers)) document.addEventListener(type, listener, true);
      return () => {
        for (const [type, listener] of Object.entries(handlers)) document.removeEventListener(type, listener, true);
      };
    }

    function Bridge({ sessionId, useInput, inputActions, useChat, runtime }) {
      const anchor = React.useRef(null);
      const r = runtime.record(sessionId);
      React.useSyncExternalStore(React.useCallback(listener => {
        r.listeners.add(listener);
        return () => r.listeners.delete(listener);
      }, [r]), () => r.revision);
      const input = useInput(state => state);
      const chat = useChat(state => state);
      const [seats, setSeats] = React.useState({ pencil: null, bar: null, histories: [] });
      const latest = React.useRef(null);
      latest.current = { r, input, chat, sessionId, inputActions };

      React.useLayoutEffect(() => {
        if (!input) return;
        const current = runtime.frame(sessionId, inputActions);
        if (!current) return;
        // A plugin reload may have handed these IDs back to the native shell.
        // Detach them again before showing an active edit; never hide new IDs.
        if (r.edit?.loaded) {
          const parked = new Set(r.edit.before.ids);
          if (current.input.attachmentIds.some(id => parked.has(id))) {
            inputActions.pruneAttachments(current.input.attachmentIds.filter(id => !parked.has(id)));
          }
        }
        if (r.edit && !r.edit.loaded && r.edit.seed !== null
          && fingerprint(current.snapshot) === r.edit.seed && runtime.active(sessionId)) {
          runtime.load(sessionId, inputActions);
        }
        runtime.restore(sessionId, inputActions);
      }, [runtime, sessionId, inputActions, input, r.revision]);

      React.useEffect(() => {
        const root = anchor.current?.closest("[data-conversation-session]");
        if (!root || root.getAttribute("data-conversation-session") !== sessionId) return;
        let alive = true;
        let polling = false;
        let frame = 0;
        let controller;
        let lastPencil = null;
        let lastBar = null;
        let lastHistoryKey = "";
        let serial = 0;
        const hosts = new Set();
        const historySeats = new Map();
        const touched = new Set();
        const lockedCards = new Map();
        const unlock = (card, previous) => {
          if (!previous.inert) card.removeAttribute("inert");
          if (previous.busy === null) card.removeAttribute("aria-busy");
          else card.setAttribute("aria-busy", previous.busy);
          if (previous.focused && card.isConnected && runtime.active(sessionId)
            && document.activeElement === document.body) {
            runtime.frame(sessionId, latest.current.inputActions)?.shell.focus();
          }
        };
        // Lock synchronously when commit starts, before a second keystroke can
        // change the submitted text. Native widgets remain otherwise untouched.
        const syncLock = () => {
          const card = root.querySelector("[data-composer-card]");
          const locked = r.operation?.kind === "commit";
          for (const [element, previous] of lockedCards) {
            if (locked && element === card) continue;
            unlock(element, previous);
            lockedCards.delete(element);
          }
          if (locked && card && !lockedCards.has(card)) {
            lockedCards.set(card, { inert: card.hasAttribute("inert"), busy: card.getAttribute("aria-busy"),
              focused: card.contains(document.activeElement) });
            card.setAttribute("inert", "");
            card.setAttribute("aria-busy", "true");
          }
        };
        const addHost = className => {
          const host = document.createElement("span");
          host.className = className;
          host.dataset.dlmeSeat = String(++serial);
          hosts.add(host);
          return host;
        };
        const poll = async () => {
          if (!alive || polling || !runtime.active(sessionId) || r.operation || !root.isConnected) return;
          polling = true;
          const epoch = r.epoch;
          controller = new AbortController();
          try { await runtime.poll(sessionId, controller.signal, () => alive && runtime.active(sessionId)); }
          catch (error) {
            if (alive && !controller.signal.aborted && epoch === r.epoch && r.edit && !r.operation) {
              r.error = error.message;
              runtime.publish(r);
            }
          } finally { polling = false; }
        };
        const reconcile = () => {
          frame = 0;
          if (!alive || !root.isConnected) return;
          syncLock();
          const current = latest.current;
          const state = r.state;
          let pencil = null;
          const histories = [];
          for (const wrapper of root.querySelectorAll("[data-chat-node-key]")) {
            if (wrapper.closest("[data-conversation-session]") !== root) continue;
            const node = current.chat?.nodes.get(wrapper.getAttribute("data-chat-node-key"));
            if (!node) continue;
            // Chat adds fractional ordering offsets to synthetic stopped/tail
            // nodes; /state ranges name the underlying durable event sequence.
            const seq = Math.floor(node.data?.seq ?? node.data?.controlAnchorSeq ?? node.anchorSeq);
            const hidden = state?.hidden.some(range => seq >= range.startSeq && seq <= range.endSeq) ?? false;
            wrapper.toggleAttribute("data-dlme-hidden", hidden);
            touched.add(wrapper);
            const human = node.kind === "user" || node.kind === "steering";
            const before = !hidden && human
              && state?.edits.some(edit => edit.mode === "continue" && String(edit.targetId) === String(node.id));
            let history = historySeats.get(wrapper);
            if (before) {
              if (!history?.isConnected) {
                history = addHost("dlme-history");
                wrapper.prepend(history);
                wrapper.setAttribute("data-dlme-collapsed", "");
                historySeats.set(wrapper, history);
              }
              histories.push({ host: history, wrapper, key: history.dataset.dlmeSeat });
            } else if (history) {
              history.remove();
              historySeats.delete(wrapper);
              wrapper.removeAttribute("data-dlme-collapsed");
            }
            const target = state?.target;
            if (!hidden && !before && human && target
              && (String(node.id) === String(target.id) || seq === target.seq)) {
              const actions = wrapper.querySelector('[data-clock="start"]');
              const copy = actions?.querySelector("button");
              if (copy) {
                pencil = actions.querySelector(":scope > .dlme-action");
                if (!pencil) {
                  pencil = addHost("dlme-action");
                  let copySeat = copy;
                  while (copySeat.parentElement !== actions) copySeat = copySeat.parentElement;
                  copySeat.after(pencil);
                }
              }
            }
          }
          for (const group of root.querySelectorAll("[data-chat-group-key]")) {
            const members = [...group.querySelectorAll("[data-chat-node-key]")];
            group.toggleAttribute("data-dlme-hidden", members.length > 0
              && members.every(member => member.hasAttribute("data-dlme-hidden")));
            touched.add(group);
          }
          for (const host of hosts) if (host.className === "dlme-action" && host !== pencil) host.remove();
          const card = root.querySelector("[data-composer-card]");
          let bar = card?.querySelector(":scope > .dlme-bar-seat") ?? null;
          if (card && !bar) {
            bar = addHost("dlme-bar-seat");
            card.prepend(bar);
          }
          const historyKey = histories.map(item => item.key).join(",");
          if (pencil !== lastPencil || bar !== lastBar || historyKey !== lastHistoryKey) {
            lastPencil = pencil; lastBar = bar; lastHistoryKey = historyKey;
            setSeats({ pencil, bar, histories });
          }
        };
        const schedule = () => { if (alive && !frame) frame = requestAnimationFrame(reconcile); };
        const unsubscribe = () => { syncLock(); schedule(); void poll(); };
        r.listeners.add(unsubscribe);
        const observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, subtree: true });
        const removeCapture = installCapture(root, () => {
          if (r.edit || r.operation?.kind === "begin") return true;
          const current = r.restore && runtime.frame(sessionId, latest.current.inputActions);
          return current && fingerprint(current.snapshot) === r.restore.guard;
        },
          () => runtime.commit(sessionId, latest.current.inputActions));
        const interval = setInterval(() => { schedule(); void poll(); }, 1500);
        const onVisible = () => { schedule(); void poll(); };
        document.addEventListener("visibilitychange", onVisible);
        reconcile();
        void poll();
        return () => {
          alive = false;
          controller?.abort();
          clearInterval(interval);
          cancelAnimationFrame(frame);
          document.removeEventListener("visibilitychange", onVisible);
          r.listeners.delete(unsubscribe);
          removeCapture();
          observer.disconnect();
          for (const [card, previous] of lockedCards) unlock(card, previous);
          lockedCards.clear();
          for (const host of hosts) host.remove();
          for (const wrapper of touched) {
            wrapper.removeAttribute("data-dlme-hidden");
            wrapper.removeAttribute("data-dlme-collapsed");
          }
        };
      }, [runtime, sessionId, r]);

      const edit = r.edit;
      const pending = r.operation?.kind;
      const title = r.state?.target?.running
        ? r.state.target.mode === "withdraw" ? "撤回并修改最新消息" : "停止并修改最新消息"
        : "修改最新消息";
      const disabled = !!(pending || edit || r.restore || !input || busy(input));
      const portals = [];
      if (seats.pencil) portals.push(createPortal(h(Tooltip, { label: title, side: "bottom" },
        h(Button, { className: "dlme-pencil", variant: "ghost", size: "sm", type: "button",
          "aria-label": title, disabled,
          onClick: () => r.state?.target && runtime.begin(sessionId, inputActions, r.state.target),
        }, h(EditIcon, { size: 16 }))), seats.pencil, "pencil"));
      let label = "";
      if (pending === "begin") label = "正在停止当前回复，停止后载入消息…";
      else if (pending === "commit") label = "正在发送修改…";
      else if (pending === "cancel") label = "正在退出编辑…";
      else if (edit && !edit.loaded) label = "消息已就绪，当前草稿未覆盖。载入后可在原输入框修改。";
      else if (edit) label = edit.mode === "continue" ? "修改最新消息 · 保留已执行操作并继续" : "修改最新消息 · 重新回复";
      else if (r.restore) label = "原草稿待恢复：当前输入已保留，清空或发送后自动恢复原草稿。";
      if (seats.bar && (label || r.error || r.warning)) portals.push(createPortal(
        h("div", { className: "dlme-bar", "aria-busy": !!pending },
          h("div", { className: "dlme-bar-copy", role: r.error ? "alert" : "status" },
            label && h("strong", null, label),
            edit?.loaded && h("div", null, "仅修改文字，原消息附件保留。",
              edit.before?.ids.length ? ` 原草稿的 ${edit.before.ids.length} 个附件暂存，不随修改发送。` : ""),
            r.error && h("div", { className: "dlme-error" }, r.error),
            r.warning && h("div", null, r.warning)),
          edit && !edit.loaded && h(Button, { variant: "outline", size: "sm", disabled: !!pending,
            onClick: () => runtime.load(sessionId, inputActions) }, "载入消息"),
          edit && h(Button, { variant: "ghost", size: "sm", disabled: !!pending,
            onClick: () => runtime.cancel(sessionId, inputActions) }, "取消"),
          !edit && !pending && !r.restore && h(Button, { variant: "ghost", size: "sm", onClick: () => {
            r.error = ""; r.warning = ""; runtime.publish(r);
          } }, "知道了")), seats.bar, "bar"));
      for (const history of seats.histories) portals.push(createPortal(h(HistoryToggle, { wrapper: history.wrapper }), history.host, history.key));
      return h(React.Fragment, null, h("span", { ref: anchor, className: "dlme-anchor" }), ...portals);
    }

    function HistoryToggle({ wrapper }) {
      const [open, setOpen] = React.useState(false);
      return h(Button, { variant: "ghost", size: "sm", "aria-expanded": open, onClick: () => {
        wrapper.toggleAttribute("data-dlme-collapsed", open);
        setOpen(!open);
      } }, open ? "收起修改前消息" : "修改前 ▸");
    }

    function apply(ctx) {
      const runtime = createRuntime(ctx);
      ctx.effect(() => {
        const style = document.createElement("style");
        style.dataset.pluginCss = "dsh-latest-message-edit/client";
        style.textContent = CSS;
        document.head.append(style);
        return () => { runtime.dispose(); style.remove(); };
      });
      ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
        name: "conversation.composer.dock", id: "local-latest-message-edit", order: -100,
        inject: () => ({ runtime }),
      }, Bridge));
    }
    return { apply, inject: ["slots", "sessions", "uiSession", "layout", "conversation"] };
  },
});
