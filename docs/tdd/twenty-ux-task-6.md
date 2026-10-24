# UX task 6 — F08, F17, F20

Implementation checkout: `work/forkop-ux-diagnostics`, branch
`feat/ux-diagnostics-integration`, base `f499897ed4193428d4383313763957e1252f1eb6`.
The brief's original repository header was explicitly overridden by the parent.
Only the three assigned items were implemented. No deployment, browser/router
access, merge, push, private script, subagent or generated bundle was used here.

## Behavior and shared contracts

- F08 exposes the default HTTPS/TCP/443 context and disclosed protocol/port,
  accepts a domain or destination IP, and names saved router UCI as the basis.
  UDP/443 and TCP/8443 are submitted exactly. An unknown condition remains
  unconfirmed, without a winning-rule button. Confirmed rule navigation uses the
  existing native ID and `navigateToRule`, preserving native drafts. The live
  probe remains its separate explicit action with captured target/router/time.
- F17 classifies profile changed keys into parameter counts for rules/connections,
  devices, DNS and other. It omits arbitrary response fields and all raw values,
  and preserves both reviewed digest gates. The component preview shows the
  current version, selected variant/channel, admitted binary source/SHA256 and
  exact trusted capabilities; target capabilities stay unverified until existing
  installation validation. Generated-config requirement counts expose no nodes,
  credentials or source values. An explicit second action starts the unchanged
  guarded job. Completion separates applied version, a fresh service read (or
  unknown) and an untested network result. Recovery wording describes existing
  transaction/package limits without promising an independent backup.
- F20 supplies all five symptom entries in diagnostic/route tools. It uses existing
  bounded service/DNS checks, route explanation, explicit probe and the committed
  `source_evidence` contract. Selection/navigation never starts a check. Results
  provide one observed outcome, captured context, next step and adjacent logs.
  Last successful import survives a later failure; missing DNS evidence stays
  unconfirmed. Generations reject stale replies, incomplete device context never
  expands scope, and hidden device values are excluded from a site scenario.

`docs/API.md` documents the added `component_preview` read before its production
implementation. Task 1 mutation/evidence semantics and Task 3 `navigateToRule`,
`targetEligibility` and workflow-context contracts remain intact. No Task 5
generator, dashboard, section, filter preview or source-evidence module changed.
The CLI map has one isolated additional action line for integration.

## Observed RED → GREEN

All frontend commands ran directly with Node in `fe-app-forkop`.

1. `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/diagnosisImpact.test.ts`
   initially failed 4/4: missing protocol/port controls, missing unconfirmed
   condition presentation and semantic impact summary. After implementation 4/4
   passed. Added five-entry regression then failed once (missing symptom picker),
   followed by GREEN. The destination-IP regression independently failed on a
   blank optional `device` value, then passed with the omitted field. Final six
   tests also exercise exact native winning-rule navigation and no implicit probe.
2. `node node_modules/vitest/vitest.mjs run src/forkop/tabs/diagnostic/tests/symptomGuide.test.ts`
   observed 2 failures/7: unknown DNS incorrectly progressed to a probe and source
   results omitted last-success history. Both became GREEN. A later hidden-device
   regression failed on an unintended device in a site route request, then passed.
   Final result: 8/8, including synthetic DNS/connection/rule/source outcomes,
   stale replies and incomplete device context.
3. `node node_modules/vitest/vitest.mjs run src/forkop/tabs/updates/tests/componentImpact.test.ts`
   first failed because Tiny immediately started an installation job. It passed
   after explicit preview/confirmation. Extending the same real-controller test
   then failed on absent applied-version/service outcome and passed after adding
   the separate completion evidence. The external shell/job boundary is faked;
   the card, action flow, store, modal and controller are real.
4. `node node_modules/vitest/vitest.mjs run src/forkop/tabs/diagnostic/tests/symptomController.test.ts`
   with the original mount-dependent log listener failed (0 `check_logs` shell
   calls). Registering the existing explicit log action before pane visibility
   gave 1/1 GREEN. The final test uses the real shell-method adapter with only its
   external execution boundary replaced.
5. Backend tests-only commits were `ef77ef6` and `f426e35`. Parent-owned Linux CI
   published exact tests tree `37db8d7bd7a1b0c61d29709407fedcb7f496a901` as remote
   `24673e0f04070a5b7d9a28a4cd24bda0dc1b4f82` (run `40140525866`, job
   `121011115895`): real ucode setup succeeded; four focused tests produced nine
   failures including action subtests because `components/impact.uc` was absent.
   Production backend `3d24234`, exact tree
   `f59c314144b824ca0c7715c7a854ae30e3dd6baf`, was published by the parent as
   `4a397c31f29976228667f2869492b57943b1ec37`. Run `40140770625`, job
   `121011864819`, focused Component impact step: SUCCESS, 4 tests, 0.060 s, OK.
   It proves exact binary admission, changed-hash rejection, safe aggregate
   requirements/no mutation, invalid-request handling and all target variants
   remaining unverified. This agent did not execute Linux locally.

