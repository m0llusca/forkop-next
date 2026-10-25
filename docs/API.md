# Integration contracts

Keep `/usr/bin/forkop` as the CLI and LuCI rpcd file-exec boundary. Return JSON
objects with `success`, stable `error` codes and optional `data`. Reject malformed
requests before side effects. Use the existing async UI job protocol for operations.

Route explanation reports a decision and trace, not website availability. Connectivity
probes are explicit, bounded jobs. Profiles use one operation lock and atomic config
replacement with durable recovery. Existing `/etc/config/forkop` remains authoritative.
Manual server choices persist; automatic health decisions do not cause flash churn.
Smart Detect only proposes rules until the user explicitly accepts a recommendation.

## HTTPS domain routing setting

`forkop.settings.https_domain_routing` is a scalar UCI flag, `0` or `1`, with
default `0`. The native Settings page exposes it as **Inspect HTTPS domains**
beside the source network controls. Saving the flag only changes this setting;
it does not edit Main or add a fully routed device rule.

When enabled, TCP traffic to port 443 from the configured source LAN is sent
through the existing HTTPS domain inspection and routing rules, even when an
app uses a saved IP. Existing bypass and priority rules still take precedence.
The setting does not force all traffic through Main. TLS is not decrypted, and
inspection may increase CPU load. Domain visibility depends on the connection;
this is not a guarantee for every HTTP/3 or ECH connection. Disable the flag to
return to the ordinary traffic selection. Enabling it requires an explicit
user choice; installation and upgrades must preserve the opt-in default.

## Maintenance restart and package handoff

`forkop stop maintenance` and `forkop start maintenance` preserve the configured
DNS forwarding during a technical stop and avoid the ordinary unclean-start DNS
reset. Normal Stop retains its existing DNS restoration behavior. Failed or
unstable maintenance starts restore DNS through the existing failure path.
`forkop maintenance_snapshot` captures identity-checked selector state; it does
not change routing. The init script exposes `maintenance_stop` and
`maintenance_start` explicitly so procd instance arguments remain unambiguous.

A running package upgrade writes a bounded, atomic, owner-private selector
handoff and resumes through maintenance startup. A stopped service remains
stopped. Only a valid private handoff authorizes this startup mode; legacy plain
markers retain ordinary recovery. Package hooks propagate failure status and
restore DNS when startup or migration fails. This short maintenance contract is
separate from an independent installation backup and rollback watchdog.

## Native UI mutation and evidence lifecycle

`nextRequest(action, payload = {})` keeps the existing command envelope. Active
configuration mutations are serialized in the current page. Before invoking the
shell they dispatch cancelable `forkop:configuration-changing` with
`{action, waitUntil(Promise<void>)}`. Listeners register asynchronous preflight
work synchronously during dispatch. Rejection or cancellation prevents the shell
operation. A second active mutation returns `native_mutation_busy` and does not
release the first operation's lock.

The native adapter rejects unsaved DOM or local/remote staged UCI changes with
`native_pending_changes`; users must apply or explicitly discard their changes
before retrying. It does not merge independently staged configurations.
`forkop:configuration-changed`, with the same waiting contract, follows a
successful mutation and refreshes the native UCI/map instead of reloading the
page. Connected tool hosts and active tab survive this refresh. A failed refresh
is reported separately from backend success; native saves remain blocked until
an explicit editor refresh succeeds. `forkop:configuration-settled {action}`
releases temporary UI locks on every terminal path. No event contains request
payloads, server JSON or credentials.

`registerConfigurationReload(target = window, adapter?)` retains its public name;
the optional adapter exposes `beforeChange`, `changed`, and `settled`. Repeated
registration replaces the adapter without duplicating listeners. There is no
automatic page-reload fallback. The guarded action set includes `profile_apply`,
`rollback`, `recover`, `device_set`, `gaming_apply`, `temporary_add`,
`temporary_delete`, `recommendation_accept`, and `smart_detect_configure`.
Read actions and profile save/import do not apply configuration.

Compatibility, route and probe results capture the target, selected connection,
origin and check time. Relevant edits or newer requests invalidate old evidence;
a late reply cannot verify the current inputs. A route explanation remains a
configured-policy result, separate from connectivity. Existing profile current
and saved-profile digest guards remain mandatory. Interrupted transaction
recovery uses the existing `recover` operation, distinct from ordinary rollback.

## Diagnostic presentation boundaries

Malformed, truncated, primitive or non-JSON sing-box configuration cannot be
presented as masked configuration. The masker fails closed; the modal displays
an explicit error and disables safe copy/download until a supported result is
available. Explicit raw view remains secret-bearing. Known-key redaction is not
a guarantee that arbitrary diagnostic prose contains no private data.

