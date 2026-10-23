# Device, gaming and profile controls

The UI uses native DOM elements and fakes only the router API boundary in a
happy-dom environment. No live router state was changed.

## RED

From `fe-app-forkop`, ran `pnpm test --run src/forkop/next/tests/tools.test.ts`
against an empty renderer scaffold. All seven tests failed: absent device list,
missing device/gaming/profile fields, missing file processing and missing error
outputs. This established that the controls and their side effects were absent.

## GREEN

Implemented API-backed device route save/list/refresh, gaming store presets with
optional device scope, named raw-UCI and file imports, profile list/refresh and
explicit secret-bearing profile download. Download uses Blob URLs and deferred
revocation; raw exported configuration never appears on the page. Successful
import clears the secret-bearing textarea and never activates the profile.

The first rerun passed six tests; the export test incorrectly matched the word
`private` inside explanatory copy `privately`. Narrowed the assertion to the full
secret fixture. The next run exposed asynchronous URL revocation timing; changed
the test to await the observable eventual cleanup rather than assume timer order.

`pnpm test --run` then passed 48 files / 528 tests, including all seven controls
tests. `pnpm exec tsc --noEmit` identified an overly broad test-fixture override
type; replacing `unknown` with the API response contract made typecheck pass.

Tests exercise DOM events and outgoing request payloads, genuine file contents,
download data/cleanup, no implicit export/import, no activation during import,
local empty-field rejection and read/write API failure presentation.

Integration limitation: router execution and actual browser download completion
remain outside these isolated DOM tests. Existing socket-error fixture logs are
expected in the full suite. An API logging test emitted its credential fixture
despite passing; this was reported to the parent orchestrator for integration.

## Parent integration follow-up

Added a test for a bubbling `forkop:profiles-changed` event after successful
import. RED: eight tests ran, one failed with event count zero instead of one.
GREEN: emitted the event only after successful import. Localized visible labels
and messages to Russian and kept native labels associated with their fields.
The focused suite now passes eight tests; TypeScript and narrow ESLint pass.
The parent corrected the separate secret logging regression after receiving the
above report.

Backend confirmed `section=direct` support. Added an explicit device bypass test:
RED was missing `device_set` because the select had no direct option; GREEN adds
the Russian `Напрямую` option. Nine controls tests now cover the feature.
