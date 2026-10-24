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
Every row still requires the final generated-bundle browser pass where marked.

| Item                             | Behavioral evidence                                                                                                                     | Manual evidence and remaining acceptance                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 — result context             | `next/trustEvidence.test.ts`, `connectionHome.test.ts`, `compatibility.test.ts`; [Task 1](twenty-ux-task-1.md)                          | Tests cover target changes and A/B response order. Final browser confirmation pending.                                                                                                    |
| F02 — draft/save/apply           | `next/nativeShellLoading.test.ts`, `configReload.test.ts`; real captured Map/Value/UCI contracts; Tasks 1/7                             | B1 retained checkbox draft through Devices and blocked mutation. Stage A covers Reset with cached reorder. Final bundle pass pending.                                                     |
| F03 — interrupted recovery       | `next/trustEvidence.test.ts`, `nativeShellLoading.test.ts`; `test_next_profiles.py`, `test_native_lifecycle.py`                         | Recovery has separate success/failure and retained result tests. Final browser pending; real interrupted-router recovery is separate.                                                     |
| F04 — direct connection creation | `next/directNative.test.ts`, `workspace/namedCreation.test.ts`; [Task 3](twenty-ux-task-3.md)                                           | B3 opened the named editor at subscription input with all six sources. Final save/return-to-group browser pass pending.                                                                   |
| F05 — add site                   | `next/directNative.test.ts`, `workspace/rules.test.ts`; Task 3                                                                          | B3 normalized a synthetic URL, appended the domain and retained existing conditions. Final browser pending.                                                                               |
| F06 — device policies            | `next/directTools.test.ts`; `test_next_policies.py`, `test_policy_generator.py`                                                         | B3 rejected IPv6 locally with actionable wording. Final assignment/reset/inherit browser path pending.                                                                                    |
| F07 — masking failure            | `tabs/diagnostic/tests/maskDiagnostics.test.ts`, `partials/modal/tests/renderModal.test.ts`; [Task 2](twenty-ux-task-2.md)              | B2 showed masking failure, no synthetic secret in DOM text and disabled Copy/Download. Final Russian catalog/raw-view pass pending.                                                       |
| F08 — precise route question     | `next/diagnosisImpact.test.ts`; `test_route_explain.py`, `test_probe.py`; [Task 6](twenty-ux-task-6.md)                                 | UDP/443, TCP/8443, basis, unknown conditions and exact rule navigation tested. Final browser pending.                                                                                     |
| F09 — eligible targets           | `next/workflows.test.ts`, `directTools.test.ts`; Task 3 review fixes                                                                    | Mixed actions/proxy availability, disabled reasons and exact setup destinations tested. Final browser pending.                                                                            |
| F10 — current reads win          | `next/directTools.test.ts`, `tools.refresh.test.ts`, `compatibilityRefresh.test.ts`; Task 3                                             | Out-of-order replies and retained successful data after refresh failure tested. Final error/retry browser states pending.                                                                 |
| F11 — truthful feedback          | `helpers/tests/feedback.test.ts`, modal/compatibility tests; Tasks 2/7                                                                  | B2/B3 cover visible local errors. Repeated global clipboard failure and manual focus/selection are automated. Final browser pending.                                                      |
| F12 — numeric contract           | `next/numericSettings.test.ts`; Task 2                                                                                                  | Integer syntax, bounds, units and zero behavior tested against native validators. Final localized validation browser pass pending.                                                        |
| F13 — bounded fresh telemetry    | `partials/modal/tests/renderModal.test.ts`, `next/traffic.test.ts`, `connectionHome.test.ts`; Task 2                                    | Hidden/closed pause, no overlap, retained text/selection, unknown/reset counters tested. Final browser pending; router performance is unmeasured.                                         |
| F14 — mobile hierarchy           | `workspace/workspace.test.ts`, `visualSystem.test.ts`, `next/overview.test.ts`, `connectionHome.test.ts`; [Task 4](twenty-ux-task-4.md) | B4: 320/390/430 widths had no horizontal overflow; all six destinations and first-screen Home action accessible. Final desktop/light/dark/200%-zoom/long-error pass pending.              |
| F15 — rule accessibility         | `workspace/rules.test.ts`; captured native table/UCI move; Task 4 fix                                                                   | B4: Enter moved a non-edge row, retained button focus and draft position feedback. Final keyboard/touch pass pending; screen reader not tested.                                           |
| F16 — large subscriptions        | `next/largeSubscription.test.ts`; `test_extended_preview.py`; [Task 5](twenty-ux-task-5.md)                                             | Synthetic 200-node search/pinned selection and failed-attempt/last-success evidence tested. Final real-renderer keyboard/search pass pending.                                             |
| F17 — change impact              | `next/diagnosisImpact.test.ts`, `tabs/updates/tests/componentImpact.test.ts`; `test_component_impact.py`; Task 6                        | Secret-free profile categories/digests, admitted current core evidence and unknown target capabilities tested. Final browser preview/completion pass pending.                             |
| F18 — authoritative composition  | `next/extendedPreview.test.ts`, `nativeExtendedPreview.test.ts`; `test_extended_preview.py`; Task 5 review fixes                        | Native live Priority order, shared resolver parity, secret labels, filters/fallback and unknown source/core evidence tested. Final native/browser pass and Linux integrated gate pending. |
| F19 — explicit game scope        | `next/directTools.test.ts`; `test_next_policies.py`; Task 3                                                                             | B3 selected-device scope with empty address showed an error and never expanded to all. Final route/scope browser confirmation pending.                                                    |
| F20 — symptom-led diagnosis      | `tabs/diagnostic/tests/symptomGuide.test.ts`, `symptomController.test.ts`, `next/diagnosisImpact.test.ts`; Task 6                       | All five entries, bounded DNS/connection/rule/source cases, next step/log access, no navigation probe and stale replies tested. Final browser pending.                                    |

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

### Remaining integrated release gate — pending

Root owns the single final whole-branch review, generated-renderer/native browser
pass, exact-tree Linux backend/syntax/package CI, public privacy audit and any
authorized merge/release/router installation. These are pending, not inferred
from checkpoint success. Device work requires verified recovery backups and an
independent delayed rollback before network-affecting changes. No worker
deployment or live-device/screen-reader/performance result is claimed.
