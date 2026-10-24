# Native shell first paint — Task 3

Scope: native `forkop.js`, `next/tests/nativeShellLoading.test.ts` and this evidence
record. Generated bundle, backend, networking, native settings/server modules and
deployment are integration-owned and untouched by this task.

## Decision

Removing the capability await alone would render Settings using unknown provider
availability. Its DNS/download section choices are populated during initial form
load, and replacing the complete form afterward would lose unsaved edits. The
existing rules/server tables already defer modal capability reads.

Ruling: render the overview and existing native tables immediately; stage only
Settings behind an inert pending/retry placeholder until real capability
evidence is available. Mount the actual Settings fields into that existing pane
after loading them. Preserve its active-tab attribute and every other pane.
Skip only that section's parse while fields are absent or still loading, so
unrelated native saves cannot turn missing form values into UCI deletions. Once
mounted, normal native Settings parsing resumes.

Capability fallback is still primary capabilities → UI state → independent core,
provider and inbound checks. Missing/failed/malformed evidence stays unknown;
it cannot fabricate an installed-feature list. Full fallback evidence is required
before exposing Settings. A partial fallback failure therefore leaves Settings
temporarily unavailable with retry, while overview/rules remain available.
The established optional Tailscale backward-compatibility default is retained.

## RED

Before implementation, three focused scenarios failed against the existing shell:

- Never-resolving capability discovery prevented even the native map/overview
  from rendering.
- A pending capability response prevented a first-render map from existing.
- All failed probes still constructed Settings using fabricated disabled-feature
  values, rather than retaining an unknown state.

## GREEN and coverage

Eight native-source behavioral tests now cover immediate essential rendering;
pending Settings parse suppression; late real Settings mounting without replacing
unsaved rule content; active-tab preservation; failed discovery with working
retry; primary→UI-state and independent runtime fallbacks; actual server/provider
loader results; malformed successful replies; and an asynchronous Settings load
that must remain unparsed until mounting completes.

The original Save and Apply receiver, arguments, result and error behavior are
verified. No global save/apply gate was added. The shared provider event/store
updates and server capability hooks remain on validated evidence only.

## Verification

From `fe-app-forkop`:

```text
node node_modules/vitest/vitest.mjs run src/forkop/next/tests
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/forkop/next/tests/nativeShellLoading.test.ts --max-warnings=0
```

Results: 99/99 Next tests across 14 files, including 8/8 native shell tests;
TypeScript and scoped ESLint passed. Native JavaScript and test formatting were
checked with the existing formatter; diff whitespace check passed.

No browser was available: real native LuCI Settings widgets, footer behavior,
desktop/mobile screenshots and live first-paint timings still require integration
verification. Independent review and deployment remain with the root task.

## Native tab-menu review correction

Independent review identified that LuCI inserts a tab-menu `li[data-tab=settings]`
before the actual pane. The original broad `findElement('data-tab', 'settings')`
therefore replaced the menu item. The earlier fixture omitted that native menu
and did not catch the problem.

The fixture now includes a `.cbi-tabmenu` before `.cbi-map-tabbed`, menu items and
their existing click handlers, and `.cbi-section` panes that switch
`data-tab-active`. A new regression failed with the real defect: its original
Settings `li` was replaced by a section. The implementation now selects only
`.cbi-map-tabbed > .cbi-section[data-tab="settings"]`.

The regression verifies menu/node identity, replacement of exactly one pending
pane, preservation of active Settings, switching away and back through the
original menu links, and the identity/value of an unsaved rule input. Final
targeted result: 9/9 native-shell tests, TypeScript and scoped ESLint passed.
