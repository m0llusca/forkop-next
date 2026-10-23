# Frontend lifecycle variants, round 2 (2026-10-23)

Baseline c31310b8. Reproduced three frontend lifecycle bugs before edits using native pnpm/Vitest and real source modules. Source ownership: next/tools.ts, next/compatibility.ts, services/socket.service.ts. Added next/tests/variantRound2.test.ts and services/tests/variantRound2.test.ts.

RED: earlier File.text completion overwrote latest selected profile content; deselection did not invalidate the read; stale failure overwrote latest success. Compatibility response after section change restored old outbound options; probe success/rejection finally re-enabled a button with no valid outbound. Retired socket error/message reached replacement subscription; retired open allowed premature send.

Command: `pnpm --dir fe-app-forkop test --run src/forkop/next/tests/variantRound2.test.ts src/forkop/services/tests/variantRound2.test.ts`. Expected assertion failures were observed before each behavior change. Compatibility's first attempted collection matcher raised a happy-dom TypeError; numeric options.length assertion corrected the fixture, then the intended RED was observed.

GREEN: file-read generation, compatibility request generation plus handshake disabled invariant, socket instance guards for open/message/error. Nine new regression cases pass in the full suite.

Verification: `pnpm test --run` in fe-app-forkop: 56 files / 592 tests passed. `pnpm exec tsc --noEmit`: exit 0. `pnpm lint --max-warnings=0`: initially unused describe import warning; removed import and repeated, exit 0. Prettier applied to five owned source/test files. No generated main.js rebuild, router/VPS access or credentials used.

Full evidence and methodology: outputs/forkop-next-variant-frontend-round2.md in the user-facing audit workspace.

## Monitoring follow-up

Confirmed same-mount stop/restart transport generation bug in monitoring/initController.ts. Added two table-driven real-DOM cases to existing monitoring/tests/controllerTransport.test.ts. With first RPC pending, stop/restart and advance 3000ms: still only one call (nonoverlap). Old success displayed old-session.example (expected absent), old rejection showed unavailable instead of loading: both expected RED. The first fixture attempt lacked real svgEl; repaired boundary mock before accepting failures. Captured connectionsUpdatesId in pollConnectionsSnapshot; checked after await and in catch; retained pollingConnections until finally. Restored guards after explicit mutation run re-confirmed both RED cases.

Final verification: pnpm test --run 56 files / 594 tests PASS; pnpm exec tsc --noEmit exit0; pnpm lint --max-warnings=0 exit0. Monitoring source and test formatted. No bundle rebuilt.
