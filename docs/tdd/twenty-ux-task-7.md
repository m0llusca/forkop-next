# Twenty UX improvements — Task 7 verification

## Stage A: integration carryovers

Base: `f246ce6247085684ee4e9abd354491dc870df142`.

This stage covers three known integration defects and expected socket-test
logging. It does not claim completion of F01–F20 or the release gate. The
parallel Task 6 diagnostics, API/backend projections, and Task 5 preview are
outside this stage's ownership.

### Behavior and evidence

1. Repeated clipboard failures without an explicit feedback element reuse one
   helper-owned manual fallback, including its textarea and selection button.
   Unrelated elements sharing its CSS class remain intact. Focus and the
   initiating document selection survive the legacy copy attempt; a retry with
   the manual field focused retains its selection when the text is unchanged.
2. Native Reset still calls LuCI `Map.reset()`, which only invokes
   `renderContents()`. The regression executes the captured native UCI `move()`
   body against cached section records: `main → games` becomes `games → main`,
   and that order plus the `state.reorder.forkop` flag survive Reset. The DOM
   field returns to its cached value, no cache unload occurs, and the pending
   strip remains visible with **unsaved** wording. Immediate mutation remains
   blocked. The existing clean-DOM-reset scenario also verifies that the strip
   clears when no local or saved pending changes remain.
3. Home omits the primary group's prefix only when that exact label already
   appears as its heading. The selected node remains visible; distinct custom
   primary labels and all additional group labels retain their context.
4. Socket failure/close/send tests capture and assert their exact expected
   console error or warning locally, including token redaction. Each spy is
   restored after its test. No production logging or global console handling
   changes.

### RED → GREEN

Commands run from `fe-app-forkop`:

```text
node node_modules/vitest/vitest.mjs run src/helpers/tests/feedback.test.ts src/forkop/next/tests/connectionHome.test.ts src/forkop/next/tests/nativeShellLoading.test.ts
```

Initial RED: **3 failed, 58 passed, 61 total**. Observed failures:

- Repeated global fallback: expected one textarea, received two.
- Duplicate primary group label: expected one heading-label occurrence,
  received two.
- Cached reorder after native Reset: expected `pending.hidden === false`,
  received `true`.

The first minimal fixes produced GREEN: **61 passed**.

Additional focus regression command:

```text
node node_modules/vitest/vitest.mjs run src/helpers/tests/feedback.test.ts
```

RED: **1 failed, 7 passed**. On a repeated denied copy while the manual field
was focused, `document.activeElement` became `body` instead of retaining the
textarea. Reusing the existing owned textarea and button without detaching
them fixed this failure; updating an unchanged textarea value is avoided to
preserve its selection.

Final focused command:

```text
node node_modules/vitest/vitest.mjs run src/helpers/tests/feedback.test.ts src/forkop/next/tests/connectionHome.test.ts src/forkop/next/tests/nativeShellLoading.test.ts src/forkop/services/tests/socket.service.test.ts src/forkop/services/tests/variantRound2.test.ts
```

GREEN: **5 files, 68 tests passed**. Expected socket ERROR/WARN lines no longer
appear as unhandled test output; informational diagnostics remain visible.

### Static verification

All completed with exit code 0:

```text
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/helpers/copyToClipboard.ts src/helpers/tests/feedback.test.ts src/forkop/next/render.ts src/forkop/next/tests/connectionHome.test.ts src/forkop/next/tests/nativeShellLoading.test.ts src/forkop/services/tests/socket.service.test.ts src/forkop/services/tests/variantRound2.test.ts --max-warnings=0
node node_modules/prettier/bin/prettier.cjs --check src/helpers/copyToClipboard.ts src/helpers/tests/feedback.test.ts src/forkop/next/render.ts src/forkop/next/tests/connectionHome.test.ts src/forkop/next/tests/nativeShellLoading.test.ts src/forkop/services/tests/socket.service.test.ts src/forkop/services/tests/variantRound2.test.ts ../luci-app-forkop/htdocs/luci-static/resources/view/forkop/forkop.js ../docs/tdd/twenty-ux-task-7.md
```

From the repository root, native `forkop.js` passed `node --check` and the
patch passed `git diff --check`.

### Ownership and remaining gate

Stage A owns `copyToClipboard.ts` and its feedback tests, `next/render.ts` and
its Home regression, the native `forkop.js` Reset wrapper and native shell
regression, and the two socket service test files. Existing captured native
LuCI/UCI fixtures retain their original provenance and method bodies.

