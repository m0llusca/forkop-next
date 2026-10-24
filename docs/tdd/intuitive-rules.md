# Intuitive native rule summaries

Date: 2026-10-24. Task 1 of `docs/superpowers/plans/2026-10-24-intuitive-workflows.md`.

## Behavior

The native ordered grid retains its name cell, enabled flag and native row actions. The name cell now includes a count-based condition summary. The action cell contains the same human action label used in the editor and a count-based source summary. Both cells render text through DOM `textContent`. The native `sectiontitle` remains a plain string; a wrapper around synchronous native `renderContents` decorates its existing name cell after native row metadata and actions have been created.

- Conditions: modern and legacy domain fields, built-in/custom/domain-and-IP lists, destination IPs, ports, device filters and forced devices.
- Sources: connection links, subscriptions, interfaces, JSON outbounds, URLTest and priority groups. Summary counters stop at `999+`; source values and child endpoint metadata are never displayed or fetched.
- Empty scope says `Условия не заданы`, without promising that the rule matches all traffic. Missing connection sources say `Источники не заданы`.
- Disabled rules have a visible `Выключено` state. Legacy `proxy`, `vpn`, `outbound`, absent provider actions and unknown configured actions remain selectable with their exact original UCI values. Arbitrary malformed action strings are not echoed into summaries.
- DNS summaries omit dormant destination-IP/port fields and describe forced device scope as DNS requests, not device traffic routing.

Native selector contract for workspace styling: `.fkp-rule-identity`, `.fkp-rule-name`, `.fkp-rule-state`, `.fkp-rule-scope`, `.fkp-rule-routing`, `.fkp-rule-action`, `.fkp-rule-route`.

## RED → GREEN evidence

Command in `fe-app-forkop`:

```text
node node_modules/vitest/vitest.mjs run src/forkop/workspace/tests/rules.test.ts
```

1. Initial behavior tests, before production changes:

```text
Test Files  1 failed (1)
     Tests  14 failed | 1 passed (15)
```

The failures observed absent readable grid action/scope/source/state output. The existing field-preservation case passed. After helper/native integration:

```text
Test Files  1 passed (1)
     Tests  15 passed (15)
```

2. Boundary tests exposed two actual summary errors: group names containing spaces were counted as multiple sources; primary native conditions were counted together with inactive legacy text values.

```text
Test Files  1 failed (1)
     Tests  2 failed | 17 passed (19)
```

After preserving list item boundaries and native primary/legacy precedence:

```text
Test Files  1 passed (1)
     Tests  19 passed (19)
```

3. A DNS-specific test exposed dormant IP/port inventory suggesting routing scope:

```text
Test Files  1 failed (1)
     Tests  1 failed | 19 passed (20)
```

After action-aware DNS presentation:

```text
✓ src/forkop/workspace/tests/rules.test.ts (20 tests) 129ms
Test Files  1 passed (1)
     Tests  20 passed (20)
```

4. Browser verification caught an integration defect that the initial helper harness missed: native `titleFn` calls `stripTags(String(sectiontitle))`, so returning a DOM element from `sectiontitle` corrupts the textual row title and loses the condition DOM. The initial harness incorrectly inserted the helper node directly. A new fixture now captures the actual `titleFn`, `stripTags`, `TableSection.renderContents` and `GridSection.renderTextValue` methods from the same native `form.js` (SHA256 `b68bebcbb5eef7256790b9dcb821bf6b1d4104b72fb076dda2e67268d7254787`), including upstream licensing and provenance.

All rule presentation cases now use the captured native table path. A new regression case asserts the original plain `sectiontitle`, correct row `data-title`, visible name and scope, the same native actions node and exactly four cells (two descriptive cells, enabled, actions). Before the fix:

```text
Test Files  1 failed (1)
     Tests  7 failed | 14 passed (21)
```

After keeping the title textual and decorating the native name cell:

```text
✓ src/forkop/workspace/tests/rules.test.ts (21 tests) 106ms
Test Files  1 passed (1)
     Tests  21 passed (21)
```

The tests execute the real native `section.js` field registration, choice loader and presentation methods with UCI/option-registration boundaries, then render the table with captured native methods. They also verify that registration/display/choice loading leave the input UCI records byte-equivalent and retain every important modal field.

5. Independent review found that subnet-enabled custom rule lists were omitted. Verified the native storage contract: `getCustomRulesetReferences` merges `rule_set` and `rule_set_with_subnets` with deduplication; routing generation consumes both. DNS generation consumes only `rule_set`, its validator rejects subnet extraction, and its editor write converts references to ordinary `rule_set` storage.

New tests cover a sole subnet-enabled custom list, the trimmed/deduplicated union with ordinary lists, and DNS-only dormant subnet storage (alone and alongside an ordinary list). RED reproduced the sole-list false empty message and mixed-list undercount:

```text
Test Files  1 failed (1)
     Tests  2 failed | 23 passed (25)
```

After counting the native union for routing while excluding invalid DNS subnet extraction:

```text
✓ src/forkop/workspace/tests/rules.test.ts (25 tests) 159ms
Test Files  1 passed (1)
     Tests  25 passed (25)
```

TypeScript `--noEmit` and focused ESLint completed with exit 0 after the initial integration, native table regression fix and subnet-list correction. A whole-suite run during concurrent Task 2 work reported 73 passing suites, one failing suite, 757 passing tests and two failures: `workspace.test.ts` destination descriptions and lazy native settings grouping. Those were Task 2 RED cases, reported to its owner; final integrated verification belongs to Task 4.

## Preservation boundaries and rulings

- No backend, UCI keys, routing order, source validation, field dependencies, modal saving, provider availability, TLS/DNS/IPv6 behavior or native row controls were changed. The only choice-menu behavior change is retaining a configured unavailable/legacy/unknown action rather than losing its selection.
- Ruling: no excluded-device scope was invented. The native rule schema has `source_ip_cidr` and `fully_routed_ips`, with no per-rule excluded-device field; migration explicitly removes the former global `routing_excluded_ips` setting. Counts describe configured match categories, not a simulation of generated policy or verified live routing.
- Ruling: use the workspace's established Russian presentation convention. Both Russian catalogs remain untouched and therefore remain synchronized.
- Full native browser/mobile visual verification, generated-bundle checks and router acceptance are outside this focused test boundary and are performed by the parent task. No bundle build, branch switch, commit or router operation was made by this task.
