window.__ModuleLoader__.load({
  id: "dsh-task-notifications",
  factory: (require) => {
    const React = require("react");
    const { Switch, Button } = require("@deepseek-ai/dsh-client-ui-primitives");
    const h = React.createElement;
    const ENTRY = "local-task-notifications";
    const API = "api/local-task-notifications";
    const titles = {
      completed: "任务已完成",
      failed: "任务执行失败",
      approval: "有操作等待审批",
      question: "有问题需要你回答",
      test: "DSH 测试提醒",
    };
    const CSS = `
      .dtn-settings { color: var(--dsw-alias-label-primary); font-size: 14px; line-height: 22px; min-width: 0; }
      .dtn-settings h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }
      .dtn-settings h3 { margin: 24px 0 0; font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
      .dtn-settings p { margin: 4px 0 0; }
      .dtn-muted { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
      .dtn-row { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 14px 0; border-bottom: .5px solid var(--dsw-alias-border-l2); }
      .dtn-row > div { min-width: 0; }
      .dtn-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 20px; }
      .dtn-feedback { margin-top: 12px !important; overflow-wrap: anywhere; }
      .dtn-error { color: var(--dsw-alias-state-error-primary); }
    `;

    function createRuntime(ctx, form) {
      const listeners = new Set();
      let state = { connected: false, testing: false, message: "", error: false };
      const lifetime = new AbortController();
      const timers = new Set();
      const notifications = new Set();
      const send = globalThis.__DSH_TRANSPORT__?.fetch
        ?? ((input, init) => globalThis.fetch(input, init));
      const update = (patch) => {
        state = { ...state, ...patch };
        for (const listener of listeners) listener();
      };
      const pause = (ms) => new Promise(resolve => {
        const finish = () => {
          clearTimeout(timer);
          timers.delete(timer);
          lifetime.signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, ms);
        timers.add(timer);
        lifetime.signal.addEventListener("abort", finish, { once: true });
        if (lifetime.signal.aborted) finish();
      });
      const request = async (action, data) => {
        const response = await send(`${API}/${action}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(data), signal: lifetime.signal,
        });
        if (!response.ok) throw new Error(`提醒服务返回 ${response.status}`);
        return response.json();
      };
      const inForeground = () => document.visibilityState === "visible" && document.hasFocus();
      const viewing = (sessionId) => sessionId !== undefined && inForeground()
        && (ctx.layout.panelInfo.getSnapshot().activePanelId ?? "conversation") === "conversation"
        && !document.querySelector('[data-shortcut-modal="settings"]')
        && ctx.uiSession.current.getSnapshot().key === sessionId;

      async function deliver(event, test = false) {
        if (lifetime.signal.aborted) return;
        const eligibility = () => {
          const snapshot = form.getSnapshot();
          if (snapshot.status !== "ready" || lifetime.signal.aborted) return null;
          const preferences = snapshot.value;
          if (!test && (!preferences[event.kind] || viewing(event.sessionId))) return null;
          return {
            preferences,
            canNotify: preferences.systemNotification
              && typeof Notification !== "undefined" && Notification.permission === "granted",
            canFlash: preferences.taskbarFlash && !inForeground(),
          };
        };
        let eligible = eligibility();
        if (!eligible) return;
        if (!eligible.canNotify && !eligible.canFlash) {
          if (test) update({ message: "没有可用的提醒渠道。请检查通知权限，或切到其他应用后再测试。", error: true });
          return;
        }
        if (!test) {
          const claim = await request("claim", { id: event.id });
          if (!claim.accepted) return;
          eligible = eligibility();
          if (!eligible) return;
        }
        const { preferences, canNotify, canFlash } = eligible;
        const results = [];
        if (canNotify) {
          try {
            const notice = new Notification(titles[event.kind], {
              body: test ? "这是一条测试提醒。" : [event.title, event.detail].filter(Boolean).join("\n"),
              tag: event.id,
            });
            notifications.add(notice);
            notice.onclose = () => notifications.delete(notice);
            notice.onclick = () => notice.close();
            notice.onerror = () => update({ message: "系统通知未能显示。可通过测试提醒重试。", error: true });
            results.push("已请求系统通知");
          } catch {
            results.push("系统通知发送失败");
          }
        } else if (preferences.systemNotification) results.push("系统通知未获授权");
        if (canFlash) {
          try {
            const result = await request("flash", test ? { test: true } : { id: event.id });
            results.push(result.status === "requested" ? "已请求任务栏闪烁"
              : result.status === "foreground" ? "DSH 已在前台，未闪烁"
              : "任务栏闪烁不可用");
          } catch {
            results.push("任务栏闪烁调用失败");
          }
        }
        if (test) update({ message: results.join("；") + "。请以实际显示为准。", error: false });
      }

      async function listen() {
        while (!lifetime.signal.aborted) {
          try {
            const response = await send(`${API}/events`, { signal: lifetime.signal });
            if (!response.ok || !response.body) throw new Error("提醒事件连接不可用");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let pending = "";
            let queue = Promise.resolve();
            update({ connected: true });
            try {
              while (!lifetime.signal.aborted) {
                const { done, value } = await reader.read();
                if (done) break;
                pending += decoder.decode(value, { stream: true });
                let end;
                while ((end = pending.indexOf("\n")) !== -1) {
                  const line = pending.slice(0, end);
                  pending = pending.slice(end + 1);
                  if (!line.startsWith("data: ")) continue;
                  const event = JSON.parse(line.slice(6));
                  if (!titles[event.kind]) continue;
                  queue = queue.then(() => deliver(event)).catch(error => {
                    if (!lifetime.signal.aborted) update({ message: error.message, error: true });
                  });
                }
              }
            } finally {
              await reader.cancel().catch(() => {});
              reader.releaseLock();
            }
          } catch (error) {
            if (!lifetime.signal.aborted) console.warn("[task-notifications]", error.message);
          }
          update({ connected: false });
          if (!lifetime.signal.aborted) await pause(3000);
        }
      }

      return {
        getSnapshot: () => state,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        start() {
          void listen();
          return () => {
            lifetime.abort();
            for (const timer of timers) clearTimeout(timer);
            for (const notice of notifications) notice.close();
          };
        },
        async test() {
          if (state.testing) return;
          update({ testing: true, message: "", error: false });
          try {
            if (form.getSnapshot().value?.systemNotification
              && typeof Notification !== "undefined" && Notification.permission === "default") {
              await Notification.requestPermission();
            }
            update({ message: "5 秒后发送，请切到其他应用观察通知和任务栏。" });
            await pause(5000);
            if (!lifetime.signal.aborted) await deliver({ kind: "test", id: `dtn-test-${Date.now()}` }, true);
          } catch (error) {
            if (!lifetime.signal.aborted) update({ message: error.message, error: true });
          } finally { update({ testing: false }); }
        },
      };
    }

    function Settings({ form, runtime }) {
      const subscribe = React.useCallback(listener => form.subscribe(listener), [form]);
      const read = React.useCallback(() => form.getSnapshot(), [form]);
      const snapshot = React.useSyncExternalStore(subscribe, read);
      const status = React.useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
      const [saving, setSaving] = React.useState(null);
      const [error, setError] = React.useState("");
      const ready = snapshot.status === "ready";
      const disabled = !ready || !snapshot.writable || saving !== null;
      async function change(field, value) {
        setSaving(field);
        setError("");
        try {
          if (field === "systemNotification" && value
            && typeof Notification !== "undefined" && Notification.permission === "default") {
            await Notification.requestPermission();
          }
          if (!await form.set(field, value)) setError("设置未保存，请重试。");
        } catch { setError("设置未保存，请重试。"); }
        finally { setSaving(null); }
      }
      function row(field, label, description) {
        return h("div", { className: "dtn-row", key: field },
          h("div", null, h("div", null, label), description && h("p", { className: "dtn-muted" }, description)),
          h(Switch, { checked: snapshot.value?.[field] ?? false, disabled, label, onChange: value => change(field, value) }));
      }
      return h("section", { className: "dtn-settings", "aria-label": "任务通知" },
        h("h2", null, "任务通知"),
        h("p", { className: "dtn-muted" }, "正在查看当前会话时不提醒。设置更改后自动保存。"),
        !ready && h("p", { role: "status" }, snapshot.status === "unavailable" ? "插件配置不可用。" : "正在加载设置…"),
        ready && !snapshot.writable && h("p", { role: "status" }, "当前配置为只读。"),
        h("h3", null, "提醒方式"),
        row("systemNotification", "系统通知", "显示任务结果或待处理事项。"),
        row("taskbarFlash", "任务栏闪烁", "DSH 在后台时闪烁，切回应用后停止。"),
        h("h3", null, "提醒内容"),
        row("completed", "任务完成"), row("failed", "任务失败"),
        row("approval", "等待审批"), row("question", "需要回答问题"),
        h("div", { className: "dtn-footer" },
          h(Button, { variant: "outline", disabled: !ready || status.testing
            || (!snapshot.value?.systemNotification && !snapshot.value?.taskbarFlash),
          onClick: () => runtime.test() }, status.testing ? "正在测试…" : "测试提醒"),
          h("span", { className: "dtn-muted", role: "status" }, status.connected ? "提醒服务已连接" : "正在连接提醒服务…")),
        typeof Notification !== "undefined" && Notification.permission === "denied"
          && h("p", { className: "dtn-muted dtn-feedback" }, "系统通知权限已关闭，开启权限后可再次测试。"),
        (error || status.message) && h("p", { className: `dtn-feedback ${(error || status.error) ? "dtn-error" : "dtn-muted"}`,
          role: error || status.error ? "alert" : "status" }, error || status.message));
    }

    function apply(ctx) {
      const form = ctx.configForms.get(ENTRY);
      const runtime = createRuntime(ctx, form);
      ctx.effect(() => runtime.start(), "task-notifications: live reminders");
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.pluginCss = "dsh-task-notifications/client";
        tag.textContent = CSS;
        document.head.append(tag);
        return () => tag.remove();
      });
      ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section", id: ENTRY, order: 40,
        label: () => "任务通知", inject: () => ({ form, runtime }),
      }, Settings));
    }
    return { apply, inject: ["slots", "configForms", "layout", "uiSession"] };
  },
});
