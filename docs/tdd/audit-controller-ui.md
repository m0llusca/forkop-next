# Controller frontend transport compatibility

## Scope and cause

The backend now binds the Clash controller to loopback unless `enable_yacd=1`
and a nonempty `yacd_secret_key` explicitly authorize remote access. The shared
frontend transport gate checked only the browser protocol, so HTTP dashboard
proxy hydration attempted an unreachable remote controller before RPC fallback,
and monitoring retried an unreachable websocket instead of polling RPC.

## RED evidence

Before production edits, ran from `fe-app-forkop`:

```
node node_modules/vitest/vitest.mjs run src/helpers/tests/getClashApiUrl.test.js src/forkop/methods/custom/tests/getDashboardSections.test.ts src/forkop/tabs/monitoring/tests/controllerTransport.test.ts
```

Observed 11 expected behavioral failures / 26 passes: four helper private-controller
cases allowed direct access, three dashboard private-controller cases fetched HTTP,
three monitoring private-controller cases made zero RPC calls, and a secret with
reserved URL characters was truncated to `a` instead of `a&b?c#d+e`.
The tests use the real transport policy and consumer code, with external UCI,
RPC, socket and DOM boundaries replaced. HTTP authenticated direct access and HTTPS
RPC remain positive controls. Dashboard timeout fallback still exercises a truly
remote-enabled controller, using fake time to observe its abort.

Added settings-load failure and service-stop-during-load cases before adding error
handling. The failure case observed zero RPC calls and an unhandled UCI rejection;
the lifecycle case passed against the existing post-await guard.

## Implementation

The shared gate now requires explicit remote enablement and a nonempty secret.
Dashboard proxy hydration passes its already-loaded settings into the gate.
Monitoring reads settings once per transport startup, validates its mount/update
identity after awaiting them, and immediately starts RPC polling for a private
controller or unavailable settings. Explicit authenticated HTTP access retains
websockets; HTTPS retains RPC. The websocket token is URL-encoded so configured
reserved characters round-trip correctly.

## GREEN verification

- Focused command above: 3 files, 39 tests passed.
- `node node_modules/vitest/vitest.mjs run`: 52 files, 569 tests passed.
  Existing socket tests intentionally emit error/disconnect logs; no failed tests
  or unhandled rejections remained.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0`: exit 0.
- Formatting applied only to this task's six frontend files.

The initial `npm` invocation could not run because npm is unavailable on PATH;
verification uses the installed Node runtime and local package entrypoints.
No bundle generation, commit, push, or live router/VPS changes were performed.

## Required legacy dashboard compatibility extension

The primary agent extended ownership to legacy dashboard telemetry because its
unconditional traffic/connections websockets would otherwise fail indefinitely
with the private controller. No new backend API was introduced.

Before dashboard production edits, ran:

```
node node_modules/vitest/vitest.mjs run src/forkop/tabs/dashboard/tests/controllerTransport.test.ts
```

Observed nine expected failures: private and HTTPS settings opened sockets; there
were no RPC samples/rates; reserved characters were truncated in both websocket
tokens; settings failures produced an unhandled rejection. Tests use the real
controller and StoreService, replacing external RPC, socket, UCI, DOM and runtime
state boundaries. A cached mocked service initially retained its previous test's
store after module reset; re-registering that boundary per test corrected the
fixture isolation before interpreting subsequent GREEN results.

Dashboard now polls existing connections snapshots every three seconds, with at
most one request in flight. Shared apply functions update both the websocket and
RPC widget paths. Snapshot totals provide traffic totals, connection count and
memory. Monotonic elapsed time and counter deltas provide bandwidth; the first
sample, resets and a nonadvancing clock produce zero. Failed requests mark widgets
failed and reset the rate baseline; subsequent success recovers normally.

Polling only runs while mounted and the service is running, skips hidden pages
and page unload, clears timers/baselines on stop/unmount, and discards stale
responses. Direct authenticated HTTP websocket behavior remains available, with
both token URLs encoded. HTTPS and unavailable settings use RPC.

A further regression test observed a RED unavailable-to-running transition:
telemetry remained suppressed (one call rather than two). Stopping data updates
for every non-running service state fixes that transition. Tests additionally
cover two snapshots and their exact rate, counter reset/clock guard, nonoverlap,
stop while a response is pending, hidden-page polling, unmount cleanup, settings
failure, RPC error/recovery, and direct websocket payload application.

Final frozen-source verification:

- Focused four files: 50 tests passed.
- Full `node node_modules/vitest/vitest.mjs run`: 53 files, 580 tests passed.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0`: exit 0.
- `git diff --check`: exit 0 (only unrelated existing CRLF normalization notices).

No bundle generation, backend edits, commits, pushes or live changes were made.
