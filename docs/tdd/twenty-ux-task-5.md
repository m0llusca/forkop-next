# UX task 5 — large subscriptions and Extended filter draft preview

Scope: F16/F18. Base `439f927c2c4673ad76d5159ca1321ec2d681c49e`.
Contract was documented in `docs/API.md` before backend endpoint implementation.
TDD and Impeccable skills were read; existing PRODUCT/DESIGN were loaded. No
browser/router/private deployment scripts/subagents were used by this implementer.

## Observed RED

- Tests-only commit `895cfad5b408d12a636765fbef505c1de648fe78`.
  Root published the identical tree as `8fc2d18f2c673b1ce9fc059bdf75463e11345be3`.
  Linux Backend CI run `40139749901`, job `121008788209`: real ucode executed
  the generator fixtures; focused step ran 6 tests in 0.324s and failed with
  10 assertions (including table subtests). Absent preview returned
  `endpoint_missing`; absent source outcome history returned no status.
  No backend production edits preceded root's observed RED confirmation.
- Local `node node_modules/vitest/vitest.mjs run
  src/forkop/next/tests/largeSubscription.test.ts`: missing search input RED;
  source-history placeholder RED (`''` missing unknown history text). Initial
  missing-module discovery was a setup error, not claimed as behavioral RED.
- Local `extendedPreview.test.ts`: absent preview controls RED. New component
  then rejected obsolete replies and rendered text without HTML interpretation.
- Local `nativeExtendedPreview.test.ts`: missing native adapter RED. It now
  executes the production snapshot adapter against native-shaped child rows,
  verifies live nested empty arrays/order, exact owners, omitted testing/health
  secrets and no UCI writes.
- Local search refresh regression: absent `replaceSectionsPreservingSearch`
  RED; GREEN preserves search input focus, query and caret through refresh.
- Additional tests-only process-budget regression is
  `f499897ed4193428d4383313763957e1252f1eb6`, published as
  `643b8af588300c6f28b0d9f3d6b9d7a34203c1b9`. Root observed Linux run
  `40140404262`, job `121010750941`: 12 tests in 8.753s, two failures.
  The new timeout marker was absent; the source-provenance failure below remained.
  Only after this RED, public preview gained the 10-second process prefix.
- Expanded `32e6544`, published as `9226596fe34197ef6d6431cd19698b015a40e86d`:
  root observed run `40140214461`, job `121010190110`, 11 tests in 7.200s,
  one failure. Captured subscription preview returned `unproven_source_pool`.
  Existing metadata fallback also captured persistent `.url`/`.user_agent`
  identities; the path allowlist admitted only temporary cache files. The fix
  admits strict filenames under both backend-owned roots and keeps byte checks.
  The fixture now isolates its persistent root and tests both identity mutations.

## Observed GREEN and commands

- Backend prototype `12241358f4e1de377e4c6d38a3e7956e781bf8ee`, published exact
  tree as `38e277681d5b550d0f3c917b1de99aa01c6fa53d`:
  Backend CI `40139957753`, job `121009411720` success. Focused 7 tests in
  5.208s, strict and ordinary ucode syntax, full backend/runtime/current-core
  suite all passed (root-observed). Frontend `40139957745` and ShellCheck
  `40139957731` also passed. This evidence applies to that immutable prototype.
- Expanded test-only `32e65441f704eba5f4296c6b3730c2e9e1a76252` adds exact ordered
  identity parity (not only counts), AND/OR dimensions, flag countries, pool
  exclusions, legacy/tied order/policy, source/core-byte invalidation, failing
  network/service/UCI stubs, file immutability, secret-bearing names and public CLI.
- Final local frontend command `node node_modules/vitest/vitest.mjs run`:
  **84 files / 887 tests passed** (6.99s). Log: ignored `work/task5-frontend-tests.log`.
