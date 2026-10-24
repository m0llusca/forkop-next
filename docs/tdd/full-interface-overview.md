# Connection-first overview and readable telemetry

Task 2 of the approved full interface redesign, 2026-10-24.

## Observed RED

Ran `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/connectionHome.test.ts src/forkop/next/tests/outgoingSelection.test.ts` before implementation.
All 24 new cases failed for the missing behavior: traffic had no semantic
readings, quantities were raw bytes, primary and additional routes were merged,
workspace controls were duplicated, probes lacked captured-target/accessibility
and stale-evidence guards, outgoing cards lacked native selection buttons, and
optional telemetry preceded servers.

After that implementation passed, added configuration invalidation to the
pending-probe table. Ran the connection-home suite and observed exactly one
failure: a successful obsolete reply changed the result to `reachable` after
`forkop:configuration-changed`. Added event invalidation and listener cleanup;
all 19 connection-home cases then passed.

The native bundle smoke check also exposed its obsolete expectation of an h2
and advanced disclosure in the native workspace. Updated the executed native
check to require their absence and to verify standalone h2/theme/details
compatibility separately. Bundle loading, native entry execution, exported
functions and injected stylesheet assertions remain active.

## Verified GREEN

Final full run: **682 tests passed across 64 files**, up from 657 tests across
62 files. Added 25 behavioral cases. Existing service, subscription, runtime,
transport and deferred-advanced tests remain green. Socket fixture error/warning
messages are expected test evidence; no test failed.

The structured definition list distinguishes unknown (`—`) from measured zero,
formats 1024/1048576/1099511627776 bytes as КиБ/МиБ/ТиБ, and supports fractional
quantities and speeds. Two monotonic samples are needed for rates. Failure,
counter rollback and suspended telemetry reset the rate baseline; invalid
counters never appear as zero.

Overview uses explicit `sectionName=main` when present; metadata-free standalone
loaders keep a first-group fallback. Other groups remain visible even without a
selected outbound. Optional group/outbound codes preserve stable selection
signatures. A probe names its captured target, never probes automatically, and
rejects obsolete replies after navigation, service transitions, selection
changes or configuration invalidation. Service/cache revision and visibility
guards remain active.

Outgoing selection is an ordinary button; clicking it calls selection once,
with propagation stopped before the existing mouse-selectable wrapper. Selected,
runtime-unavailable and switching entries are disabled. Copy/info controls remain
independent sibling buttons and retain their event guards. Native controller
switch guards remain authoritative.

## Additional checks

Passed TypeScript, ESLint with zero warnings, Prettier across `src`, native
`next.js` formatting, whitespace checks, production bundle build and native
bundle execution. Generated bundle measured **555.66 KB**, with a local build
phase of **58 ms**. These are build measurements, not router loading claims.
Generated `main.js` remains uncommitted for the controller's final consolidated
build. Browser/device visual acceptance and router deployment were not performed
by this task.

## Accepted review fix round 1: invalidate displayed traffic on stop

Independent review identified that `stop()` reset the epoch and rate baseline
while leaving five readings visibly current during a deferred replacement read.
Added one monitor regression and two renderer cases (configuration invalidation
and suspension/resume). Ran the focused tests before the fix and observed
exactly three failures, each retaining `1 КиБ/с`, `2 КиБ`/`1 КиБ` and three
connections instead of unknown readings.

`stop()` now clears all five readings synchronously and announces that traffic
awaits an update. A fresh read with no baseline announces loading; existing
failure text remains the failure state. Obsolete pending samples still fail the
epoch guard and cannot restore old readings. The first new sample establishes a
baseline with unknown rates; only a second fresh sample supplies rates.

Focused GREEN: **33/33** across traffic, connection-home and overview-review
tests. Final full GREEN: **685/685 across 64 files**. TypeScript, ESLint with zero
warnings, all-src Prettier, whitespace, production build and executed native
bundle checks passed. Build output: **555.97 KB**, build phase **59 ms**.
Generated bundle remains uncommitted for final consolidation. No browser/router
operations or additional scope.

## Final whole-branch fixwave: recognize named native connections

The final branch review identified that the native Add flow creates `section_1`,
`section_2`, etc., while Home accepted only literal `main` or missing metadata as
its primary connection. Added native-shaped regressions for a sole `section_1`,
multiple custom groups in configured order, and an unselected first group with a
selected secondary. Strengthened the existing explicit-main case to ensure its
primary is not duplicated in additional routes.

RED command: `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/connectionHome.test.ts`.
Observed **3 failed, 21 passed**: all three new named-group cases incorrectly
showed the no-server fallback in the primary area.

The lookup now prefers an explicit `main` group and otherwise uses the first
returned connection group, preserving the native loader's configured order.
Selection is still checked independently: an unselected primary is labeled
truthfully and does not promote a selected secondary. No persisted IDs or routing
semantics change, and the primary is not repeated under additional routes.
The fallback heading says “Первое подключение”; “Основное подключение” is retained
for explicit `main`, so configured order is not presented as a global route
assertion. Added that distinction to the regression, observed **1 failed, 23
passed**, then implemented the heading change and restored GREEN.

GREEN command: `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/connectionHome.test.ts src/forkop/next/tests/overview.test.ts src/forkop/next/tests/overviewReview.test.ts src/forkop/next/tests/nativeOverview.test.ts src/forkop/next/tests/traffic.test.ts`.
Observed **54 passed across 5 files**. TypeScript, all-src ESLint with zero
warnings, all-src Prettier, whitespace checks, production build and executed
native bundle smoke check passed. Generated bundle **571.46 KB**, local build
phase **57 ms**, included in this final fix commit as requested. The controller
owns the final whole-branch full-suite/CI run. No browser/router operations or
broader polish were performed.
