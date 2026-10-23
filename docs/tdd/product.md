# Product/UI TDD evidence — 2026-10-23

Environment: Windows Node 24.19.0, pnpm 11.25.0, Vitest 3.2.4. Commands run in `fe-app-forkop`; pnpm resolved from the bundled runtime. No live router or VPS was contacted.

## Baseline

`pnpm test --run`: 44 test files, 507 tests passed before changes.

## Dashboard reconnect

`pnpm test --run src/forkop/services/tests/socket.service.test.ts`

RED: after browser close event and advancing 1000 ms, expected two websocket instances, received one. Initial test was first moved inside existing describe to use the actual browser-boundary double consistently; RED was rerun and confirmed.

GREEN: imported the reconnect implementation from `petrouspetr-pixel/trafira`, commit `ce5e4f33253c74664f6d4a7727918a30bb011217`, `src/trafira/services/socket.service.ts`, retaining original subscribers and cancelling scheduled reconnects on disconnect. 2 tests passed. Tested a real MessageEvent payload after reconnect and no reconnect after explicit disconnect.

## CLI JSON boundary

`pnpm test --run src/forkop/next/tests/api.test.ts`

RED: placeholder produced no CLI args; expected separate `next`, action, single JSON argument. Then top-level route_explain contract test failed because next prefix was present. Then logging test against real console.info failed because imported fixture credential was written to operation timing logs.

GREEN: separate argument transport (no shell interpolation), malformed/nonzero response rejection, top-level route_explain, redacted operationName that omits payload. 4 tests passed.

## Main control panel

`pnpm test --run src/forkop/next/tests/render.test.ts`

RED: initially absent versions/controls; five workflow tests failed. Implemented real DOM controls against injected external CLI boundary. Subsequent real regressions were separately RED: applied profile remained enabled; trace remained visible in simple mode; import notification did not refresh parent profiles; explicit probe button absent; a profile changed while comparison was pending became incorrectly authorized.

GREEN: each regression rerun after minimal fix. 10 tests passed: real versions/modes; explanation independent from availability; compare before apply with digest; explicit recommendation acceptance; expiring rule payload; preview invalidation; hidden trace in simple mode; import refresh; explicit probe reachable=false versus command success; stale comparison rejection.

## Latency timestamp

`pnpm test --run src/forkop/next/tests/latency.test.ts src/forkop/methods/custom/tests/getDashboardSections.test.ts`

RED: newest sample expected delay 54 and actual timestamp, received zero; failed newer sample expected its timestamp, received missing timestamp.

GREEN: newest timestamp chosen independent of array order; newest failure never replaced by older success; no fabricated measurement time. 25 tests passed including 22 existing dashboard mapping regressions.

## Specialist devices and profile tools

See product-controls.md for child specialist's 9 independent DOM RED/GREEN cases.

## Verification to date

`pnpm lint`: passed all frontend source.
`pnpm exec tsc --noEmit`: passed. Browser timer type is explicitly number because window.setTimeout returns a browser timer ID even when Node test types are installed.
`pnpm test --run`: 48 files, 532 passed at 18:52 Moscow, before the two later probe/race cases. Full suite will be rerun at integration.

Local fixture preview (clearly labeled demonstration values) captured through headless Edge at desktop 1440 and mobile 390. Both document scroll widths exactly matched viewport widths. First batch images inspected; final combined feature/theme review pending integration. No real metrics are invented in production.

## Review corrections and compatibility scope extension

The fresh Impeccable reviewer returned fix with two findings. Two new DOM tests demonstrated false empty lists on failed reads and disappearance of previous results. Both became GREEN after preserving prior data and adding an explicit refresh action. Browser computed placeholder contrast check (`node work/check-placeholder.cjs`) failed with 2.8349:1 and passed with 7.5948:1 after explicitly applying the muted foreground token with opacity 1. No second detector run was needed; its one run had returned [].

The newly requested 3x-ui/Xray compatibility panel was implemented test-first: `pnpm test --run src/forkop/next/tests/compatibility.test.ts` RED four cases (absent controls/behavior), then GREEN four. Tests cover no automatic compatibility claims from versions, explicit metadata match versus actual connection test, unknown update status despite equal version strings, and malformed pasted JSON rejected before external execution.

Additional regression RED/GREEN: malformed older latency history cannot hide a valid dated sample; routing results show the human connection label and Russian status.

Fresh integration verification 18:59 Moscow: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm test --run` all passed: 49 files / 542 tests. The generated LuCI bundle has intentionally not yet been regenerated pending the root integrator's signal.


## Final UI integration evidence

- Native configuration-cache recovery: API EventTarget test RED (no event after device_set) → GREEN; real browser-target listener RED (reload count0) → GREEN (one deferred reload despite double registration). Profile import/read never trigger reload; failed active mutations never trigger reload. smart_detect_configure included after its own RED/GREEN extension.
- Automatic Smart Detect opt-in: RED absent toggle / missing guidance → GREEN 2 DOM cases. Status populates current enabled state and selected section; backend section_probe_unavailable explains enabling local SOCKS in advanced settings. Passive page load does not enable automatic checks.
- Manual Smart Detect comparison: RED absent domain/action → GREEN request sends selected domain/section. UI shows current-route evidence, without assuming a direct route; public current_route_failures response shape covered with literal fixture.
- Compatibility runtime path: existing tests expanded RED when domain/outbound choice absent → GREEN metadata response enumerates safe server choices, real check requires site and selected generated outbound. Installed version fields are optional user-supplied evidence for update comparison.
- Visible mobile latency timestamp: real LuCI DOM rendering test RED missing time element → GREEN actual time/dateTime displayed.
- Websocket credential privacy: real logger logs RED exposed fixture token → GREEN all URL log paths redact token while actual websocket URL remains unchanged.
- Actual selected-server overview: RED missing selected server → GREEN consumes existing dashboard loader, includes actual latency/time if available.

Fresh final verification at 19:11 Moscow: frontend lint passed; 51 files / 551 tests passed; build passed (`tsc --noEmit`, tsup and native LuCI patch). Generated main.js is475.51KB. Build now additionally loads the generated LuCI module plus native next.js in a VM with real HappyDOM, creates the overview, and verifies required controls/exports/styles are usable. This is independent of source-only tests and does not contact the router.
