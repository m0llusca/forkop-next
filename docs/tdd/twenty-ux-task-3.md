# UX task 3 — direct native workflows

Date: 2026-10-25. Base: a6f41312760a0ee7599a078b7b8914e6d470a478.
Scope: F04/F05/F06/F09/F10/F19. No backend changes or deployment.

## Behavioral changes

- Home and Servers create through the existing named GridSection editor and focus
  subscription input. All six sources and native dependency/parse/save/cancel
  behavior remain available. Exact existing rule/source/site navigation and a
  return-to-that-group anchor avoid searching a general table.
- The native domain field has URL/hostname preview, explicit subdomain/exact
  scope, target rule and priority. It adds to the existing draft, preserves
  full/keyword/regex and other conditions, and does not duplicate subscriptions.
- Devices have Edit and reset-to-general-rules actions. The explicit local
  inherit sentinel maps to existing section:""; the placeholder never does.
  Generated direct assignments stay visibly distinct. IPv6/CIDR entries remain
  untouched and link to their full native editor.
- Device and game inputs share DHCP/name+IPv4 hints, manual entry, local address
  validation and non-online-status wording. Gaming requires an explicit all or
  selected-device scope and shows the route/affected-device preview.
- Tool choices preserve action and safe native proxy configuration. Unknown and
  unavailable targets are disabled with a reason and exact settings navigation.
  Status already excludes generated rules; a small optional generated boolean
  also protects the exported route eligibility helper against mixed snapshots.
- Device/profile/routes reads use generations, preserve successful data on failed
  refresh and show refresh time. Native guard codes retain their API values and
  get human wording beside the device/game action.

## RED and GREEN evidence

All commands below ran from fe-app-forkop using bundled Node (npm/npx are not on
PATH). Tests exercise real controls and actual native module code; only remote
reads and native widget/DOM/UCI boundaries use fixtures. Native GridSection add,
modal cancellation/save and tab activation contracts are captured in existing
fixtures. No invented Map SaveApply method was used.

1. `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/directTools.test.ts`
   initially **9 failed**: no row actions; IPv6 write reached device_set; empty
   game device silently applied globally; DNS/Zapret were enabled game targets;
   guard codes were printed verbatim; old device response replaced fresh data.
   Minimal implementation made all nine pass.
2. Additional device regressions each ran RED before their fix: stored IPv6/CIDR
   still showed incompatible actions (**1 failed / 9 passed**); old profile
   completion cleared/replaced fresh status (**2 failed / 10 passed**); native
   direct assignment showed `nxt_direct` (**1 failed / 12 passed**). Final file:
   **13 passed**.
3. New workflow/native-helper tests were written before those APIs existed; their
   first runs failed on missing functions (setup/API absence, not a behavioral
   assertion). The capability integration test also failed because incompatible
   Smart Detect choices remained enabled. After implementation the controls and
   source preservation assertions passed. Subsequent behavioral RED covered a
   missing diagnostic settings link and modification of a read-only native
   textarea (**2 failed / 7 passed**), and generated route eligibility
   (**1 failed / 9 passed**). Error-preview secret regression then failed on two bare userinfo/query cases (**2 failed / 10 passed**); the error now omits userinfo and path/query fragments. Final workflow file: **12 passed**.
4. Native Home creation RED: **1 failed / 4 passed** (opened IDs were [] instead
   of section_2); unavailable-group return RED: **1 failed / 6 passed** (Servers
   did not display the explanation). Both now pass. Native adapter tests use
   captured actual add/tab methods and execute dashboard.js. Native domain
   integration executes section.js, its analyzer and write cleanup, verifying
   subscription references and original section count are unchanged.
5. First full suite: **9 failed / 846 passed**. Existing fixtures needed explicit
   game scope and complete action/native capability metadata for valid tool
   choices. A refresh test exposed malformed response assignment poisoning the
   device list; responses are now shape-checked before assignment. The prior
   broad assertion forbidding any mention of online status was corrected to
   verify the explicit DHCP-not-online explanation. These were all repaired;
   no failures were omitted. One intermediate native test invocation used the
   repository root instead of fe-app-forkop and produced ENOENT; rerunning from
   the documented directory passed.

## Final verification

