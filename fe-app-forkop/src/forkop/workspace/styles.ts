// Forkop is an embedded LuCI application. Every rule stays inside its map or
// a modal positively identified by the workspace adapter.
export const workspaceStyles = `
#maincontent.container:has(#cbi-forkop.fkp-workspace) {
  max-width:1180px;width:100%;padding-inline:clamp(12px,2.5vw,24px);
}
.fkp-workspace,.fkp-workspace .fkp-next,.fkp-workspace-modal,#cbi-forkop.fkp-workspace ~ .cbi-page-actions {
  --next-bg:#f6f7f8;--next-fg:#17252d;--next-muted:#455863;--next-line:#ced7dc;--next-accent:#14635e;--next-field:#fff;
  --next-surface:#fff;--next-subtle:#eef2f4;
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
.fkp-workspace[data-theme=dark],.fkp-workspace[data-theme=dark] .fkp-next,.fkp-workspace-modal[data-theme=dark],#cbi-forkop.fkp-workspace[data-theme=dark] ~ .cbi-page-actions:not([data-theme=light]),#cbi-forkop.fkp-workspace ~ .cbi-page-actions[data-theme=dark] {
  --next-bg:#16232b;--next-fg:#eef4f6;--next-muted:#b8c8d0;--next-line:#455963;--next-accent:#8bd6c8;--next-field:#21333e;
  --next-surface:#21333e;--next-subtle:#1b2b35;
  --fkp-hover:#29423f;--fkp-danger:#ffb4b8;--fkp-selected:#29473f;--warn-color-medium:#f2ca87;color-scheme:dark;
}
/* Native themes may load later and use important colors. The existing map ID
   and marked modal contain these overrides; surrounding LuCI is untouched. */
#cbi-forkop.fkp-workspace[data-theme],#modal_overlay .fkp-workspace-modal[data-theme],
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-map,.cbi-section,fieldset),#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-map,.cbi-section,fieldset) {background:var(--next-bg)!important;color:var(--next-fg)!important}
#cbi-forkop.fkp-workspace[data-theme] :is(input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),select,textarea,.cbi-select,.cbi-dropdown:not(.btn):not(.cbi-button)),
#modal_overlay .fkp-workspace-modal[data-theme] :is(input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),select,textarea,.cbi-select,.cbi-dropdown:not(.btn):not(.cbi-button)),
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button,.btn):not(.fkp-action-menu__item):not(.fkp_monitoring-page__tab):not(.fkp_monitoring-page__icon-button):not(.fkp_monitoring-page__row-action):not(.fkp_dashboard-page__outbound-grid__item__select),
#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button,.btn):not(.fkp-action-menu__item) {background:var(--next-field)!important;color:var(--next-fg)!important;border-color:var(--next-line)}
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button,.btn):not(.fkp-action-menu__item):not(.fkp_monitoring-page__tab):not(.fkp_monitoring-page__icon-button):not(.fkp_monitoring-page__row-action):not(.fkp_dashboard-page__outbound-grid__item__select):hover:not(:disabled),
#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button,.btn):not(.fkp-action-menu__item):hover:not(:disabled) {background:var(--fkp-hover)!important;border-color:var(--next-accent)!important;color:var(--next-accent)!important}
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button-positive,.cbi-button-apply,.cbi-button-save,.fkp-next-primary-action,.cbi-section-create>.cbi-button-add),
#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button-positive,.cbi-button-apply,.cbi-button-save,.fkp-next-primary-action) {background:var(--next-accent)!important;border-color:var(--next-accent)!important;color:var(--next-bg)!important}
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button-positive,.cbi-button-apply,.cbi-button-save,.fkp-next-primary-action,.cbi-section-create>.cbi-button-add):hover:not(:disabled),
#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button-positive,.cbi-button-apply,.cbi-button-save,.fkp-next-primary-action):hover:not(:disabled) {background:var(--next-accent)!important;border-color:var(--next-accent)!important;color:var(--next-bg)!important;filter:brightness(.94)}
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button-negative,.cbi-button-remove),#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button-negative,.cbi-button-remove) {color:var(--fkp-danger)!important}
#cbi-forkop.fkp-workspace[data-theme] :is(.cbi-button-negative,.cbi-button-remove):hover:not(:disabled),#modal_overlay .fkp-workspace-modal[data-theme] :is(.cbi-button-negative,.cbi-button-remove):hover:not(:disabled) {border-color:var(--fkp-danger)!important;color:var(--fkp-danger)!important;background:var(--fkp-hover)!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions {display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin:-12px 0 28px;padding:14px 20px;background:var(--next-surface)!important;color:var(--next-fg)!important;border:1px solid var(--next-line)!important;border-radius:12px;box-shadow:0 4px 16px rgba(15,28,36,.04);text-align:right;box-sizing:border-box}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions[hidden] {display:none!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions::after {display:none!important;content:none!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions > form {display:inline-flex;align-items:center;gap:10px;margin:0}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions :is(button,.cbi-button,input[type=button],input[type=submit]) {float:none!important;margin:0!important;min-height:40px;height:auto;padding:8px 16px;border:1px solid var(--next-line)!important;border-radius:8px;background:var(--next-field)!important;color:var(--next-fg)!important;font:inherit;font-size:13.5px;font-weight:600;line-height:1.4;box-shadow:none!important;text-shadow:none!important;cursor:pointer;transition:background-color 140ms ease-out,border-color 140ms ease-out}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions :is(button,.cbi-button,input[type=button],input[type=submit]):hover:not(:disabled) {background:var(--fkp-hover)!important;border-color:var(--next-accent)!important;color:var(--next-accent)!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions :is(button,input,div,.cbi-button):is(.cbi-button-apply,.cbi-button-positive) {background:var(--next-accent)!important;border-color:var(--next-accent)!important;color:var(--next-bg)!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions :is(button,input,div,.cbi-button):is(.cbi-button-apply,.cbi-button-positive):hover:not(:disabled) {background:var(--next-accent)!important;border-color:var(--next-accent)!important;color:var(--next-bg)!important;filter:brightness(.94)}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions :is(button,input,div,.cbi-button):is(.cbi-button-reset,.cbi-button-negative,.cbi-button-remove) {color:var(--fkp-danger)!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions :is(button,input,div,.cbi-button):is(.cbi-button-reset,.cbi-button-negative,.cbi-button-remove):hover:not(:disabled) {border-color:var(--fkp-danger)!important;color:var(--fkp-danger)!important;background:var(--fkp-hover)!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions .cbi-dropdown.cbi-button {display:inline-flex;align-items:center;padding:6px 10px 6px 16px!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions .cbi-dropdown.cbi-button > ul:not(.dropdown) {margin:0!important;padding:0;background:transparent!important;color:inherit!important;border:0!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions .cbi-dropdown.cbi-button > ul:not(.dropdown) > li {min-height:0;padding:0;line-height:1.4;background:transparent!important;color:inherit!important}
#cbi-forkop.fkp-workspace ~ .cbi-page-actions .cbi-dropdown.cbi-button > .open {color:inherit!important;border-left-color:color-mix(in srgb,currentColor 32%,transparent)!important}
.fkp-workspace,.fkp-workspace-modal,.fkp-workspace *,.fkp-workspace-modal * {box-sizing:border-box}
.fkp-workspace ::selection,.fkp-workspace-modal ::selection {background:var(--next-accent);color:var(--next-bg)}
.fkp-workspace {display:grid;grid-template-columns:196px minmax(0,1fr);padding:0!important;margin:20px 0 28px;min-width:0;border:1px solid var(--next-line);border-radius:14px;box-shadow:0 6px 24px rgba(15,28,36,.05)}
.fkp-workspace > .fkp-next-notice {grid-column:1 / -1;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:12px 20px;border-bottom:1px solid var(--next-line);background:var(--fkp-selected);color:var(--next-fg);border-radius:14px 14px 0 0}
.fkp-workspace > .fkp-next-notice[hidden] {display:none!important}
.fkp-workspace-sidebar {min-width:0;padding:22px 14px;align-self:stretch;background:var(--next-surface);border-radius:14px 0 0 14px}
.fkp-workspace-brand {font-size:20px;line-height:1.25;letter-spacing:-.025em;font-weight:750;padding:0 12px 16px;margin-bottom:14px;border-bottom:1px solid var(--next-line)}
.fkp-workspace-primary {display:flex;flex-direction:column;gap:4px;position:sticky;top:16px}
.fkp-workspace .fkp-workspace-mobile-menu {display:none}
.fkp-workspace .fkp-rule-order {display:inline-flex;align-items:center;gap:4px;margin:0}
.fkp-workspace .fkp-rule-order button {min-height:34px;min-width:34px;padding:4px 8px;display:inline-flex;align-items:center;justify-content:center;text-align:center;font-weight:650;line-height:1}
.fkp-workspace .fkp-rule-order-status {font-size:13px;overflow-wrap:anywhere;margin:12px 0 0}
.fkp-workspace .fkp-rule-order-status:empty {margin:0}
.fkp-workspace-main {min-width:0;border-left:1px solid var(--next-line);padding:22px 28px 32px}
.fkp-workspace-top {display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface);margin-bottom:20px}
.fkp-workspace-status {display:flex;flex-direction:column;gap:2px;min-width:0}
.fkp-workspace-service {display:inline-flex;align-items:center;gap:8px;font-weight:650;font-size:14px;line-height:1.4}
.fkp-workspace-service::before {content:"";width:9px;height:9px;border-radius:999px;flex-shrink:0;background:var(--next-muted)}
.fkp-workspace-service[data-state=running]::before {background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.18)}
.fkp-workspace-service[data-state=pending]::before {background:var(--warn-color-medium)}
.fkp-workspace-service[data-state=stopped]::before,.fkp-workspace-service[data-state=error]::before {background:var(--fkp-danger)}
.fkp-workspace-connection {color:var(--next-muted);font-size:12px;max-width:75ch;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;padding-left:17px}
.fkp-workspace .fkp-workspace-title {font-size:24px;font-weight:700;line-height:1.25;letter-spacing:-.025em;margin:0 0 12px;color:var(--next-fg);text-wrap:balance;overflow-wrap:anywhere}
#cbi-forkop.fkp-workspace[data-active-tab=next] .fkp-workspace-title {display:none}
.fkp-workspace-secondary:has(.fkp-workspace-local:not([hidden])) {margin-bottom:20px}
.fkp-workspace-local {display:inline-flex;gap:4px;padding:4px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface);overflow-x:auto;max-width:100%;scrollbar-width:thin}
.fkp-workspace .fkp-workspace-nav-button,.fkp-workspace .fkp-workspace-local-button {border:0;background:transparent!important;box-shadow:none;white-space:nowrap;cursor:pointer;font:inherit;font-weight:550;min-height:44px;padding:9px 12px;text-align:left;border-radius:8px;color:var(--next-muted)!important;margin:0}
.fkp-workspace .fkp-workspace-local-button {min-height:36px;padding:6px 14px;font-size:13px;text-align:center}
.fkp-workspace .fkp-workspace-nav-button:hover:not(:disabled),.fkp-workspace .fkp-workspace-local-button:hover:not(:disabled) {background:var(--fkp-hover)!important;color:var(--next-fg)!important}
.fkp-workspace .fkp-workspace-nav-button[aria-current=page],.fkp-workspace .fkp-workspace-local-button[aria-current=page] {background:var(--fkp-selected)!important;color:var(--next-accent)!important;font-weight:650}
.fkp-workspace .fkp-workspace-nav-button[data-errors],.fkp-workspace .fkp-workspace-local-button[data-errors] {display:flex;align-items:center;gap:8px;color:var(--fkp-danger)!important}
.fkp-workspace .fkp-workspace-nav-button[data-errors]::after,.fkp-workspace .fkp-workspace-local-button[data-errors]::after {content:attr(data-errors);display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;margin-left:auto;padding:0 4px;border:1px solid currentColor;border-radius:999px;font-size:11px;font-variant-numeric:tabular-nums;line-height:1}
.fkp-workspace .fkp-workspace-native-tabs {display:none!important}
.fkp-workspace-content {min-width:0}
.fkp-workspace .fkp-workspace-description {font-size:13.5px;line-height:1.55;color:var(--next-muted);margin:0 0 18px;max-width:75ch;overflow-wrap:anywhere}
.fkp-workspace section.fkp-form-group,.fkp-workspace-modal section.fkp-form-group {min-width:0;margin:0 0 16px;padding:18px 20px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface)}
.fkp-workspace section.fkp-form-group>h3,.fkp-workspace-modal section.fkp-form-group>h3 {margin:0 0 6px;font-size:16px;font-weight:650}
.fkp-workspace .fkp-form-help,.fkp-workspace-modal .fkp-form-help {font-size:13px;line-height:1.55;color:var(--next-muted);margin:0 0 10px;max-width:75ch;overflow-wrap:anywhere}
.fkp-workspace details.fkp-form-group,.fkp-workspace-modal details.fkp-form-group {min-width:0;margin:0 0 16px;padding:0 20px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface)}
.fkp-workspace details.fkp-form-group[open],.fkp-workspace-modal details.fkp-form-group[open] {padding-bottom:14px}
.fkp-workspace .fkp-form-group>summary,.fkp-workspace-modal .fkp-form-group>summary {padding:14px 0;min-height:48px;cursor:pointer;font-size:15px;font-weight:650;line-height:1.4;overflow-wrap:anywhere;display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none}
.fkp-workspace .fkp-form-group>summary::-webkit-details-marker,.fkp-workspace-modal .fkp-form-group>summary::-webkit-details-marker {display:none}
.fkp-workspace .fkp-form-group>summary::after,.fkp-workspace-modal .fkp-form-group>summary::after {content:"▾";font-size:14px;color:var(--next-muted);transition:transform 140ms ease}
.fkp-workspace details.fkp-form-group[open]>summary,.fkp-workspace-modal details.fkp-form-group[open]>summary {border-bottom:1px solid var(--next-line);margin-bottom:8px}
.fkp-workspace details.fkp-form-group[open]>summary::after,.fkp-workspace-modal details.fkp-form-group[open]>summary::after {transform:rotate(180deg)}
.fkp-workspace .fkp-form-group>summary:hover,.fkp-workspace-modal .fkp-form-group>summary:hover {color:var(--next-accent)}
.fkp-workspace .fkp-rule-name,.fkp-workspace .fkp-rule-action {display:block;font-size:14px;font-weight:650;line-height:1.45;word-break:normal;overflow-wrap:break-word}
.fkp-workspace .fkp-rule-scope,.fkp-workspace .fkp-rule-route {display:block;font-size:12px;font-weight:400;line-height:1.5;color:var(--next-muted);margin-top:3px;max-width:55ch;word-break:normal;overflow-wrap:break-word}
.fkp-workspace .fkp-rule-state {display:inline-block;font-size:12px;font-weight:500;color:var(--next-muted);margin-top:3px}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) :is(.cbi-section-table-titles,.cbi-section-table-row)::before {display:none!important;content:none!important}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) :is(.cbi-section-table-titles,.cbi-section-table-row)>:first-child {width:28%!important;min-width:140px}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) :is(.cbi-section-table-titles,.cbi-section-table-row)>:nth-child(2) {width:96px!important;min-width:96px;white-space:nowrap;text-align:center!important}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) :is(.cbi-section-table-titles,.cbi-section-table-row)>:nth-child(3) {width:auto!important;min-width:160px}
.fkp-workspace-content > h2,.fkp-workspace-content > .cbi-map-descr {display:none}
.fkp-workspace .cbi-map-tabbed {background:transparent;border:0;padding:0;min-width:0}
.fkp-workspace .cbi-map-tabbed > .cbi-section {padding:0;margin:0;background:transparent;border:0;box-shadow:none;min-width:0}
.fkp-workspace .cbi-map-tabbed > .cbi-section[data-tab]:not([data-tab-active=true]),.fkp-workspace [hidden],.fkp-workspace-modal [hidden],.fkp-workspace .hidden,.fkp-workspace-modal .hidden {display:none!important}
.fkp-workspace-modal .cbi-section-node-tabbed > [data-tab]:not([data-tab-active=true]) {display:none!important}
.fkp-workspace h3,.fkp-workspace-modal h3,.fkp-workspace-modal h4 {color:var(--next-fg);font-weight:650;font-size:18px;line-height:1.3;margin:24px 0 12px;letter-spacing:-.015em;text-wrap:balance;overflow-wrap:break-word}
.fkp-workspace .cbi-section > h3:first-child {margin-top:0}
.fkp-workspace p,.fkp-workspace-modal p,.fkp-workspace li,.fkp-workspace-modal li {max-width:75ch;overflow-wrap:break-word}
.fkp-workspace .cbi-section-descr,.fkp-workspace .cbi-value-description,.fkp-workspace-modal .cbi-section-descr,.fkp-workspace-modal .cbi-value-description {color:var(--next-muted);font-size:12.5px;line-height:1.55;max-width:75ch;margin:6px 0 14px;overflow-wrap:break-word}
.fkp-workspace .cbi-value-description::before,.fkp-workspace-modal .cbi-value-description::before {display:none!important;content:none!important}
.fkp-workspace .cbi-value,.fkp-workspace-modal .cbi-value {display:flex;flex-wrap:nowrap;align-items:flex-start;gap:20px;padding:12px 0;margin:0;border-bottom:1px solid var(--next-line);background:transparent;min-width:0}
.fkp-workspace .cbi-value:last-child,.fkp-workspace-modal .cbi-value:last-child {border-bottom:0;padding-bottom:2px}
.fkp-workspace .cbi-value > label.cbi-value-title,.fkp-workspace-modal .cbi-value > label.cbi-value-title {flex:0 0 210px;float:none;width:auto;text-align:left;padding:9px 0 0;margin:0;color:var(--next-fg);font-size:13.5px;line-height:1.45;font-weight:550;overflow-wrap:break-word}
.fkp-workspace .cbi-value:has(> .cbi-value-field > .cbi-checkbox) > label.cbi-value-title,.fkp-workspace-modal .cbi-value:has(> .cbi-value-field > .cbi-checkbox) > label.cbi-value-title {padding-top:3px}
.fkp-workspace .cbi-value-field,.fkp-workspace-modal .cbi-value-field {flex:1;min-width:0;width:auto;margin:0;padding:0;color:var(--next-fg)}
.fkp-workspace .cbi-value-field:only-child,.fkp-workspace-modal .cbi-value-field:only-child {margin-left:0}
.fkp-workspace .cbi-value > .cbi-value-field > :is(input:not([type=checkbox]):not([type=radio]),select,textarea,.cbi-select,.cbi-dropdown,.cbi-dynlist,.control-group),
.fkp-workspace-modal .cbi-value > .cbi-value-field > :is(input:not([type=checkbox]):not([type=radio]),select,textarea,.cbi-select,.cbi-dropdown,.cbi-dynlist,.control-group) {width:100%;max-width:42rem;min-width:0;height:auto}
.fkp-workspace .cbi-value .cbi-value-description,.fkp-workspace-modal .cbi-value .cbi-value-description {margin:6px 0 0;line-height:1.5;white-space:normal;max-width:75ch}
.fkp-workspace .cbi-value-field > [id^="cbid.forkop."] > :is(input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea),.fkp-workspace-modal .cbi-value-field > [id^="cbid.forkop."] > :is(input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea) {width:100%;max-width:42rem;min-width:0}
:is(.fkp-workspace,.fkp-workspace-modal) .cbi-value-field .control-group {display:flex;align-items:center;gap:6px;width:100%;max-width:42rem;min-width:0}
:is(.fkp-workspace,.fkp-workspace-modal) .cbi-value-field .control-group > input {flex:1;min-width:0;width:100%;margin:0}
:is(.fkp-workspace,.fkp-workspace-modal) .cbi-value-field .control-group > :is(button,.cbi-button) {flex:0 0 42px;min-width:42px;min-height:42px;padding:0;margin:0!important;display:inline-flex;align-items:center;justify-content:center}
.fkp-workspace .cbi-value .cbi-dynlist > .add-item,.fkp-workspace-modal .cbi-value .cbi-dynlist > .add-item {display:flex;gap:6px;min-width:0;align-items:center}
.fkp-workspace .cbi-value .cbi-dynlist > .add-item > :is(input,.cbi-dropdown),.fkp-workspace-modal .cbi-value .cbi-dynlist > .add-item > :is(input,.cbi-dropdown) {flex:1;min-width:0;width:100%}
.fkp-workspace .cbi-value .cbi-dynlist > .add-item > button,.fkp-workspace-modal .cbi-value .cbi-dynlist > .add-item > button {flex:0 0 42px;min-width:42px}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-button-add-dynlist > .add-item {width:auto!important;display:inline-flex!important}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-button-add-dynlist > .add-item > .cbi-button-add {width:auto!important;flex:0 0 auto!important;height:auto!important;min-height:40px!important;max-height:none!important;padding:8px 16px!important;border-radius:8px!important;white-space:normal!important}
.fkp-workspace .cbi-value:has(.fkp-next),.fkp-workspace .cbi-value:has(.fkp_dashboard-page),.fkp-workspace .cbi-value:has(.fkp_monitoring-page),.fkp-workspace .cbi-value:has(.fkp_diagnostic-page),.fkp-workspace .cbi-value:has(.fkp_updates-page) {display:block;padding:0;border:0}
.fkp-workspace input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),.fkp-workspace select,.fkp-workspace textarea,
.fkp-workspace-modal input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),.fkp-workspace-modal select,.fkp-workspace-modal textarea {
  box-sizing:border-box;min-height:42px;max-width:100%;border:1px solid var(--next-line);border-radius:8px;padding:9px 12px;background:var(--next-field);color:var(--next-fg);font:inherit;line-height:1.5;box-shadow:none;caret-color:var(--next-accent)
}
:is(.fkp-workspace,.fkp-workspace-modal,.fkp-next) input[type=file] {width:100%;max-width:42rem;min-height:42px;padding:5px 8px;border:1px dashed var(--next-line);border-radius:8px;background:var(--next-subtle);color:var(--next-muted);font:inherit;font-size:12.5px}
:is(.fkp-workspace,.fkp-workspace-modal,.fkp-next) input[type=file]::file-selector-button {margin-right:10px;padding:6px 12px;border:1px solid var(--next-line);border-radius:6px;background:var(--next-field);color:var(--next-fg);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.fkp-workspace textarea,.fkp-workspace-modal textarea {min-height:108px;width:100%;resize:vertical;font-variant-numeric:tabular-nums}
.fkp-workspace input::placeholder,.fkp-workspace textarea::placeholder,.fkp-workspace-modal input::placeholder,.fkp-workspace-modal textarea::placeholder {color:var(--next-muted);opacity:.78}
:is(.fkp-workspace,.fkp-workspace-modal,.fkp-next) input:is([type=checkbox],[type=radio]) {appearance:auto!important;-webkit-appearance:auto!important;width:19px!important;height:19px!important;min-height:19px!important;padding:0!important;border:0!important;border-radius:4px;background:transparent!important;box-shadow:none!important;flex:0 0 19px;margin:2px 8px 2px 0;vertical-align:middle;accent-color:var(--next-accent);cursor:pointer}
:is(.fkp-workspace,.fkp-workspace-modal,.fkp-next) input[type=radio] {border-radius:50%}
:is(.fkp-workspace,.fkp-workspace-modal,.fkp-next) input:is([type=checkbox],[type=radio])::before,:is(.fkp-workspace,.fkp-workspace-modal,.fkp-next) input:is([type=checkbox],[type=radio])::after {display:none!important;content:none!important}
.fkp-workspace .fkp-next .fkp-next-check input[type=checkbox] {margin:0}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) tr[data-sid] input[type=checkbox] {width:20px!important;height:20px!important;min-height:20px!important;margin:0 auto!important;display:block}
.fkp-workspace .cbi-checkbox,.fkp-workspace-modal .cbi-checkbox {min-height:28px;display:inline-flex;align-items:center}
.fkp-workspace button,.fkp-workspace .cbi-button,.fkp-workspace input[type=button],.fkp-workspace input[type=submit],
.fkp-workspace-modal button,.fkp-workspace-modal .cbi-button,.fkp-workspace-modal input[type=button],.fkp-workspace-modal input[type=submit] {
  min-height:42px;height:auto;max-width:100%;border:1px solid var(--next-line);border-radius:8px;padding:8px 14px;background:var(--next-field);color:var(--next-fg);font:inherit;font-weight:550;line-height:1.45;white-space:normal;word-break:normal;overflow-wrap:break-word;text-shadow:none;box-shadow:none;cursor:pointer;transition:background-color 140ms ease-out,border-color 140ms ease-out
}
.fkp-workspace button:hover:not(:disabled),.fkp-workspace .cbi-button:hover:not(:disabled),.fkp-workspace-modal button:hover:not(:disabled),.fkp-workspace-modal .cbi-button:hover:not(:disabled) {background:var(--fkp-hover);border-color:var(--next-accent);color:var(--next-accent)}
.fkp-workspace .cbi-button-positive,.fkp-workspace .cbi-button-apply,.fkp-workspace .cbi-button-save,.fkp-workspace-modal .cbi-button-positive,.fkp-workspace-modal .cbi-button-apply,.fkp-workspace-modal .cbi-button-save {background:var(--next-accent);border-color:var(--next-accent);color:var(--next-bg)}
.fkp-workspace .cbi-button-negative,.fkp-workspace .cbi-button-remove,.fkp-workspace-modal .cbi-button-negative,.fkp-workspace-modal .cbi-button-remove {color:var(--fkp-danger)}
.fkp-workspace :disabled,.fkp-workspace-modal :disabled {opacity:.5;cursor:not-allowed}
.fkp-workspace [aria-busy=true],.fkp-workspace-modal [aria-busy=true] {cursor:progress}
.fkp-workspace [aria-invalid=true],.fkp-workspace .cbi-input-invalid,.fkp-workspace-modal [aria-invalid=true],.fkp-workspace-modal .cbi-input-invalid {border-color:var(--fkp-danger)!important;outline-color:var(--fkp-danger)}
.fkp-workspace :is(button,input,select,textarea,a,summary,[tabindex]):focus-visible,.fkp-workspace-modal :is(button,input,select,textarea,a,summary,[tabindex]):focus-visible {outline:2px solid var(--next-accent);outline-offset:2px}
.fkp-workspace a,.fkp-workspace-modal a {color:var(--next-accent);text-underline-offset:3px}
.fkp-workspace .cbi-dynlist,.fkp-workspace-modal .cbi-dynlist {max-width:100%}
.fkp-workspace .cbi-dynlist > .item,.fkp-workspace-modal .cbi-dynlist > .item {position:relative;display:flex;align-items:center;padding:8px 44px 8px 12px;min-height:42px;margin-bottom:8px;border:1px solid var(--next-line);background:var(--next-field);color:var(--next-fg);border-radius:8px;overflow-wrap:anywhere}
:is(.fkp-workspace,.fkp-workspace-modal) .cbi-dynlist > .item::after {top:0!important;bottom:0!important;right:0!important;width:36px!important;display:flex!important;align-items:center;justify-content:center;padding:0!important;border:0!important;border-left:1px solid var(--next-line)!important;border-radius:0 8px 8px 0!important;background:transparent!important;color:var(--fkp-danger)!important;font-size:15px;font-weight:650;box-shadow:none!important}
:is(.fkp-workspace,.fkp-workspace-modal) .cbi-dynlist.fkp-connections-dynlist > .item {--fkp-dynlist-action-width:36px;padding-right:calc(var(--fkp-dynlist-action-width) * 2 + 12px)!important}
:is(.fkp-workspace,.fkp-workspace-modal) .cbi-dynlist.fkp-connections-dynlist > .item > .fkp-dynlist-settings {right:var(--fkp-dynlist-action-width)!important;width:var(--fkp-dynlist-action-width)!important;top:0!important;bottom:0!important;height:auto!important;min-height:0!important;padding:0!important;border:0!important;border-left:1px solid var(--next-line)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.fkp-workspace .cbi-dropdown,.fkp-workspace-modal .cbi-dropdown {min-height:42px;max-width:100%;border:1px solid var(--next-line);border-radius:8px;background:var(--next-field);color:var(--next-fg);padding:8px 12px}
:is(.fkp-workspace,.fkp-workspace-modal) .cbi-dropdown:not(.btn):not(.cbi-button) {width:100%;max-width:42rem;min-width:0}
.fkp-workspace .cbi-dropdown ul,.fkp-workspace-modal .cbi-dropdown ul {background:var(--next-field);color:var(--next-fg);border-color:var(--next-line)}
.fkp-workspace .cbi-dropdown li,.fkp-workspace-modal .cbi-dropdown li {min-height:42px;padding:8px;overflow-wrap:anywhere}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-extended-preview {display:flex;flex-direction:column;gap:8px;width:100%;max-width:100%}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-extended-preview > button {align-self:flex-start}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-extended-preview > [role=status]:empty {display:none}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-extended-preview > [role=status]:not(:empty) {font-size:12.5px;color:var(--next-muted)}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-extended-preview details {padding:8px 12px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-subtle)}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-extended-preview details > summary {cursor:pointer;font-weight:600;min-height:36px;display:flex;align-items:center}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-capability-notice {display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;padding:14px 18px;margin:0 0 16px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface)}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-capability-notice > p {margin:0;flex:1 1 240px;font-size:13.5px;color:var(--next-muted)}
.fkp-workspace .table,.fkp-workspace table,.fkp-workspace-modal .table,.fkp-workspace-modal table {width:100%;max-width:100%;border:0;border-collapse:collapse;color:var(--next-fg);background:transparent;font-variant-numeric:tabular-nums;font-size:13px;margin:8px 0 16px}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .table.cbi-section-table {border:1px solid var(--next-line);border-radius:12px;border-collapse:separate;border-spacing:0;background:var(--next-surface);overflow:hidden}
.fkp-workspace :is(th,td,.th,.td),.fkp-workspace-modal :is(th,td,.th,.td) {background:transparent;color:var(--next-fg);border:0;border-bottom:1px solid var(--next-line);padding:12px 14px;text-align:left;vertical-align:middle;overflow-wrap:anywhere;line-height:1.45}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) tbody tr:last-child > :is(td,.td) {border-bottom:0}
.fkp-workspace :is(th,.th),.fkp-workspace-modal :is(th,.th) {font-weight:650;color:var(--next-muted);font-size:12px;background:var(--next-subtle)}
.fkp-workspace :is(tr,.tr):hover > :is(td,.td),.fkp-workspace-modal :is(tr,.tr):hover > :is(td,.td) {background:var(--fkp-hover)}
.fkp-workspace .cbi-section-table-row,.fkp-workspace .cbi-section-table-row:nth-child(2n),.fkp-workspace-modal .cbi-section-table-row {background:transparent}
.fkp-workspace .cbi-section-actions > div,.fkp-workspace-modal .cbi-section-actions > div,.fkp-workspace .fkp-rule-actions-bar {display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:6px}
.fkp-workspace .fkp-rule-actions-bar:has(.fkp-rule-order) > .drag-handle {display:none!important}
.fkp-workspace .cbi-section-actions,.fkp-workspace-modal .cbi-section-actions {min-width:104px}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) :is(td,.td).cbi-section-actions {width:1%!important;min-width:240px!important;white-space:nowrap}
.fkp-workspace .td.cbi-section-actions > div:not(.cbi-dropdown) {display:flex;justify-content:flex-end;align-items:center;flex-wrap:wrap;gap:6px}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-actions > div {display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end}
.fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-actions :is(button,.cbi-button) {min-height:34px;padding:5px 10px;font-size:12.5px;border-radius:6px;white-space:nowrap}
.fkp-workspace .td.cbi-section-actions > div:not(.cbi-dropdown) > * {flex:0 0 auto;width:auto;margin:0!important}
.fkp-workspace .cbi-section-create {display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:10px;margin:14px 0 0!important;padding:0!important}
.fkp-workspace .cbi-section-create > * {flex:0 0 auto!important;margin:0!important}
.fkp-workspace .cbi-page-actions,.fkp-workspace-modal .button-row {display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--next-line)}
.fkp-workspace-modal .button-row > button {margin:0!important}
.fkp-workspace pre,.fkp-workspace code,.fkp-workspace-modal pre,.fkp-workspace-modal code {background:var(--next-field);color:var(--next-fg);font-size:13px;line-height:1.6;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.fkp-workspace pre,.fkp-workspace-modal pre {max-width:100%;overflow:auto;border-radius:8px;padding:14px 16px;border:1px solid var(--next-line)}
.fkp-workspace .alert-message,.fkp-workspace-modal .alert-message {background:var(--next-surface);color:var(--next-fg);border:1px solid var(--next-line);border-radius:10px;padding:14px 16px;margin:14px 0;overflow-wrap:anywhere}
.fkp-workspace .alert-message.error,.fkp-workspace-modal .alert-message.error {color:var(--fkp-danger);border-color:var(--fkp-danger)}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-copy-feedback {display:flex;flex-direction:column;gap:8px;width:100%;max-width:100%;margin-top:12px;padding:12px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-field)}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-copy-feedback textarea {width:100%;min-height:88px;font-size:16px}
:is(.fkp-workspace,.fkp-workspace-modal) .fkp-copy-feedback button {align-self:flex-start;min-height:42px}
.fkp-workspace .fkp-next {padding:0;border-radius:0;background:transparent;color:inherit;line-height:1.5;color-scheme:inherit}
.fkp-workspace .fkp-next > header {position:static;float:none;inset:auto;display:flex;width:auto;height:auto;min-height:0;max-width:none;padding:0;margin:0 0 20px;border:0;box-shadow:none;background:transparent;color:var(--next-fg);z-index:auto;transform:none}
.fkp-workspace .fkp-next > header h2 {color:var(--next-fg);font-size:22px;line-height:1.25;margin:0 0 6px}
.fkp-workspace .fkp-next > header p {color:var(--next-muted);margin:0}
.fkp-workspace .fkp-next-panel {background:transparent;border-radius:0;box-shadow:none}
.fkp-workspace .fkp-workspace-sources {display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;padding:14px 18px;margin:0 0 16px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface)}
.fkp-workspace .fkp-workspace-sources > p:not([role=status]) {order:1;flex:1 1 260px;margin:0;font-size:13px;line-height:1.5;color:var(--next-muted);max-width:none}
.fkp-workspace .fkp-workspace-sources-actions {order:2;display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:0 0 auto}
.fkp-workspace .fkp-workspace-sources > button {order:2}
.fkp-workspace .fkp-workspace-sources > button,.fkp-workspace .fkp-workspace-sources-actions > button {margin:0!important;flex:0 0 auto;min-height:44px;padding:8px 14px;font-size:13.5px;text-align:center}
#cbi-forkop.fkp-workspace[data-theme] .fkp-workspace-sources > button:first-of-type {background:var(--next-accent)!important;border-color:var(--next-accent)!important;color:var(--next-bg)!important;font-weight:600}
.fkp-workspace .fkp-workspace-sources > button.cbi-button {order:3}
.fkp-workspace .fkp-workspace-sources > p[role=status] {order:4;flex-basis:100%;margin:2px 0 0;font-size:13px;color:var(--fkp-danger)}
.fkp-workspace .fkp-workspace-sources > p[role=status]:empty {display:none}
.fkp-workspace .fkp-source-evidence {margin:12px 0;padding:0 14px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-subtle)}
.fkp-workspace .fkp-source-evidence > summary {padding:8px 0;min-height:44px;display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:600;color:var(--next-muted);list-style:none}
.fkp-workspace .fkp-source-evidence > summary::-webkit-details-marker {display:none}
.fkp-workspace .fkp-source-evidence > summary::after {content:"▾";font-size:13px;transition:transform 140ms ease}
.fkp-workspace .fkp-source-evidence[open] {padding-bottom:12px}
.fkp-workspace .fkp-source-evidence[open] > summary {border-bottom:1px solid var(--next-line);margin-bottom:8px}
.fkp-workspace .fkp-source-evidence[open] > summary::after {transform:rotate(180deg)}
.fkp-workspace .fkp-node-search {margin:14px 0 12px;gap:8px 12px}
.fkp-workspace .fkp-node-search[hidden] {display:none!important}
.fkp-workspace .fkp-node-search > span {font-size:12.5px;font-weight:600;color:var(--next-muted);padding:6px 12px;border:1px solid var(--next-line);border-radius:999px;background:var(--next-subtle);white-space:nowrap}
.fkp-workspace .fkp-node-search > small {font-size:12px;line-height:1.45;color:var(--next-muted)}
.fkp-workspace .fkp_dashboard-page {--dashboard-grid-columns:2;--dashboard-grid-min-width:0}
.fkp-workspace .fkp_dashboard-page__widgets-section {gap:16px;margin:16px 0 0}
.fkp-workspace .fkp_dashboard-page__widgets-section__item {border:1px solid var(--next-line);border-radius:12px;padding:16px 18px;background:var(--next-surface);min-width:0}
.fkp-workspace .fkp_dashboard-page__widgets-section__item__title {font-size:15px;font-weight:650;margin-bottom:10px}
.fkp-workspace .fkp_dashboard-page__widgets-section__item__row {display:flex;justify-content:space-between;gap:16px;margin:6px 0;font-variant-numeric:tabular-nums}
.fkp-workspace .fkp_dashboard-page__widgets-section__item__row__key {color:var(--next-muted)}
.fkp-workspace .fkp_dashboard-page__outbound-section {border:1px solid var(--next-line);border-radius:12px;padding:20px;background:var(--next-surface);margin-top:0}
.fkp-workspace .fkp_dashboard-page__outbound-section + .fkp_dashboard-page__outbound-section {margin-top:16px}
.fkp-workspace .fkp_dashboard-page__outbound-section__title-section {gap:16px;flex-wrap:wrap}
.fkp-workspace .fkp_dashboard-page__outbound-section__title-section__title {font-size:17px;font-weight:650}
.fkp-workspace .fkp_dashboard-page__outbound-section__title-section__actions {gap:8px;flex-wrap:wrap}
.fkp-workspace .fkp_dashboard-page__outbound-grid {gap:12px;margin-top:14px}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item {border-width:1px;border-color:var(--next-line);border-radius:10px;padding:16px;background:var(--next-field)}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item--active {border-color:var(--next-accent);background:var(--fkp-selected)}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item--selectable:hover {border-color:var(--next-accent)}
.fkp-workspace .fkp_dashboard-page__subscription-meta {--subscription-meta-action-size:42px;--subscription-meta-action-gap:8px;border:0;border-bottom:1px solid var(--next-line);border-radius:0;padding:12px 0;background:transparent}
.fkp-workspace .fkp_dashboard-page__subscription-meta__announce {border:0;border-radius:0;padding:10px 0;background:transparent;font-style:normal;line-height:1.5}
.fkp-workspace .fkp_dashboard-page button.btn,.fkp-workspace .fkp_monitoring-page button.btn:not(.fkp_monitoring-page__row-action):not(.fkp_monitoring-page__tab),.fkp-workspace-modal button.fkp_dashboard-page__urltest-details__copy-button {min-width:42px;min-height:42px;height:auto;border-radius:8px}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item__copy-button {padding:8px}
.fkp-workspace .fkp_diagnostic-page {grid-template-columns:minmax(0,1.85fr) minmax(260px,1fr);gap:20px}
.fkp-workspace .fkp_diagnostic-page__right-bar {gap:16px}
.fkp-workspace .fkp_diagnostic-page__right-bar__wiki,.fkp-workspace .fkp_diagnostic-page__right-bar__actions,.fkp-workspace .fkp_diagnostic-page__right-bar__system-info {border:1px solid var(--next-line);border-radius:12px;padding:16px;background:var(--next-surface);gap:10px}
.fkp-workspace .fkp_diagnostic-page__right-bar__system-info__row {display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-variant-numeric:tabular-nums}
.fkp-workspace .fkp_diagnostic-page__right-bar__system-info__row > b {color:var(--next-muted);font-weight:550;flex-shrink:0}
.fkp-workspace .fkp_diagnostic-page__right-bar__system-info__row > div {display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px;text-align:right;min-width:0}
.fkp-workspace .fkp_diagnostic-page__actions-group {display:flex;flex-direction:column;gap:8px;min-width:0}
.fkp-workspace .fkp_diagnostic-page__actions-group--service {margin-top:4px;padding-top:12px;border-top:1px solid var(--next-line)}
.fkp-workspace .fkp_diagnostic-page__actions-subtitle {font-size:11.5px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;color:var(--next-muted);margin:0 0 2px}
.fkp-workspace .fkp_diagnostic-page__right-bar__actions button {display:flex!important;align-items:center;justify-content:flex-start;gap:10px;text-align:left!important;width:100%}
.fkp-workspace .fkp_diagnostic-page__checks {border:0;padding:0;background:transparent;gap:10px}
.fkp-workspace .fkp_diagnostic-page__right-bar__wiki--warning {border-color:var(--warn-color-medium)}
.fkp-workspace .fkp_diagnostic-page__right-bar__wiki--error {border-color:var(--fkp-danger)}
.fkp-workspace .fkp_diagnostic-page__left-bar {gap:16px}
.fkp-workspace .fkp_diagnostic-page__left-bar > .fkp-next-panel {border:1px solid var(--next-line);border-radius:12px;padding:20px;background:var(--next-surface)}
.fkp-workspace .fkp_diagnostic-page__left-bar > .fkp-next-panel > h3:first-child {margin-top:0}
.fkp-workspace .fkp_diagnostic_alert {border-width:1px;border-radius:10px;padding:14px 16px;gap:12px;background:var(--next-surface)}
.fkp-workspace .fkp_diagnostic_alert__title {font-size:14.5px;font-weight:650;margin-bottom:4px}
.fkp-workspace .fkp_diagnostic_alert__description {line-height:1.55;overflow-wrap:anywhere}
.fkp-workspace .fkp_monitoring-page {--fkp-monitoring-control-height:42px;--fkp-monitoring-row-action-size:34px;--fkp-monitoring-divider-color:var(--next-line);--fkp-monitoring-soft-bg:var(--next-surface);--fkp-monitoring-soft-bg-hover:var(--fkp-hover);--fkp-monitoring-danger-color:var(--fkp-danger)}
.fkp-workspace .fkp_monitoring-page__controls {gap:10px 12px;margin-bottom:16px;flex-wrap:wrap}
.fkp-workspace .fkp_monitoring-page__tabs {border-radius:10px;padding:3px}
.fkp-workspace .fkp_monitoring-page .btn.fkp_monitoring-page__tab {min-height:36px;border-radius:7px;font-size:13px;padding:5px 12px}
.fkp-workspace .fkp_monitoring-page .btn.fkp_monitoring-page__tab--active {background:var(--fkp-selected)!important;color:var(--next-accent)!important}
.fkp-workspace .fkp_monitoring-page__tab--active .fkp_monitoring-page__tab-badge {background:var(--next-accent);color:var(--next-bg)}
.fkp-workspace .fkp_monitoring-page__filters {flex:1 1 300px;gap:10px;flex-wrap:nowrap}
.fkp-workspace .fkp_monitoring-page__device-filter {width:auto;flex:0 1 175px;min-width:130px}
.fkp-workspace .fkp_monitoring-page__search {width:auto;flex:1 1 180px;max-width:280px}
.fkp-workspace .fkp_monitoring-page__table-wrap {border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface);overflow-x:auto}
.fkp-workspace .fkp_monitoring-page__table {margin:0}
.fkp-workspace .fkp_monitoring-page__table th {font-size:12px;text-transform:none;padding:11px 10px;background:var(--next-subtle)}
.fkp-workspace .fkp_monitoring-page__table td {padding:10px}
#cbi-forkop.fkp-workspace[data-theme] .fkp_monitoring-page .btn.fkp_monitoring-page__row-action {width:34px;height:34px;min-width:34px;min-height:34px;padding:0;margin:2px auto;border:1px solid transparent!important;border-radius:8px;background:transparent!important;color:var(--fkp-danger)!important}
#cbi-forkop.fkp-workspace[data-theme] .fkp_monitoring-page .btn.fkp_monitoring-page__row-action:hover:not(:disabled) {background:var(--fkp-hover)!important;border-color:var(--fkp-danger)!important;color:var(--fkp-danger)!important}
.fkp-workspace .fkp_updates-page__toolbar {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 14px;padding:12px 16px;margin:0 0 16px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface)}
.fkp-workspace .fkp_updates-page__toolbar > span {font-size:13px;color:var(--next-muted)}
.fkp-workspace .fkp_updates-page__components {gap:20px}
.fkp-workspace .fkp_updates-page__components-column {flex:1 1 280px;min-width:0;gap:16px}
.fkp-workspace .fkp_updates-page__component {border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface);min-width:0;padding:18px;gap:14px}
.fkp-workspace .fkp_updates-page__component__header {border-bottom-color:var(--next-line);padding-bottom:10px;justify-content:space-between}
.fkp-workspace .fkp_updates-page__component__title {font-size:17px;font-weight:650}
.fkp-workspace .fkp_updates-page__component__header-version {font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--next-subtle);border:1px solid var(--next-line);color:var(--next-muted)}
.fkp-workspace .fkp_updates-page__component__info-row {white-space:normal;flex-wrap:wrap;gap:8px 16px}
.fkp-workspace .fkp_updates-page__component__actions--with-details {border-top-color:var(--next-line);padding-top:12px}
.fkp-workspace .fkp_updates-page__component__actions-main,.fkp-workspace .fkp_updates-page__component__variants-buttons {flex-wrap:wrap;gap:8px}
.fkp-workspace .fkp_updates-page__component__variants-title {font-size:13px;font-weight:550}
.fkp-workspace-modal {padding:24px!important;border:1px solid var(--next-line);border-radius:14px;box-shadow:0 20px 56px rgba(0,0,0,.24);width:calc(100% - 32px);min-width:0;max-width:min(960px,calc(100% - 32px));max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow-y:auto;overflow-x:hidden}
.fkp-workspace-modal > h4:first-child {font-size:22px;font-weight:700;margin:0 0 18px}
.fkp-workspace-modal .cbi-map {padding:0;margin:0;border:0;background:transparent;color:inherit;box-shadow:none}
.fkp-workspace-modal .cbi-tabmenu {display:inline-flex;gap:4px;overflow-x:auto;max-width:100%;border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface);padding:4px;margin:0 0 20px;list-style:none}
.fkp-workspace-modal .cbi-tabmenu li {margin:0;border:0;background:transparent;padding:0;white-space:nowrap}
.fkp-workspace-modal .cbi-tabmenu a {display:block;padding:8px 14px;min-height:38px;border-radius:8px;text-decoration:none;color:var(--next-muted);font-weight:550}
.fkp-workspace-modal .cbi-tabmenu .cbi-tab:not(.cbi-tab-disabled) a {background:var(--fkp-selected);color:var(--next-accent);font-weight:600}
.fkp-workspace-modal .fkp_dashboard-page__urltest-details__row {grid-template-columns:minmax(0,1fr) minmax(54px,max-content) 42px;padding:12px 0;border-radius:0}
@media (min-width:1180px) {
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) :is(td,.td).cbi-section-actions {min-width:max-content!important}
  .fkp-workspace #cbi-forkop-section .cbi-section-actions > div.fkp-rule-actions-bar,.fkp-workspace #cbi-forkop-server .cbi-section-actions > div.fkp-rule-actions-bar,.fkp-workspace .fkp-rule-actions-bar,.fkp-workspace .fkp-rule-order {flex-wrap:nowrap}
}
@media (max-width:1050px) {
  .fkp-workspace {grid-template-columns:168px minmax(0,1fr)}
  .fkp-workspace-main {padding:20px}
  .fkp-workspace-top {gap:12px;flex-wrap:wrap}
  .fkp-workspace-local {flex-wrap:wrap;overflow:visible}
  .fkp-workspace .fkp-workspace-local-button {white-space:normal;overflow-wrap:anywhere;max-width:100%}
}
@media (max-width:960px) {
  .fkp-workspace .fkp_diagnostic-page {grid-template-columns:minmax(0,1fr)}
  .fkp-workspace .fkp_updates-page__components-column {flex-basis:100%}
  .fkp-workspace .fkp_monitoring-page__actions {margin-left:auto}
  .fkp-workspace .fkp_monitoring-page__filters {order:3;flex-wrap:wrap;flex:1 1 100%}
  .fkp-workspace .fkp_monitoring-page__device-filter,.fkp-workspace .fkp_monitoring-page__search {flex:1 1 180px;max-width:none}
}
@media (max-width:900px) {
  .fkp-workspace .fkp_monitoring-page__table-wrap {border:0;background:transparent}
  .fkp-workspace .fkp_monitoring-page__table tr {border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface);padding:12px;margin-bottom:10px}
}
@media (max-width:720px) {
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) :is(.cbi-section-table-titles,.cbi-section-table-row)>:is(:first-child,:nth-child(2),:nth-child(3)) {width:auto!important;min-width:0;white-space:normal;text-align:left!important}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) tr[data-sid] input[type=checkbox] {margin:0!important;display:inline-block}
  #cbi-forkop.fkp-workspace ~ .cbi-page-actions {margin:-6px 0 20px;padding:12px 14px;justify-content:stretch}
  #cbi-forkop.fkp-workspace ~ .cbi-page-actions :is(button,.cbi-button,input[type=button],input[type=submit]) {flex:1 1 auto;min-height:42px;text-align:center;justify-content:center}
  .fkp-workspace .fkp-workspace-sources > p:not([role=status]),.fkp-workspace .fkp-workspace-sources-actions {flex-basis:100%}
  .fkp-workspace .fkp-workspace-sources > button,.fkp-workspace .fkp-workspace-sources-actions > button {flex:1 1 auto;min-height:42px}
  .fkp-workspace {display:block;border-radius:12px;margin:12px 0 20px;overflow-x:clip}
  .fkp-workspace > .fkp-next-notice {border-radius:12px 12px 0 0;padding:12px 16px}
  .fkp-workspace-sidebar {position:static;padding:14px 16px;border-bottom:1px solid var(--next-line);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .fkp-workspace-brand {font-size:18px;padding:0;margin:0;border:0}
  .fkp-workspace-primary {display:none}
  .fkp-workspace .fkp-workspace-mobile-menu {display:flex;align-items:center;gap:8px;margin:0;min-width:0;flex:1 1 180px;font-size:13px;font-weight:600;color:var(--next-muted)}
  .fkp-workspace .fkp-workspace-mobile-menu select {flex:1;min-width:0;width:100%;max-width:100%;min-height:44px}
  .fkp-workspace-local {display:flex;flex-wrap:wrap;overflow:visible;width:100%}
  .fkp-workspace .fkp-workspace-local-button {min-height:42px;white-space:normal;overflow-wrap:anywhere;max-width:100%;flex:1 1 auto}
  .fkp-workspace .fkp-workspace-nav-button {flex-shrink:0;min-height:44px}
  .fkp-workspace-main {padding:14px;border:0}
  .fkp-workspace-top {margin-bottom:14px;padding:10px 12px;gap:10px}
  .fkp-workspace-connection {padding-left:0}
  .fkp-workspace .fkp-workspace-title {font-size:22px}
  .fkp-workspace section.fkp-form-group,.fkp-workspace-modal section.fkp-form-group {padding:14px 16px}
  .fkp-workspace details.fkp-form-group,.fkp-workspace-modal details.fkp-form-group {padding-inline:16px}
  .fkp-workspace .cbi-value,.fkp-workspace-modal .cbi-value {display:block;padding:12px 0}
  .fkp-workspace .cbi-value > label.cbi-value-title,.fkp-workspace-modal .cbi-value > label.cbi-value-title {display:block;width:100%;text-align:left;padding:0;margin:0 0 8px}
  .fkp-workspace .cbi-value > label.cbi-value-title:empty,.fkp-workspace-modal .cbi-value > label.cbi-value-title:empty {display:none;margin:0}
  .fkp-workspace input:not([type=checkbox]):not([type=radio]),.fkp-workspace select,.fkp-workspace textarea,.fkp-workspace-modal input:not([type=checkbox]):not([type=radio]),.fkp-workspace-modal select,.fkp-workspace-modal textarea {font-size:16px!important}
  :is(.fkp-workspace,.fkp-workspace-modal) .cbi-dynlist > .item {padding-right:48px}
  :is(.fkp-workspace,.fkp-workspace-modal) .cbi-dynlist > .item::after {width:42px!important}
  :is(.fkp-workspace,.fkp-workspace-modal) .cbi-dynlist.fkp-connections-dynlist > .item {--fkp-dynlist-action-width:42px}
  :is(.fkp-workspace,.fkp-workspace-modal) .fkp-button-add-dynlist > .add-item {width:100%!important;display:flex!important}
  :is(.fkp-workspace,.fkp-workspace-modal) .fkp-button-add-dynlist > .add-item > .cbi-button-add {width:100%!important;height:auto!important;min-height:42px!important;max-height:none!important;padding:8px 12px!important;white-space:normal!important}
  .fkp-workspace .cbi-map-tabbed > .cbi-section {overflow-x:auto}
  .fkp-workspace .table,.fkp-workspace table,.fkp-workspace-modal .table,.fkp-workspace-modal table {min-width:0}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .table.cbi-section-table {display:block;width:100%;min-width:0;table-layout:auto;border:0;background:transparent}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table > thead {display:none}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table > :is(tbody,tfoot) {display:block;width:100%}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row {display:block;width:100%;padding:14px 16px;margin:0 0 12px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface)}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .td {display:grid;grid-template-columns:minmax(88px,34%) minmax(0,1fr);align-items:center;gap:12px;width:100%;min-width:0;margin:0;padding:8px 0;border:0;text-align:left;white-space:normal}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .td[data-title]::before {content:attr(data-title);color:var(--next-muted);font-weight:550;white-space:normal;overflow-wrap:anywhere}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .cbi-section-table-titles {display:block;font-size:15px;color:var(--next-fg);font-weight:650;padding:0 0 10px;border-bottom:1px solid var(--next-line);margin-bottom:4px}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-table-row > .cbi-section-actions {display:block;width:100%!important;min-width:0!important;padding-top:10px;border-top:1px solid var(--next-line);margin-top:4px}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .cbi-section-actions :is(button,.cbi-button),.fkp-workspace .fkp-rule-order button {min-height:42px;min-width:42px;font-size:13.5px;padding:8px 12px}
  .fkp-workspace .td.cbi-section-actions > div:not(.cbi-dropdown),.fkp-workspace .fkp-rule-actions-bar {justify-content:flex-start}
  .fkp-workspace #cbi-forkop-section .cbi-section-actions > div,.fkp-workspace #cbi-forkop-server .cbi-section-actions > div {justify-content:flex-start}
  .fkp-workspace :is(#cbi-forkop-section,#cbi-forkop-server) .placeholder > .td {display:block;padding:16px}
  .fkp-workspace .cbi-page-actions {margin-inline:0}
  .fkp-workspace .fkp-next-content {grid-template-columns:minmax(0,1fr)}
  .fkp-workspace .fkp_dashboard-page {--dashboard-grid-columns:1}
  .fkp-workspace .fkp_diagnostic-page {grid-template-columns:minmax(0,1fr)}
  .fkp-workspace .fkp_diagnostic-page__left-bar > .fkp-next-panel {padding:16px}
  .fkp-workspace .fkp_monitoring-page__table {min-width:0}
  .fkp-workspace .fkp_updates-page__components-column {flex-basis:auto}
  .fkp-workspace-modal {padding:18px 14px!important;width:calc(100% - 16px);max-width:calc(100% - 16px);max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px);margin:8px auto;border-radius:12px}
  .fkp-workspace-modal .cbi-tabmenu {display:flex}
  .fkp-workspace-modal .cbi-tabmenu a {min-height:42px}
}
@media (max-width:560px) {
  .fkp-workspace-modal .fkp_dashboard-page__urltest-details__row {grid-template-columns:minmax(0,1fr) 42px}
}
@media (max-width:520px) {
  .fkp-workspace .fkp_monitoring-page__controls,.fkp-workspace .fkp_monitoring-page__filters,.fkp-workspace .fkp_monitoring-page__device-filter,.fkp-workspace .fkp_monitoring-page__search {flex:0 0 auto;width:100%;max-width:none;height:auto}
  .fkp-workspace .fkp_monitoring-page__actions {margin-left:0}
}
.fkp-workspace .fkp-action-menu,.fkp-workspace-modal .fkp-action-menu {position:relative;display:inline-block;vertical-align:middle;flex:0 0 auto}
.fkp-workspace .fkp-action-menu[hidden],.fkp-workspace-modal .fkp-action-menu[hidden] {display:none!important}
.fkp-workspace .fkp-action-menu--block,.fkp-workspace-modal .fkp-action-menu--block {display:block;width:100%}
.fkp-workspace .fkp-action-menu > summary.fkp-action-menu__trigger,.fkp-workspace-modal .fkp-action-menu > summary.fkp-action-menu__trigger {box-sizing:border-box;min-height:44px;min-width:44px;margin:0;padding:8px 14px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-field);color:var(--next-fg);font:inherit;font-size:13.5px;font-weight:600;line-height:1.2;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;list-style:none;user-select:none;white-space:nowrap;transition:background-color .15s ease,border-color .15s ease,color .15s ease}
.fkp-workspace .fkp-action-menu--block > summary.fkp-action-menu__trigger,.fkp-workspace-modal .fkp-action-menu--block > summary.fkp-action-menu__trigger {display:flex;width:100%;justify-content:space-between}
.fkp-workspace .fkp-action-menu > summary.fkp-action-menu__trigger::-webkit-details-marker,.fkp-workspace-modal .fkp-action-menu > summary.fkp-action-menu__trigger::-webkit-details-marker {display:none}
.fkp-workspace .fkp-action-menu > summary.fkp-action-menu__trigger::marker,.fkp-workspace-modal .fkp-action-menu > summary.fkp-action-menu__trigger::marker {content:""}
.fkp-workspace .fkp-action-menu > summary.fkp-action-menu__trigger:hover,.fkp-workspace-modal .fkp-action-menu > summary.fkp-action-menu__trigger:hover,.fkp-workspace .fkp-action-menu[open] > summary.fkp-action-menu__trigger,.fkp-workspace-modal .fkp-action-menu[open] > summary.fkp-action-menu__trigger {background:var(--fkp-hover);border-color:var(--next-accent);color:var(--next-accent)}
.fkp-workspace .fkp-action-menu:not(.fkp-action-menu--compact) > summary.fkp-action-menu__trigger::after,.fkp-workspace-modal .fkp-action-menu:not(.fkp-action-menu--compact) > summary.fkp-action-menu__trigger::after {content:"▾";font-size:11px;line-height:1;color:var(--next-muted);transition:transform .15s ease}
.fkp-workspace .fkp-action-menu[open]:not(.fkp-action-menu--compact) > summary.fkp-action-menu__trigger::after,.fkp-workspace-modal .fkp-action-menu[open]:not(.fkp-action-menu--compact) > summary.fkp-action-menu__trigger::after {transform:rotate(180deg);color:var(--next-accent)}
.fkp-workspace .fkp-action-menu--compact > summary.fkp-action-menu__trigger,.fkp-workspace-modal .fkp-action-menu--compact > summary.fkp-action-menu__trigger {padding:0 10px;font-size:18px;font-weight:700;line-height:1;letter-spacing:1px}
.fkp-workspace .fkp-action-menu__popover,.fkp-workspace-modal .fkp-action-menu__popover {box-sizing:border-box;position:absolute;top:calc(100% + 6px);right:0;z-index:80;min-width:210px;max-width:min(284px,calc(100vw - 28px));padding:6px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface);box-shadow:0 12px 30px rgba(15,28,36,.16);display:flex;flex-direction:column;gap:2px;text-align:left}
.fkp-workspace[data-theme="dark"] .fkp-action-menu__popover,.fkp-workspace-modal[data-theme="dark"] .fkp-action-menu__popover {box-shadow:0 14px 34px rgba(0,0,0,.45)}
.fkp-workspace .fkp-action-menu[data-align="start"] > .fkp-action-menu__popover,.fkp-workspace-modal .fkp-action-menu[data-align="start"] > .fkp-action-menu__popover {left:0;right:auto}
.fkp-workspace .fkp-action-menu--block > .fkp-action-menu__popover,.fkp-workspace-modal .fkp-action-menu--block > .fkp-action-menu__popover {position:static;margin-top:6px;width:100%;min-width:0;max-width:none;box-shadow:none;background:var(--next-subtle)}
.fkp-workspace .fkp-action-menu__popover button.fkp-action-menu__item,.fkp-workspace-modal .fkp-action-menu__popover button.fkp-action-menu__item {box-sizing:border-box;width:100%!important;min-height:40px;margin:0!important;padding:8px 12px!important;border:0!important;border-radius:7px!important;background:transparent!important;color:var(--next-fg)!important;font-size:13.5px;font-weight:500;display:flex!important;align-items:center;justify-content:flex-start!important;gap:8px;text-align:left!important;white-space:normal;box-shadow:none!important;flex:0 0 auto!important}
.fkp-workspace .fkp-action-menu__popover button.fkp-action-menu__item:hover:not(:disabled),.fkp-workspace-modal .fkp-action-menu__popover button.fkp-action-menu__item:hover:not(:disabled) {background:var(--fkp-hover)!important;color:var(--next-accent)!important}
.fkp-workspace .fkp-action-menu__popover button.fkp-action-menu__danger,.fkp-workspace-modal .fkp-action-menu__popover button.fkp-action-menu__danger,#cbi-forkop.fkp-workspace[data-theme] .fkp-action-menu__popover button.fkp-action-menu__danger {color:var(--fkp-danger)!important}
.fkp-workspace .fkp-action-menu__popover button.fkp-action-menu__danger:hover:not(:disabled),.fkp-workspace-modal .fkp-action-menu__popover button.fkp-action-menu__danger:hover:not(:disabled),#cbi-forkop.fkp-workspace[data-theme] .fkp-action-menu__popover button.fkp-action-menu__danger:hover:not(:disabled) {color:var(--fkp-danger)!important;background:rgba(209,67,67,.1)!important}
.fkp-workspace .fkp-action-menu__divider,.fkp-workspace-modal .fkp-action-menu__divider {border:0;border-top:1px solid var(--next-line);margin:4px 2px;width:auto}
.fkp-workspace .fkp-action-menu__heading,.fkp-workspace-modal .fkp-action-menu__heading {padding:6px 10px 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--next-muted)}
.fkp-workspace .cbi-map-tabbed > .cbi-section:has(details.fkp-action-menu[open]) {overflow:visible}
@media (prefers-reduced-motion:reduce) {.fkp-workspace *,.fkp-workspace-modal * {transition:none!important;animation:none!important}}
`;
