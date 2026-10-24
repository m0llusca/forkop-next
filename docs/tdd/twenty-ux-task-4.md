# UX task 4 — mobile hierarchy and accessible rule order

Scope: approved F14/F15, based on `edeb8d57ab2eca295d14024f6262436153b76a45`.

## Behavioral RED

Before production edits, from `fe-app-forkop`:

```text
node node_modules/vitest/vitest.mjs run src/forkop/workspace/tests/workspace.test.ts src/forkop/next/tests/overview.test.ts
Tests 3 failed | 26 passed
single menu: expected null not to be null
settings preferences: expected null not to be null
collapsed probe: expected 'DIV' to be 'DETAILS'

node node_modules/vitest/vitest.mjs run src/forkop/workspace/tests/rules.test.ts
Tests 2 failed | 26 passed
rule enable name: expected null to be 'Включить правило Работа'
rejected order move: expected null not to be null

node node_modules/vitest/vitest.mjs run src/forkop/next/tests/nativeShellLoading.test.ts -t 'local theme'
Tests 1 failed | 27 skipped
local preference host: expected null not to be null
```

The rule fixture executes the captured LuCI `UCI.move` method against ordered
records, retaining its `.index` updates and `state.reorder` flag. Fixture source
and SHA256 are recorded alongside its LuCI license. The native section renderer
and production section adapter construct the tested rows and controls.

An initial fixture creation used the wrong relative path; a later fixture wrapper
needed valid JavaScript and an assignment before evaluating comments. These were
test setup errors, corrected separately from the behavioral RED above.

## Implementation and GREEN

The narrow layout replaces the horizontal primary strip with one native section
select; desktop retains its six-area sidebar. Native links remain the activation
authority. The selected group and native validation counts synchronize back into
the select, and local navigation wraps. Existing inputs and their listeners stay
mounted. Theme preferences appear under Settings in a host outside every native
editable pane, so no global dirty-event exemption is needed.

Home presents selected connection before the collapsed probe form. Redundant
embedded status text is represented by the existing shared strip; standalone
Next retains its theme. Embedded refresh follows primary content, and service
controls follow connection/check controls. Opening the probe form does not probe
or mutate routes; its domain draft survives closing/reopening.

Rule toggles name their rule. Above/below buttons call native
`map.data.move(config, sid, referenceSid, after)` before moving the existing DOM
row, retain fields, mark the native draft with `change`, and announce position
plus Save/Apply semantics. Rejected moves retain order and announce failure.
Edge buttons disable, with focus transferred within the moved row when needed.
Native drag/drop remains optional and updates edge-button state. New order
buttons have 44px targets; rule-grid checkboxes have 24px dimensions.

Focused GREEN: the same four test files passed **85/85 tests**. The existing
source-count, modal-field, cascade, secret-redaction, navigation, draft, and
configuration guard tests remain active.

The first full frontend run found one obsolete broad assertion in
`connectionHome.test.ts`: it forbade all `details` in embedded home. Result:
**1 failed / 881 passed**. This and the native smoke assertion now specifically
forbid the advanced panel while permitting the required collapsed probe form.
Existing overview tests likewise select `.fkp-next-advanced` explicitly.

Final verification from `fe-app-forkop`:

```text
node node_modules/vitest/vitest.mjs run
Test Files 81 passed (81)
Tests 882 passed (882)

node node_modules/typescript/bin/tsc --noEmit
exit 0
node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0
exit 0
node node_modules/prettier/bin/prettier.cjs --check src ../luci-app-forkop/htdocs/luci-static/resources/view/forkop/section.js
All matched files use Prettier code style!
node node_modules/tsup/dist/cli-default.js src/main.ts
ESM Build success; patched native main.js, 661.11 KB
node scripts/check-luci-bundle.mjs
Native LuCI bundle and overview module loaded and rendered successfully.
```

Impeccable detector ran once across the five changed UI sources, exit 0, `[]`.

## Integration fixture repair

