# LuCI connection overview implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Use behavioral TDD and independent review.

**Goal:** Show a fast, understandable connection overview while preserving all existing capabilities.

**Architecture:** Keep the native LuCI shell and the existing TypeScript/DOM frontend. Separate essential connection state from lazily mounted advanced panels. Reuse authenticated controller/service APIs and shared runtime state; no replacement backend or remote assets.

**Tech Stack:** LuCI JavaScript, TypeScript, ucode, Vitest/Happy DOM, tsup.

**Spec:** The user selected the new simple overview with advanced settings separate on 2026-10-24, approving the structure in the local proposal. Everyday information is service state, selected server, explicit connection check, traffic and errors. Extended functions remain accessible. Preserve the existing local typography/theme and other LuCI pages.

## Global constraints

- Preserve UCI/filesystem/service namespaces, credentials, IPv6/DNS isolation and Extended features.
- Never equate a running process or historical latency with working Internet.
- No credentials, deployment endpoints or backups in commits or published reports.
- Existing working route remains selected during development.
- UI controls show immediate pending feedback; no duplicate apply/restart actions.
- First render must not await capabilities or advanced diagnostics.
- Initial reads are shared per mount; explicit refreshes are fresh and old replies cannot overwrite new state.
- Desktop and mobile layouts, native focus/keyboard controls, local assets, light/dark themes.

## Review focus

1. Legacy YACD enabled without secret must not block unrelated rule saves; new remote enable without secret must fail.
2. Pending initial requests and out-of-order refreshes must not overwrite fresher state or block first paint.
3. Missing controller/service data must remain unknown/error rather than imply successful connectivity.
4. Hidden/unmounted views must stop their own periodic work and ignore late replies.
5. Advanced functions must remain reachable; saving/applying profiles still requires comparison and respects rollback/conflict guards.

## Task 1 — Initial read fanout and urgent save regression

**Files:** next/render.ts, tools.ts, compatibility.ts, next/tests/render.test.ts, native settings.js and controllerSettings.test.ts.

- [x] Observe RED for duplicated initial reads, implement per-mount sharing, verify fresh explicit refresh.
- [x] Observe RED for legacy YACD save, implement effective off state and save-time enable guard, retain backend fail-closed behavior.
- [x] Run full frontend tests, typecheck and independent reviews.
- [x] Deploy only the reviewed urgent settings.js fix after verifying existing file identity and backing it up; no service restart.

## Task 2 — Useful simple overview and lazy advanced panels

**Files:** next/render.ts, next/styles.ts; create focused overview/state modules as needed; next/tools.ts/compatibility.ts only where lazy mounting requires it; tests under next/tests. Keep generated main.js integration-owned.

**Interfaces:** Preserve renderNextPanel(request?, loadConnections?) compatibility. Optional typed adapters may extend it for shared service state, authenticated service actions, server selection and telemetry. Implement adapters through existing methods; do not add fake API actions.

- [x] Write failing Happy DOM tests: initial simple screen exposes connection actions; advanced data is not requested until expanded; unknown service/probe state stays unknown; slow detail requests do not block the main state; explicit probe reports actual result/time.
- [x] Implement status/selected server/connection check/error hierarchy. Versions are secondary. Put profiles/recovery, temporary rules, Smart Detect, compatibility and device tools in named expandable advanced areas with first-open loading.
- [x] Expose server change via existing authenticated selector methods, with pending/error feedback. When not supported, provide a functioning native navigation action rather than a dead button.
- [x] Add no-overlap visible-only updates using shared runtime state/telemetry; protect late replies, and retain retry/refresh controls.
- [x] Verify missing/failed/slow responses, no configured server and existing action/profile safeguards in behavioral tests.
- [ ] Verify actual desktop/mobile rendering and native LuCI widget integration in a browser.
- [x] Run next suite, typecheck and lint; request independent review.

## Task 3 — Native shell loading and measured backend cost

**Files:** native forkop.js, relevant native-loader behavioral tests, service/next.uc only if measurements justify a change.

- [x] Measure read-only backend operations on the router. Investigate repeated raw compressed-core version execution versus the existing runtime version-state reader.
- [x] Write a failing behavioral test for unresolved capability discovery not blocking an otherwise usable overview; preserve capability-dependent control guards and fallback detection.
- [x] Render the essential view immediately; initialize optional capability-dependent sections when ready or on demand, maintaining existing LuCI save semantics.
- [x] If version probing is a material bottleneck, add a fixture regression before using the existing version-state contract; never trust an arbitrary stale file for core capability admission.
- [x] Verify settings, server and provider controls with pending/failed capability discovery.

## Task 4 — Integration and actual verification

- [ ] Run all frontend tests, typecheck, ESLint and bundle check; run affected backend/native tests when changed.
- [ ] Build the actual LuCI bundle and packages; verify source/package identities and no private metadata.
- [ ] Review the complete diff independently before integration.
- [ ] Capture desktop/mobile UI and measure first useful render, interaction feedback, initial request count and router response times before/after. If browser access is unavailable, record that gap without claiming visual/live timing verification.
- [ ] Apply reversible UI-only files with backups; preserve current networking and other LuCI theme work. Verify the user-visible save scenario.
- [ ] Update documentation with actual evidence and remaining limits; publish only after final checks.

## Execution ledger

Task 1 completed: initial fanout 9 to 6; frontend 600 tests passed after urgent save fix; independent static reviews found no new issues. Urgent settings-only hotfix installed. Tasks 2–4 remain active. No full redesign or new release is deployed yet.

Integration update: independent reviews closed two overview P2 findings, a cached-replay P2, and the native Settings pane selector P1. Full frontend tests, formatting, lint and typecheck pass locally. Browser access currently fails at the Codex browser connection, so desktop/mobile and actual native widget verification remain outstanding. No new overview deployment or release has been performed.
