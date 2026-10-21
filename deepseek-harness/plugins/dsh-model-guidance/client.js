window.__ModuleLoader__.load({
  id: "dsh-model-guidance",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const ENTRY_ID = "local-model-guidance";
    const STYLE_ID = "dsh-model-guidance/client";
    const own = (object, key) => Object.hasOwn(object, key) ? object[key] : undefined;
    const emptyData = () => ({ guides: {}, bindings: {} });
    const routeKey = (provider, model) => JSON.stringify([provider, model]);

    const PANEL_CSS = `
      .dmg-root {
        --dmg-page-max: 960px;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: var(--dsw-alias-label-primary);
        font-size: 14px;
        line-height: 22px;
        container: dmg-root / inline-size;
      }
      .dmg-root *,
      .dmg-root *::before,
      .dmg-root *::after { box-sizing: border-box; }
      .dmg-root button,
      .dmg-root input,
      .dmg-root textarea,
      .dmg-root select { font: inherit; }
      .dmg-scroll {
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: var(--dsw-alias-scrollbar-bg-l2) transparent;
      }
      .dmg-pageWidth {
        width: 100%;
        max-width: calc(var(--dmg-page-max) + 2 * clamp(24px, 4vw, 48px));
        margin: 0 auto;
        padding: 0 clamp(24px, 4vw, 48px) 28px;
      }
      .dmg-header {
        min-width: 0;
        padding: 28px 0 20px;
      }
      [data-platform="darwin"] .dmg-header {
        padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px));
      }
      .dmg-heading {
        min-width: 0;
        max-width: 760px;
      }
      .dmg-title {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
        line-height: 28px;
      }
      .dmg-intro {
        margin: 4px 0 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 13px;
        line-height: 20px;
        text-wrap: pretty;
      }
      .dmg-layout {
        min-width: 0;
        display: grid;
        grid-template-columns: 228px minmax(0, 1fr);
        align-items: start;
        gap: 24px;
      }
      .dmg-guideRail {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .dmg-railHead {
        min-height: 32px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding-left: 4px;
      }
      .dmg-railTitle {
        margin: 0;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        font-weight: 500;
        line-height: 18px;
      }
      .dmg-newButton {
        height: 30px;
        padding: 0 9px;
        border-radius: var(--dsw-radius-sm);
        border: .5px solid var(--dsw-alias-border-l3);
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 12px;
        line-height: 18px;
        cursor: pointer;
      }
      .dmg-newButton:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-primary);
      }
      .dmg-guideList {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .dmg-guideRow {
        position: relative;
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 28px;
        align-items: center;
        border-radius: var(--dsw-radius-md);
        transition: background-color var(--ds-transition-duration-fast, .1s) var(--ds-ease-in-out, ease);
      }
      .dmg-guideRow:hover,
      .dmg-guideRow[data-active="true"] {
        background: var(--dsw-specific-sidebar-nav-item-active, var(--dsw-alias-interactive-bg-hover-solid));
      }
      .dmg-guideSelect {
        min-width: 0;
        height: 40px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 4px 0 10px;
        border: 0;
        border-radius: var(--dsw-radius-md);
        background: transparent;
        color: var(--dsw-alias-label-primary);
        text-align: left;
        cursor: pointer;
      }
      .dmg-guideMarker {
        flex: none;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--dsw-alias-state-business-primary);
        opacity: 0;
        transform: scale(.75);
        transition:
          opacity var(--ds-transition-duration-fast, .1s) var(--ds-ease-in-out, ease),
          transform var(--ds-transition-duration-fast, .1s) var(--ds-ease-in-out, ease);
      }
      .dmg-guideRow[data-active="true"] .dmg-guideMarker {
        opacity: 1;
        transform: none;
      }
      .dmg-guideName {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
        line-height: 20px;
      }
      .dmg-guideRow[data-active="true"] .dmg-guideName { font-weight: 500; }
      .dmg-moreButton,
      .dmg-iconButton {
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: var(--dsw-radius-sm);
        background: transparent;
        color: var(--dsw-alias-label-caption);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .dmg-moreButton:hover:not(:disabled),
      .dmg-iconButton:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-primary);
      }
      .dmg-moreButton[data-open="true"] {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-primary);
      }
      .dmg-menu {
        position: absolute;
        z-index: 8;
        top: calc(100% - 4px);
        right: 2px;
        min-width: 136px;
        margin: 0;
        padding: 4px;
        border: .5px solid var(--dsw-alias-border-l3);
        border-radius: var(--dsw-radius-md);
        background: var(--dsw-alias-bg-layer-2);
        box-shadow: var(--dsw-elevation-prominent);
      }
      .dmg-menuItem {
        width: 100%;
        min-height: 32px;
        padding: 5px 9px;
        border: 0;
        border-radius: var(--dsw-radius-sm);
        background: transparent;
        color: var(--dsw-alias-label-primary);
        text-align: left;
        font-size: 13px;
        line-height: 20px;
        cursor: pointer;
      }
      .dmg-menuItem:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
      .dmg-menuItem--danger { color: var(--dsw-alias-state-error-primary); }
      .dmg-menuItem--danger:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover-danger, var(--dsw-alias-interactive-bg-hover));
      }
      .dmg-railEmpty {
        margin: 0;
        padding: 12px 10px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }
      .dmg-editorPane {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .dmg-mobileBar { display: none; }
      .dmg-editor {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 20px;
        border: .5px solid var(--dsw-alias-settings-card-stroke);
        border-radius: var(--dsw-radius-xl);
        background: var(--dsw-alias-settings-card-fill);
      }
      .dmg-editorHead {
        min-width: 0;
        display: flex;
        align-items: flex-end;
        gap: 12px;
      }
      .dmg-nameField {
        min-width: 0;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .dmg-editorMeta {
        flex: none;
        padding-bottom: 10px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }
      .dmg-fields {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .dmg-field {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .dmg-fieldLabel {
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        font-weight: 500;
        line-height: 18px;
      }
      .dmg-input,
      .dmg-textarea,
      .dmg-select {
        width: 100%;
        margin: 0;
        border: .5px solid var(--dsw-alias-border-l4);
        border-radius: var(--dsw-radius-md);
        background: var(--dsw-alias-bg-layer-1);
        color: var(--dsw-alias-label-primary);
        outline: none;
        transition:
          border-color var(--ds-transition-duration-fast, .1s) var(--ds-ease-in-out, ease),
          box-shadow var(--ds-transition-duration-fast, .1s) var(--ds-ease-in-out, ease);
      }
      .dmg-input,
      .dmg-select {
        height: 36px;
        padding: 0 10px;
      }
      .dmg-nameField .dmg-input {
        height: 40px;
        font-size: 15px;
        font-weight: 500;
      }
      .dmg-textarea {
        min-height: 240px;
        padding: 9px 10px;
        line-height: 22px;
        resize: vertical;
      }
      .dmg-input::placeholder,
      .dmg-textarea::placeholder { color: var(--dsw-alias-label-dimmed); }
      .dmg-input:hover:not(:disabled),
      .dmg-textarea:hover:not(:disabled),
      .dmg-select:hover:not(:disabled) { border-color: var(--dsw-alias-border-l3); }
      .dmg-input:focus,
      .dmg-textarea:focus,
      .dmg-select:focus {
        border-color: var(--dsw-alias-state-business-primary);
        box-shadow: 0 0 0 2px color-mix(
          in srgb,
          var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)) 18%,
          transparent
        );
      }
      .dmg-input:disabled,
      .dmg-textarea:disabled,
      .dmg-select:disabled {
        opacity: .6;
        cursor: default;
        resize: none;
      }
      .dmg-hint {
        margin: 0;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }
      .dmg-bindings {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin: 0;
        padding: 16px 0 0;
        border: 0;
        border-top: .5px solid var(--dsw-alias-border-l2);
      }
      .dmg-sectionTitle {
        padding: 0;
        color: var(--dsw-alias-label-primary);
        font-size: 14px;
        font-weight: 500;
        line-height: 22px;
      }
      .dmg-boundPanel {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px 12px;
        border: .5px solid var(--dsw-alias-border-l2);
        border-radius: var(--dsw-radius-lg);
        background: var(--dsw-alias-bg-layer-1);
      }
      .dmg-boundHead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }
      .dmg-boundList {
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .dmg-boundChip {
        min-width: 0;
        max-width: 100%;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 3px 2px 9px;
        border: .5px solid var(--dsw-alias-border-l3);
        border-radius: 999px;
        background: var(--dsw-alias-bg-layer-2);
      }
      .dmg-boundBody {
        min-width: 0;
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .dmg-boundName {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        line-height: 20px;
      }
      .dmg-boundProvider {
        min-width: 0;
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
        line-height: 17px;
      }
      .dmg-chipRemove {
        flex: none;
        width: 20px;
        height: 20px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--dsw-alias-label-tertiary);
        font-size: 15px;
        line-height: 20px;
        cursor: pointer;
      }
      .dmg-chipRemove:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-primary);
      }
      .dmg-noBindings {
        margin: 0;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }
      .dmg-searchRow {
        min-width: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 36px;
        gap: 8px;
      }
      .dmg-searchInput { min-width: 0; }
      .dmg-refreshButton {
        width: 36px;
        height: 36px;
        padding: 0;
        border: .5px solid var(--dsw-alias-border-l4);
        border-radius: var(--dsw-radius-md);
        background: transparent;
        color: var(--dsw-alias-label-secondary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .dmg-refreshButton:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover);
        color: var(--dsw-alias-label-primary);
      }
      .dmg-refreshButton:disabled { cursor: default; opacity: .7; }
      .dmg-inlineStatus {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
      }
      .dmg-inlineStatus--error { color: var(--dsw-alias-state-error-primary); }
      .dmg-inlineStatus--warning { color: var(--dsw-alias-state-warn-label); }
      .dmg-candidateScroll {
        min-width: 0;
        max-height: min(44vh, 420px);
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        border-top: .5px solid var(--dsw-alias-border-l2);
        padding: 4px 4px 2px 0;
        scrollbar-width: thin;
        scrollbar-color: var(--dsw-alias-scrollbar-bg-l2) transparent;
      }
      .dmg-provider {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .dmg-provider + .dmg-provider { margin-top: 8px; }
      .dmg-providerHead {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 6px 10px;
        background: var(--dsw-alias-settings-card-fill);
        color: var(--dsw-alias-label-secondary);
      }
      .dmg-providerName {
        margin: 0;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        font-weight: 500;
        line-height: 18px;
      }
      .dmg-providerCount {
        flex: none;
        color: var(--dsw-alias-label-tertiary);
        font-size: 11px;
        line-height: 17px;
      }
      .dmg-modelRow {
        min-width: 0;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
        gap: 10px;
        padding: 7px 10px;
        border: .5px solid transparent;
        border-radius: var(--dsw-radius-md);
        cursor: pointer;
        transition:
          background-color var(--ds-transition-duration-fast, .1s) var(--ds-ease-in-out, ease),
          border-color var(--ds-transition-duration-fast, .1s) var(--ds-ease-in-out, ease);
      }
      .dmg-modelRow:hover:not([data-disabled="true"]) {
        background: var(--dsw-alias-interactive-bg-hover);
      }
      .dmg-modelRow[data-selected="true"] {
        border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 24%, transparent);
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent);
      }
      .dmg-modelRow[data-selected="true"]:hover:not([data-disabled="true"]) {
        background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
      }
      .dmg-modelRow[data-disabled="true"] { cursor: default; }
      .dmg-checkbox {
        width: 16px;
        height: 16px;
        margin: 3px 0 0;
        accent-color: var(--dsw-alias-state-business-primary);
        cursor: pointer;
        flex: none;
      }
      .dmg-checkbox:disabled { cursor: default; }
      .dmg-modelBody {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .dmg-modelName {
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: 13px;
        line-height: 20px;
      }
      .dmg-modelId {
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--dsw-alias-label-tertiary);
        font-family: var(--ds-font-family-code);
        font-size: 11px;
        line-height: 17px;
      }
      .dmg-modelNotes {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 3px;
      }
      .dmg-tag {
        display: inline-flex;
        align-items: center;
        padding: 0 5px;
        border: .5px solid var(--dsw-alias-border-l3);
        border-radius: var(--dsw-radius-xs);
        color: var(--dsw-alias-label-secondary);
        font-size: 11px;
        line-height: 17px;
      }
      .dmg-tag--warning {
        border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);
        color: var(--dsw-alias-state-warn-label);
      }
      .dmg-candidateEmpty {
        margin: 0;
        padding: 20px 12px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 12px;
        line-height: 18px;
        text-align: center;
      }
      .dmg-blank {
        min-width: 0;
        padding: 56px 12px;
        text-align: center;
      }
      .dmg-blankTitle {
        margin: 0;
        font-size: 15px;
        font-weight: 500;
        line-height: 22px;
      }
      .dmg-blankText {
        max-width: 480px;
        margin: 6px auto 0;
        color: var(--dsw-alias-label-tertiary);
        font-size: 13px;
        line-height: 20px;
        text-wrap: pretty;
      }
      .dmg-loading {
        min-height: 220px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: var(--dsw-alias-label-tertiary);
        font-size: 13px;
        line-height: 20px;
      }
      .dmg-footer {
        flex: none;
        border-top: .5px solid var(--dsw-alias-border-l2);
        background: var(--dsw-alias-bg-base);
      }
      .dmg-footerInner {
        width: 100%;
        max-width: calc(var(--dmg-page-max) + 2 * clamp(24px, 4vw, 48px));
        margin: 0 auto;
        padding: 12px clamp(24px, 4vw, 48px);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px 20px;
      }
      .dmg-footerStatus {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--dsw-alias-label-secondary);
        font-size: 12px;
        line-height: 18px;
      }
      .dmg-footerStatusText {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .dmg-statusDot {
        flex: none;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--dsw-alias-label-dimmed);
      }
      .dmg-statusDot[data-kind="dirty"] { background: var(--dsw-alias-state-warn-primary); }
      .dmg-statusDot[data-kind="warning"] { background: var(--dsw-alias-state-warn-primary); }
      .dmg-statusDot[data-kind="success"] { background: var(--dsw-alias-state-success-primary); }
      .dmg-statusDot[data-kind="error"] { background: var(--dsw-alias-state-error-primary); }
      .dmg-footerActions {
        flex: none;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }
      .dmg-button {
        height: 32px;
        padding: 0 12px;
        border: 0;
        border-radius: var(--dsw-radius-md);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        white-space: nowrap;
        font-size: 13px;
        line-height: 20px;
        cursor: pointer;
      }
      .dmg-button--primary {
        background: var(--dsw-alias-button-primary-fill);
        color: var(--dsw-alias-label-primary-foreground);
      }
      .dmg-button--primary:hover:not(:disabled) {
        background: var(--dsw-alias-button-primary-hover);
      }
      .dmg-button--secondary {
        border: .5px solid var(--dsw-alias-border-l3);
        background: transparent;
        color: var(--dsw-alias-label-primary);
      }
      .dmg-button--secondary:hover:not(:disabled) {
        background: var(--dsw-alias-interactive-bg-hover-solid);
      }
      .dmg-button:disabled {
        opacity: .42;
        cursor: default;
      }
      .dmg-root button:focus-visible,
      .dmg-root input:focus-visible,
      .dmg-root textarea:focus-visible,
      .dmg-root select:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
      }
      .dmg-spinner {
        flex: none;
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-inline-end-color: transparent;
        border-radius: 50%;
        animation: dmg-spin .8s linear infinite;
      }
      @keyframes dmg-spin { to { transform: rotate(360deg); } }
      @container dmg-root (max-width: 760px) {
        .dmg-layout { grid-template-columns: minmax(0, 1fr); }
        .dmg-guideRail { display: none; }
        .dmg-mobileBar {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dmg-mobileBar .dmg-select { flex: 1; min-width: 0; }
        .dmg-editor { padding: 16px; }
        .dmg-editorHead {
          flex-direction: column;
          align-items: stretch;
        }
        .dmg-editorMeta {
          align-self: flex-start;
          padding-bottom: 0;
        }
      }
      @container dmg-root (max-width: 520px) {
        .dmg-pageWidth,
        .dmg-footerInner { padding-inline: 16px; }
        .dmg-boundBody { align-items: flex-start; flex-direction: column; gap: 0; }
        .dmg-boundProvider { max-width: 200px; }
        .dmg-footerInner {
          align-items: stretch;
          flex-direction: column;
        }
        .dmg-footerActions { justify-content: flex-end; }
        .dmg-footerActions .dmg-button { flex: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dmg-root button,
        .dmg-root input,
        .dmg-root textarea,
        .dmg-root select,
        .dmg-guideMarker,
        .dmg-guideRow,
        .dmg-modelRow { transition: none; }
        .dmg-spinner {
          animation: none;
          border-inline-end-color: currentColor;
          opacity: .55;
        }
      }
    `;

    function createSharedStore(initial) {
      let snapshot = initial;
      const listeners = new Set();
      return {
        getSnapshot() {
          return snapshot;
        },
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        update(updater) {
          const next = updater(snapshot);
          if (next === undefined || next === snapshot) return;
          snapshot = next;
          for (const listener of [...listeners]) listener();
        },
      };
    }

    function createCatalogSource(ctx) {
      let snapshot = { groups: [], failures: [], loading: true, error: "" };
      let generation = 0;
      let disposed = false;
      const listeners = new Set();

      function setSnapshot(patch) {
        snapshot = { ...snapshot, ...patch };
        for (const listener of [...listeners]) listener();
      }

      async function refresh() {
        const current = ++generation;
        setSnapshot({ loading: true, error: "" });
        try {
          const response = await ctx.remote.session.modelCatalog();
          if (disposed || current !== generation) return;
          if (!response.ok) throw new Error(response.error?.message ?? "未知错误");
          setSnapshot({
            groups: response.value?.groups ?? [],
            failures: response.value?.failures ?? [],
            loading: false,
            error: "",
          });
        } catch (error) {
          if (disposed || current !== generation) return;
          setSnapshot({
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      function start() {
        const disposers = [
          ctx.remote.$on("llm/adapters-updated", refresh),
          ctx.remote.$on("settings/document-updated", refresh),
          ctx.on("connection/reset", refresh),
        ];
        void refresh();
        return () => {
          disposed = true;
          generation += 1;
          for (const dispose of disposers) dispose();
        };
      }

      return {
        source: {
          getSnapshot() {
            return snapshot;
          },
          subscribe(listener) {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
          refresh,
        },
        start,
      };
    }

    function modelRows(groups, ...bindingSets) {
      const rows = new Map();
      for (const group of groups ?? []) {
        for (const model of group.models ?? []) {
          rows.set(routeKey(group.id, model.id), {
            provider: group.id,
            model: model.id,
            providerName: group.name || group.id,
            modelName: model.name || model.id,
            available: true,
          });
        }
      }
      for (const bindings of bindingSets) {
        for (const [provider, models] of Object.entries(bindings ?? {})) {
          for (const model of Object.keys(models ?? {})) {
            const key = routeKey(provider, model);
            if (!rows.has(key)) {
              rows.set(key, {
                provider,
                model,
                providerName: provider,
                modelName: model,
                available: false,
              });
            }
          }
        }
      }
      return [...rows.entries()];
    }

    function GuidanceIcon({ size = 16 }) {
      return h("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        "aria-hidden": "true",
      },
        h("path", {
          d: "M5.5 4.75h8.25A2.25 2.25 0 0 1 16 7v12H7.75A2.25 2.25 0 0 1 5.5 16.75V4.75Z",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinejoin: "round",
        }),
        h("path", {
          d: "M8.5 8h4.25M8.5 11h4.25",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinecap: "round",
        }),
        h("path", {
          d: "M16 7h1.75A2.25 2.25 0 0 1 20 9.25v10H11",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }));
    }

    function GuidancePage({ form, guidanceStore, catalog }) {
      const formSource = React.useMemo(() => ({
        subscribe: (listener) => form.subscribe(listener),
        getSnapshot: () => form.getSnapshot(),
      }), [form]);
      const snapshot = React.useSyncExternalStore(formSource.subscribe, formSource.getSnapshot);
      const ui = React.useSyncExternalStore(guidanceStore.subscribe, guidanceStore.getSnapshot);
      const catalogState = React.useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
      const nameInput = React.useRef(null);
      const lastFocusToken = React.useRef(ui.focusNameToken);
      const [openMenuId, setOpenMenuId] = React.useState(null);

      React.useEffect(() => {
        if (ui.focusNameToken === lastFocusToken.current) return;
        lastFocusToken.current = ui.focusNameToken;
        const input = nameInput.current;
        if (input !== null) {
          input.focus();
          input.select();
        }
      }, [ui.focusNameToken]);

      React.useEffect(() => {
        if (openMenuId === null) return undefined;
        const close = () => setOpenMenuId(null);
        const onKeyDown = (event) => {
          if (event.key === "Escape") setOpenMenuId(null);
        };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", onKeyDown);
        return () => {
          document.removeEventListener("pointerdown", close);
          document.removeEventListener("keydown", onKeyDown);
        };
      }, [openMenuId]);

      const accepted = snapshot.value?.data ?? emptyData();
      const draftData = ui.draft?.data;
      const data = draftData ?? accepted;
      const guides = data.guides ?? {};
      const guideIds = Object.keys(guides);
      const activeId = ui.selectedId !== null && own(guides, ui.selectedId) !== undefined
        ? ui.selectedId
        : guideIds[0];
      const guide = activeId === undefined ? undefined : own(guides, activeId);
      const ready = snapshot.status === "ready";
      const editable = ready && snapshot.writable === true && !ui.saving;
      const conflicted = ui.draft !== null && snapshot.revision !== ui.draft.revision;
      const groups = catalogState.groups ?? [];
      const failures = catalogState.failures ?? [];
      const allRows = modelRows(groups, accepted.bindings, draftData?.bindings);
      const ownerOf = (provider, model) => own(own(data.bindings ?? {}, provider) ?? {}, model);
      const boundRows = activeId === undefined
        ? []
        : allRows.filter(([, row]) => ownerOf(row.provider, row.model) === activeId);
      const query = ui.search.trim().toLowerCase();
      const filteredRows = query === ""
        ? allRows
        : allRows.filter(([, row]) => (
          row.provider.toLowerCase().includes(query)
          || row.providerName.toLowerCase().includes(query)
          || row.model.toLowerCase().includes(query)
          || row.modelName.toLowerCase().includes(query)
        ));

      const providerGroups = [];
      const providerMap = new Map();
      for (const entry of filteredRows) {
        const row = entry[1];
        let providerGroup = providerMap.get(row.provider);
        if (providerGroup === undefined) {
          providerGroup = {
            id: row.provider,
            name: row.providerName,
            rows: [],
          };
          providerMap.set(row.provider, providerGroup);
          providerGroups.push(providerGroup);
        }
        providerGroup.rows.push(entry);
      }

      function openGuide(id) {
        guidanceStore.update((previous) => (
          previous.selectedId === id ? previous : { ...previous, selectedId: id }
        ));
      }

      function editGuide(change) {
        guidanceStore.update((previous) => {
          if (previous.saving) return previous;
          const latest = form.getSnapshot();
          if (latest.status !== "ready" || latest.writable !== true) return previous;
          const next = previous.draft === null
            ? {
              data: structuredClone(latest.value?.data ?? emptyData()),
              revision: latest.revision,
            }
            : {
              data: structuredClone(previous.draft.data),
              revision: previous.draft.revision,
            };
          if (change(next.data) === false) return previous;
          return { ...previous, draft: next, message: null };
        });
      }

      function addGuide() {
        let id;
        const currentData = guidanceStore.getSnapshot().draft?.data ?? accepted;
        do {
          id = "guide-" + (globalThis.crypto?.randomUUID?.()
            ?? Date.now().toString(36) + "-" + Math.random().toString(36).slice(2));
        } while (own(currentData.guides ?? {}, id) !== undefined);

        guidanceStore.update((previous) => {
          if (previous.saving) return previous;
          const latest = form.getSnapshot();
          if (latest.status !== "ready" || latest.writable !== true) return previous;
          const next = previous.draft === null
            ? {
              data: structuredClone(latest.value?.data ?? emptyData()),
              revision: latest.revision,
            }
            : {
              data: structuredClone(previous.draft.data),
              revision: previous.draft.revision,
            };
          next.data.guides = {
            [id]: { name: "新指南", text: "" },
            ...(next.data.guides ?? {}),
          };
          return {
            ...previous,
            draft: next,
            selectedId: id,
            focusNameToken: previous.focusNameToken + 1,
            message: null,
          };
        });
      }

      function deleteGuide(id) {
        setOpenMenuId(null);
        guidanceStore.update((previous) => {
          if (previous.saving) return previous;
          const latest = form.getSnapshot();
          if (latest.status !== "ready" || latest.writable !== true) return previous;
          const next = previous.draft === null
            ? {
              data: structuredClone(latest.value?.data ?? emptyData()),
              revision: latest.revision,
            }
            : {
              data: structuredClone(previous.draft.data),
              revision: previous.draft.revision,
            };
          if (own(next.data.guides ?? {}, id) === undefined) return previous;
          delete next.data.guides[id];

          const nextBindings = { ...(next.data.bindings ?? {}) };
          for (const [provider, models] of Object.entries(nextBindings)) {
            const kept = { ...models };
            for (const [model, guideId] of Object.entries(kept)) {
              if (guideId === id) delete kept[model];
            }
            if (Object.keys(kept).length === 0) delete nextBindings[provider];
            else nextBindings[provider] = kept;
          }
          next.data.bindings = nextBindings;
          return {
            ...previous,
            draft: next,
            selectedId: previous.selectedId === id ? null : previous.selectedId,
            message: null,
          };
        });
      }

      function renameGuide(id) {
        if (!editable) return;
        setOpenMenuId(null);
        guidanceStore.update((previous) => ({
          ...previous,
          selectedId: id,
          focusNameToken: previous.focusNameToken + 1,
        }));
      }

      function toggleBinding(provider, model, checked) {
        if (activeId === undefined) return;
        editGuide((next) => {
          const nextBindings = { ...(next.bindings ?? {}) };
          const models = { ...(nextBindings[provider] ?? {}) };
          const owner = own(models, model);
          if (checked) {
            if (owner !== undefined && owner !== activeId) return false;
            models[model] = activeId;
            nextBindings[provider] = models;
          } else {
            if (owner !== activeId) return false;
            delete models[model];
            if (Object.keys(models).length === 0) delete nextBindings[provider];
            else nextBindings[provider] = models;
          }
          next.bindings = nextBindings;
        });
      }

      function discardDraft() {
        guidanceStore.update((previous) => {
          if (previous.saving || previous.draft === null) return previous;
          return {
            ...previous,
            draft: null,
            message: { kind: "info", text: "已放弃草稿并载入最新配置。" },
          };
        });
        setOpenMenuId(null);
      }

      async function saveDraft() {
        const before = guidanceStore.getSnapshot();
        if (before.saving || before.draft === null) return;
        const latest = form.getSnapshot();
        if (latest.status !== "ready" || latest.writable !== true) return;
        if (latest.revision !== before.draft.revision) {
          guidanceStore.update((previous) => ({
            ...previous,
            message: {
              kind: "warning",
              text: "配置已在其他地方更新；草稿已保留，请先复核后再应用。",
            },
          }));
          return;
        }

        const acquisition = { started: false };
        guidanceStore.update((previous) => {
          if (previous.saving || previous.draft === null) return previous;
          acquisition.started = true;
          return { ...previous, saving: true, message: null };
        });
        if (!acquisition.started) return;

        try {
          const ok = await form.mutate([
            { op: "set", path: ["data"], value: before.draft.data },
          ], before.draft.revision);
          guidanceStore.update((previous) => ({
            ...previous,
            saving: false,
            draft: ok ? null : previous.draft,
            message: ok
              ? { kind: "success", text: "修改已应用。" }
              : { kind: "error", text: "保存未被接受；草稿已保留，请复核后重试。" },
          }));
        } catch (error) {
          guidanceStore.update((previous) => ({
            ...previous,
            saving: false,
            message: {
              kind: "error",
              text: "保存失败；草稿已保留：" + (error instanceof Error ? error.message : String(error)),
            },
          }));
        }
      }

      let statusKind = "neutral";
      let statusText = ui.draft === null ? "所有修改均已应用。" : "有未保存修改。";
      if (ui.draft !== null) statusKind = "dirty";
      if (ui.message !== null) {
        statusKind = ui.message.kind;
        statusText = ui.message.text;
      }
      if (conflicted) {
        statusKind = "warning";
        statusText = "配置已在其他位置更新；草稿已保留，放弃后会载入最新配置。";
      }
      if (ui.saving) {
        statusKind = "busy";
        statusText = "正在应用修改…";
      }

      const showFooter = guideIds.length > 0 || ui.draft !== null || ui.saving;
      const canApply = editable && ui.draft !== null && !conflicted;
      const emptyCandidateText = query === ""
        ? "当前没有可用模型或已有绑定。"
        : "没有匹配的模型。";

      const body = !ready
        ? h("div", { className: "dmg-loading", role: "status" },
          snapshot.status !== "unavailable"
            && h("span", { className: "dmg-spinner", "aria-hidden": true }),
          snapshot.status === "unavailable" ? "插件配置当前不可用。" : "正在加载配置…")
        : h("div", { className: "dmg-layout" },
          h("aside", { className: "dmg-guideRail", "aria-label": "行为指南列表" },
            h("div", { className: "dmg-railHead" },
              h("h2", { className: "dmg-railTitle" }, "行为指南"),
              h("button", {
                type: "button",
                className: "dmg-newButton",
                disabled: !editable,
                onClick: addGuide,
              }, h("span", { "aria-hidden": true }, "+"), "新建")),
            guideIds.length > 0
              ? h("ul", { className: "dmg-guideList" },
                ...guideIds.map((id) => {
                  const name = own(guides, id)?.name || "未命名指南";
                  const active = id === activeId;
                  return h("li", {
                    key: id,
                    className: "dmg-guideRow",
                    "data-active": active ? "true" : "false",
                  },
                    h("button", {
                      type: "button",
                      className: "dmg-guideSelect",
                      "aria-current": active ? "page" : undefined,
                      onClick: () => openGuide(id),
                    },
                      h("span", { className: "dmg-guideMarker", "aria-hidden": true }),
                      h("span", { className: "dmg-guideName" }, name)),
                    h("button", {
                      type: "button",
                      className: "dmg-moreButton",
                      disabled: !editable,
                      "data-open": openMenuId === id ? "true" : "false",
                      "aria-haspopup": "menu",
                      "aria-expanded": openMenuId === id,
                      "aria-label": name + " 的更多操作",
                      onClick: (event) => {
                        event.stopPropagation();
                        setOpenMenuId((current) => current === id ? null : id);
                      },
                      onPointerDown: (event) => event.stopPropagation(),
                    }, h("span", { "aria-hidden": true }, "⋯")),
                    openMenuId === id && h("div", {
                      className: "dmg-menu",
                      role: "menu",
                      onPointerDown: (event) => event.stopPropagation(),
                    },
                      h("button", {
                        type: "button",
                        className: "dmg-menuItem",
                        role: "menuitem",
                        onClick: () => renameGuide(id),
                      }, "重命名"),
                      h("button", {
                        type: "button",
                        className: "dmg-menuItem dmg-menuItem--danger",
                        role: "menuitem",
                        onClick: () => deleteGuide(id),
                      }, "删除")));
                }))
              : h("p", { className: "dmg-railEmpty" }, "暂无指南。")),
          h("div", { className: "dmg-editorPane" },
            h("div", { className: "dmg-mobileBar" },
              guideIds.length > 0
                ? h("select", {
                  className: "dmg-select",
                  "aria-label": "选择行为指南",
                  value: activeId ?? "",
                  onChange: (event) => openGuide(event.target.value),
                },
                  ...guideIds.map((id) => h("option", { key: id, value: id },
                    own(guides, id)?.name || "未命名指南")))
                : h("p", { className: "dmg-hint" }, "暂无指南"),
              h("button", {
                type: "button",
                className: "dmg-newButton",
                disabled: !editable,
                onClick: addGuide,
              }, h("span", { "aria-hidden": true }, "+"), "新建")),
            guide === undefined
              ? h("div", { className: "dmg-blank" },
                h("h2", { className: "dmg-blankTitle" },
                  ui.draft === null ? "还没有行为指南" : "已删除全部指南"),
                h("p", { className: "dmg-blankText" },
                  ui.draft === null
                    ? "新建一条指南，然后填写行为指令并绑定模型。未绑定的模型继续沿用 DSH 默认角色指导。"
                    : "这份删除仍保留在草稿中。应用后指南列表才会清空；放弃则恢复当前配置。"))
              : h("section", { className: "dmg-editor", "aria-label": "编辑行为指南" },
                h("div", { className: "dmg-editorHead" },
                  h("label", { className: "dmg-nameField", htmlFor: "dmg-guide-name" },
                    h("span", { className: "dmg-fieldLabel" }, "指南名称"),
                    h("input", {
                      ref: nameInput,
                      id: "dmg-guide-name",
                      className: "dmg-input",
                      value: guide.name ?? "",
                      disabled: !editable,
                      autoComplete: "off",
                      onChange: (event) => {
                        const name = event.target.value;
                        editGuide((next) => {
                          const target = own(next.guides, activeId);
                          if (target === undefined) return false;
                          target.name = name;
                        });
                      },
                    })),
                  h("span", { className: "dmg-editorMeta" },
                    boundRows.length + " 个模型已绑定")),
                h("div", { className: "dmg-fields" },
                  h("label", { className: "dmg-field", htmlFor: "dmg-guide-text" },
                    h("span", { className: "dmg-fieldLabel" }, "行为指令"),
                    h("textarea", {
                      id: "dmg-guide-text",
                      className: "dmg-textarea",
                      rows: 9,
                      value: guide.text ?? "",
                      disabled: !editable,
                      "aria-describedby": "dmg-guide-text-hint",
                      onChange: (event) => {
                        const text = event.target.value;
                        editGuide((next) => {
                          const target = own(next.guides, activeId);
                          if (target === undefined) return false;
                          target.text = text;
                        });
                      },
                    }),
                    h("span", {
                      id: "dmg-guide-text-hint",
                      className: "dmg-hint",
                    }, "正文留空时沿用 DSH 默认角色指导。未绑定任何指南的模型也保持默认指导。正文按原文使用，不展开模板变量。"))),
                h("fieldset", { className: "dmg-bindings" },
                  h("legend", { className: "dmg-sectionTitle" }, "绑定模型"),
                  h("div", { className: "dmg-boundPanel" },
                    h("div", { className: "dmg-boundHead" },
                      h("span", null, "已选模型"),
                      h("span", null, boundRows.length + " 个")),
                    boundRows.length > 0
                      ? h("div", { className: "dmg-boundList" },
                        ...boundRows.map(([key, row]) => h("div", { key, className: "dmg-boundChip" },
                          h("span", { className: "dmg-boundBody" },
                            h("span", { className: "dmg-boundName" }, row.modelName),
                            h("span", { className: "dmg-boundProvider" },
                              row.providerName + " / " + row.model)),
                          h("button", {
                            type: "button",
                            className: "dmg-chipRemove",
                            disabled: !editable,
                            "aria-label": "解除 " + row.modelName + " 的绑定",
                            onClick: () => toggleBinding(row.provider, row.model, false),
                          }, h("span", { "aria-hidden": true }, "×")))))
                      : h("p", { className: "dmg-noBindings" }, "尚未绑定模型。当前指南不会用于任何模型。")),
                  h("div", { className: "dmg-searchRow" },
                    h("input", {
                      type: "search",
                      className: "dmg-input dmg-searchInput",
                      value: ui.search,
                      placeholder: "搜索模型名、ID 或提供方",
                      "aria-label": "搜索候选模型",
                      onChange: (event) => {
                        const search = event.target.value;
                        guidanceStore.update((previous) => ({ ...previous, search }));
                      },
                    }),
                    h("button", {
                      type: "button",
                      className: "dmg-refreshButton",
                      disabled: catalogState.loading,
                      title: "刷新模型目录",
                      "aria-label": "刷新模型目录",
                      onClick: () => {
                        void catalog.refresh();
                      },
                    },
                      catalogState.loading
                        ? h("span", { className: "dmg-spinner", "aria-hidden": true })
                        : h("svg", {
                          width: 16,
                          height: 16,
                          viewBox: "0 0 24 24",
                          fill: "none",
                          "aria-hidden": "true",
                        },
                          h("path", {
                            d: "M20 5v5h-5M4 19v-5h5M6.1 9a7 7 0 0 1 11.2-2.3L20 10M4 14l2.7 3.3A7 7 0 0 0 17.9 15",
                            stroke: "currentColor",
                            strokeWidth: 1.6,
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                          })))),
                  catalogState.loading && h("p", { className: "dmg-inlineStatus", role: "status" },
                    h("span", { className: "dmg-spinner", "aria-hidden": true }),
                    "正在刷新模型目录…"),
                  catalogState.error && h("p", {
                    className: "dmg-inlineStatus dmg-inlineStatus--error",
                    role: "alert",
                  }, "模型目录加载失败：" + catalogState.error),
                  failures.length > 0 && h("p", {
                    className: "dmg-inlineStatus dmg-inlineStatus--warning",
                    role: "status",
                  }, "部分提供方加载失败：" + failures.map((item) => item.name).join("、")
                    + "。已有绑定仍可解除。"),
                  h("div", { className: "dmg-candidateScroll" },
                    providerGroups.length > 0
                      ? providerGroups.map((providerGroup) => h("section", {
                        key: providerGroup.id,
                        className: "dmg-provider",
                        "aria-label": providerGroup.name,
                      },
                        h("div", { className: "dmg-providerHead" },
                          h("h3", { className: "dmg-providerName" }, providerGroup.name),
                          h("span", { className: "dmg-providerCount" },
                            providerGroup.rows.length + " 个模型")),
                        ...providerGroup.rows.map(([key, row]) => {
                          const owner = ownerOf(row.provider, row.model);
                          const occupied = owner !== undefined && owner !== activeId;
                          const ownerName = owner === undefined
                            ? ""
                            : own(guides, owner)?.name || owner;
                          const disabled = !editable || occupied;
                          return h("label", {
                            key,
                            className: "dmg-modelRow",
                            "data-selected": owner === activeId ? "true" : "false",
                            "data-disabled": disabled ? "true" : "false",
                          },
                            h("input", {
                              type: "checkbox",
                              className: "dmg-checkbox",
                              checked: owner === activeId,
                              disabled,
                              onChange: (event) => toggleBinding(
                                row.provider,
                                row.model,
                                event.target.checked,
                              ),
                            }),
                            h("span", { className: "dmg-modelBody" },
                              h("span", { className: "dmg-modelName" }, row.modelName),
                              h("span", { className: "dmg-modelId" },
                                row.provider + " / " + row.model),
                              (!row.available || occupied) && h("span", { className: "dmg-modelNotes" },
                                !row.available && h("span", {
                                  className: "dmg-tag dmg-tag--warning",
                                }, "当前不在模型目录中"),
                                occupied && h("span", { className: "dmg-tag" },
                                  "已绑定：" + ownerName))));
                        })))
                      : h("p", { className: "dmg-candidateEmpty" },
                        catalogState.loading ? "正在加载模型…" : emptyCandidateText))))));
      return h("section", {
        className: "dmg-root",
        "aria-label": "模型行为指南",
        "aria-busy": ui.saving || undefined,
      },
        h("div", { className: "dmg-scroll" },
          h("div", { className: "dmg-pageWidth" },
            h("header", { className: "dmg-header" },
              h("div", { className: "dmg-heading" },
                h("h1", { className: "dmg-title" }, "模型行为指南"),
                h("p", { className: "dmg-intro" },
                  "为每个模型绑定行为指南。保存后从下一次模型步骤开始生效；正文留空的指南与未绑定模型继续沿用 DSH 默认角色指导。"))),
            body)),
        showFooter && h("footer", { className: "dmg-footer" },
          h("div", { className: "dmg-footerInner" },
            h("div", {
              className: "dmg-footerStatus",
              role: "status",
              "aria-live": "polite",
            },
              ui.saving
                ? h("span", { className: "dmg-spinner", "aria-hidden": true })
                : h("span", {
                  className: "dmg-statusDot",
                  "data-kind": statusKind,
                  "aria-hidden": true,
                }),
              h("span", { className: "dmg-footerStatusText" }, statusText)),
            h("div", { className: "dmg-footerActions" },
              h("button", {
                type: "button",
                className: "dmg-button dmg-button--secondary",
                disabled: ui.saving || ui.draft === null,
                onClick: discardDraft,
              }, "放弃修改"),
              h("button", {
                type: "button",
                className: "dmg-button dmg-button--primary",
                disabled: !canApply || ui.saving,
                "aria-busy": ui.saving || undefined,
                onClick: () => {
                  void saveDraft();
                },
              },
                ui.saving && h("span", { className: "dmg-spinner", "aria-hidden": true }),
                ui.saving ? "应用中…" : "应用")))));
    }

    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.pluginCss = STYLE_ID;
        tag.textContent = PANEL_CSS;
        document.head.append(tag);
        return () => tag.remove();
      }, "model-guidance: styles");

      const form = ctx.configForms.get(ENTRY_ID);
      const guidanceStore = createSharedStore({
        selectedId: null,
        search: "",
        draft: null,
        saving: false,
        message: null,
        focusNameToken: 0,
      });
      const catalogController = createCatalogSource(ctx);
      ctx.effect(() => catalogController.start(), "model-guidance: model catalog");

      ctx.slots.inject("main", () => ctx.slots.register({
        name: "main",
        key: ENTRY_ID,
        inject: () => ({
          form,
          guidanceStore,
          catalog: catalogController.source,
        }),
      }, GuidancePage));

      ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
        name: "sidebar.panellist",
        id: ENTRY_ID,
        order: 20,
        label: () => "模型行为指南",
      }, GuidanceIcon));
    }

    return { apply, inject: ["slots", "configForms", "remote", "remote.session"] };
  },
});
