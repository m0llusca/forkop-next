// Forkop is an embedded LuCI application. Every rule stays inside its map or
// a modal positively identified by the workspace adapter.
export const workspaceStyles = `
.fkp-workspace,.fkp-workspace-modal {
  --next-bg:#f6f7f8;--next-fg:#17252d;--next-muted:#455863;--next-line:#ced7dc;--next-accent:#14635e;--next-field:#fff;
  --fkp-hover:#e6eeed;--fkp-danger:#a02b32;--fkp-selected:#dceee9;
  --text-color-high:var(--next-fg);--text-color-medium:var(--next-muted);--text-color-low:var(--next-muted);
  --background-color-high:var(--next-field);--background-color-medium:var(--next-bg);--background-color-low:var(--next-line);
  --border-color:var(--next-line);--border-color-high:var(--next-line);--border-color-low:var(--next-line);
  --primary-color-high:var(--next-accent);--primary-color-medium:var(--next-accent);--primary-color-low:var(--next-muted);
  --success-color-medium:var(--next-accent);--success-color-low:var(--next-accent);--error-color-medium:var(--fkp-danger);--warn-color-medium:#815210;
  --link-color:var(--next-accent);--link-color-dark:var(--next-accent);
  --at-bg:var(--next-bg);--at-panel:var(--next-bg);--at-text:var(--next-fg);--at-muted:var(--next-muted);--at-line:var(--next-line);--at-cyan:var(--next-accent);--at-good:var(--next-accent);
  color:var(--next-fg);background:var(--next-bg);font-family:inherit;font-size:14px;line-height:1.5;
  accent-color:var(--next-accent);color-scheme:light;scrollbar-color:var(--next-line) var(--next-bg);
}
.fkp-workspace[data-theme=dark],.fkp-workspace-modal[data-theme=dark] {
  --next-bg:#16232b;--next-fg:#eef4f6;--next-muted:#b8c8d0;--next-line:#455963;--next-accent:#8bd6c8;--next-field:#21333e;
  --fkp-hover:#29423f;--fkp-danger:#ffb4b8;--fkp-selected:#29473f;--warn-color-medium:#f2ca87;color-scheme:dark;
}
/* Native themes may load later and use important colors. The existing map ID
   and marked modal contain these overrides; surrounding LuCI is untouched. */
#cbi-forkop.fkp-workspace[data-theme],#modal_overlay .fkp-workspace-modal[data-theme],
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-map,.cbi-section,fieldset),#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-map,.cbi-section,fieldset) {background:var(--next-bg)!important;color:var(--next-fg)!important}
#cbi-forkop.fkp-workspace[data-theme] :is(input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),select,textarea,.cbi-select,.cbi-dropdown),
#modal_overlay .fkp-workspace-modal[data-theme] :is(input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),select,textarea,.cbi-select,.cbi-dropdown),
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button,.btn),#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button,.btn) {background:var(--next-field)!important;color:var(--next-fg)!important;border-color:var(--next-line)}
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button-positive,.cbi-button-apply,.cbi-button-save,.fkp-next-primary-action),#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button-positive,.cbi-button-apply,.cbi-button-save) {background:var(--next-accent)!important;color:var(--next-bg)!important}
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button-negative,.cbi-button-remove),#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button-negative,.cbi-button-remove) {color:var(--fkp-danger)!important}
.fkp-workspace *,.fkp-workspace-modal * {box-sizing:border-box}
.fkp-workspace ::selection,.fkp-workspace-modal ::selection {background:var(--next-accent);color:var(--next-bg)}
.fkp-workspace {display:grid;grid-template-columns:184px minmax(0,1fr);padding:0!important;margin:24px 0;min-width:0;border:1px solid var(--next-line);border-radius:12px;overflow:clip}
.fkp-workspace-sidebar {min-width:0;padding:24px 12px;align-self:start;position:sticky;top:16px}
.fkp-workspace-brand {font-size:22px;line-height:1.25;letter-spacing:-.025em;font-weight:700;padding:0 12px;margin-bottom:32px}
.fkp-workspace-primary {display:flex;flex-direction:column;gap:8px}
.fkp-workspace-main {min-width:0;border-left:1px solid var(--next-line);padding:24px 32px 32px}
.fkp-workspace-top {display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:24px;border-bottom:1px solid var(--next-line);margin-bottom:24px}
.fkp-workspace-status {display:flex;flex-direction:column;gap:4px;min-width:0}
.fkp-workspace-service {font-weight:650;line-height:1.4}
.fkp-workspace-connection {color:var(--next-muted);font-size:12px;max-width:75ch;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.fkp-workspace .fkp-workspace-theme {display:flex;align-items:center;gap:8px;flex-shrink:0;font-size:12px;color:var(--next-muted);margin:0}
.fkp-workspace .fkp-workspace-theme select {width:auto;min-width:126px;font-size:13px}
.fkp-workspace .fkp-workspace-title {font-size:28px;font-weight:650;line-height:1.2;letter-spacing:-.025em;margin:0 0 24px;color:var(--next-fg);text-wrap:balance}
.fkp-workspace-secondary:has(.fkp-workspace-local:not([hidden])) {margin-bottom:24px}
.fkp-workspace-local {display:flex;gap:8px;border-bottom:1px solid var(--next-line);padding-bottom:12px;overflow-x:auto;scrollbar-width:thin}
.fkp-workspace .fkp-workspace-nav-button,.fkp-workspace .fkp-workspace-local-button {border:0;background:transparent;box-shadow:none;white-space:nowrap;cursor:pointer;font:inherit;font-weight:550;min-height:44px;padding:10px 12px;text-align:left;border-radius:6px;color:var(--next-muted);margin:0}
.fkp-workspace .fkp-workspace-local-button {font-size:13px}
.fkp-workspace .fkp-workspace-nav-button[aria-current=page],.fkp-workspace .fkp-workspace-local-button[aria-current=page] {background:var(--fkp-selected);color:var(--next-accent);font-weight:650}
.fkp-workspace .fkp-workspace-nav-button[data-errors],.fkp-workspace .fkp-workspace-local-button[data-errors] {display:flex;align-items:center;gap:8px;color:var(--fkp-danger)}
.fkp-workspace .fkp-workspace-nav-button[data-errors]::after,.fkp-workspace .fkp-workspace-local-button[data-errors]::after {content:attr(data-errors);display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;margin-left:auto;padding:0 4px;border:1px solid currentColor;border-radius:4px;font-size:12px;font-variant-numeric:tabular-nums;line-height:1}
.fkp-workspace .fkp-workspace-native-tabs {display:none!important}
.fkp-workspace-content {min-width:0}
.fkp-workspace-content > h2,.fkp-workspace-content > .cbi-map-descr {display:none}
.fkp-workspace .cbi-map-tabbed {background:transparent;border:0;padding:0;min-width:0}
.fkp-workspace .cbi-map-tabbed > .cbi-section {padding:0;margin:0;background:transparent;border:0;box-shadow:none;min-width:0}
.fkp-workspace .cbi-map-tabbed > .cbi-section[data-tab]:not([data-tab-active=true]),.fkp-workspace [hidden],.fkp-workspace-modal [hidden],.fkp-workspace .hidden,.fkp-workspace-modal .hidden {display:none!important}
.fkp-workspace h3,.fkp-workspace-modal h3,.fkp-workspace-modal h4 {color:var(--next-fg);font-weight:650;font-size:19px;line-height:1.3;margin:32px 0 12px;letter-spacing:-.015em;text-wrap:balance}
.fkp-workspace .cbi-section > h3:first-child {margin-top:0}
.fkp-workspace p,.fkp-workspace-modal p {max-width:75ch;overflow-wrap:anywhere}
.fkp-workspace .cbi-section-descr,.fkp-workspace .cbi-value-description,.fkp-workspace-modal .cbi-section-descr,.fkp-workspace-modal .cbi-value-description {color:var(--next-muted);font-size:13px;line-height:1.6;max-width:75ch;margin:8px 0 16px;overflow-wrap:anywhere}
.fkp-workspace .cbi-value,.fkp-workspace-modal .cbi-value {display:flex;flex-wrap:nowrap;align-items:flex-start;gap:24px;padding:12px 0;margin:0;border-bottom:1px solid var(--next-line);background:transparent;min-width:0}
.fkp-workspace .cbi-value:last-child,.fkp-workspace-modal .cbi-value:last-child {border-bottom:0}
.fkp-workspace .cbi-value > label.cbi-value-title,.fkp-workspace-modal .cbi-value > label.cbi-value-title {flex:0 0 200px;float:none;width:auto;text-align:left;padding:10px 0 0;margin:0;color:var(--next-fg);font-size:14px;line-height:1.5;font-weight:550;overflow-wrap:anywhere}
.fkp-workspace .cbi-value-field,.fkp-workspace-modal .cbi-value-field {flex:1;min-width:0;width:auto;margin:0;padding:0;color:var(--next-fg)}
.fkp-workspace .cbi-value-field:only-child,.fkp-workspace-modal .cbi-value-field:only-child {margin-left:0}
.fkp-workspace .cbi-value > .cbi-value-field > :is(input:not([type=checkbox]):not([type=radio]),select,textarea,.cbi-select,.cbi-dropdown,.cbi-dynlist,.control-group),
.fkp-workspace-modal .cbi-value > .cbi-value-field > :is(input:not([type=checkbox]):not([type=radio]),select,textarea,.cbi-select,.cbi-dropdown,.cbi-dynlist,.control-group) {width:100%;max-width:42rem;min-width:0;height:auto}
.fkp-workspace .cbi-value .cbi-value-description,.fkp-workspace-modal .cbi-value .cbi-value-description {margin:6px 0 0;line-height:1.5;white-space:normal;max-width:75ch}
.fkp-workspace .cbi-value .cbi-dynlist > .add-item,.fkp-workspace-modal .cbi-value .cbi-dynlist > .add-item {display:flex;gap:4px;min-width:0}
.fkp-workspace .cbi-value .cbi-dynlist > .add-item > :is(input,.cbi-dropdown),.fkp-workspace-modal .cbi-value .cbi-dynlist > .add-item > :is(input,.cbi-dropdown) {flex:1;min-width:0;width:100%}
.fkp-workspace .cbi-value .cbi-dynlist > .add-item > button,.fkp-workspace-modal .cbi-value .cbi-dynlist > .add-item > button {flex:0 0 42px;min-width:42px}
.fkp-workspace .cbi-value:has(.fkp-next),.fkp-workspace .cbi-value:has(.fkp_dashboard-page),.fkp-workspace .cbi-value:has(.fkp_monitoring-page),.fkp-workspace .cbi-value:has(.fkp_diagnostic-page),.fkp-workspace .cbi-value:has(.fkp_updates-page) {display:block;padding:0;border:0}
.fkp-workspace input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),.fkp-workspace select,.fkp-workspace textarea,
.fkp-workspace-modal input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),.fkp-workspace-modal select,.fkp-workspace-modal textarea {
  min-height:42px;max-width:100%;border:1px solid var(--next-line);border-radius:6px;padding:9px 12px;background:var(--next-field);color:var(--next-fg);font:inherit;line-height:1.5;box-shadow:none;caret-color:var(--next-accent)
}
.fkp-workspace textarea,.fkp-workspace-modal textarea {min-height:112px;width:100%;resize:vertical;font-variant-numeric:tabular-nums}
.fkp-workspace input::placeholder,.fkp-workspace textarea::placeholder,.fkp-workspace-modal input::placeholder,.fkp-workspace-modal textarea::placeholder {color:var(--next-muted);opacity:1}
.fkp-workspace input[type=checkbox],.fkp-workspace input[type=radio],.fkp-workspace-modal input[type=checkbox],.fkp-workspace-modal input[type=radio] {width:20px;height:20px;min-height:20px;margin:11px 8px 11px 0;vertical-align:middle;accent-color:var(--next-accent)}
.fkp-workspace .cbi-checkbox,.fkp-workspace-modal .cbi-checkbox {min-height:42px;display:inline-flex;align-items:center}
.fkp-workspace button,.fkp-workspace .cbi-button,.fkp-workspace input[type=button],.fkp-workspace input[type=submit],
.fkp-workspace-modal button,.fkp-workspace-modal .cbi-button,.fkp-workspace-modal input[type=button],.fkp-workspace-modal input[type=submit] {
  min-height:42px;height:auto;max-width:100%;border:1px solid var(--next-line);border-radius:6px;padding:9px 14px;background:var(--next-field);color:var(--next-fg);font:inherit;font-weight:550;line-height:1.5;text-shadow:none;box-shadow:none;cursor:pointer;transition:background-color 140ms ease-out
}
.fkp-workspace button:hover:not(:disabled),.fkp-workspace .cbi-button:hover:not(:disabled),.fkp-workspace-modal button:hover:not(:disabled),.fkp-workspace-modal .cbi-button:hover:not(:disabled) {background:var(--fkp-hover);color:var(--next-accent)}
.fkp-workspace .cbi-button-positive,.fkp-workspace .cbi-button-apply,.fkp-workspace .cbi-button-save,.fkp-workspace-modal .cbi-button-positive,.fkp-workspace-modal .cbi-button-apply,.fkp-workspace-modal .cbi-button-save {background:var(--next-accent);border-color:var(--next-accent);color:var(--next-bg)}
.fkp-workspace .cbi-button-negative,.fkp-workspace .cbi-button-remove,.fkp-workspace-modal .cbi-button-negative,.fkp-workspace-modal .cbi-button-remove {color:var(--fkp-danger)}
.fkp-workspace :disabled,.fkp-workspace-modal :disabled {opacity:.55;cursor:not-allowed}
.fkp-workspace [aria-busy=true],.fkp-workspace-modal [aria-busy=true] {cursor:progress}
.fkp-workspace [aria-invalid=true],.fkp-workspace .cbi-input-invalid,.fkp-workspace-modal [aria-invalid=true],.fkp-workspace-modal .cbi-input-invalid {border-color:var(--fkp-danger)!important;outline-color:var(--fkp-danger)}
.fkp-workspace :is(button,input,select,textarea,a,summary,[tabindex]):focus-visible,.fkp-workspace-modal :is(button,input,select,textarea,a,summary,[tabindex]):focus-visible {outline:2px solid var(--next-accent);outline-offset:3px}
.fkp-workspace a,.fkp-workspace-modal a {color:var(--next-accent);text-underline-offset:3px}
.fkp-workspace .cbi-dynlist,.fkp-workspace-modal .cbi-dynlist {max-width:100%}
.fkp-workspace .cbi-dynlist > .item,.fkp-workspace-modal .cbi-dynlist > .item {padding:8px 12px;min-height:42px;border-color:var(--next-line);background:var(--next-field);color:var(--next-fg);border-radius:6px;overflow-wrap:anywhere}
.fkp-workspace .cbi-dropdown,.fkp-workspace-modal .cbi-dropdown {min-height:42px;max-width:100%;border:1px solid var(--next-line);border-radius:6px;background:var(--next-field);color:var(--next-fg);padding:8px 12px}
.fkp-workspace .cbi-dropdown ul,.fkp-workspace-modal .cbi-dropdown ul {background:var(--next-field);color:var(--next-fg);border-color:var(--next-line)}
.fkp-workspace .cbi-dropdown li,.fkp-workspace-modal .cbi-dropdown li {min-height:36px;padding:6px 8px;overflow-wrap:anywhere}
.fkp-workspace .table,.fkp-workspace table,.fkp-workspace-modal .table,.fkp-workspace-modal table {width:100%;max-width:100%;border:0;border-collapse:collapse;color:var(--next-fg);background:transparent;font-variant-numeric:tabular-nums;font-size:13px;margin:16px 0 24px}
.fkp-workspace :is(th,td,.th,.td),.fkp-workspace-modal :is(th,td,.th,.td) {background:transparent;color:var(--next-fg);border:0;border-bottom:1px solid var(--next-line);padding:12px 10px;text-align:left;vertical-align:middle;overflow-wrap:anywhere;line-height:1.5}
.fkp-workspace :is(th,.th),.fkp-workspace-modal :is(th,.th) {font-weight:650;color:var(--next-muted);font-size:12px}
.fkp-workspace :is(tr,.tr):hover > :is(td,.td),.fkp-workspace-modal :is(tr,.tr):hover > :is(td,.td) {background:var(--fkp-hover)}
.fkp-workspace .cbi-section-table-row,.fkp-workspace .cbi-section-table-row:nth-child(2n),.fkp-workspace-modal .cbi-section-table-row {background:transparent}
.fkp-workspace .cbi-section-actions > div,.fkp-workspace-modal .cbi-section-actions > div {display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px}
.fkp-workspace .cbi-section-actions,.fkp-workspace-modal .cbi-section-actions {min-width:104px}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .td.cbi-section-actions {width:240px!important;min-width:240px!important;white-space:normal}
.fkp-workspace .td.cbi-section-actions > div:not(.cbi-dropdown) {display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:8px}
.fkp-workspace .td.cbi-section-actions > div:not(.cbi-dropdown) > :is(button,.cbi-button) {flex:0 0 auto;width:auto;margin:0!important}
.fkp-workspace .cbi-section-create,.fkp-workspace .cbi-page-actions,.fkp-workspace-modal .button-row {display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:24px;padding-top:16px}
.fkp-workspace pre,.fkp-workspace code,.fkp-workspace-modal pre,.fkp-workspace-modal code {background:var(--next-field);color:var(--next-fg);font-size:13px;line-height:1.6;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.fkp-workspace pre,.fkp-workspace-modal pre {max-width:100%;overflow:auto;border-radius:6px;padding:16px;border:1px solid var(--next-line)}
.fkp-workspace .alert-message,.fkp-workspace-modal .alert-message {background:var(--next-field);color:var(--next-fg);border:1px solid var(--next-line);border-radius:6px;padding:16px;margin:16px 0}
.fkp-workspace .alert-message.error,.fkp-workspace-modal .alert-message.error {color:var(--fkp-danger);border-color:var(--fkp-danger)}
.fkp-workspace .fkp-next {--next-bg:inherit;--next-fg:inherit;--next-muted:inherit;--next-line:inherit;--next-accent:inherit;--next-field:inherit;padding:0;border-radius:0;background:transparent;color:inherit;line-height:1.5;color-scheme:inherit}
.fkp-workspace .fkp-next > header {position:static;float:none;inset:auto;display:flex;width:auto;height:auto;min-height:0;max-width:none;padding:0;margin:0 0 24px;border:0;box-shadow:none;background:transparent;color:var(--next-fg);z-index:auto;transform:none}
.fkp-workspace .fkp-next > header h2 {color:var(--next-fg);font-size:24px;line-height:1.25;margin:0 0 8px}
.fkp-workspace .fkp-next > header p {color:var(--next-muted);margin:0}
.fkp-workspace .fkp-next-panel {background:transparent;border-radius:0;box-shadow:none}
.fkp-workspace .fkp_dashboard-page {--dashboard-grid-columns:2;--dashboard-grid-min-width:0}
.fkp-workspace .fkp_dashboard-page__widgets-section {gap:16px;margin:0 0 32px}
.fkp-workspace .fkp_dashboard-page__widgets-section__item {border:0;border-top:1px solid var(--next-line);border-radius:0;padding:16px 0;min-width:0}
.fkp-workspace .fkp_dashboard-page__widgets-section__item__title {font-size:15px;font-weight:650;margin-bottom:12px}
.fkp-workspace .fkp_dashboard-page__widgets-section__item__row {display:flex;justify-content:space-between;gap:16px;margin:8px 0;font-variant-numeric:tabular-nums}
.fkp-workspace .fkp_dashboard-page__widgets-section__item__row__key {color:var(--next-muted)}
.fkp-workspace .fkp_dashboard-page__outbound-section {border:0;border-top:1px solid var(--next-line);border-radius:0;padding:24px 0;margin-top:8px}
.fkp-workspace .fkp_dashboard-page__outbound-section__title-section {gap:16px;flex-wrap:wrap}
.fkp-workspace .fkp_dashboard-page__outbound-section__title-section__title {font-size:18px;font-weight:650}
.fkp-workspace .fkp_dashboard-page__outbound-section__title-section__actions {gap:8px;flex-wrap:wrap}
.fkp-workspace .fkp_dashboard-page__outbound-grid {gap:12px;margin-top:16px}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item {border-width:1px;border-color:var(--next-line);border-radius:8px;padding:16px;background:var(--next-field)}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item--active {border-color:var(--next-accent);background:var(--fkp-selected)}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item--selectable:hover {border-color:var(--next-accent)}
.fkp-workspace .fkp_dashboard-page__subscription-meta {--subscription-meta-action-size:42px;--subscription-meta-action-gap:8px;border:0;border-bottom:1px solid var(--next-line);border-radius:0;padding:16px 0;background:transparent}
.fkp-workspace .fkp_dashboard-page__subscription-meta__announce {border:0;border-radius:0;padding:12px 0;background:transparent;font-style:normal;line-height:1.5}
.fkp-workspace .fkp_dashboard-page button.btn,.fkp-workspace .fkp_monitoring-page button.btn,.fkp-workspace-modal button.fkp_dashboard-page__urltest-details__copy-button {min-width:42px;min-height:42px;height:auto;border-radius:6px}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item__copy-button {padding:8px}
.fkp-workspace .fkp_diagnostic-page {grid-template-columns:minmax(0,2fr) minmax(220px,1fr);gap:32px}
.fkp-workspace .fkp_diagnostic-page__right-bar {gap:24px}
.fkp-workspace .fkp_diagnostic-page__checks,.fkp-workspace .fkp_diagnostic-page__right-bar__wiki,.fkp-workspace .fkp_diagnostic-page__right-bar__actions,.fkp-workspace .fkp_diagnostic-page__right-bar__system-info {border:0;border-top:1px solid var(--next-line);border-radius:0;padding:16px 0;background:transparent;gap:12px}
.fkp-workspace .fkp_diagnostic-page__right-bar__wiki--warning {border-color:var(--warn-color-medium)}
.fkp-workspace .fkp_diagnostic-page__right-bar__wiki--error {border-color:var(--fkp-danger)}
.fkp-workspace .fkp_diagnostic-page__left-bar {gap:24px}
.fkp-workspace .fkp_diagnostic_alert {border-width:1px;border-radius:8px;padding:16px;gap:12px;background:var(--next-field)}
.fkp-workspace .fkp_diagnostic_alert__title {font-size:15px;font-weight:650;margin-bottom:8px}
.fkp-workspace .fkp_diagnostic_alert__description {line-height:1.6;overflow-wrap:anywhere}
.fkp-workspace .fkp_monitoring-page {--fkp-monitoring-control-height:44px;--fkp-monitoring-row-action-size:42px;--fkp-monitoring-divider-color:var(--next-line);--fkp-monitoring-soft-bg:var(--next-field);--fkp-monitoring-soft-bg-hover:var(--fkp-hover)}
.fkp-workspace .fkp_monitoring-page__controls {gap:16px;margin-bottom:24px}
.fkp-workspace .fkp_monitoring-page .btn.fkp_monitoring-page__tab--active {background:var(--fkp-selected)!important;color:var(--next-accent)!important}
.fkp-workspace .fkp_monitoring-page__table th {font-size:12px;text-transform:none}
.fkp-workspace .fkp_updates-page__components {gap:32px}
.fkp-workspace .fkp_updates-page__components-column {flex:1 1 280px;min-width:0;gap:24px}
.fkp-workspace .fkp_updates-page__component {border:0;border-top:1px solid var(--next-line);border-radius:0;min-width:0;padding:16px 0;gap:16px}
.fkp-workspace .fkp_updates-page__component__title {font-size:18px;font-weight:650}
.fkp-workspace .fkp_updates-page__component__info-row {white-space:normal;flex-wrap:wrap;gap:8px 16px}
.fkp-workspace .fkp_updates-page__component__actions-main,.fkp-workspace .fkp_updates-page__component__variants-buttons {flex-wrap:wrap;gap:8px}
.fkp-workspace .fkp_updates-page__component__variants-title {font-size:13px;font-weight:550}
.fkp-workspace-modal {padding:24px!important;border:0;border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.22);max-width:min(960px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto}
.fkp-workspace-modal > h4:first-child {font-size:24px;margin:0 0 24px}
.fkp-workspace-modal .cbi-map {padding:0;margin:0;border:0;background:transparent;color:inherit;box-shadow:none}
.fkp-workspace-modal .cbi-tabmenu {display:flex;gap:8px;overflow-x:auto;border:0;border-bottom:1px solid var(--next-line);padding:0 0 12px;margin:0 0 24px;list-style:none}
.fkp-workspace-modal .cbi-tabmenu li {margin:0;border:0;background:transparent;padding:0;white-space:nowrap}
.fkp-workspace-modal .cbi-tabmenu a {display:block;padding:10px 12px;min-height:42px;border-radius:6px;text-decoration:none;color:var(--next-muted)}
.fkp-workspace-modal .cbi-tabmenu .cbi-tab:not(.cbi-tab-disabled) a {background:var(--fkp-selected);color:var(--next-accent);font-weight:650}
.fkp-workspace-modal .fkp_dashboard-page__urltest-details__row {grid-template-columns:minmax(0,1fr) minmax(54px,max-content) 42px;padding:12px 0;border-radius:0}
@media (max-width:1050px) {
  .fkp-workspace {grid-template-columns:160px minmax(0,1fr)}
  .fkp-workspace-main {padding:24px}
  .fkp-workspace-top {gap:16px;flex-wrap:wrap}
}
@media (max-width:720px) {
  .fkp-workspace {display:block;border-radius:8px;margin:16px 0}
  .fkp-workspace-sidebar {position:static;padding:16px 16px 12px;border-bottom:1px solid var(--next-line)}
  .fkp-workspace-brand {font-size:20px;padding:0;margin-bottom:12px}
  .fkp-workspace-primary {flex-direction:row;overflow-x:auto;gap:4px;padding:4px;scrollbar-width:thin}
  .fkp-workspace .fkp-workspace-nav-button {flex-shrink:0;min-height:44px}
  .fkp-workspace-main {padding:24px 16px;border:0}
  .fkp-workspace-top {margin-bottom:24px;padding-bottom:16px}
  .fkp-workspace .fkp-workspace-title {font-size:26px}
  .fkp-workspace .cbi-value,.fkp-workspace-modal .cbi-value {display:block;padding:12px 0}
  .fkp-workspace .cbi-value > label.cbi-value-title,.fkp-workspace-modal .cbi-value > label.cbi-value-title {display:block;width:100%;text-align:left;padding:0;margin:0 0 8px}
  .fkp-workspace input,.fkp-workspace select,.fkp-workspace textarea,.fkp-workspace-modal input,.fkp-workspace-modal select,.fkp-workspace-modal textarea {font-size:16px!important}
  .fkp-workspace .fkp-workspace-theme select {font-size:16px}
  .fkp-workspace .cbi-map-tabbed > .cbi-section {overflow-x:auto}
  .fkp-workspace .table,.fkp-workspace table {min-width:520px}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .table.cbi-section-table {display:block;width:100%;min-width:0;table-layout:auto}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table > thead {display:none}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table > :is(tbody,tfoot) {display:block;width:100%}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row {display:block;width:100%;padding:16px 0;margin:0;border-bottom:1px solid var(--next-line)}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row::before {display:none;content:none}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .td {display:grid;grid-template-columns:minmax(88px,32%) minmax(0,1fr);align-items:center;gap:12px;width:100%;min-width:0;margin:0;padding:8px 0;border:0;text-align:left;white-space:normal}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .td[data-title]::before {content:attr(data-title);color:var(--next-muted);font-weight:550;white-space:normal;overflow-wrap:anywhere}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .cbi-section-table-titles {display:block;font-size:15px;color:var(--next-fg);font-weight:650;padding:0 0 12px}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .cbi-section-actions {display:block;width:100%!important;min-width:0!important;padding-top:12px}
  .fkp-workspace .td.cbi-section-actions > div:not(.cbi-dropdown) {justify-content:flex-start}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .placeholder > .td {display:block;padding:16px 0}
  .fkp-workspace .fkp-next-content {grid-template-columns:minmax(0,1fr)}
  .fkp-workspace .fkp_dashboard-page {--dashboard-grid-columns:1}
  .fkp-workspace .fkp_diagnostic-page {grid-template-columns:minmax(0,1fr)}
  .fkp-workspace .fkp_monitoring-page__table {min-width:0}
  .fkp-workspace .fkp_updates-page__components-column {flex-basis:auto}
  .fkp-workspace-modal {padding:20px 16px!important;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);border-radius:8px}
}
@media (prefers-reduced-motion:reduce) {.fkp-workspace *,.fkp-workspace-modal * {transition:none!important;animation:none!important}}
`;
