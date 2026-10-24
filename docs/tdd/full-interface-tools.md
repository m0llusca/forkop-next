# Focused workspace tools — regression evidence

Date: 2026-10-24. Baseline: `b01ccad`, 685 frontend tests in 64 files.

## Observed RED → GREEN

- `focusedTools.test.ts`: all six initial cases failed because every area read
  devices/profiles/temporary rules/recommendations and device rows displayed raw
  route IDs. Area-specific DOM and guarded reads now pass. A later retry case
  failed because it reused the failed initial status promise; explicit retries
  now use a fresh read and preserve the entered address.
- `toolsHost.test.ts`: native activation initially left no tools/input; after
  mounting was implemented, both detach/disposal cases failed with three reads
  from retired hosts. The host now mounts once on native pane activation,
  preserves its input when navigating, disconnects its observer after mounting,
  and disposes before an unvisited map is removed or reconstructed. Retry keeps
  the entered temporary-rule domain.
- `nativeShellLoading.test.ts`: two cases failed because the four new panes were
  absent. They are appended after all eight existing IDs, retaining old native
  tab indices. Real native save/reset/modal-parent-reset tests remain green.
  A subsequent native `Value.parse` regression failed with four unexpected
  `renderWorkspaceTools` calls during parsing: `DummyValue` inherits a parser
  that calls `cfgvalue`. Explicit no-op parsers on the new pure display fields
  prevent uninserted host/observer creation during saves.
- `namedCreation.test.ts`: initial cases failed because no single Add action
  existed. The helper now supplies a generated, unique **named** ID to the native
  `GridSection.handleAdd`, applies a friendly editable label only to that new
  section before its modal opens, and retains native cancellation/read-only
  behavior. The actual native server module also exercises its asynchronous
  capability/default/cancel path; default Tailscale protocol and enabled flag
  survive. A modal-failure case then failed because a generated draft remained;
  guarded cleanup now removes only the exact `map.addedSection` reservation and
  clears its marker before retry. Existing names, references and entries stay
  unchanged, and retry uses the first available ID.
- `nativeSourcesNavigation.test.ts`: failed because Servers had no action to
  reach source creation. The new action activates the existing native rules
  pane, retains its draft and preserves the outgoing Dashboard node.
- `compatibilityRefresh.test.ts`: two cases failed because refresh did not retry
  compatibility routes and an old response won. The compatibility panel now
  retries without replacing entered JSON and ignores obsolete route responses.
  One read is shared within each refresh wave; a later wave always reads anew.

## Preserved contracts

Default standalone `all` rendering remains compatible. Rules retain temporary
rules, recommendation scans/acceptance and opt-in automatic detection;
Diagnostics retains route explanations and explicit probes; Devices contains
configured assignments and gaming presets; Settings contains compatibility,
profile comparison/apply/save, import/export and rollback. Existing digest and
stale-comparison regressions still pass, as do settings parse guards, native
old-default behavior and all Extended features in the existing suite. The native
Dashboard selector and inbound editor remain the authoritative editors.

Configured device assignments use status-provided labels where available and
make no online/reachability claim. Device conditions link to the native rules
editor. New pure UI fields write no UCI options. Persistent rule/server sections
remain named and all original native IDs retain their positions.

## Final verification

- Full frontend suite: **707/707 tests, 69/69 files**.
- TypeScript no-emit check: passed.
- Whole-source ESLint with zero warnings: passed.
- Prettier check of all `src` plus changed native forkop/dashboard files: passed.
- Production tsup build: passed, **565.18 KB**, local build phase **56 ms**.
- Executed native LuCI bundle smoke check: passed.
- `git diff --check`: passed.

The `npm run build` launcher was unavailable in this shell (`npm` not found), so
the package script's exact stages were executed directly: TypeScript, tsup and
`scripts/check-luci-bundle.mjs`. Expected socket-fixture log errors/warnings are
unchanged. Generated native `main.js` is refreshed and intentionally left
uncommitted for controller consolidation. No router/browser/Atlas operations or
deployment were performed; final visual inspection belongs to the controller.

## Accepted review fix — stale device-route failures

The Task 3 reviewer reproduced P2: the generation guard protected successful
route reads, but unconditional caller catches let an older failed read overwrite
a successful retry. The button also displayed success outside the guard, allowing
an older successful read to overwrite a newer refresh failure.

Added `tools.refresh.test.ts` before the fix. All **4/4 tests failed** for the
expected displayed-state races: an initial unsuccessful response/rejected promise
after a successful button retry, an older button success after a newer event
failure, and an older event failure after a newer event success. Assertions cover
the retained input value, newest route options, and result text. Moving success
and error display inside `loadRoutes` generation ownership made all cases pass.
Explicit button/event refreshes announce their guarded result; initial loading
retains its existing quiet-success behavior.

Final verification commands on 2026-10-24:

- `vitest run src/forkop/next/tests/tools.refresh.test.ts
  src/forkop/next/tests/focusedTools.test.ts src/forkop/next/tests/tools.test.ts`:
  **20/20 passed in 3 files** before the final event-status assertion. Final full
  suite includes that assertion and passed **711/711 tests in 70 files**.
- `tsc --noEmit`, whole-src ESLint zero warnings and whole-src Prettier: passed.
- Production tsup and native bundle smoke check: passed; **565.27 KB / 58 ms**.
- `git diff --check`: passed. Generated `main.js` refreshed, left uncommitted.

Only tools.ts, its new regression file and this evidence changed for the fix.
No stylesheet, translation, API, native lifecycle or creation changes were made.
