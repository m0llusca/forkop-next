# Simple connection overview — behavioral evidence

Task 2 of the approved 2026-10-24 LuCI overview plan. Local fixtures only; no deployment or router state changes in this task.

## RED

- Added `next/tests/overview.test.ts` before replacing the main render. All four initial scenarios failed against the old eager render: missing service unknown state, no separate runtime adapter state, missing change-server action and advanced data requested immediately.
- Added a race scenario after implementing the first pass. It failed because a slow initial runtime reply overwrote a newer shared runtime update (`Сервис запущен` replaced the newer stopped state).
- Added a hidden-document scenario. It failed because the view had not unsubscribed after `visibilitychange`.
- Added a legacy advanced regression: an initial `status` response arriving after an explicit fresh refresh incorrectly replaced `fresh` with `stale`.

## GREEN

- Main render now paints synchronously. It requests no Next advanced API data before expansion. The authenticated native adapter reads the existing shared runtime service; the existing Dashboard connection loader supplies selected servers.
- Runtime state and explicit network probe evidence are separate. Missing running/reachable/time/duration values remain unknown. Probe output includes the backend result, HTTP status, elapsed milliseconds and checked time when supplied. Previous latency is explicitly historical.
- Main actions check a validated domain, open the existing native Dashboard selection flow and link first-time users to native rule/connection editing. Navigation errors are visible. Service start/stop uses the existing authenticated job API and retains local/shared pending feedback until the result and fresh runtime read complete.
- Advanced tools retain their original implementation in `advanced.ts`; legacy behavioral tests now target that focused module. Named sections mount into the document on first expansion. Profile, temporary-rule and recommendation reads start only when their section opens; compatibility and device tools are constructed only on their first open. The startup advanced status read remains shared among child consumers.
- Shared runtime subscriptions stop when hidden/removed, including native LuCI `data-tab-active=false` panes. Late initial runtime and advanced status/profile responses cannot replace newer replies; reopening resumes a fresh read, including an initially inactive pane. Runtime state adds no polling timer. A separate nonoverlapping traffic monitor uses the existing controller snapshot and schedules the next read three seconds after completion while visible. Rates remain unknown until two valid samples; counter rollback, unavailable reads, nonpositive monotonic time and visibility changes reset or invalidate the rate baseline.
- Existing profile comparison, configuration digest, exact saved-profile digest, rollback and explicit mutation safeguards remain covered by the advanced tests.

## Checks

- Focused Next suite after review fixes: 91 tests passed across 13 files.
- TypeScript no-emit check: passed.
- ESLint for `src/forkop/next` and `src/main.ts`, zero warnings: passed.
- Impeccable mechanical detector over render/advanced/styles: `[]` (no findings).
- Existing local tokens, platform typography, native focus controls and the 720px single-column breakpoint retained. Added disclosure and service hierarchy styles.

Browser access was unavailable. Desktop/mobile screenshots, computed visual contrast, real native tab navigation and live timing have not been verified here. The root integration task owns the generated LuCI bundle, complete frontend suite, package checks, independent review and any authorized deployment.

## Review round 1 and approved-spec completion

Observed seven new RED failures before the review implementation: native inactive panes did not unsubscribe; late export tools reused old profiles/routes after a real profile save and refresh; service actions/shared pending were absent; empty domains reached the backend; real traffic totals/rates and nonoverlapping polling were absent. Three additional native-adapter tests failed because the service-job and traffic adapters did not exist. A further initially inactive native-pane test failed because the first read was discarded and never refreshed on activation. All now pass.

Lazy child mounts now use fresh reads rather than lifetime startup promises. The save→fresh refresh→first-open export flow verifies both the new profile and new route. Native service tests verify exact start/wait calls and preserve actual start and terminal-job failures. Traffic tests verify totals/count, exact calculated rates, reset behavior, invalid counters/time, automatic scheduling, hidden/unmounted cancellation and late-reply suppression. The main screen never awaits controller traffic.

Commands run from `fe-app-forkop`:

```text
node node_modules/vitest/vitest.mjs run src/forkop/next/tests
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/forkop/next src/main.ts --max-warnings=0
```

Results: 86/86 focused tests; TypeScript and scoped ESLint passed. No deployment, networking changes, GitHub changes or generated bundle edits were made by this implementation task.

## Review round 2 — cached runtime replay

The native shared runtime service synchronously replays its cached state when
subscribing. New native-adapter regressions first failed for both an undefined
fresh response and a rejected pending response: cached `running=1` incorrectly
kept the service running and its action enabled. A further native pane resume
test failed because replaying that cache hid an already known fresh failure.

The optional subscription listener evidence now marks synchronous native replay
as `{ cached: true }`. Replays do not advance the fresh-update revision and
cannot replace an already observed fresh result/error. Genuine later shared
updates retain their protection against older in-flight reads. Native tests
cover both failures, an immediately completed failed read, a newer genuine
update and failure persistence across pane hide/resume.

Final focused checks: 91/91 tests, TypeScript no-emit and scoped zero-warning
ESLint passed using the same commands above.
