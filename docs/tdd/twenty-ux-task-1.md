# Twenty UX improvements — Task 1 (F01–F03)

Date: 2026-10-25. Baseline: `f98f320bcf509c3bacdd011e931dccfe03c2af95` (769 tests).

## Behavioral changes

- Compatibility checks capture connection, outbound, target and request time, explicitly name router origin, omit pasted JSON from the context, and invalidate on relevant input changes. Generation plus captured-input checks reject obsolete responses.
- Diagnostic probe, route explanation and Smart Detect comparison capture context and invalidate when inputs or the configuration digest change. Probe/recommendation requests can restart after edits while an obsolete request is pending.
- Native input changes keep one pending-state strip across workspace navigation. Saved versus applied state is explicit. DOM edits, local UCI create/change/delete/reorder and saved remote UCI changes stop active Next mutations before the command boundary. No implicit save or apply happens on navigation.
- Clean immediate mutations lock the editor while executing, reload UCI and reconstruct the native map without `location.reload()`. Native Save / Apply are blocked during the transaction. A cache refresh failure retains backend success, blocks unsafe saves, releases the temporary lock, and offers an explicit editor-only refresh.
- Recovery has a separate `recover` action available outside lazy disclosures. `rollback` is unavailable while transaction recovery is pending. Recovery results retain error reason and retry guidance.

## RED → GREEN evidence

Commands below run from `fe-app-forkop` with Node already on PATH. Raw logs remain outside version control in `.superpowers/sdd/2026-10-25-twenty-ux-improvements/` (initial logs in its `logs/` subfolder).

1. `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/trustEvidence.test.ts src/forkop/next/tests/nativeShellLoading.test.ts`
   - RED: 12 failed / 17 passed. Missing captured target, retained verified success after JSON edits, obsolete probe blocking replacement, missing recover path, native draft/staged UCI allowed through shell, and absent editor lock were observed.
   - Initial GREEN iteration exposed test-boundary mistakes: device navigation legitimately performs read commands, shell helper converts thrown transport errors into failure responses, and copy assertion casing. These were corrected without changing the required behavior.
2. `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/configReload.test.ts`
   - RED: second concurrent mutation returned success instead of `native_mutation_busy`. The initial deferred-test timeout was repaired to settle both requests, then the expected assertion RED was observed (`task1-red-2b.log`).
   - Native explicit reset also reproduced a retained dirty flag before its fix.
3. `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/nativeShellLoading.test.ts`
   - RED (`task1-red-3b.log`): persisted saved-state guidance absent; boolean `uci.state.reorder.forkop` allowed mutation; cache-refresh failure lacked an editor-only retry action. An initial misplaced test assertion was corrected before this valid RED.
   - GREEN: all native tests pass, including map reconstruction, pending capability discovery, preserved native Save and Apply semantics and lock release after transport/cache errors.
4. `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/trustEvidence.test.ts`
   - RED (`task1-red-4.log`): recover absent from lazy rules area; Smart Detect result remained current after target edit.
   - GREEN: 10/10 context/recovery regressions pass. Additional A-after-B compatibility regression passed against the earlier generation fix.
5. Focused command including `trustEvidence`, `nativeShellLoading`, `configReload`, and `api`: GREEN (38 tests before the final three context cases; all covered again by final full suite).

## Final verification

- `node node_modules/vitest/vitest.mjs run`: **75 files, 787 tests passed**, zero failures (final run). A preceding full run caught an existing routing test selecting the new empty recovery result before the route result; recovery feedback now uses notice styling and preserves the established result selector behavior.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Focused ESLint with `--max-warnings=0` on all changed TypeScript files: passed.
- Prettier `--check` on changed source/native/test files: passed.
- `node node_modules/tsup/dist/cli-default.js src/main.ts`: passed; generated LuCI `main.js` updated.
- `node scripts/check-luci-bundle.mjs`: passed; native bundle and overview loaded and rendered.
- `git diff --check`: passed before commit.
- Generated `main.js` SHA256: `5cb9500edbbc043af8ec5bb478812e283a2246d6468f9443e18d11bf49616cb5`.
- `npm run build` was unavailable because npm is not on PATH; its three constituent checks above were executed successfully with Node.

## Ownership and limitations

