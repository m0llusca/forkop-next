# Integration contracts

Keep `/usr/bin/forkop` as the CLI and LuCI rpcd file-exec boundary. Return JSON
objects with `success`, stable `error` codes and optional `data`. Reject malformed
requests before side effects. Use the existing async UI job protocol for operations.

Route explanation reports a decision and trace, not website availability. Connectivity
probes are explicit, bounded jobs. Profiles use one operation lock and atomic config
replacement with durable recovery. Existing `/etc/config/forkop` remains authoritative.
Manual server choices persist; automatic health decisions do not cause flash churn.
Smart Detect only proposes rules until the user explicitly accepts a recommendation.

Before adding APIs, document final CLI method names and JSON shape here
and coordinate with maintainers. Reuse proven Trafira equivalents where suitable,
with all `trafira` runtime namespaces adapted to `forkop` and attribution retained.

## Forkop Next extension

`forkop next ACTION JSON` returns `{success:boolean,error?:stable_code,data?:object}`.
Read operations use the same lock as writes; malformed JSON never mutates state.

- `status {}`: `{digest,recovery_pending,previous_available,sections:[{name,label,action}],versions:{forkop,sing_box}}`.
- `profile_list {}`: `{items:[{name}]}`; `profile_save {name}` saves the current raw UCI.
- `profile_export {name}`: `{name,config}`. Export includes secrets and is an explicit user action.
- `profile_import {name,config}` parses isolated UCI before saving; never activates.
- `profile_diff {name}`: `{changed:["section.option"],current_digest,profile_digest}`; both digests identify the exact bytes reviewed, including when the active file changes during parsing. Values are omitted to avoid credential exposure.
- `profile_apply {name,expected?,expected_profile?}` and `rollback {expected?}` atomically replace config, validate and restore on activation failure. A changed active config returns `conflict`; a replaced saved profile returns `profile_conflict`. The UI supplies both preview digests and invalidates its preview after a refresh, profile replacement or selection change.
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

## Controller access

### Connection overview adapters

`renderNextPanel(request?, loadConnections?, adapters?)` retains its two existing
optional arguments. The optional third argument provides `readRuntime`,
`subscribeRuntime`, `openServers`, `openRules`, `changeService` and `readTraffic`.
Runtime snapshots contain optional
`running: boolean`, `pending: boolean` and `error: string`; omitted evidence stays
unknown. Subscriptions return an unsubscribe callback. The native adapter uses
an optional second listener argument `{ cached: true }` for its synchronous
startup cache replay. Cached evidence cannot supersede a pending fresh read or
an already observed fresh result/error. Genuine later updates still supersede
older in-flight replies. The native adapter uses
the existing shared `refreshRuntimeUiState`/`subscribeRuntimeUiState` service;
there is no additional overview polling loop for runtime state. `openServers` navigates to the
existing authenticated selector; without an adapter the overview opens the
native Dashboard tab and reports unavailable navigation explicitly. Advanced
Next actions retain their current authenticated CLI contracts.

`changeService('start' | 'stop')` returns `{ success, error? }` only after following
the actual service job. The native adapter uses `serviceActionStart` followed by
`waitServiceActionJob` and checks terminal `data.success`, preserving start/job
errors. Local and shared pending state disable duplicate service actions.

`readTraffic()` returns `{ downloadTotal, uploadTotal, connections }` from the
existing authenticated controller snapshot. The overview reads at most once at
a time, schedules the next read three seconds after completion and stops while
the document or native `[data-tab-active="false"]` pane is hidden or removed.
Rates require two valid samples and positive monotonic elapsed time; counter
resets, failures and visibility changes reset the baseline. Missing telemetry
stays unavailable. `openRules` navigates to existing connection/rule editing;
without it, the native `section` tab is used. Probe inputs require a domain before
any backend request.

The generated Clash controller listens on `127.0.0.1:9090` by default. Remote YACD
access requires both `enable_yacd=1` and a nonempty `yacd_secret_key`; only then can
the controller bind to the service LAN address or, with explicit WAN access, all
IPv4 interfaces. A configured secret remains enforced when YACD is disabled.
Native LuCI requires a nonblank secret when enabling YACD and masks its field.

Private controllers and HTTPS LuCI use the existing authenticated rpcd/file-exec
boundary for section state and telemetry. Authenticated HTTP YACD can use direct
WebSockets; query-string tokens are URL-encoded. RPC diagnostics attach the
configured Bearer secret regardless of the WAN setting. Dashboard polling is
bounded to one request at a time and stops when unmounted or the service stops.

Unrestricted `/usr/bin/forkop` and `/etc/init.d/forkop` exec permissions belong to
the write ACL only, because those entrypoints can mutate state. Consequently the
existing CLI-backed dynamic pages require a write-capable LuCI session, including
for status reads. The read ACL does not provide a separate read-only CLI proxy.

The read ACL also excludes the credential-bearing `forkop` UCI package and raw
section-cache files. The write ACL explicitly grants both UCI read and write
functions using table notation, and retains section-cache reads. This prevents
a read-only app account obtaining the controller secret or copyable proxy links.
Permissions from other installed ACL groups remain outside this app's control.

Configuration mutations hash their exact input snapshot. Device/preset/expiry
operations supply the base snapshot digest internally even when the UI did not
send `expected`. Native reload rechecks this digest before restoring an invalid
candidate or applying a valid one. Profile and recovery checks hash the exact
in-memory bytes they will use, rather than rereading the path for the hash.
These checks detect concurrent edits at the checked boundaries; external writers
must still respect the operation lock for complete serialization.