- Full suite: **81 files / 870 tests passed**, zero failures. Existing socket
  service tests retain expected error/warning scenario output.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0`:
  passed. Initial lint found three explicit-any test types; replaced with the
  response type before the passing run.
- `node node_modules/prettier/bin/prettier.cjs --check src` plus owned native
  section.js/dashboard.js: passed.
- `node node_modules/tsup/dist/cli-default.js src/main.ts`: passed, **654.54 KB**.
- `node scripts/check-luci-bundle.mjs`: native bundle and overview smoke passed.
- Generated main.js SHA256:
  `eac15609d6aa8b31764c74926edcb18e3df314c9f45414335a91fd500316579b`.
- Ignored scoped logs: task-3-suite.log, task-3-build.log, task-3-smoke.log.

## Ownership, shared contracts and limits

Owned: next/workflows.ts; next/tools.ts; selector-only changes in next/advanced.ts;
Home creation call site; native section.js/dashboard.js adapters; Dashboard
section anchors/actions; public helper exports and DOM attribute type; targeted
new/updated frontend tests; docs/API.md; this document; generated main.js.
No backend API, six-source persistence, independent server inventory, Extended
resolver, native guard lifecycle or deployed configuration changed.

The exact navigation, eligibility, safe native context and group anchor contracts
for Tasks 4/6 are documented in docs/API.md. Native local_devices.js is reused
through its existing loadLocalDeviceChoices function without changing its IPv6
configuration support. F04 uses the approved first-stage addressed native editor;
source parsing and unsupported-item results remain native, not a new import API.
A configured proxy is not asserted to be an active listener; backend validation
may still reject an unapplied/unavailable listener. Backend rule evaluation is
not reimplemented. No real browser/router/private scripts, network probes,
Linux packaging, screen-reader session, push, merge or deployment were performed.
Root owns actual native preview and independent review.

## Root preview follow-up

Root's actual LuCI preview confirmed that Add site opened the native domain field
and appended `docs.example.net` from an HTTPS URL while retaining the two original
lines and marking a draft. It found that the shared navigation hint still talked
about subscription parsing for the site action. After initial implementation
commit 5aa2892, two focused regressions ran RED (**2 failed / 7 passed**) for site
and local-proxy editing. Guidance and return-to-node now appear only for create
or source-field editing; other actions show ordinary rule save/apply guidance.
Focused GREEN: **9/9**. Full verification after this follow-up: **81 files / 870
passed**, type/lint/format/build/runtime smoke passed with the final hash above.


## Independent review fix round 1 — F09

Base: `c94a727ed03cd0b44f19a4b7cb355b48f2bbf708`. Fixed only the two Important
findings in task-3-review.md. Smart Detect recovery now comes from the failed
eligibility branch: unsupported action opens `action`; compatible connection
with missing/unknown proxy opens `mixed_proxy_enabled`. Diagnostic proxy behavior
is preserved. The shared return shape gains optional `settingsOption`, documented
in docs/API.md for Tasks 4/6. Gaming and temporary selectors now filter ineligible
routes, the alternative explicitly permitted by F09; device eligibility remains
broad and generated assignments remain visible there.

Behavioral RED, before the corresponding production edits:

- `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/workflows.test.ts`
  — 3 failed / 14 passed. Actual Smart Detect recovery clicks for configured
  Zapret, Zapret2 and ByeDPI dispatched `mixed_proxy_enabled`, expected `action`.
  Compatible missing and unknown proxy cases already passed.
- `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/workflows.test.ts src/forkop/next/tests/directTools.test.ts`
  — 3 failed / 28 passed. Gaming/temporary still contained invalid choices,
  and generated targets remained in the game selector. Updated assertions reflect
  the approved eligible-only presentation instead of the former disabled choices.

GREEN after each minimal change: first 17/17, then 31/31. Recovery tests activate
actual buttons and capture cancelable native navigation details; selector tests
inspect real rendered options and retain valid selections. Neither selection nor
recovery sends a mutation/probe. All commands run from fe-app-forkop:

- `node node_modules/vitest/vitest.mjs run src/forkop/next/tests`
  — 26 files / 252 tests passed (bounded impacted Next suite).
- `node node_modules/typescript/bin/tsc --noEmit` — passed.
- `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0` — passed.
- `node node_modules/prettier/bin/prettier.cjs --check src` — passed.
- `node node_modules/tsup/dist/cli-default.js src/main.ts` — passed, 654.53 KB.
- `node scripts/check-luci-bundle.mjs` — native bundle/overview loaded and rendered.
- Regenerated main.js SHA256:
  `f35198901070895236857859f639b715ed245cbf557dcad2611279d81f6b22d9`.

The full 870-test run above remains historical; this narrow review round did not
repeat the full suite as directed by root. Existing socket log noise (Minor)
remains deferred. No backend, browser/router, probes, push, merge or deployment.
