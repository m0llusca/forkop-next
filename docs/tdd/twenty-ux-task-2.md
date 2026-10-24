# Twenty UX improvements — Task 2 (F07, F11–F13)

Date: 2026-10-25. Base: `b479fa55c868c9562413604eb2706d63d042d6a4` (790 frontend tests).

## Behavior and contracts

- A malformed, truncated, primitive or non-JSON sing-box configuration now fails masking. The modal catches masking failure, clears displayed text and disables both copy and download. Turning off Hide values explicitly identifies the raw secret-bearing view. Re-enabling masking clears raw text and any manual-copy fallback. Valid objects retain recursive masking of known sensitive keys; the label asks operators to review before sharing and does not promise complete anonymization of arbitrary diagnostic prose.
- `formatMaskedSingBoxConfig(value)` retains its successful string result but now throws for unsupported input. The diagnostic controller passes the formatter into the modal rather than formatting before the modal can display the failure.
- `copyToClipboard(text, feedback?) -> Promise<boolean>` confirms the browser Clipboard API promise, or a true legacy `execCommand('copy')` result. Existing one-argument callers remain compatible. False, thrown and rejected results show failure and a read-only, manually selectable fallback. An optional element keeps modal feedback beside its action. Legacy selection restores focus; modern clipboard completion does not steal focus if the user has moved. Switching diagnostic views detaches obsolete copy feedback so a pending raw-copy failure cannot reveal raw text in the masked view.
- Toasts expose polite status or assertive alert semantics. Compatibility-update transport errors use their own result; comparison evidence and Task 1 context/invalidation remain intact. Retry uses the same released action button.
- Native TTL and BadWAN validators accept only decimal whole-number text, without whitespace, signs, fractional parts, exponent notation, units or trailing junk. Zero remains valid. TTL is seconds, `0..4294967295`, matching sing-box `*uint32 RewriteTTL`; zero rewrites response TTL to zero. BadWAN is milliseconds, `0..2147483647`, matching procd's signed `int timeout` and integer timer argument. Zero omits an explicit timeout in procd.sh and procd uses its minimum scheduling delay, rather than disabling monitoring. Help and native field errors state the units, range and zero meaning. Backend option names/defaults and runtime semantics are unchanged.
- Log reads use one request in flight and completion-based adaptive scheduling: 3 seconds initially, doubling unchanged/error intervals to at most 30 seconds and returning to the base interval when text changes. Hidden tabs stop scheduling and invalidate pending results; return schedules one current read, waiting for an existing request to settle before replacement. Native LuCI modal close, disconnection and the explicit Close button dispose polling. Refresh failure retains the last successful text/time and offers a local Refresh retry. Unchanged refreshes preserve manual selection; text updates retain the existing scroll stickiness behavior.

Consumer references checked read-only:

