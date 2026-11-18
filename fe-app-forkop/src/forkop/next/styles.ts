export const nextStyles = `
.fkp-next-overview>.fkp-next-heading:empty{display:none}
.fkp-next-overview[data-workspace=true] .fkp-next-service,.fkp-next-overview[data-workspace=true] .fkp-next-connection{display:none}
.fkp-next-overview[data-workspace=true] .fkp-next-status-block:has(>.fkp-next-notice:empty):not(:has(button)){display:none}
.fkp-next-overview .fkp-next-content{grid-template-columns:minmax(0,1fr);align-items:start;gap:20px}
.fkp-next-overview .fkp-next-content>section{min-width:0}
.fkp-next-overview .fkp-next-primary{padding:22px 24px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface,var(--next-field));box-shadow:0 2px 10px rgba(15,28,36,.04)}
.fkp-next-overview .fkp-next-primary>h3{font-size:12px!important;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--next-muted);margin:0 0 8px!important}
.fkp-next-overview .fkp-next-selected-name{font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-.02em;color:var(--next-fg);margin:0 0 4px;overflow-wrap:anywhere}
.fkp-next-hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:16px}
.fkp-next-hero-actions>button{margin:0!important;display:inline-flex;align-items:center;justify-content:center;text-align:center!important}
.fkp-next-overview .fkp-next-probe{margin-top:16px;padding-top:12px;border-top:1px solid var(--next-line)}
.fkp-next-overview .fkp-next-probe>summary{min-height:44px;cursor:pointer;font-size:13.5px;font-weight:650;padding:8px 0;color:var(--next-accent);overflow-wrap:anywhere;display:flex;align-items:center;gap:6px;list-style:none}
.fkp-next-overview .fkp-next-probe>summary::-webkit-details-marker{display:none}
.fkp-next-overview .fkp-next-probe>summary::before{content:"▸";font-size:12px;transition:transform .14s ease}
.fkp-next-overview .fkp-next-probe[open]>summary::before{transform:rotate(90deg)}
.fkp-next-overview .fkp-next-probe>summary:focus-visible{outline:2px solid var(--next-accent);outline-offset:2px}
.fkp-next-probe-form{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;margin-top:10px}
.fkp-next-probe-form>label{flex:1 1 240px;max-width:28rem;margin:0!important}
.fkp-next-probe-form>button{margin:0!important;flex-shrink:0;text-align:center!important}
.fkp-next-probe label{display:flex;flex-direction:column;gap:6px;color:var(--next-muted);font-size:13px;font-weight:550;max-width:34ch}
.fkp-next-probe input{margin:0}
.fkp-next-probe .fkp-next-help{font-size:12px;line-height:1.55;margin:10px 0 0}
.fkp-next-heading{display:flex;align-items:center;justify-content:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:20px}.fkp-next-heading>div{flex:1;min-width:200px}.fkp-next-heading>div>p{color:var(--next-muted)}.fkp-next-heading label{display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--next-muted)}
.fkp-next.fkp-next-overview h3{font-size:15px;font-weight:650;line-height:1.35;color:var(--next-fg);margin:0 0 12px}
.fkp-next-overview .fkp-next-service{font-size:20px;line-height:1.3;font-weight:650;margin:0 0 10px;letter-spacing:-.02em}
.fkp-next-overview .fkp-next-connection{font-size:14px;line-height:1.6;margin-bottom:14px}
.fkp-next .fkp-next-primary-action,.fkp-workspace .fkp-next .fkp-next-primary-action{background:var(--next-accent);border-color:var(--next-accent);color:var(--next-bg);font-weight:600}
.fkp-next .fkp-next-primary-action:hover,.fkp-workspace .fkp-next .fkp-next-primary-action:hover{background:var(--next-accent);filter:brightness(.94);color:var(--next-bg)}
.fkp-workspace :is([data-tab=next],[data-tab=devices],[data-tab=rule_tools],[data-tab=route_tools],[data-tab=advanced])>h3{display:none}
.fkp-next-overview .fkp-next-traffic{margin-top:22px;padding-top:0;border-top:0}
.fkp-next-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 8px;padding:0;font-variant-numeric:tabular-nums}
.fkp-next-metrics>div{min-width:0;padding:12px 14px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface,var(--next-field))}
.fkp-next-metrics dt{font-size:11.5px;line-height:1.4;font-weight:550;color:var(--next-muted);margin:0 0 4px}
.fkp-next-metrics dd{font-size:17px;line-height:1.35;font-weight:700;color:var(--next-fg);margin:0;overflow-wrap:anywhere}
.fkp-next-traffic .fkp-next-traffic-status{font-size:12px;color:var(--next-muted);margin:6px 0 0}
.fkp-next-overview .fkp-next-routes{margin-top:22px;padding:18px 20px;border:1px solid var(--next-line);border-radius:12px;background:var(--next-surface,var(--next-field))}
.fkp-next-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.fkp-next-section-head>h3{margin:0!important}
.fkp-next-section-head>button{margin:0!important;text-align:center!important}
.fkp-next-routes-list{font-size:13.5px;color:var(--next-muted)}
.fkp-next-overview .fkp-next-route{color:var(--next-fg)}
.fkp-next-overview .fkp-next-route+.fkp-next-route{margin-top:12px;padding-top:12px;border-top:1px solid var(--next-line)}
.fkp-next-routes .fkp-next-route p:first-child{font-weight:600;margin-bottom:2px}
.fkp-next-routes .fkp-next-help{font-size:12px;margin:0}
.fkp-next{scrollbar-color:var(--next-line) var(--next-bg)}.fkp-next a{text-underline-offset:3px}
.fkp-next-overview .fkp-next-heading:has(>button:only-child){margin-top:-8px;margin-bottom:16px}
.fkp-workspace .fkp_dashboard-page__outbound-grid__item .fkp_dashboard-page__outbound-grid__item__select{width:100%;margin:14px 0 0;min-height:42px;background:transparent;color:var(--next-accent);border:1px solid var(--next-line);font-size:13px;text-align:center}.fkp-workspace .fkp_dashboard-page__outbound-grid__item .fkp_dashboard-page__outbound-grid__item__select[aria-pressed=true]{background:var(--next-accent)!important;border-color:var(--next-accent)!important;color:var(--next-bg)!important;font-weight:600;opacity:1}.fkp-workspace .fkp_dashboard-page__outbound-grid__item .fkp_dashboard-page__outbound-grid__item__select:disabled:not([aria-pressed=true]){color:var(--next-muted);opacity:1;cursor:default}.fkp-workspace .fkp_dashboard-page__outbound-grid__item .fkp_dashboard-page__outbound-grid__item__select:not(:disabled):hover{background:var(--fkp-hover);border-color:var(--next-accent)}
@media(max-width:900px){.fkp-next-metrics{gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:720px){.fkp-next-heading{gap:8px;margin-bottom:16px}.fkp-next-heading>div{flex-basis:100%}.fkp-next-heading label{flex:1}.fkp-next-overview .fkp-next-content{gap:14px}.fkp-next-overview .fkp-next-primary{padding:16px}.fkp-next-hero-actions>button{flex:1 1 150px;min-height:44px}.fkp-next-hero-actions:not(:has(>.fkp-action-menu))>button.fkp-next-primary-action{flex-basis:100%}.fkp-next-probe-form>label,.fkp-next-probe-form>button{flex-basis:100%;max-width:none;width:100%}.fkp-next-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fkp-next-metrics>div:nth-child(5):last-child{grid-column:1 / -1}.fkp-next-metrics dd{font-size:16px}.fkp-next-overview .fkp-next-selected-name{font-size:19px}.fkp-next-probe label{max-width:none}.fkp-next-overview .fkp-next-routes{padding:16px}}
.fkp-next-overview>.fkp-next-service{font-size:20px;font-weight:650;line-height:1.3;margin:20px 0 8px}.fkp-next-connection{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.fkp-next details{min-width:0}.fkp-next summary{cursor:pointer;padding:12px 4px;min-height:44px;font-weight:600;overflow-wrap:anywhere}.fkp-next details>summary:hover{color:var(--next-accent)}.fkp-next-advanced{margin-top:24px;border-top:1px solid var(--next-line)}.fkp-next-advanced-content{padding-top:20px}.fkp-next-advanced-content>.fkp-next-content{display:block}.fkp-next-disclosure{border-top:1px solid var(--next-line);padding-bottom:8px}.fkp-next-disclosure>.fkp-next-panel{border:0;padding:8px 0 20px}.fkp-next-overview .fkp-next-advanced-content .fkp-next-tools{padding:14px 0}.fkp-next summary::marker{color:var(--next-muted)}
.fkp-next{--next-bg:#f6f7f8;--next-fg:#17252d;--next-muted:#455863;--next-line:#ced7dc;--next-accent:#14635e;--next-field:#fff;--next-surface:#fff;--next-subtle:#eef2f4;--fkp-hover:#e6eeed;--fkp-danger:#a02b32;--warn-color-medium:#815210;color:var(--next-fg);background:var(--next-bg);padding:24px;border-radius:12px;font-family:inherit;line-height:1.5;accent-color:var(--next-accent);color-scheme:light}
.fkp-next[data-theme=dark]{--next-bg:#16232b;--next-fg:#eef4f6;--next-muted:#b8c8d0;--next-line:#455963;--next-accent:#8bd6c8;--next-field:#21333e;--next-surface:#21333e;--next-subtle:#1b2b35;--fkp-hover:#29423f;--fkp-danger:#ffb4b8;--warn-color-medium:#f2ca87;color-scheme:dark}
@media(prefers-color-scheme:dark){.fkp-next:not([data-theme=light]):not(.fkp-workspace *){--next-bg:#16232b;--next-fg:#eef4f6;--next-muted:#b8c8d0;--next-line:#455963;--next-accent:#8bd6c8;--next-field:#21333e;--next-surface:#21333e;--next-subtle:#1b2b35;--fkp-hover:#29423f;--fkp-danger:#ffb4b8;--warn-color-medium:#f2ca87;color-scheme:dark}}
.fkp-next input::placeholder,.fkp-next textarea::placeholder{color:var(--next-muted);opacity:.78}.fkp-next .fkp-next-check{display:flex;flex-direction:row;align-items:center;gap:10px;min-height:44px;margin:8px 0;cursor:pointer;color:var(--next-fg)}.fkp-next input[type=checkbox],.fkp-next input[type=radio]{appearance:auto;-webkit-appearance:auto;width:19px;height:19px;min-height:19px;padding:0;margin:0;flex:0 0 19px;border:0;background:transparent}.fkp-next *{box-sizing:border-box}.fkp-next ::selection{background:var(--next-accent);color:var(--next-bg)}
.fkp-next header{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:20px}.fkp-next header>div{flex:1;min-width:200px}.fkp-next h2{font-size:24px;line-height:1.2;margin:0 0 6px;font-weight:700}.fkp-next h3{font-size:17px;line-height:1.3;margin:0 0 8px;font-weight:650}.fkp-next p{margin:0 0 10px;max-width:70ch}.fkp-next header p,.fkp-next-help{color:var(--next-muted)}
.fkp-next-compatibility{grid-column:1/-1}.fkp-next-compatibility label{max-width:70ch}.fkp-next-tools{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.fkp-next-content{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:20px}.fkp-next-panel{min-width:0;border-top:1px solid var(--next-line);padding-top:20px}.fkp-next-panel>h3:not(:first-child){margin-top:24px}.fkp-next-panel label,.fkp-next header label{display:flex;flex-direction:column;gap:6px;margin:10px 0;color:var(--next-muted);font-size:13.5px;font-weight:550}.fkp-next input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]),.fkp-next select,.fkp-next textarea{border:1px solid var(--next-line);border-radius:8px;background:var(--next-field);color:var(--next-fg);min-height:42px;padding:9px 12px;width:100%;max-width:100%;font:inherit;caret-color:var(--next-accent)}
.fkp-next button{border:1px solid var(--next-line);border-radius:8px;background:var(--next-field);color:var(--next-fg);min-height:42px;padding:8px 14px;font:inherit;font-weight:550;margin:4px 8px 4px 0;white-space:normal;word-break:normal;overflow-wrap:break-word;text-align:left;cursor:pointer;transition:background-color .15s ease-out,border-color .15s ease-out}.fkp-next button:hover{background:var(--fkp-hover);border-color:var(--next-accent)}.fkp-next button:disabled{opacity:.5;cursor:default}.fkp-next :focus-visible{outline:2px solid var(--next-accent);outline-offset:2px}.fkp-next-summary{font-variant-numeric:tabular-nums}.fkp-next-summary>span{display:block;margin-bottom:6px}.fkp-next-summary:empty{display:none}.fkp-next-status{font-variant-numeric:tabular-nums;color:var(--next-accent);padding:12px 0;border-top:1px solid var(--next-line)}.fkp-next-status:empty,.fkp-next-status[hidden]{display:none!important}.fkp-next-notice:empty{display:none}.fkp-next-notice{font-weight:600}.fkp-next-result{white-space:pre-wrap;overflow-wrap:break-word;max-height:320px;overflow:auto;font-size:13px;line-height:1.55;font-variant-numeric:tabular-nums;margin-top:12px}.fkp-next-result:empty{display:none}.fkp-next-result:not(:empty){padding:12px 14px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-subtle,var(--next-bg))}.fkp-next-tools ul{list-style:none;padding:0;margin:12px 0;display:flex;flex-direction:column;gap:8px;font-size:13px;color:var(--next-muted)}.fkp-next-tools li{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;padding:10px 12px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-subtle,var(--next-bg));color:var(--next-fg);font-size:13.5px;max-width:none}.fkp-next-tools li>span{flex:1 1 180px;min-width:0}.fkp-next-item-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-left:auto}.fkp-next-tools li button{margin:0!important;min-height:36px;padding:5px 12px;font-size:12.5px;text-align:center!important}.fkp-next-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 14px;padding:10px 12px;margin-top:8px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-subtle,var(--next-bg));overflow-wrap:break-word}.fkp-next-row>span{flex:1 1 220px;min-width:0;font-size:13.5px;color:var(--next-fg)}.fkp-next-row>button{margin:0!important;flex:0 0 auto;min-height:36px;padding:6px 12px;font-size:12.5px;text-align:center!important}.fkp-next output{display:block;white-space:pre-wrap;overflow-wrap:break-word;margin:8px 0;font-size:13px;color:var(--next-muted)}.fkp-next output:empty{display:none}.fkp-next[data-mode=simple] pre.fkp-next-result{max-height:130px}.fkp-next [data-detail]{display:none}.fkp-next[data-mode=detailed] [data-detail]{display:block}
.fkp-next-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin-top:10px}.fkp-next-actions:empty,.fkp-next [hidden]{display:none!important}.fkp-next-actions>button{margin:0!important;text-align:center!important}
.fkp-next-overview .fkp-next-scenarios{margin-top:22px;padding-top:0;border-top:0}
.fkp-scenario-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.fkp-next .fkp-scenario-card,.fkp-workspace .fkp-next .fkp-scenario-card{position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;margin:0;padding:16px 40px 16px 18px;min-height:74px;width:100%;border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface,var(--next-field));color:var(--next-fg);text-align:left;word-break:normal;overflow-wrap:break-word;box-shadow:0 1px 3px rgba(15,28,36,.03)}
.fkp-next .fkp-scenario-card::after,.fkp-workspace .fkp-next .fkp-scenario-card::after{content:"→";position:absolute;right:16px;top:50%;transform:translateY(-50%);color:var(--next-accent);font-size:15px;font-weight:650;opacity:.75;transition:transform .14s ease,opacity .14s ease}
.fkp-next .fkp-scenario-card:hover:not(:disabled),.fkp-workspace .fkp-next .fkp-scenario-card:hover:not(:disabled){border-color:var(--next-accent);background:var(--fkp-hover);color:var(--next-fg)}
.fkp-next .fkp-scenario-card:hover:not(:disabled)::after,.fkp-workspace .fkp-next .fkp-scenario-card:hover:not(:disabled)::after{transform:translate(2px,-50%);opacity:1}
.fkp-scenario-title{font-size:14px;line-height:1.35;font-weight:650;color:var(--next-fg)}
.fkp-scenario-desc{font-size:12.5px;line-height:1.45;font-weight:400;color:var(--next-muted)}
@media(max-width:720px){.fkp-next-tools,.fkp-scenario-grid{grid-template-columns:minmax(0,1fr)}.fkp-next-tools{gap:16px}.fkp-next{padding:16px;border-radius:10px}.fkp-next-content{grid-template-columns:minmax(0,1fr);gap:16px}.fkp-next header{gap:8px}.fkp-next header>div{flex-basis:100%}.fkp-next header label{flex:1;margin:0}.fkp-next h2{font-size:22px}.fkp-next button{max-width:100%}.fkp-next-actions>button{flex:1 1 140px;min-height:42px}.fkp-next input:not([type=checkbox]):not([type=radio]),.fkp-next select,.fkp-next textarea{font-size:16px}.fkp-next-item-actions{margin-left:0;width:100%}.fkp-next-tools li button,.fkp-next-row>button{min-height:42px;flex:1 1 auto}}
.fkp-workspace .fkp-next[data-area] > .fkp-next-status{width:100%;max-width:none}
.fkp-workspace .fkp-next[data-area] > .fkp-next-content{width:100%;min-width:0}
.fkp-workspace .fkp-next[data-area=devices] > .fkp-next-content,.fkp-workspace .fkp-next[data-area=diagnostics] > .fkp-next-content{grid-template-columns:minmax(0,1fr)}
.fkp-workspace .fkp-next[data-area=devices] .fkp-next-tools{grid-template-columns:repeat(2,minmax(0,1fr))}
.fkp-workspace .fkp-next[data-area=settings] > .fkp-next-content > .fkp-next-compatibility{grid-column:auto}
.fkp-workspace .fkp-next[data-area=settings] .fkp-next-tools{grid-template-columns:minmax(0,1fr)}
.fkp-workspace .fkp-next[data-area] > header:empty{display:none}
.fkp-workspace .fkp-next[data-area] > header:has(>button:only-child){justify-content:flex-end;margin:-6px 0 12px}
.fkp-workspace .fkp-next[data-area] > header:has(>button:only-child)>button{margin:0;min-height:36px;padding:6px 12px;font-size:12.5px}
.fkp-workspace .fkp-next[data-area] .fkp-next-panel{border:1px solid var(--next-line);border-radius:12px;padding:18px 20px;background:var(--next-surface)}
.fkp-workspace .fkp-next[data-area] .fkp-next-panel>h3:first-child{margin-top:0}
@media (max-width:900px){.fkp-workspace .fkp-next[data-area=devices] .fkp-next-tools{grid-template-columns:minmax(0,1fr)}}
@media (max-width:720px){.fkp-workspace .fkp-next[data-area] > .fkp-next-content,.fkp-workspace .fkp-next[data-area=devices] .fkp-next-tools{grid-template-columns:minmax(0,1fr)}.fkp-workspace .fkp-next[data-area] .fkp-next-panel{padding:16px}}
.fkp-symptom-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:14px 0 12px}
.fkp-symptom-actions>button{margin:0!important;text-align:center!important}
[data-symptom-result]{padding:12px 14px;border-radius:8px;border:1px solid var(--next-line);background:var(--next-subtle,var(--next-bg));font-size:13px;line-height:1.55}
.fkp-tspu-card{margin-top:20px;padding-top:20px;border-top:1px solid var(--next-line);max-width:100%}
.fkp-tspu-card>h4{font-size:16px;line-height:1.35;margin:0 0 6px;font-weight:650;color:var(--next-fg)}
.fkp-tspu-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:10px 14px;align-items:end;margin:12px 0 14px}
.fkp-tspu-controls>label{margin:0!important;width:100%;max-width:none}
.fkp-tspu-controls :is(input,select){width:100%!important;max-width:100%!important}
.fkp-tspu-presets{grid-column:1 / -1;order:3;display:flex;flex-wrap:wrap;gap:6px;margin:0}
.fkp-next .fkp-tspu-preset,.fkp-workspace .fkp-next .fkp-tspu-preset{min-height:34px;padding:4px 12px;margin:0;border-radius:999px;font-size:12px;font-weight:550;text-align:center!important}
.fkp-tspu-card>[data-tspu-run]{margin:0!important;text-align:center!important}
.fkp-tspu-result{white-space:pre-wrap;overflow-wrap:break-word;font-size:13.5px;line-height:1.55;font-variant-numeric:tabular-nums;margin-top:14px;padding:14px 16px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-subtle,var(--next-bg))}
.fkp-tspu-result>strong{display:block;font-size:14.5px;margin-bottom:6px;color:var(--next-fg)}
.fkp-tspu-stages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0;max-width:100%}
.fkp-tspu-stage{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-field);min-width:0;max-width:100%;word-break:normal;overflow-wrap:break-word}
.fkp-tspu-stage > strong{font-size:13px;font-weight:650;color:var(--next-fg)}
.fkp-tspu-stage > span{font-size:12px;color:var(--next-muted)}
.fkp-tspu-stage[data-tspu-status="ok"]{border-color:var(--next-accent)}
.fkp-tspu-stage[data-tspu-status="failed"]{border-color:var(--fkp-danger)}
.fkp-tspu-stage[data-tspu-status="failed"] > strong{color:var(--fkp-danger)}
.fkp-tspu-stage[data-tspu-status="warning"]{border-color:var(--warn-color-medium)}
.fkp-tspu-comparison{font-weight:550;margin:8px 0 0}
.fkp-tspu-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.fkp-tspu-actions>button{margin:0!important;text-align:center!important}
.fkp-tier2-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;max-width:100%;margin:6px 0}
.fkp-tier2-toolbar .btn,.fkp-wg-warp-subview .btn{min-height:42px;max-width:100%;white-space:normal;word-break:normal;overflow-wrap:break-word}
.fkp-tier2-badge{display:inline-flex;align-items:center;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--next-line,rgba(127,127,127,.35));background:var(--next-subtle,var(--next-field));color:var(--next-fg,inherit);max-width:100%;overflow-wrap:anywhere}
.fkp-sub-preview-wrap,.fkp-sub-preview-host{width:100%;max-width:100%;min-width:0}
.fkp-sub-preview-details{width:100%;max-width:100%;margin-top:8px;padding:10px 14px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-subtle,var(--next-bg))}
.fkp-sub-preview-details>summary{cursor:pointer;min-height:44px;padding:6px 0;display:flex;align-items:center;font-weight:600;overflow-wrap:anywhere}
.fkp-sub-preview-search{box-sizing:border-box;margin-top:8px;width:100%;max-width:min(28rem,100%);min-height:42px}
.fkp-sub-preview-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;max-width:100%}
.fkp-sub-preview-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;border:1px solid var(--next-line,rgba(127,127,127,.3));background:var(--next-field,transparent);color:var(--next-fg,inherit);font-size:12px;font-weight:500;max-width:100%;overflow-wrap:anywhere}
.fkp-sub-preview-chip[hidden]{display:none!important}
.fkp-wg-warp-subview{display:flex;flex-direction:column;gap:16px;max-width:100%;width:100%}
.fkp-wg-warp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;width:100%;max-width:100%;align-items:stretch}
.fkp-wg-warp-card{border:1px solid var(--next-line,rgba(127,127,127,.28));background:var(--next-surface,var(--next-field));border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:12px;max-width:100%;min-width:0}
.fkp-wg-warp-card h5{margin:0;font-size:16px;font-weight:650;color:var(--next-fg,inherit)}
.fkp-wg-warp-lead,.fkp-wg-warp-hint{margin:0;font-size:13px;line-height:1.5;color:var(--next-muted,inherit)}
.fkp-wg-warp-hint{font-weight:550;padding:8px 10px;border-radius:8px;background:var(--next-subtle,transparent)}
.fkp-wg-warp-card label{display:flex;flex-direction:column;gap:6px;max-width:100%;font-size:13.5px;font-weight:550;color:var(--next-fg)}
.fkp-wg-warp-card label.fkp-wg-warp-check{flex-direction:row;align-items:center;gap:10px;min-height:42px;margin:2px 0;cursor:pointer;font-weight:500}
.fkp-wg-warp-card input[type=checkbox]{width:20px;height:20px;min-height:20px;margin:0!important;flex-shrink:0}
.fkp-wg-warp-card input:not([type=checkbox]):not([type=file]),.fkp-wg-warp-card select,.fkp-wg-warp-card textarea{width:100%;max-width:100%;min-height:42px;box-sizing:border-box;padding:8px 12px;border-radius:8px;border:1px solid var(--next-line,rgba(127,127,127,.35));font:inherit}
.fkp-wg-warp-card input[type=file]{width:100%;max-width:100%;min-height:42px;padding:5px 8px;border:1px dashed var(--next-line);border-radius:8px;background:var(--next-subtle,transparent);color:var(--next-muted);font-size:12.5px}
.fkp-wg-warp-card input[type=file]::file-selector-button{margin-right:10px;padding:6px 12px;border:1px solid var(--next-line);border-radius:6px;background:var(--next-field);color:var(--next-fg);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.fkp-wg-warp-card textarea{min-height:132px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
.fkp-wg-warp-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:stretch;max-width:100%;margin-top:auto;padding-top:6px}
.fkp-wg-warp-actions>.btn,.fkp-wg-warp-actions>button{flex:1 1 auto;width:100%;display:inline-flex;align-items:center;justify-content:center;text-align:center!important;margin:0!important;font-weight:600}
@media(max-width:760px){.fkp-wg-warp-grid,.fkp-tspu-controls{grid-template-columns:minmax(0,1fr)}.fkp-tspu-presets{order:0}.fkp-next .fkp-tspu-preset,.fkp-workspace .fkp-next .fkp-tspu-preset{min-height:42px;padding:6px 14px}}
@media(max-width:560px){.fkp-tspu-stages{grid-template-columns:minmax(0,1fr)}.fkp-wg-warp-card input:not([type=checkbox]),.fkp-wg-warp-card select,.fkp-wg-warp-card textarea{font-size:16px}}
.fkp-next .fkp-action-menu{position:relative;display:inline-block;vertical-align:middle;flex:0 0 auto;margin:4px 8px 4px 0}
.fkp-workspace .fkp-next .fkp-action-menu{margin:0}
.fkp-next .fkp-action-menu[hidden]{display:none!important}
.fkp-next .fkp-action-menu--block{display:block;width:100%;margin:6px 0 0}
.fkp-next .fkp-action-menu>summary.fkp-action-menu__trigger{box-sizing:border-box;min-height:44px;min-width:44px;margin:0;padding:8px 14px;border:1px solid var(--next-line);border-radius:8px;background:var(--next-field);color:var(--next-fg);font:inherit;font-size:13.5px;font-weight:600;line-height:1.2;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;list-style:none;user-select:none;white-space:nowrap}
.fkp-next .fkp-action-menu>summary.fkp-action-menu__trigger::-webkit-details-marker{display:none}
.fkp-next .fkp-action-menu>summary.fkp-action-menu__trigger::marker{content:""}
.fkp-next .fkp-action-menu:not(.fkp-action-menu--compact)>summary.fkp-action-menu__trigger::after{content:"▾";font-size:11px;line-height:1;color:var(--next-muted);transition:transform .15s ease}
.fkp-next .fkp-action-menu[open]:not(.fkp-action-menu--compact)>summary.fkp-action-menu__trigger::after{transform:rotate(180deg);color:var(--next-accent)}
.fkp-next .fkp-action-menu--compact>summary.fkp-action-menu__trigger{padding:0 10px;font-size:18px;font-weight:700;line-height:1;letter-spacing:1px}
.fkp-next .fkp-action-menu__popover{box-sizing:border-box;position:absolute;top:calc(100% + 6px);right:0;z-index:80;min-width:210px;max-width:min(284px,calc(100vw - 28px));padding:6px;border:1px solid var(--next-line);border-radius:10px;background:var(--next-surface,var(--next-field));box-shadow:0 12px 30px rgba(15,28,36,.16);display:flex;flex-direction:column;gap:2px;text-align:left}
.fkp-next .fkp-action-menu[data-align="start"]>.fkp-action-menu__popover{left:0;right:auto}
.fkp-next .fkp-action-menu__popover button.fkp-action-menu__item{box-sizing:border-box;width:100%!important;min-height:40px;margin:0!important;padding:8px 12px!important;border:0!important;border-radius:7px!important;background:transparent!important;color:var(--next-fg)!important;font-size:13.5px;font-weight:500;display:flex!important;align-items:center;justify-content:flex-start!important;gap:8px;text-align:left!important;white-space:normal;box-shadow:none!important;flex:0 0 auto!important}
.fkp-next .fkp-action-menu__popover button.fkp-action-menu__item:hover:not(:disabled){background:var(--fkp-hover)!important;color:var(--next-accent)!important}
.fkp-next .fkp-action-menu__popover button.fkp-action-menu__danger{color:var(--fkp-danger)!important}
.fkp-next .fkp-action-menu__popover button.fkp-action-menu__danger:hover:not(:disabled){color:var(--fkp-danger)!important;background:rgba(209,67,67,.1)!important}
.fkp-next .fkp-action-menu__divider{border:0;border-top:1px solid var(--next-line);margin:4px 2px;width:auto}
@media(prefers-reduced-motion:reduce){.fkp-next button,.fkp-tier2-toolbar .btn,.fkp-wg-warp-subview .btn,.fkp-next .fkp-action-menu>summary::after{transition:none!important;animation:none!important}}
`;