`copyToClipboard(text, feedback?)` returns `Promise<boolean>` after actual browser
confirmation or the checked legacy result. Existing one-argument callers remain
valid. Failure provides selectable manual text without a false success. Mode
changes discard secret-bearing fallback content and obsolete asynchronous results.
Log reads are completion-based, single-flight, and suspended/disposed while the
document is hidden or the native modal is closed. The last successful text/time
and local retry survive refresh errors; unchanged text retains manual selection.

Native UI numeric validation accepts DNS TTL `0..4294967295` seconds and BadWAN
delay `0..2147483647` milliseconds as complete unsigned decimal strings. Zero
retains the existing downstream meaning. These UI checks do not add backend-wide
validation to direct CLI-written UCI values.

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
without it, the native `section` creation flow opens the subscription field. Probe inputs require a domain before
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
## Record compatibility core source

The optional `forkop-next-record` source is selected explicitly through:

```text
forkop component_action sing_box install_forkop_record_compressed
```

It keeps the genuine `extended-compressed` variant. Source state lives in `/etc/forkop/sing-box-source`; only an absent/empty official source or the allowlisted custom value is writable. The source marker selects update routing and never grants runtime capability.

The trusted core manifest records a single `source_current: true` target per custom source/architecture. It pins the own-repository core-prefixed release tag, archive SHA and executable SHA separately. Historical runtime identities can remain admitted without being current update targets. Unsupported architectures, missing/ambiguous pins and unavailable assets fail without upstream fallback.

An explicit custom install requires an admitted compressed runtime or no installed engine, and no package ownership of the destination executable. Package state is untouched. Archive destination and checksum, executable checksum/capability, the pinned memory requirement and exact reported version are checked before stopping the current service. A verified archive is removed before the memory check. The transaction restores binary, optional library, generated config, sing-box UCI/init, variant/version/source, file modes and absent states on failure. Source selection commits after startup succeeds.

Generic check/install remains on the selected custom source. Explicit official/stable/tiny transitions that would lose record capability are refused before stopping the service. Component result/cache evidence adds `source`; late cross-source results are not cached or displayed. Source-less historical official results remain compatible only when the official source is selected.

`tls.reality.record_fragment_size` accepts an integer 0..16384 only with exact record-capable runtime admission. For admitted Chrome REALITY outbounds, generation adds 256 only if the field is absent. Explicit zero opts out. Official cores receive no new field, and other outbound/TLS settings remain unchanged.

## Direct native workflows (UX task 3)

UX task 4 retains the navigation and workflow-context contracts below. The
workspace adds a synchronized narrow-screen `Раздел Forkop` select using the
same native tab activation authority as desktop navigation. Local theme
preferences are hosted outside `.cbi-section[data-tab]`; changing them never
marks native UCI drafts dirty.

`configureRuleOrder(root, move)` decorates native rule rows in place with named
enable controls and above/below buttons. The native adapter supplies
`map.data.move(config, sid, referenceSid, after)` and must return its boolean
result. Successful moves preserve mounted fields, move the existing row, emit
a bubbling native `change` event, and announce the draft position and required
Save/Apply. Failed moves retain DOM order. This stages native UCI priority;
it does not apply routes. Native drag/drop remains available.

These frontend helpers do not add a write API or change UCI identity/lifecycle.
`device_set {address, section:""}` removes that exact IPv4 from all explicit
`fully_routed_ips` assignments and restores ordinary rules. It is distinct from
`section:"direct"`, which creates/uses the priority bypass rule `nxt_direct`.
The UI uses `inherit` only as its local selection sentinel; the empty placeholder
never submits a reset. Existing IPv6/CIDR assignments use the exact native rule
editor because this endpoint accepts only an explicit IPv4.

`src/forkop/next/workflows.ts` exports:

- `navigateToRule(root, {kind:"create"|"edit"|"site", section?, option?})` activates
  the existing native rules tab and dispatches cancelable `forkop:navigate-rule`
  on its pane. `section` is the existing UCI ID, not its label; `option` is an
  existing native option such as `subscription_url`, `domain`,
  `mixed_proxy_enabled` or `fully_routed_ips`. The return value means the native
  adapter accepted navigation, not that a save or apply completed. Exact
  navigation failures are displayed in the destination. Native
  `handleAdd`/`renderMoreOptionsModal`/`getActiveModalMap` and existing
  save/parse/cancel behavior are retained. The native bundle exports this helper,
  `configureRuleWorkflow`, and `renderQuickSite`.