## Scoped verification

`node node_modules/vitest/vitest.mjs run src/forkop/next/tests src/forkop/tabs/diagnostic/tests src/forkop/tabs/updates/tests`
passed **35 files / 309 tests**. The preceding run failed one old route-payload
expectation requiring `device:""`; it was corrected to the real backend's omitted
optional-device contract. The old label/trace fixture also gained a real input
domain after validation was added. Existing unknown trace text remains escaped
plain text. No existing behavior assertion was removed.

After the two final regressions, the focused command over `diagnosisImpact`,
`symptomGuide`, `symptomController` and `componentImpact` passed **4 files / 16
tests**, exit 0. The parent will run the full integrated suite once.

`node node_modules/typescript/bin/tsc --noEmit` passed. An initial ES target error
for `findLast` was corrected to supported `reverse().find()`. Scoped ESLint with
`--max-warnings=0` passed over every changed TypeScript file. Prettier's first
check found two test formatting issues; formatting them and rerunning the full
changed-file check produced “All matched files use Prettier code style!”.
`git diff --check` passed. No package/bundle build was claimed: the parent owns
the single final integrated build and Linux/package gate and explicitly requested
no duplicate build. `main.ts` and generated `main.js` are unchanged.

## Ownership and limits

Source commit: `5009d8e`; backend/API commit: `3d24234`; tests/CI commits above.
Owned files are `next/advanced.ts`, its diagnosis impact tests and two adjusted
native fixtures; diagnostic guide/read/controller and tests; component impact
UI/update controller and tests; isolated `components/impact.uc`, its fixture, CLI
map line and focused CI step; this report and the additive API section.

The backend CI checkout still contains the old Task 5 base `f499897`. Its later
Extended step fails the two parent-reported known source-provenance/timeout
assertions; the focused Component step is GREEN. This is scoped evidence, not a
claim that that old tree's complete backend suite passed. Latest Task 5 must be
integrated before the final full Linux gate. No router, visual/browser, hardware,
screen-reader, installed target artifact or independent live rollback was tested.
Unknown target versions/capabilities, unavailable generated config and missing
service/network evidence are intentionally explicit. Independent review and
cherry-pick are parent-owned; no merge or deployment occurred here.

## Review round 1 — release evidence binding and scenario scope

Verified the Important finding against the real card/cache/controller: its
per-component sing-box update cache carries no target variant/source identity.
The preview therefore suppresses that cached version for every sing-box install
action (including generic install), showing unknown until matching evidence is
available. Other components retain their existing release version. No backend,
network, cache schema, install variant, source selection, job guard or confirmation
flow changed. The current-channel release remains visible on its component card;
it is not presented as the selected variant's target in the modal.

The Minor finding was also reproduced after status populated a subscription rule:
global/service-only scenarios wrongly named its hidden ID. Only the source
scenario now captures the selected rule. All/global service checks name the
router and their actual service/DNS scope, without a subscription target.

Tests were committed before implementation as `de500de`:

`node node_modules/vitest/vitest.mjs run src/forkop/tabs/updates/tests/componentImpact.test.ts src/forkop/tabs/diagnostic/tests/symptomGuide.test.ts`

Observed RED: **2 files failed, 4 failed / 8 passed (12 tests), exit 1**. The real
controller modal labelled cached `1.99.0-extended` as Tiny's target and cached
`2.0.0-record` as Stable's target; both expected unknown. The two global/service
fixtures displayed `Цель: main` instead of the router/service scope. These are
behavior failures with loaded evidence, not missing controls or imports.

The exact same command after correction observed GREEN: **2 files / 12 tests
passed, exit 0**, duration 1.69 s. Both component cases still assert that the
current card displays its cached release, preview starts no job, unknown target
omits that release, and explicit confirmation invokes the selected native job
before terminal applied-version/service/network evidence is shown. The tests use
official Extended → Tiny and custom record → Stable, covering variant and source
changes. Existing eight symptom behaviors remain covered alongside the two new
scope cases.

`node node_modules/typescript/bin/tsc --noEmit` returned exit 0.
`node node_modules/eslint/bin/eslint.js src/forkop/tabs/updates/initController.ts src/forkop/tabs/updates/componentImpact.ts src/forkop/tabs/diagnostic/symptomGuide.ts src/forkop/tabs/updates/tests/componentImpact.test.ts src/forkop/tabs/diagnostic/tests/symptomGuide.test.ts --max-warnings=0`
returned exit 0 with no findings.
`node node_modules/prettier/bin/prettier.cjs --check` over the same five files
returned exit 0: “All matched files use Prettier code style!”. No full suite,
bundle, backend or live-router check was repeated in this scoped review round.
