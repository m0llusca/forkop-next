# Full Forkop Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved hybrid connection-first home and persistent six-section workspace across all Forkop UI.

**Architecture:** Preserve native LuCI map/tab IDs and form lifecycle. Add a scoped workspace adapter, rebuild the overview and format traffic, then group advanced API panels into their appropriate destinations. Avoid duplicate inputs/controllers and keep lazy mounting.

**Tech Stack:** TypeScript, native DOM, LuCI JavaScript forms, existing Vitest/happy-dom, scoped CSS strings, existing build tools.

**Spec:** docs/superpowers/specs/2026-10-24-full-interface-design.md

## Global Constraints

- Six primary destinations: Главная, Серверы, Правила, Устройства, Диагностика, Настройки.
- Preserve native data-tab IDs, UCI keys/APIs, form.Map dependencies/parsing, unsaved drafts, priority, TLS/DNS/IPv6 and Extended.
- No remote assets, fonts or new UI framework; all new styles scoped to Forkop workspace and marked Forkop modals.
- Controls at least 42px; mobile inputs 16px; focus 2px with 3px offset; existing light/dark token palette.
- No route changes or probes caused by navigation; unknown differs from zero; lazy mount once; suspend hidden telemetry.

## Review Focus

- Native tabs activated externally or restored from storage must synchronize both navigation levels without changing original IDs (Task 1).
- Switching sections must preserve unsaved rule inputs and settings parse guard, including delayed capabilities (Task 1).
- Failed traffic reads or counter resets must not display stale rates as live or invent zero values (Task 2).
- Advanced group navigation must not duplicate requests, forms, profile comparison state or controllers (Task 3).
- Long server names, large quantities, empty lists and slow actions must stay usable in both themes and mobile width (Tasks 2–4).

---

### Task 1: Native workspace and full application visual system

**Files:** Create `fe-app-forkop/src/forkop/workspace/render.ts`, `styles.ts`, `tests/workspace.test.ts`; modify `src/main.ts`, `src/styles.ts`, native `view/forkop/forkop.js`; record `docs/tdd/full-interface-workspace.md`.

**Interfaces:** Produce `mountForkopWorkspace(root: HTMLElement): void`, exported from main. Finds existing native tab menu and panes, wraps native map content without recreating fields. Mappings: home next; servers dashboard/server; rules section; devices devices; diagnostics diagnostic/monitoring; settings settings/updates/advanced. Missing optional tabs are omitted. Native tab links remain activation authorities. Task 3 adds optional devices/advanced sections and extra local destinations using the same mapping.

- [ ] Add failing DOM tests using real inputs/native tab links: primary+secondary activation retains draft value; externally clicked tab synchronizes nav; missing optional pages safe; repeated mount idempotent; status uses actual overview state and unknown default; theme choice applies to whole workspace. Run targeted Vitest and observe RED.
- [ ] Implement workspace, native integration and consistent scoped forms/tables/buttons/modal styling. Do not remove original native menu; hide visually inside workspace and retain activation click/attributes. Ensure observers clean up after detachment and hidden tabs stay hidden.
- [ ] Run targeted and existing native shell tests, full suite; commit only own paths and TDD evidence.

### Task 2: Connection-first overview and readable telemetry

**Files:** Modify `next/render.ts`, `next/traffic.ts`, `next/styles.ts`, tests under `next/tests/`; create metric helper if useful; native `next.js` supplies workspace mode. Record `docs/tdd/full-interface-overview.md`.

**Interfaces:** Keep `renderNextPanel(request?, loadConnections?, adapters?)` and `createTrafficMonitor` public compatibility. Add `workspace?: boolean` in adapters to suppress duplicate standalone theme/advanced controls in native workspace. Render compact real metrics into a semantic definition list; selected primary connection is distinct from additional groups. Actions still use native tab links.

- [ ] Add failing tests for readable 1024/1048576/large quantities, invalid/unknown vs zero; structured metric updates/reset/failure; main selection and secondary routes; pending probe state, target/result and accessible label; workspace omits duplicate controls. Observe RED.
- [ ] Implement new composition: no generic header element susceptible to LuCI chrome, status/primary action and selected server in first row; traffic strip; additional routes and useful links below. Keep existing runtime revision, visibility, no-overlap guards and service/probe semantics. Preserve standalone advanced default.
- [ ] Run overview/traffic/native tests, full suite; commit own paths and TDD evidence.

### Task 3: Focused tools and all advanced destinations

**Files:** Modify `next/advanced.ts`, `next/tools.ts`, native `forkop.js`, `src/main.ts`, optional focused workspace tool module; relevant tests. Record `docs/tdd/full-interface-tools.md`.

**Interfaces:** Extend `renderAdvancedPanel(request?, loadConnections?, lazy?, area?)` with optional area `all | rules | diagnostics | settings | devices`, default all. Keep standalone compatibility. Extend device/profile renderer with area option or separate focused exports. Export `renderWorkspaceTools(area)` from main for native pure DummyValue sections. Add stable tabs `devices`, `rule_tools`, `route_tools`, `advanced`; map rule_tools under rules, route_tools under diagnostics, advanced under settings. Tool rendering lazy once per first activated section, errors offer retry without discarding entered values.

- [ ] Tests first: only relevant panels/reads mounted per area; device page no profiles; profile page no device reads; rules temporary/recommendations remain functional; native page lazy mount once preserves input across navigation; comparison-before-apply and stale preview tests still pass. Observe RED.
- [ ] Group tools without duplicating controllers or LuCI config fields; keep native Dashboard outbound selector and server inbound editor; improve descriptions, empty states, result formatting and field grouping. Keep honest device assignments. Preserve all compatibility/profile/recovery functions.
- [ ] Run focused and full tests; commit own paths and TDD evidence.

### Task 4: Integration, evidence and build

**Files:** Update DESIGN.md, interface documentation, `docs/ACCEPTANCE.md`; create user-facing screenshots/report under workspace outputs, not private data. Build from the final source; do not deploy during development.

**Interfaces:** Consumes Tasks 1–3. No new runtime API. Preview uses synthetic labeled data and actual shipped renderers/native LuCI form classes; it must not pretend to be live router acceptance.

- [ ] Verify all existing and added tests, TypeScript, ESLint, Prettier, native bundle syntax and relevant LuCI fixture checks. Fix only evidence-backed failures with regression tests where behavior changes.
- [ ] Capture desktop/mobile for six sections, one form modal, unknown/error states. Batch material fixes and confirm once. Run Impeccable detector once on final changed UI targets and independent whole-branch review.
- [ ] Build frontend/native bundle and package workflow, inspect actual CI result. Document source commit/package identities and limits. Commit documentation and create reviewable PR with test/visual evidence; attach PR.