- `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0`:
  exit 0. `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- Scoped Prettier check: exit 0. `git diff --check`: exit 0.
- Build: `node node_modules/tsup/dist/cli-default.js src/main.ts`, followed by
  `node scripts/check-luci-bundle.mjs`: exit 0; generated LuCI bundle 682.04 KB;
  actual native bundle and overview module loaded/rendered successfully.
- One Impeccable detector run on changed surfaces: three preexisting advisories
  only in unchanged native CSS (section.js lines 919, 942, 943); no new palette
  or radius added by this task. No claimed visual screenshot acceptance.
- A focused invocation with `--root` from repo root failed because existing
  native fixtures resolve from frontend cwd; rerun from `fe-app-forkop` passed
  54/54. This setup mistake is not product RED evidence.

## Contracts and ownership

- `singbox/group_resolver.uc`: extracted original membership expressions and
  first-assignment ordering; generation aliases the shared functions. Optional
  trace reports reasons from those same membership decisions.
- `singbox/preview_basis.uc`, `core/sha256.uc`: captured consumed source bytes,
  loaded normalized config identity plus exact raw-config guard, core/trust
  identity, finalized provenance after successful generated-output writing.
  SHA tests compare actual bytes to Python hashlib for empty/ASCII/multiblock,
  lengths 55/56/63/64/65, Cyrillic/emoji and embedded NUL.
- `service/extended_preview.uc` and CLI map: bounded strict request, native
  ownership, expected capture, country-evidence gate, allowlisted safe response;
  no generator invocation/probe/download/service write on reads. Cached inputs
  stay backend-owned. Captured membership is not applied-runtime or connectivity
  proof. No ACL expansion.
- `subscription/evidence.uc` and updater integration: exact source identity,
  real observed attempts and last success retained after failure; known import
  counts only, duplicate/unsupported breakdown unknown. Source read omits URLs.
- Dashboard renderer/controller/types: local search by name/country/type,
  selected row pinned, accurate matches/total, retained keyboard focus/caret,
  unchanged UCI/URLTest membership; source outcome read/unknown labels and native
  traffic-assignment navigation.
- Native `section.js`: nonmutating live/pending/UCI draft extraction, complete
  child lists, preview-only new IDs, ownership, child JSONMap context, omitted
  testing/health URLs, source/cascade checks and stale result invalidation.
- `next/extendedPreview.ts`: request generations/capture conflict handling,
  text-only membership/reasons/overlap/empty levels/fallback/interrupt policy,
  explicit draft-vs-runtime scope. Existing Save/parse/cancel remains native.
- Parent review fixture is ignored
  `.superpowers/sdd/2026-10-25-twenty-ux-improvements/native-preview-fixture.json`.
  It contains synthetic native rows and a static envelope, not a browser resolver.

## Limits and remaining parent gates

Windows host has no ucode/bash/WSL; Linux evidence is explicitly root-observed CI.
Old caches without completed provenance, changed saved inputs and missing
country.is metadata are unavailable, never silently approximated. Unsupported
source/cascade drafts are withheld until a fresh saved generation exists.
Full source-kind/cascade behavior additionally remains covered by the existing
Linux generator/runtime suite. No live router, screen reader, real subscription
network import or browser screenshot behavior is certified by these fixtures.
Root owns final Linux/package gate, independent review, browser/native acceptance
and any later authorized release/merge/router installation. This task stays local.

## Review fix round 1

Isolated checkout `forkop-ux-preview-fix`, base `f246ce6`; no shared Task 7 edits
and no generated bundle changes. Review found arbitrary known credentials in
labels, native Priority order drift and incorrect exclude-only explanation.

- Backend tests-only `f1ea955ca5663a30da3883f180b7db270a44e63b`, published as
  `39af441b84eef77f810ab770362bc538e275245a`. Root observed Linux Backend CI
  `40140819431`, job `121012014095`: 14 tests in 6.659s, exactly two failures:
  `plainCredential731` leaked through node/group/level labels; exclude-only
  survivor reason was `include_match` instead of `exclude_miss`. Other 12 passed.
- Native actual-adapter test RED: live nested order `2` differed from native
  Save's displayed index `0`. Minimal fix assigns Priority level order from its
  actual list index after copying filters. Reorder/add/remove, overlapping filter
  inputs, explicit empty nested filters, owners and no writes are covered.
- Rendering test RED: `exclude_miss` displayed unknown data; localized explanation
  added. Focused native/render suite GREEN: two files, three tests. Existing
  shell timing INFO output is expected; earlier full frontend logs also contained
  expected errors/warnings from unchanged socket tests (Task 7 owns that cleanup).
- Focused ESLint and full TypeScript check exit 0; scoped formatting/diff check
  clean. No repeated full frontend suite/build/bundle in this fix round, per root.
- Backend projection compares labels with non-label string values from known JSON
  outbounds and verified captured normalized source JSON, plus source URL
  userinfo/query/path and explicit credential fields. It rechecks captured bytes
  before using them as label evidence. Ordinary proven subscription names remain
  useful. Unsupported encoded manual-link context uses neutral labels/opaque IDs;
  this is not a claim of universal arbitrary-prose anonymization.
- Membership is unchanged; resolver trace alone uses `exclude_miss` in exclude
  mode. Added ordered overlap/fallback parity against actual saved generation,
  and preservation of ordinary subscription names alongside plain password tags.
- Final fix Linux GREEN remains pending root's immutable CI observation.

## Review fix round 2 — canonical manual-link credentials

Review demonstrated a double-encoded Trojan credential missed by the label
context. Tests-only `f711a4fdfed0e7797beef9925785b35c19f39c11` adds an actual
ucode generator assertion of the password before preview projection, covers
both double and triple encoding, and preserves an ordinary manual-node label.

First Linux attempt `40141422437`, job `121013788100` (remote `c42ef037`)
failed all 16 methods at compilation: the round-1 source guard incorrectly used
JavaScript-style `throw 'source_changed'`, unsupported by ucode. This is an
introduced syntax defect, not behavioral RED for the encoded case, and no
fix-round backend GREEN is claimed for that run. Separate correction
`a95351838903b0f93d7b4110ca73b77217dced42` uses `die('source_changed')`, matching
existing `singbox/compatibility.uc` and `singbox/reality.uc` exception handling.
The corrected tests baseline must run before canonical decoding implementation.

Corrected-baseline Linux RED observed by root: `a953518` exact tree
`8f61e1de`, remote `a271dfbe`; Backend CI `40141538838`, job `121014131842`:
16 tests in 12.143s, exactly two encoded-case assertion failures. The actual
generated passwords `plainCredential731` and `%70lainCredential731` appeared
in the response; other 14 tests passed, without syntax/setup errors.

Only after that behavioral RED, manual-source context gained precisely the
single whole-link `url.decode` then `url.strip_fragment` step used by
`manual_link_outbound`, before shared URL userinfo/query helpers. Subscription
URL interpretation is unchanged; no recursive decoding, resolver, generation,
Priority-order or frontend changes. `git diff --check` passed. Final focused
Linux GREEN awaits root's publication of this immutable fix.

## Final native acceptance fix wave

Root's actual native checkpoint exposed two initial-preview blockers. These were
real lifecycle/default defects, not synthetic subscription metadata:
`createSectionContent` ran before LuCI `Map.render()->load()` populated UCI, so
no source baseline existed; the inactive nonoptional cascade select independently
chose its first target (`games`) despite an empty saved value.

Tests-only `1475c5c4dbe6c5ed635d42107f6ae90c1981c0bc` observed behavioral RED:
`nativePreviewDefaults.test.ts`, two tests failed with `source_draft_changed`
and `cascade_draft_changed` respectively, both expecting an untouched preview.
The fixture executes the production native snapshot/load hook and actual detour
option load/target helper; real HTML select default semantics expose the hidden
first-choice behavior. Native checkbox value semantics use its DOM checked state.

Minimal fix captures saved inputs from section load (after Map's UCI load and
before rendering), never replacing an existing baseline with later dirty values.
Inactive cascade target is normalized away only while the effective enabled
flag is not `1`. Tests cover first capture, subsequent source edit/reload without
rebasing, disabled target changes, enabling cascade, and active target changes.

Focused verification: `node node_modules/vitest/vitest.mjs run` with
`nativePreviewDefaults.test.ts`, `nativeExtendedPreview.test.ts`, and
`extendedPreview.test.ts`: 3 files / 5 tests passed. Full TypeScript, scoped
ESLint, scoped Prettier check, `node --check` on authored section.js and
`git diff --check` passed. One test-regex spacing lint issue was corrected before
the clean scoped lint result. No backend, TypeScript product, or bundle change;
root owns updated native-browser checkpoint and final integration checks.