Per the staged integration instruction, no full suite, generated `main.js`
rebuild, browser/router check, backend/package gate, translation synchronization,
version bump, final acceptance matrix, deployment or whole-branch completion
claim is included here. Those remain for the integrated Task 7 release stage.

## Stage B: integrated release preparation

Integrated source base: `c272c51295aa7ae545c934a4a2d804d0ec06094b`. Stage A is
`ba9caff7b322aaa6ae3400335a9da6ce2221ddab`. Task 5 review corrections and Task 6
source were integrated before this stage; subsequent independent-review fixes
must be included before the single complete frontend/build gate.

`VERSION` is **1.2.0**. Packaging already substitutes its requested release version
into backend/frontend compiled constants and all six package metadata records;
the frontend tooling package's internal `1.0.0` and public core fixture versions
are separate and unchanged. README, interface/design/acceptance guidance,
changelog and release notes describe the implemented workflows and actual limits.
The unpublished intermediate 1.1.5 notes now point to 1.2.0. Release-facing private
runtime/server/performance claims were removed; published dependency identifiers,
official fixtures, license, provenance and checksum requirements remain intact.

### Russian catalog synchronization

The extraction/generation/distribution scripts were inspected before use.
`generate-pot.js` and `generate-po.js` regenerate headers from local git identity
and time, so their header-rewriting paths were not invoked. Existing complete
POT/RU PO headers, including copyright/license/provenance, were retained exactly;
catalog bodies were synchronized from extracted keys while preserving existing
translations and adding the missing Russian messages. No local translator
identity was added.

From `fe-app-forkop`:

```text
node extract-calls.js
node distribute-locales.js
```

Result: **761 gettext keys; 23 newly translated entries**, including six keys
already written in Russian. An independent Babel parse of **179 runtime files**
with native top-level returns admitted confirmed the same complete key set.
The stock extractor reports skips for `next.js` and `luci.d.ts`; neither contains
runtime gettext calls missed by that audit. Source POT/RU PO and packaged POT/RU
PO are synchronized. Header preservation and zero untranslated entries are
checked independently of the generators. Compiled translation/package checks
remain part of root-owned Linux CI.

After reviewed Task 6 fix `c37a322`, extraction/audit/distribution was repeated:
the same **761 keys**, no additional gettext entries, and source references were
refreshed. The new Russian target-version/router-scope wording is direct text.
Documentation now makes absent variant/source-bound target version evidence and
the global router diagnostic context explicit. This is catalog/docs preparation;
the final full gate still waits for the pending Task 5 correction.

### F01–F20 acceptance matrix

Frontend paths below are relative to `fe-app-forkop/src/`: `next` means
`forkop/next/tests`, `workspace` means `forkop/workspace/tests`, and tab paths are
under `forkop/tabs`. Backend paths are relative to `tests/backend`. Linked task
reports record the observed behavioral RED/GREEN commands. The complete frontend
gate is recorded below; these UI tests do not certify the backend/package gate.

Manual evidence is synthetic, reported by the root browser pass on immutable
checkpoint builds: **B1** `b479fa5` draft/navigation guard; **B2** `a6f4131`
malformed masked diagnostics; **B3** Task 3 connection/site flow and `edeb8d5`
device/game limits; **B4** `439f927` mobile layout and keyboard order/focus.
No private endpoints, installed-core facts or deployment evidence are included.
The matrix separates directly observed browser behavior from automated contracts;
it does not imply that every timing/error variant was reproduced manually.

**B5 — final native checkpoint `bbfc02b`**, using the unchanged `e262c16` bundle:
root observed the real native renderer at desktop 1280 in light/dark, all six
source editors, a saved-basis UDP/8443 question and exact winning-rule Conditions
navigation. Malformed masked JSON exposed no synthetic secret and disabled safe
exports. A checkbox draft plus keyboard reorder retained focus; Reset restored
the checkbox while preserving cached order and its correct unsaved strip.
The untouched Extended main preview showed draft membership without fabricated
network evidence: two Priority nodes, levels «Основные → Резерв». Nested-child
preview acceptance is still pending.

The synthetic large subscription contained 200 leaf nodes plus two group rows:
VLESS search reported `100/202`, Frankfurt `1/202`, and zero matches retained
the active node. Tested mobile surfaces showed client/scroll widths `305/305`
at 320, `375/375` at 390 and `415/415` at 430. At 320 all destinations except
Servers were exercised; the primary Home action remained within the first screen
(620px even with the pending banner). Actual 200% browser zoom was unavailable:
the browser shortcut did not change the rendered scale/DPR, so no zoom result is
claimed. Screen-reader and hardware performance checks remain unmeasured.

