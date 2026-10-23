# Backend TDD evidence

All runtime checks use the localhost-only disposable Alpine VM, native ucode fs/uci,
and temporary fixture configuration. No router or VPS service changes.
Runner: `work/toolchain/vm.py --repo work/forkop --command 'python3 -m unittest discover -s tests/backend -p PATTERN -v'`.

- Initial behavioral RED: snapshot `71aae8506eff`, absent `next` CLI returned help instead of required JSON; profile/policy tests failed. Route module absence also observed in executable runtime.
- Profiles GREEN: `test_next_profiles.py`, snapshot `8bc536385e53`, 7/7.
- Semantic validation RED: `31e7d5534e7d`, invalid DNS type was accepted. Added isolated UCI parsing and reused full runtime validator before replacement.
- Generator fixture initially used unsupported manual SOCKS input; rejected that failure as unrelated, corrected to valid VLESS, removed production policy changes, repeated RED `6680d53fc619` (policy generated an empty outbound group), then GREEN `d8c4d0aa40c9`, 2/2.
- Native policies and profiles GREEN: `0994e42b88b9`, 29/29 instances including duplicate inherited profile cases; imports subsequently tidied to eliminate duplicate class discovery.
- Direct-device/reset, invalid-policy-target and startup-recovery extensions RED `2c65e7e3a6e2`, then GREEN `1eae30ea4c28`, 40/40 instances.
- Supervised expiry timer RED `2d329ef04acd` (no supervised command), then GREEN `1eae30ea4c28` with `bash tests/next_service.sh`.
- Recommendation acceptance RED `b267537d7e89` (suggestion returned without actual config change; activation failure incorrectly successful), then GREEN `320f19507eb9`, 31/31 instances, actual transactional shadow routing and explicit completion only after success.
- Routing core regressions RED `67d1790b0ae3`, 5 tests / 7 failing assertions: source-DNS non-DNS capture, selector interrupt flag, native URLTest interval (45m, 1h30m, 30.5m) vs idle timeout, section exclusions, elapsed scheduler. GREEN `184ec41014a9`, 5/5.

Imports: `singbox/generator.uc` duration parsing, URLTest timeout protection and section-wide exclusion pool adapted from Trafira commit `ce5e4f33253c74664f6d4a7727918a30bb011217`, GPL-2.0-or-later. Forkop namespaces retained. `core/scheduler.uc` is shared by Priority and DNS failover; monotonic elapsed scheduling does not depend on NTP changes.

Pending current increments: low-space/symlink storage rejection, identity-based durable manual selection, graceful managed sing-box shutdown, full affected upstream fixture suite. No pending check is claimed passed.

## Verified integration increments

