# Full interface workspace — TDD evidence

Date: 2026-10-24. Scope: approved hybrid connection-first home with persistent
workspace navigation. No router, API, UCI parsing or routing changes.

## RED

`node node_modules/vitest/vitest.mjs run src/forkop/workspace/tests/workspace.test.ts`
first ran against an exported no-op adapter: **7 failed**, with absent navigation,
missing status/theme and no mount lifecycle behavior. The native fixtures use real
input nodes and real anchor click handlers that change the original pane/menu state.

The native render integration test then failed **1 of 10** because the returned map
had no workspace. The remaining nine capability/settings/save tests still passed.
Calling the adapter on the existing map result made this integration test green.

Subsequent regression cycles observed failures before each fix:

- Focus and non-UCI Forkop detail dialogs: **2 failed / 9**, catching recreated
  navigation buttons losing keyboard focus and an unidentified URLTest dialog.
- Native Atlas `data-darkmode=true|false`: **3 failed / 10** before the previous
  regressions and theme synchronization were fixed.
- Theme before the native result is attached: **1 failed / 11**; detached maps now
  inspect LuCI's document/body theme before falling back to system preference.
- Real LuCI initial inactive panes and off-home service state: **2 failed / 13**.
  The computed-style test saw eight visible panes instead of one when inactive
  panes had no `data-tab-active` attribute. The shared-state test observed an
  unknown header after new loaded service evidence. Scoped inactive-pane styling
  and a subscription to the existing service store fixed both.

## GREEN and verification

Final workspace tests: **13 passed**. Native shell tests: **10 passed**. Earlier
combined workspace/native shell/native overview checkpoint: **25 passed**, before
the later workspace regressions were added.

Final full run, `node node_modules/vitest/vitest.mjs run`: **653 passed across
62 files**, zero failures, 6.99 seconds reported by Vitest. The existing socket
failure/reconnection fixtures intentionally log error/warning output; they pass.

All final commands exited zero:

- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0`
- Targeted Prettier check for workspace sources/tests, main/styles, native shell
  test and `view/forkop/forkop.js`.
- `node node_modules/tsup/dist/cli-default.js src/main.ts` — generated bundle
  **541.04 KB**, build phase **56 ms** (local build cost, not router loading time).
- `node scripts/check-luci-bundle.mjs` — native LuCI bundle and overview loaded
  and rendered successfully.

## Preserved contracts and limits

The adapter moves existing nodes into a scoped shell. It retains the original
menu, links, pane group, inputs and listeners; navigation clicks native anchors.
Optional/capability-hidden destinations are omitted. Repeated mount is idempotent.
Selection changes update button state in place to preserve focus. Observers and
the service-store subscription disconnect when the attached workspace is removed.
Monitoring table updates are filtered before shell synchronization, and modal
inspection is limited to modal-related mutations. There is no new network poll.

Unknown/unloaded service differs from loaded stopped (zero); network evidence
remains separate. Home status follows the real overview. Off-home service uses
the existing shared service store; an overview-only fallback is labeled as the
last state. Identifiable Forkop dialogs inherit the selected workspace theme;
unrelated LuCI dialogs are untouched.

The controller owns the final desktop/mobile visual inspection using the local
native LuCI preview. This task's passing DOM/build checks do not certify live
router deployment, latency, data correctness or all production modal variants.

## Review fix round 1 — map lifecycle and invalid-tab recovery

Accepted findings: the initial adapter was lost when native `renderContents()`
cleared the same root after save/reset, and hidden original tabs carried validation
feedback that the replacement navigation did not mirror.

Replaced the native-shell test's hand-built map rendering with focused captured
LuCI `Map.renderContents`, `render`, `save`, `reset`, `ui.tabs.initTabGroup`,
`updateTabs`, `switchTab` and GridSection `handleModalSave` method bodies. The
committed fixture contains source URLs, snapshot SHA256 values and the upstream
Apache license. Tests use only that fixture; they do not read local preview files.
Only DOM/UCI boundaries, child-section construction and session selection storage
are supplied by the harness. In particular, the genuine native
`dom.content(mapEl, null)` path clears the same connected root on each rebuild.

RED: the native shell test run reported **4 failures / 14**: save, reset and
GridSection parent reset each left zero workspace navigations; the invalid-page
case had no visible group error count. The existing ten tests remained green
after correcting their obsolete assumption that every inactive pane has a literal
`false` attribute.

GREEN: **27 passed** across native shell (14) and workspace (13). The tests verify
one shell after each native rebuild; new native anchor/pane activation; correct
computed pane visibility; original native field reconstruction; retired controls
and store listeners no longer handling events; intact mounting remains idempotent.
Validation coverage invokes native `updateTabs` on invalid fields in inactive
panes, checks summed group counts, destination count/tooltip/accessibility, opens
the invalid page with its unsaved input intact, then verifies feedback clears.

The adapter now runs after every completed native map render and disposes the
previous binding before attaching to reconstructed native children. Intact mounts
are retained; selected workspace appearance survives a rebuild. Native validation
remains authoritative; visible buttons mirror its counts and tooltips.

Final full suite: **657 passed in 62 files**, zero failures (4.35 seconds).
TypeScript, ESLint with zero warnings, targeted Prettier, whitespace checks,
bundle build and native LuCI bundle smoke check passed. Latest local bundle:
**543.72 KB**, bundler build phase **45 ms**. Generated `main.js` remains
uncommitted for the controller's consolidated build. No browser/router action.