**B6 — final runtime candidate `1eef375`**: after the independently approved
cloned-modal binding correction, root's actual native browser confirmed initial
preview and rejection after adding a third source with Enter. All six destinations
including Servers fit at 320 (`305/305` client/scroll), alongside observed 390
(`375/375`) and 430 (`415/415`) layouts. Parent/URLTest/Priority and nested-level
preview forms were exercised using static response envelopes; actual resolver
parity is Linux backend evidence. Tiny's unknown-target preview error kept
installation unavailable and started no job. Browser error/warning output was
empty. Real zoom, screen-reader and hardware performance remain unclaimed.

| Item                             | Behavioral evidence                                                                                                                                                                | Manual evidence and remaining acceptance                                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 — result context             | `next/trustEvidence.test.ts`, `connectionHome.test.ts`, `compatibility.test.ts`; [Task 1](twenty-ux-task-1.md)                                                                     | Target changes and A/B completion order are covered by behavioral tests; B5 captured explicit target/protocol/device context. No standalone manual race-timing claim.                                                                 |
| F02 — draft/save/apply           | `next/nativeShellLoading.test.ts`, `configReload.test.ts`; real captured Map/Value/UCI contracts; Tasks 1/7                                                                        | B1 and B5 retained the native draft and blocked unresolved mutation. B5 Reset restored checkbox, retained cached reorder and kept the correct unsaved strip.                                                                          |
| F03 — interrupted recovery       | `next/trustEvidence.test.ts`, `nativeShellLoading.test.ts`; `test_next_profiles.py`, `test_native_lifecycle.py`                                                                    | Recovery success/failure and retained connected results are covered by native/backend tests. Real interrupted-router recovery belongs to deployment acceptance.                                                                       |
| F04 — direct connection creation | `next/directNative.test.ts`, `workspace/namedCreation.test.ts`; [Task 3](twenty-ux-task-3.md)                                                                                      | B3 opened the named editor at subscription input; B5/B6 exposed all six source editors. Save/return-to-group behavior is verified by native fixtures.                                                                                 |
| F05 — add site                   | `next/directNative.test.ts`, `workspace/rules.test.ts`; Task 3                                                                                                                     | B3 normalized a synthetic URL, appended its domain and retained conditions; behavioral tests preserve regex/full/keyword and sources.                                                                                                 |
| F06 — device policies            | `next/directTools.test.ts`; `test_next_policies.py`, `test_policy_generator.py`                                                                                                    | B3 rejected IPv6 locally with actionable wording; runtime/native tests cover assignment, reset, inherit, direct and legacy scopes.                                                                                                    |
| F07 — masking failure            | `tabs/diagnostic/tests/maskDiagnostics.test.ts`, `partials/modal/tests/renderModal.test.ts`; [Task 2](twenty-ux-task-2.md)                                                         | B2 and B5 showed masking failure, no synthetic secret in DOM text and disabled Copy/Download. Raw-view/copy retry details remain covered by behavioral tests.                                                                         |
| F08 — precise route question     | `next/diagnosisImpact.test.ts`; `test_route_explain.py`, `test_probe.py`; [Task 6](twenty-ux-task-6.md)                                                                            | B5 asked saved-basis UDP/8443 for a synthetic domain/device, matched main and opened its exact Conditions tab. TCP/8443, unknown conditions and probe separation also have behavioral tests.                                          |
| F09 — eligible targets           | `next/workflows.test.ts`, `directTools.test.ts`; Task 3 review fixes                                                                                                               | Mixed actions/proxy availability, disabled reasons and exact setup destinations are verified by behavioral tests; no inferred capability from version text.                                                                           |
| F10 — current reads win          | `next/directTools.test.ts`, `tools.refresh.test.ts`, `compatibilityRefresh.test.ts`; Task 3                                                                                        | Out-of-order replies and retained successful data after refresh failure are verified by behavioral tests; no additional manual timing claim.                                                                                          |
| F11 — truthful feedback          | `helpers/tests/feedback.test.ts`, modal/compatibility tests; Tasks 2/7                                                                                                             | B2/B5 show truthful local masking errors; repeated global clipboard failure and manual focus/selection are verified by real helper/modal tests.                                                                                       |
| F12 — numeric contract           | `next/numericSettings.test.ts`; Task 2                                                                                                                                             | Native validators verify integer syntax, bounds, units and zero semantics. No separate hardware timing interpretation is claimed.                                                                                                     |
| F13 — bounded fresh telemetry    | `partials/modal/tests/renderModal.test.ts`, `next/traffic.test.ts`, `connectionHome.test.ts`; Task 2                                                                               | Behavioral tests verify hidden/closed pause, no overlap, retained text/selection and unknown/reset counters. Router performance remains unmeasured.                                                                                   |
| F14 — mobile hierarchy           | `workspace/workspace.test.ts`, `visualSystem.test.ts`, `next/overview.test.ts`, `connectionHome.test.ts`; [Task 4](twenty-ux-task-4.md)                                            | B5/B6 desktop 1280 light/dark and tested 320/390/430 surfaces had no overflow; B6 covered all six destinations at 320. Home action stayed visible; actual 200% zoom was unavailable.                                                  |
| F15 — rule accessibility         | `workspace/rules.test.ts`; captured native table/UCI move; Task 4 fix                                                                                                              | B4/B5 keyboard move retained button focus and draft feedback. B5 Reset preserved cached reorder with the unsaved strip. Screen reader remains untested.                                                                               |
| F16 — large subscriptions        | `next/largeSubscription.test.ts`; `test_extended_preview.py`; [Task 5](twenty-ux-task-5.md)                                                                                        | B5 searched 200 leaf + 2 group rows: VLESS 100/202, Frankfurt 1/202; zero matches kept active pinned. Source failure/last-success behavior is covered by tests.                                                                       |
| F17 — change impact              | `next/diagnosisImpact.test.ts`, `tabs/updates/tests/componentImpact.test.ts`; `test_component_impact.py`; Task 6                                                                   | Profile categories/digests and admitted/unknown capabilities passed runtime tests; B6 Tiny preview failure left install unavailable and started no job. No real installation is implied.                                              |
| F18 — authoritative composition  | `next/extendedPreview.test.ts`, `nativeExtendedPreview.test.ts`, `nativePreviewDefaults.test.ts`, `nativePreviewModalMap.test.ts`; `test_extended_preview.py`; Task 5 review fixes | B6 initial preview and added-source blocking passed in actual native DOM. Parent/URLTest/Priority/nested-level forms used static response envelopes; the real shared resolver and credential regressions passed Linux Extended tests. |
| F19 — explicit game scope        | `next/directTools.test.ts`; `test_next_policies.py`; Task 3                                                                                                                        | B3 empty selected-device scope produced an error without expanding to all; runtime tests verify scope and route payloads.                                                                                                             |
| F20 — symptom-led diagnosis      | `tabs/diagnostic/tests/symptomGuide.test.ts`, `symptomController.test.ts`, `next/diagnosisImpact.test.ts`; Task 6                                                                  | All five entries, bounded DNS/connection/rule/source outcomes, next-step/log access, no navigation probe and stale replies passed behavioral tests; hardware diagnosis is not certified.                                              |