- Native lifecycle reload delegates to `next native_apply` before runtime mutation. Stable starts record a private last-good `applied.uci`; identical config uses the existing optimized reload. Missing checkpoint fails closed until a successful start. Ordinary LuCI saved configuration is restored if validation or activation fails.
- Last-good transaction tests RED `c52e041019bf` -> GREEN `854201393b2b` (4); lifecycle boundary RED `8c8399f2b33f` -> GREEN `bd0a3f01b4da` (1).
- Durable manual choices: RED `d213aac85ba4` -> GREEN `76358fc4d9fc` (3); actual successful HTTP API selection persistence RED `0f870a0383e9` -> GREEN `068f6e5d2a1e` (4). Only identity hashes are stored, preserving selection across label changes and rejecting a reused tag. Priority and lifecycle restore pass explicit automatic/restore origins and do not write persistent preferences.
- Storage hardening: zero free space RED `830af74646e9`; symlink storage RED `d213aac85ba4`; GREEN `76358fc4d9fc` (13 profile tests). Candidate parsing and validator fixtures now live in private per-process RAM directories and are removed afterward.
- Supervised timer is ucode, satisfying existing package architecture. RED `d213aac85ba4` wrong old shell worker -> GREEN `76358fc4d9fc`; no lock is held across the timer sleep/child CLI calls.
- Smart Detect opt-in config RED `dd9209d40f3c`; timer tick RED `060578c60ccf` -> GREEN `2c2fe8aecfdf` (3). The timer runs expiry and one optional recommendation tick per minute; collector/probe implementation is tracked by the root orchestrator.
- Graceful managed sing-box script RED `989476c13743` -> GREEN `e495d86581c8` (1 actual generated service execution). Shared builder used by runtime and requirements installer sets `term_timeout 30`.
- Fresh-core generator hook RED `cf0ef5b03a7e` -> GREEN `8789170336f2` (6 routing regression tests). Runtime version is detected from the actual binary; explicit fixture override is supported. Independent compatibility tests verify published sing-box 1.13.7 and 1.14.3 schemas.
- Independent review regression: permanent next_expires=0 shadow rule wrongly skipped in explanation. RED `cfce6c31893b` -> GREEN `98575d2f23a4` (13 route tests).
- Independent review regression: first shadow generated a nonexistent service-check outbound. RED `bddb2131f719` -> GREEN `fa27a5d454cb` (generator references existing base outbound).
- Independent review regression: internal IP-check domain explanation ignored its service override. RED `b4bb2165aa7d` -> GREEN `fa27a5d454cb`.
- Independent review regression: native transaction journal stored candidate hash against previous backup. RED `13c0c8351b2b` -> GREEN `fa27a5d454cb`; journal now stores backup digest independently from expected current digest. Failed native activation followed by passive startup recovery restores the known-good file.

Whole Python suite: snapshot `b49dcc6aeac4`, 121 passed before the final independent-review increments. Latest whole suite and full normal/strict ucode compile are being rerun; no unavailable check is claimed passed.
Affected original shell suites all passed: shell_inventory, config_validator_runtime, selector_state, service_reload_plan, service_start_trap, diagnostics_status, urltest_groups, config_migration, sing_box_runtime, dns_action_ui, proxy_parameter_filters, nft_apply (`9ef54b9a68e0`); plus urltest_interrupt, dns_failover and priority_failover (`e495d86581c8`). Diagnostics fixtures emit expected missing OpenWrt ubus/interface messages in Alpine; no live services were contacted.

Final backend freeze: normal and strict compilation of every ucode module passed in
snapshot `da765256a640`. Whole Python suite: 125 tests, 124 passed; one timing failure
`test_parallel_latency.LatencyTests.test_network_timeout_bounds_actual_request_not_only_api_parameter`
measured 2.9845s against a 2.5s limit while multiple VM suites were active. This was
reported to the root orchestrator; no assertion was relaxed and no failed test is
omitted. Root is rerunning the focused timeout and final whole suite without VM
contention. Backend production files are frozen for integration.

## Independent audit: management controller isolation

- Native behavioral RED supplied by the integration runner: snapshot
  `fd7f87a5fb66`, `python3 -m unittest discover -s tests/backend -p
  'test_controller_security.py' -v`. Default generation bound the controller to
  the service address instead of loopback, enabling WAN dashboard access without
  a secret exposed the wildcard listener, disabling the dashboard discarded a
  configured secret, and local RPC diagnostics failed to reach/authenticate the
  private fixture controller. The explicitly authenticated LAN case passed.
- Generator now uses `127.0.0.1:9090` by default. An enabled dashboard with a
  nonempty configured secret may bind to the service address or, with explicit
  WAN access, the wildcard address. Configured authentication survives disabling
  the dashboard; UI serving remains tied to the dashboard setting.
- Native diagnostic requests choose the corresponding private/controller address
  and include the configured Bearer secret independently of WAN access. The
  regression uses a real temporary localhost HTTP server to verify the request
  and authentication header rather than a command-output mock.
- GREEN and affected-suite verification are pending the root runner's fresh
  snapshot; no VM or live-network checks were run by this worker.

Integration runner follow-up: `cff38e6527d6` passed all 148 Python tests including
all five controller security cases, and all 70 shell suites. Fresh normal/strict
ucode compilation passed in `f677e7f12184`. Detailed re-audit evidence superseding
the intermediate pending checks is in [re-audit.md](re-audit.md).