- `targetEligibility(target, use)` returns `{eligible, reason, settingsOption?}` for a
  `WorkflowTarget` (`name`, optional `label`, `action`,
  `localProxyConfigured`, `generated`). `use:"device"` follows device_set's
  broader enabled-section contract. `use:"route"` (gaming/temporary) admits
  connection/proxy/outbound/vpn/bypass/block but rejects generated targets.
  `use:"smart"` requires a connection alias and configured mixed proxy;
  `use:"probe"` requires configured mixed proxy without imposing a new action
  restriction. Failed Smart Detect/probe eligibility supplies `settingsOption`
  (`action` or `mixed_proxy_enabled`) for exact native recovery. An unsupported
  Smart Detect action always points to `action`, even when its proxy is configured.
  Gaming/temporary selectors show only eligible targets; device choices retain
  their broader contract. Missing capability is unknown and unavailable, not verified.
  Native status already excludes `next_kind` rows; the optional generated flag
  also protects consumers combining a transient/native context with that list.
- `workflowContext(root)` asks the native rules pane for `forkop:workflow-context`.
  Its synchronous detail callback `provide(context)` supplies only
  `targets:[{name,localProxyConfigured,generated}]` and
  `loadDevices():Promise<Record<IPv4OrIPv6Address,name>>`. The native projection
  derives proxy configuration from enabled flag plus valid port and omits
  credentials, links, ports and arbitrary UCI options. It is configuration
  evidence, not proof that the applied listener is available: backend probe
  validation remains authoritative. The device picker filters hints to IPv4 and
  labels them as DHCP hints, not live presence. Manual IPv4 entry remains usable.
- `renderQuickSite(textarea,label,priority)` appends a previewed hostname/exact
  match to the existing native domain draft, emits its native input/change
  events, and preserves full/keyword/regex expressions. It never copies or
  creates source sections. Native validation and saving remain authoritative.

Dashboard groups expose `data-connection-section=<native sectionName>` for exact
return/focus after application; this anchor is available for subsequent local
search/collapse enhancements. Navigation never runs a probe or chooses a node.
The Home empty-state CTA now starts the same native creation flow when no custom
`openRules` adapter is supplied.

Device, profile-exchange and route-selector reads discard obsolete generations,
retain the last successful list on refresh failure and display refresh time.
`forkop:refresh-tools` still accepts optional `{read}`; all three lists use that
read wave. Gaming scope requires explicit `all` or `selected`; only `all` omits
`payload.device`. A selected empty/invalid/IPv6 address never expands scope.
Known native guard codes are preserved by the API and rendered as actionable
local wording beside device/game actions. Task 1 mutation/refresh events and
Task 2 evidence semantics remain unchanged.

## Extended filter draft preview and source evidence (UX task 5)

`forkop extended_preview <JSON>` is a bounded, read-only, authenticated write-ACL
CLI operation implemented by `service/extended_preview.uc`. It never imports the
executable generator, fetches subscriptions, resolves countries, tests connections,
changes UCI, generates config or starts/stops services. Maximum request: 128 KiB;
maximum 64 groups of each kind, 128 levels, 2,000 captured candidates, 128 filter values and
256 bytes per regex. Invalid fields, enums, regexes and foreign native ownership
fail with `invalid_request`; missing or unverifiable source evidence returns
`preview_unavailable`. The existing broad write ACL remains required.
The public CLI runs this read in a 10-second `timeout` process budget; transport
failure or expiry is unavailable, never an unbounded retry. Provenance checks
accept only strict source filenames within backend-configured temporary or
persistent subscription cache roots, and compare every recorded byte digest.

Request: `{schema:1, section, requestId, expectedCapture?, draft}`. `draft` contains
`section` (only dashboard/legacy URLTest filter options), `urltest`,
`priority_group`, `priority_level` complete child arrays. Rows preserve `.name`,
`.type`, `section` or `group` ownership. New rows use preview-only IDs. Public
allowlists exclude testing/health URLs, subscription credentials and all source
values. Native extraction reads live unparsed widgets before pending/UCI values,
including explicit empty lists. Changed source/cascade drafts disable preview;
no modal parse/save or child materialization is allowed during extraction.

Success envelope: `{success:true,data:{schema:1,requestId,scope:"draft",
basis:"captured_source_pool",capture,applied:false,connectivity_tested:false,
sourceFreshness:"verified",candidates,groups}}`. Candidates have opaque `id`
and safe `name`. Groups have `id`, `kind`, `name`, `count`, `omitted`, `interrupt`,
`levels`, `fallbackOrder` and optional selection `policy`. Each level has `id`,
`name`, `direct`, opaque member IDs, `count`, `empty`, `overlap` (member and earlier
assigned level), and `decisions` (member, included, stable reason codes).
Fallback lists nonempty eligible levels in native order. It predicts membership,
not latency winners, active selection or reachability. No responsive replacement
means the existing Priority worker retains controller selection; the preview must
not imply automatic block/direct. Request IDs discard obsolete replies; an
`expectedCapture` mismatch returns `capture_changed`.