### Complete frontend gate and generated-bundle identity

The root acceleration ruling admitted the single complete frontend gate before
the remaining strictly backend credential-canonicalization correction. That
correction and its backend regression do not change frontend inputs; final Linux
CI must still certify the integrated complete tree. Backend-only or documentary
changes do not require repeating an unchanged frontend suite.

Frontend basis: **`35737fd3f0bec0d53262c1f5ad98543ab146730b`**, source tree
`b8964da898b987372abd1f43e17d2f7d41aba304`.
The `fe-app-forkop/src` Git subtree is
`bac2e99228054102afbca8927188023ebb44b833`; the `tsup.config.ts` blob is
`e37b6cf8d822043e8ae92b87994ce6bc447b4050`.

Commands from `fe-app-forkop`, all exit 0:

```text
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0
node node_modules/prettier/bin/prettier.cjs --check src '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/*.js' '!../luci-app-forkop/htdocs/luci-static/resources/view/forkop/main.js'
node node_modules/tsup/dist/cli-default.js src/main.ts
node scripts/check-luci-bundle.mjs
```

Result: **88 files / 910 tests passed**, no skips/failures; no unexpected
ERROR/WARN/stderr or unhandled error output in the full test log. Full-source
TypeScript, ESLint with zero warnings and authored-source Prettier checks passed.
An initial broader format command also included the inherited generated
`main.js` and returned one formatting warning. The corrected scope above excludes
that generated artifact; it is rebuilt by tsup, never hand-formatted.