Owned: `next/{compatibility,advanced,configReload,api}.ts`, focused tests, native `forkop.js`, generated `main.js`, this record and the scoped implementation report. Root owns shared API/interface documentation and independent review. No framework, backend resolver, profile digest, six-source editor, Extended setting, DNS/TLS/IPv6 behavior or secret projection contract was changed.

Native UCI behavior uses the existing captured LuCI form lifecycle fixture. UCI local state fields and boolean reorder representation were checked against the [upstream UCI implementation](https://raw.githubusercontent.com/openwrt/luci/master/modules/luci-base/htdocs/luci-static/resources/uci.js). Fixtures cover the real controller script and command wrapper with controlled I/O; they do not certify a live router. No router/VPS, deployment, Linux packaging, screen-reader or live browser acceptance checks were performed by this agent.

The conservative conflict policy requires applying or explicitly discarding pending native/UCI changes before retrying an immediate action. It does not merge drafts. Concurrent edits from a separate browser/session are outside this frontend lock's scope. The fix round below preserves mounted tool hosts during clean mutation synchronization. Browser preview and independent review remain assigned to root.

## Review fix round 1 — actual view contract and connected recovery result

Fix base: `721bdf921ccf475ee0a19cec4b37966eb49ef66c`. Independent review found the earlier native Apply fixture invented a Map method and therefore did not establish real Save & Apply compatibility. The production strip reached that invalid assumption; the corrected fixture places Save & Apply on the view, matching the [official LuCI view implementation](https://raw.githubusercontent.com/openwrt/luci/master/modules/luci-base/htdocs/luci-static/resources/luci.js). Its native Map retains only the captured real lifecycle.

- RED: `node node_modules/vitest/vitest.mjs run src/forkop/next/tests/nativeShellLoading.test.ts` → **2 failed, 24 passed** (`task1-fix-red.log`): strip Apply reaches an undefined captured Map method; actual recovery synchronization replaces the connected host and loses its result.
- First GREEN: both regressions pass after routing strip Apply through the inherited view method with mode `'0'` (checked), and retaining mounted tool hosts only during immediate UCI synchronization. Standard native Save/Reset continue reconstructing their children.
- Observer RED: the same command with a deferred native reconstruction boundary → **1 failed, 25 passed** (`task1-fix-observer-red.log`): retained host is disconnected during asynchronous reconstruction. Actual document MutationObserver microtasks run during the pause.
- Observer GREEN: a hidden connected staging sibling retains mounted hosts while native panes rebuild. Hosts return before workspace remount; new unused placeholders are disposed. The native active tab is restored through its existing tab link. Rejected reconstruction restores staged hosts and rethrows so existing synchronization failure guidance remains authoritative. No probes are initiated by restoration.
- Corrected fixture also checks standard view Save then UI Apply, checked and unchecked mode mapping, failed saves preventing Apply, and delayed service-evidence refresh after native Apply / immediate refresh on save rejection. The strip says to await the native LuCI dialog; it no longer labels merely starting native apply as completed activation.
- Final GREEN: **75 files, 790 frontend tests passed**, including **27 native-controller tests**. TypeScript, focused ESLint (`--max-warnings=0`), source Prettier check, `git diff --check`, frontend build and bundle runtime smoke passed. Full suite retains expected socket warning/error logging from unchanged tests; these are not new failures.
- Raw transcripts are scoped, ignored files: `task1-fix-{red,observer-red,green,suite,build,smoke}.log`. Build and smoke now have separate captured transcripts. Generated `main.js` is byte-identical to the prior build: SHA256 `5cb9500edbbc043af8ec5bb478812e283a2246d6468f9443e18d11bf49616cb5`.

Backend `native_apply` / `checkpoint` behavior is unchanged: the view invokes native `ui.changes.apply`, preserving the standard service activation route; no new frontend checkpoint or Next apply substitute was added. Existing backend regressions `test_native_reload_rejects_invalid_saved_changes_and_restores_checkpoint`, `test_native_reload_restores_missing_config_from_checkpoint`, `test_native_reload_activation_failure_restores_last_good_config`, and `test_native_reload_success_updates_checkpoint_and_previous_config` remain the Linux/ucode verification boundary. They were not executed on this Windows host; frontend fixtures do not certify checkpoints or service activation. No router, deployment, private scripts or browser changes were made in this round.