- [sing-box v1.12 DNS action option types](https://raw.githubusercontent.com/SagerNet/sing-box/v1.12.0/option/rule_action.go): `RewriteTTL *uint32`.
- [OpenWrt procd trigger consumer](https://raw.githubusercontent.com/openwrt/procd/master/service/trigger.c): signed `int timeout`, `uloop_timeout_set`, minimum scheduling when timeout is not positive.
- [OpenWrt procd shell API](https://raw.githubusercontent.com/openwrt/openwrt/main/package/system/procd/files/procd.sh): positive reload delay adds explicit timeout; zero omits it.
- [LuCI UI modal implementation](https://raw.githubusercontent.com/openwrt/luci/master/modules/luci-base/htdocs/luci-static/resources/ui.js): `hideModal()` removes `modal-overlay-active` without disconnecting content. The regression exercises that actual boundary rather than inventing a modal disposal API.

## Observed RED → GREEN

Commands run from `fe-app-forkop` with Node on PATH; ignored raw transcripts are under `.superpowers/sdd/2026-10-25-twenty-ux-improvements/task2-*.log`.

1. `node node_modules/vitest/vitest.mjs run src/helpers/tests/feedback.test.ts src/partials/modal/tests/renderModal.test.ts src/forkop/next/tests/numericSettings.test.ts src/forkop/next/tests/compatibility.test.ts src/forkop/tabs/diagnostic/tests/maskDiagnostics.test.ts`
   - Actual initial RED: **27 failed / 19 passed**. Masking returned raw malformed/primitive text; clipboard false announced success; async clipboard was not awaited; status semantics were absent; update errors replaced comparison evidence; native validators accepted ambiguous/out-of-range values; hidden completion updated logs; refresh errors had no visible result.
   - First GREEN iteration: **44 passed / 2 failed**. Two fixture assumptions were corrected: Happy DOM has a default Clipboard API and must explicitly lack it for the legacy test; the new adaptive polling interval requires an explicit Refresh to test the failure branch without assuming the old cadence. TypeScript also caught unsupported E attribute typings; DOM properties/setAttribute replaced them.
   - Focused GREEN after corrections: **46/46**, later **51/51** with additional selection/clipboard regressions.
2. `node node_modules/vitest/vitest.mjs run src/helpers/tests/feedback.test.ts src/partials/modal/tests/renderModal.test.ts`
   - Selection RED: **1 failed / 10 passed**. An unchanged refresh removed the manual-copy textarea and selection. GREEN updates display/copy state only when text changes or safe output has not yet been obtained.
3. `node node_modules/vitest/vitest.mjs run src/partials/modal/tests/renderModal.test.ts`
   - Actual-native-close RED: **1 failed / 6 passed**; **11 reads instead of 1** after LuCI hideModal removed its overlay class while the body remained connected. GREEN observes the native overlay class and disposes the modal lifecycle; **7/7 passed**.
4. `node node_modules/vitest/vitest.mjs run src/helpers/tests/feedback.test.ts`
   - Focus RED: **1 failed / 5 passed**; deferred Clipboard API confirmation moved focus back from an input to the original button. GREEN restores selection/focus only for the synchronous legacy-selection route. Combined feedback/modal run **13/13 passed**.

Tests call real masking/helper/modal/compatibility implementations and execute the actual native settings module to obtain its registered validators. Only browser clipboard, LuCI element creation and remote request boundaries use controlled doubles. Fixtures use synthetic secrets. No source-string assertions or invented LuCI methods were introduced.

## Final verification

- `node node_modules/vitest/vitest.mjs run`: **78 files / 835 tests passed**, zero failures. Unchanged socket-service/retired-socket tests still print their expected warning/error scenarios; new focused tests are clean.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx --max-warnings=0`: passed across all source.
- `node node_modules/prettier/bin/prettier.cjs --check` with the twelve owned TypeScript/native source/test paths: passed.
- `node node_modules/tsup/dist/cli-default.js src/main.ts`: passed, generated LuCI bundle updated.
- `node scripts/check-luci-bundle.mjs`: passed, native bundle and overview loaded and rendered.
- `git diff --check`: passed.
- Generated `main.js` SHA256: `4dbe2a5ef57b3f7b946a9551911d367daf1096117a4e47e51ebd6b5317feb8d8`.
- npm/bash/WSL are unavailable on this host; the build script's constituent Node commands above ran directly.

## Ownership and limits

Owned: diagnostics masking/helper tests and controller call site; modal/tests; clipboard/toast/tests; compatibility's scoped feedback change/test; native settings and registered-validator tests; generated `main.js`; this document. No Task 1 event, mutation, recovery or evidence API changed. No six-source editor, route, probe initiation, backend configuration format, native IDs, secret export, DNS transport/isolation, TLS or IPv6 behavior changed.

No browser/router/private scripts, real network probes, deployment, Linux packaging, assistive-technology session or router cold/warm/bad-link performance measurement was performed. DOM status/focus/selection assertions establish the frontend contract, not actual screen-reader announcements. Root owns browser preview and independent review. Live screen-reader and router-performance acceptance remain unverified. An already-running read cannot be canceled at the existing shell API boundary; its obsolete result is discarded and no overlapping replacement is started. Known-key masking is not a general anonymizer for arbitrary diagnostic prose, and raw view remains explicitly secret-bearing.