Display labels are checked against credential context, including plain values
inside structured JSON outbounds; a credential-shaped-string heuristic alone is
insufficient. When encoded/link source context cannot establish safe labels,
preview uses neutral node/group/level labels and retains stable member IDs.
Native Priority draft `order` is the live list index, exactly as native Save
materializes it; stored/default order does not override reordering or additions.

Both preview and generation call pure `singbox/group_resolver.uc` initialized
with the native connections accessor index. Generation alone creates candidate
pools and records their consumed input context, finalizing evidence only after
successful output creation. A section cache without completed provenance or with
changed saved configuration/source/core context is unavailable. The cache token
identifies the exact bytes captured once by the read request. Cached country.is
metadata is required when such predicates are used; preview never substitutes a
lookup or flag heuristic. The scope is a captured source pool, never applied
runtime proof. Captured source inputs and internal digests are not response fields.

Source outcome records are keyed by native subscription source ID plus exact
source identity. `subscription/evidence.uc` preserves the last observed success
across a subsequent failed attempt. Missing historical timestamps/counts are
null/unknown; file mtime and current node count never stand in for history.
Import results distinguish observed accepted/skipped counts from unknown duplicate
and unsupported breakdowns. `forkop source_evidence <section>` returns only source
IDs, safe observed outcomes and the owning rule ID. It never returns source URLs.
A successful source update is import evidence, not successful connectivity.

## Diagnostic context and component impact (UX task 6)

The route form supplies explicit protocol/port (default HTTPS/TCP/443) and
`destination_ip` for a literal IP. An omitted device stays omitted. Its basis is
the saved router UCI read by `route_explain`; neither the LuCI draft nor applied
packet capture is certified. `indeterminate` remains unconfirmed and has no
winning-rule action. Confirmed winners use the existing `navigateToRule` UCI ID.
Network probes remain separate explicit actions with captured router/target/time.

`forkop component_preview <JSON>` accepts only `{component,action}` for the
existing component/action allowlist. It reads bounded local files and exact
installed binary admission without fetching, probing, downloading or mutating.
Success is `{success:true,data:{component,action,captured_at,current,target,
requirements,restart_expected,recovery,connectivity_tested:false}}`.
`current` has `{version,variant,source,runtime_source,admission,sha256,capabilities}`.
Only `singbox.reality.verified_runtime` admission exposes SHA256 and the trusted
`reality_hybrid` / `reality_record_fragment` booleans; matching version strings
or variant/source markers alone leave admission unknown and capabilities null.
Markers describe the selected channel/variant, not proven runtime capability.
Other components preserve unknown identity rather than borrowing sing-box proof.
`target` has `{variant,source,admission:"unverified",capabilities:null}`. Generic
sing-box install retains its selected source; explicit variants identify their
existing official/custom source. No artifact has yet been downloaded, so the
preview cannot admit target capabilities. The UI separately labels any cached
release version. The existing guarded installer remains authoritative.
`requirements` is `{basis:"generated_config"|"unavailable",reality,record_fragment}`:
nonnegative counts of generated outbounds, or null when the bounded local config
is unavailable. Presence of an explicit record-fragment parameter includes zero.
No endpoint, UUID, key, SNI, source URL, raw config or arbitrary manifest field is
projected. These counts describe the generated file, not applied runtime traffic.
`recovery:"sing_box_transaction"|"manual"` describes the existing failure path;
it does not promise an independent backup or reconstruction of package state.
Preview errors keep the UI install action disabled. Installation requires an
explicit second action, then the existing job guards. Terminal results show the
applied version, freshly read service state (or unknown), and a separate untested
network result. All existing variants, custom channels and rollback checks remain.

The symptom guide reuses bounded native DNS/service checks, configured route
analysis, explicit HTTPS probe and `source_evidence` reads. Navigation/selection
never runs checks. Each result names router/target/device/time and a next step;
source history keeps last success after a later failed attempt. Missing evidence
stays unconfirmed. The technical log action reuses the native masked/log viewer.
Profile impact classifies changed parameter keys into rules/connections, devices,
DNS and other counts; these are parameter counts, not device counts. It projects
only changed keys and both reviewed digests, preserving the existing apply gate.
