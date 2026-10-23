# Integration contracts

Keep `/usr/bin/forkop` as the CLI and LuCI rpcd file-exec boundary. Return JSON
objects with `success`, stable `error` codes and optional `data`. Reject malformed
requests before side effects. Use the existing async UI job protocol for operations.

Route explanation reports a decision and trace, not website availability. Connectivity
probes are explicit, bounded jobs. Profiles use one operation lock and atomic config
replacement with durable recovery. Existing `/etc/config/forkop` remains authoritative.
Manual server choices persist; automatic health decisions do not cause flash churn.
Smart Detect only proposes rules until the user explicitly accepts a recommendation.

Before adding APIs, orchestrators must document final CLI method names and JSON shape
here and notify the other orchestrator. Reuse proven Trafira equivalents where suitable,
with all `trafira` runtime namespaces adapted to `forkop` and attribution retained.

## Forkop Next extension

`forkop next ACTION JSON` returns `{success:boolean,error?:stable_code,data?:object}`.
Read operations use the same lock as writes; malformed JSON never mutates state.

- `status {}`: `{digest,recovery_pending,previous_available,sections:[{name,label,action}],versions:{forkop,sing_box}}`.
- `profile_list {}`: `{items:[{name}]}`; `profile_save {name}` saves the current raw UCI.
- `profile_export {name}`: `{name,config}`. Export includes secrets and is an explicit user action.
- `profile_import {name,config}` parses isolated UCI before saving; never activates.
- `profile_diff {name}`: `{changed:["section.option"],current_digest}`; values are omitted to avoid credential exposure.
- `profile_apply {name,expected?}` and `rollback {expected?}` atomically replace config, validate and restore on activation failure. Digest conflicts reject stale previews.
- `devices {}`: `{items:[{address,section}]}`; `device_set {address,section}` updates real fully-routed device lists using the config transaction.
- `gaming_apply {preset,device?,section}`: presets `steam`, `playstation`, `xbox` route download/store domains only. Game session traffic keeps existing routing.
- `temporary_add {domain,section,ttl}` accepts 60..86400 seconds; `temporary_list {}` returns `{items:[{id,domain,section,expires}]}`; `temporary_delete {id}` removes one rule.
- Internal `expire {}` removes expired generated sections and reapplies config. The service timer runs this every minute; expiry precision is one timer interval.
- Root-owned Smart Detect actions: `recommendations`, `recommendation_record`, `recommendation_accept`, `recommendation_dismiss`.

`forkop route_explain JSON` accepts `{domain,device?,port?,protocol?}` and returns
`{success:true,data:{scope:"configured",connectivity_tested:false,capture_verified:false,
decision:{status:"matched|direct|blocked|indeterminate",section?,outbound?},
trace:[{section,match:"yes|no|unknown",reason}],missing:[]}}`.
The trace describes configured rules, not live packet capture or website availability.
Unknown remote rules cannot produce a false definitive answer.

Additional status field: `smart_detect:{enabled:boolean,section:string,interval:60}`.
`smart_detect_configure {enabled:boolean,section?}` uses the same safe config transaction;
enabling requires an existing enabled connection and a valid enabled local mixed proxy.
`recommendation_scan {domain,section}` is explicit; automatic `recommendation_tick {}`
is disabled unless opted in and is supervised once per minute. `recommendation_accept`
first applies a route through the chosen existing connection, then marks evidence complete.

Internal lifecycle actions: `checkpoint {}` records the stable applied UCI; `native_apply {}`
protects ordinary LuCI reloads using that checkpoint; `startup_recover {}` restores a
pending durable backup before runtime configuration is read. These actions are not
separate everyday UI controls. No checkpoint fails closed until a stable start records one.
`timer {}` is a supervised ucode worker; it holds no operation lock while sleeping.

`compatibility_check` and `compatibility_updates` are delegated to the compatibility
module; full request/response and evidence semantics are in `docs/COMPATIBILITY.md`.