The parent identified the existing shell cascade fixture's missing Task 3
`main.configureRuleWorkflow` dependency. Reproducing its HEAD heredoc using
PowerShell extraction and Node yielded:

```text
ReferenceError: main is not defined
at configureSectionSection ... main.configureRuleWorkflow(sectionRef)
```

`tests/luci_section_cascade.sh` now provides isolated registration spies,
asserts the identical section receives workflow registration, and checks the
Task 4 order adapter forwards the native configuration/id/reference/after
arguments. All original cascade cleanup assertions remain. Executing the exact
current heredoc body with Node on Windows prints:

```text
LuCI section cascade checks passed
```

No backend production behavior was changed for this integration repair.

## File ownership and shared contracts

Owned: workspace render/styles/rules, Next render/styles, main export, native
`section.js`, their behavior tests, captured UCI fixture, native bundle smoke,
generated `main.js`, cascade test fixture, this evidence, and narrow updates to
`docs/API.md` and `DESIGN.md`.

New public helper: `configureRuleOrder(root, move)`, documented in `docs/API.md`.
Task 3 `navigateToRule`, `forkop:navigate-rule`, `workflowContext`, and target
eligibility contracts are retained. Native IDs, all six connection sources,
modal editing, DNS/TLS/IPv6, Extended, cascade and local proxy remain unchanged.
Theme does not change UCI state or need a markDirty exception.

## Limits

No browser, router, private scripts, deployment, push or merge were used. The
parent owns immutable browser verification at 320/390/430 CSS px and 200% zoom,
long Russian/error states and actual native-order preview. These measurements
and screen-reader speech are not claimed from happy-dom tests. Windows lacks
bash/ucode here; full Linux/backend/package CI remains the parent's gate. The
cascade heredoc ran directly with Node, not as an entire shell suite.

## Review fix round 1 — focus after non-edge moves

Fix base: `062e4a79ce238dd256354eba79e169fe614f9ce9`.
The independent review and parent's immutable native browser check at 430 CSS px
found that reinserting a focused row with `insertBefore` leaves browser focus on
BODY. The existing implementation restored focus only when the clicked button
became disabled at an edge. In the middle it remained enabled but lost focus.

The regression keeps the actual native row renderer and UCI move path. A local
DOM boundary wrapper performs the real `insertBefore` and then blurs a focused
descendant, simulating the browser side effect missing in happy-dom. It retains
the existing edge/counterpart assertion and adds the first-to-middle assertion
for the still-enabled clicked button. Before the production fix:

```text
node node_modules/vitest/vitest.mjs run src/forkop/workspace/tests/rules.test.ts
Tests 1 failed | 27 passed (28)
middle move restores its enabled button focus: expected false to be true
```

Minimal fix: after the successful row move and disabled-state update, focus the
same button if enabled; retain the existing counterpart selection at an edge.
No ordering, dirty-state, row identity or announcement contract changed.

```text
node node_modules/prettier/bin/prettier.cjs --write src/forkop/workspace/rules.ts src/forkop/workspace/tests/rules.test.ts
node node_modules/vitest/vitest.mjs run src/forkop/workspace/tests/rules.test.ts
Test Files 1 passed (1); Tests 28 passed (28)
node node_modules/typescript/bin/tsc --noEmit
exit 0
node node_modules/eslint/bin/eslint.js src/forkop/workspace/rules.ts src/forkop/workspace/tests/rules.test.ts --max-warnings=0
exit 0
node node_modules/prettier/bin/prettier.cjs --check src/forkop/workspace/rules.ts src/forkop/workspace/tests/rules.test.ts
All matched files use Prettier code style!
node node_modules/tsup/dist/cli-default.js src/main.ts
ESM Build success; patched native main.js, 661.14 KB
node scripts/check-luci-bundle.mjs
Native LuCI bundle and overview module loaded and rendered successfully.
```

The parent explicitly scoped this fix to focused validation; the earlier full
882-test pass was not repeated. Generated `main.js` is included. Actual native
browser revalidation remains the parent's gate, including repeated keyboard
ordering; this test simulates only its observed focus-loss boundary.
