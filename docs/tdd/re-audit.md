# Re-audit TDD evidence — 2026-10-23

Baseline: `a1439fc9329ca2d468bf49fe9a94c6a2af498e53` (candidate 1.1.0).
Every behavior below was reproduced before its production fix. Tests run against
the actual ucode modules in an isolated localhost-only Alpine VM or the actual
frontend/native settings module with external boundaries replaced. No router or
VPS was modified. Snapshot IDs identify individual VM transfers.

| Regression | Observed RED | Fix and executable evidence |
| --- | --- | --- |
| Assigning a second direct device erases the first | `03f6a77b5062` | Reuse the existing direct section once; `test_next_policies.py` preserves both addresses |
| Replacing a saved profile permits applying an unreviewed file | `03f6a77b5062` | Hash both reviewed files, reject `profile_conflict`; `test_next_profiles.py` |
| Active file edited during diff receives the wrong preview digest | `7ec81c41857d` | Hash the exact parsed RAM copy before parsing the profile; external-edit fixture rejects subsequent application |
| Refresh/profile selection keeps a stale enabled Apply button | Four frontend failures | Separate immutable preview digests and invalidate on refresh/replacement/selection; `render.test.ts` 21 passed |
| Lifecycle raw tag restoration overrides identity-safe server choice | `03f6a77b5062` | Restore runtime tags only for an identical nonempty generated-config hash; `test_native_lifecycle.py` covers changed identity and unchanged config |
| IPv6 TPROXY bypasses sniff and QUIC block | `03f6a77b5062` | Include both TPROXY inbounds; two actual generator assertions in `test_routing_regressions.py` |
| Unknown ruleset yields a falsely definite route; expired service override wins | `17073e999916`, two failures | Preserve indeterminate destination matching and ignore expired service sections; `test_route_explain.py` |
| Smart Detect misses default-WARN errors and scans successful INFO traffic | `5796527e9747`, two failures | Parse real ERROR open-connection records and ignore INFO; `test_smart_detect.py` |
| Read ACL grants mutation-capable CLI and init execution | Local Python ACL run, two tests/four failing subcases | Move both unrestricted exec grants to write; `test_rpc_permissions.py` |
| Private controller exposed on LAN and local diagnostics omit authentication | `fd7f87a5fb66`, four failures, authenticated-LAN control passed | Loopback default, explicit authenticated exposure, persistent Bearer; `test_controller_security.py` uses actual generated JSON and a real local HTTP server |
| UI opens unreachable private/HTTPS sockets; tokens truncate reserved characters | Eleven focused frontend failures | Choose RPC for private/HTTPS controllers, encode tokens; helper/dashboard/monitoring transport tests |
| Legacy dashboard has no RPC telemetry and mishandles service recovery | Nine initial failures, then one unavailable→running failure | Nonoverlapping three-second RPC polling, elapsed-counter rates, lifecycle/stale-response guards; dashboard transport tests |
| Native YACD secret unavailable for LAN, unmasked and unvalidated | Three settings tests failed at 20:16 Moscow | Key depends on YACD, is masked, and rejects blank input; three executable native settings tests passed at 20:20 |

An intermediate full backend run (`ed3ed9a05e82`) caught a lexical forward
reference introduced while moving lifecycle helpers; definitions were ordered
before callers. Another (`3e5f4d9b3994`) caught a POSIX regular-expression
incompatibility in the Smart Detect fix; ordinary capture groups replaced
unsupported noncapturing groups. These failures were corrected, not excluded.
The focused post-fix VM run `d4ea5b250aa0` passed all 32 route, Smart Detect and
native lifecycle tests.

The actual published sing-box 1.14.3 binary was run locally with a hosts-mapped
loopback destination and an intentionally refused port. Its default-WARN ERROR
record provided the collector fixture; an INFO run provided the successful
connection record shape. No external service was contacted. Unknown ruleset
matching follows the documented distinction between merged simple sets and
compound-set guards: <https://sing-box.sagernet.org/configuration/route/rule/>.

Frontend verification after integration: `pnpm exec prettier --check src`,
`pnpm lint --max-warnings=0`, `pnpm test --run`, `pnpm build`; 54 files / 583 tests
passed, type checking and native LuCI bundle rendering passed. The committed
`main.js` was regenerated from the reviewed source.

The independent read-only integration reviewer reported no concrete new P1/P2
issue in the combined fixes, including the final native key settings change.
Final full backend run: snapshot `cff38e6527d6`, `bash tests/run-backend.sh`, exit
0, all 70 shell suites and 148 Python tests passed (82.144s; no skips), including
both published-core schema checks. Report: `/tmp/forkop-test-report-6395`, exported
to `forkop-next-1.1.1-backend-verification.tar.gz`. All ucode modules compiled in
normal and strict modes in fresh snapshot `f677e7f12184`, exit 0. Package-build
evidence is kept separately from these runtime results.
