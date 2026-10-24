# Intuitive tools regression evidence — 2026-10-24

Scope: Task 3 of `docs/superpowers/plans/2026-10-24-intuitive-workflows.md`.
This is a display-only refinement of the approved six-area workspace.

## Behavioral changes

- Route decisions and trace rows use the configured connection label. Temporary
  rules update their labels even when the shared status read completes after the
  list read. Unknown identifiers remain plain text, including markup-like input.
- Area-scoped tools omit the successful version strip. Initial loading, failed
  reads and recovery notices remain visible. The standalone panel still reports
  real versions. A lazy embedded form uses its disclosure title once.
- Profile comparison reports the number of changed parameters, distinguishes an
  empty list from an unavailable list, and preserves the changed keys and original
  diagnostic JSON behind a closed details control. Save, apply and rollback have
  readable outcomes. Activation still submits both exact reviewed digests.
- Device-save confirmation identifies the submitted address and configured route,
  using values captured before the request so a later edit cannot change the
  reported assignment.
- Compatibility checks show readable capability/status labels. New or unknown
  codes remain distinguishable through closed technical details. Existing
  technical evidence and next-step text are retained.

## RED

Production code was unchanged for the first run of
`node node_modules/vitest/vitest.mjs run src/forkop/next/tests/intuitiveTools.test.ts`.
Eight of nine initial cases failed: raw trace IDs, raw temporary-rule IDs after a
late status response, repeated embedded versions, missing profile summaries (three
cases), unidentifiable device-save confirmation and raw compatibility codes.
The standalone-version characterization passed.

The separate embedded-disclosure test failed because the mounted form repeated
the disclosure title. A subsequent named-save/restore test failed on the generic
success message before those action summaries were supplied.

## GREEN and checks

After implementation, the focused run passed **68 tests in 8 suites**:

```text
node node_modules/vitest/vitest.mjs run \
  src/forkop/next/tests/intuitiveTools.test.ts \
  src/forkop/next/tests/render.test.ts \
  src/forkop/next/tests/focusedTools.test.ts \
  src/forkop/next/tests/tools.test.ts \
  src/forkop/next/tests/tools.refresh.test.ts \
  src/forkop/next/tests/compatibility.test.ts \
  src/forkop/next/tests/compatibilityRefresh.test.ts \
  src/forkop/next/tests/variantRound2.test.ts
```

The new suite contains 11 cases. Existing cases continue checking explicit action
payloads, import/export behavior, digest invalidation, lazy mounts, stale read
protection and failed-read recovery. TypeScript `tsc --noEmit` passed. Focused
ESLint passed with zero warnings. The four changed TypeScript files were formatted
with the project's Prettier.

A complete frontend run during concurrent Task 1/2 implementation observed
**755 passed, 4 failed, 759 total in 74 suites**. The failures were outside this
task's files:

- `workspace.test.ts`: destination descriptions; lazy native settings grouping.
- `rules.test.ts`: group names containing spaces; legacy text/list precedence.

These are recorded as the state of that run, not a claim of a green final branch.
Final whole-branch tests, build and visual checks belong to Task 4. No router,
network policy, backend action or API payload was changed by this task.