Tsup rebuilt the actual LuCI `main.js` (725.60 KB build output). The smoke check
executed the generated bundle and native overview module and rendered the
workspace successfully. `node --check` passed for all **11** native JavaScript
files, including the newly generated bundle. `git diff --check` passed.

Generated `luci-app-forkop/htdocs/luci-static/resources/view/forkop/main.js`:

- SHA256: `75db825a2913cc9572240123797eece27b2d5c45c15807de3a1a06f0413f12e9`
- Git blob: `46de335374aed26e1ba7f4a253a2e713f049e75c`

The bundle commit follows this recorded basis with generated output and evidence
only. These identities allow root to verify parity after later backend-only
integration without a duplicate frontend build. A frontend input change would
require the affected gate again.

### Final native correction verification

Native source basis: `bbfc02b73aff41f050a25a56c5215633f53f9932`.
Actual native acceptance exposed missing first-load UCI source baselines and an
inactive cascade select's default first target. The reviewed fix loads the
baseline after UCI and ignores inactive cascade target text; it preserves later
dirty source/filter edits. Its RED/GREEN and independent scoped review are in
[Task 5](twenty-ux-task-5.md). No TypeScript product source, build configuration
or generated `main.js` changed from the prior frozen bundle.

The native behavior change and two new regression tests justified one fresh full
Vitest run: **89 files / 912 tests passed**, no skips/failures or unexpected
ERROR/WARN/stderr. Commands:

```text
node node_modules/vitest/vitest.mjs run
node node_modules/prettier/bin/prettier.cjs --check src/forkop/next/tests/nativePreviewDefaults.test.ts '../luci-app-forkop/htdocs/luci-static/resources/view/forkop/*.js' '!../luci-app-forkop/htdocs/luci-static/resources/view/forkop/main.js'
node scripts/check-luci-bundle.mjs
```

All passed. Native `node --check` passed for all 11 JavaScript files. The existing
shipped bundle/native overview executed and rendered successfully again; tsup
was not repeated because its product inputs were unchanged. The aggregate
`fe-app-forkop/src` subtree is now `4876ad25d8e62ec46036c37be7143e377d0b7994`
because of the added tests. The updated authored `section.js` blob is
`051c5adfea0b64c400a0c9deb236bcdab4b0936d`; generated bundle SHA256/blob remain
exactly as recorded above. Source/POT reference locations were synchronized after
the native line shifts: still 761 translated keys, original headers preserved,
source and packaged catalogs identical.

The native fix's scoped SPEC/QUALITY review approved both findings with none open.
B5 above records root's actual native browser confirmation. Final integrated
Linux/backend/package CI and whole-branch completion still need root evidence.

### Final runtime candidate and Linux results

Root's final native modal correction binds preview reads to the active cloned
map; its behavioral regression and independent approved review are recorded in
[Task 5](twenty-ux-task-5.md). Runtime candidate:
`1eef3750188eed69a425c70a835ca919b34c3b49`, tree
`fbc18afb7c637728daf2e9b0b1aa5fabb2849ef4`, published for CI as
`dd2a42fe9f6fb529089769c4158169cbd0a2a579` with the exact same tree.
The aggregate frontend source/test subtree is
`ddd182a0479928de048f433c49ccf65935632936`; authored `section.js` is blob
`e848566f9c33c420c2d3b33f27ba40fd812d693c`. TypeScript product/build inputs and
generated `main.js` retain the earlier recorded identities.

Root observed the final Linux frontend quality gate **SUCCESS**, job
`121017069327`: **90 files / 913 tests passed**, with required static/build checks.
The complete Linux backend release gate was also **SUCCESS**, job `121017069168`,
including **4 component-impact tests**, **16 Extended preview tests** and the
full backend/runtime/core suite. These are root-observed CI outcomes, not an
additional local run by this documentation worker.

Package run [40142529145](https://github.com/m0llusca/forkop-next/actions/runs/40142529145)
completed **SUCCESS**, package job `121017552548`: IPK/APK generation passed
on that exact runtime candidate. Frontend job `121017069327` and backend job
`121017069168` also succeeded; release publication was correctly skipped for the
PR run. This follow-up changes documentation only. After integration,
the release workflow must certify its selected final source tree and assets;
runtime-candidate CI is not silently relabeled as a run on a later docs commit.

Root retains publication, final privacy review and authorized merge/release/router
installation. Device work requires verified recovery backups and an independent
delayed rollback before network-affecting changes. No worker deployment or
live-device/screen-reader/hardware-performance result is claimed.
