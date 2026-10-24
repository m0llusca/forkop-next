# Intuitive Forkop workflows implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Follow the TDD steps below.

**Goal:** Make every existing workspace destination understandable, especially rule scope and routing, without changing networking behavior.

**Architecture:** Continue the user-approved six-section workspace and its existing native LuCI map. Add display-only rule summaries, task explanations, native field grouping and readable tool output. Native option objects, field nodes, dependencies and parsing remain authoritative.

**Tech Stack:** TypeScript, native LuCI JavaScript, Vitest/happy-dom, existing bundled CSS.

**Spec:** `docs/superpowers/specs/2026-10-24-full-interface-design.md`. This is its copy/grouping/local-helper refinement requested by the user after live installation, not a replacement visual direction.

## Global constraints

- Preserve all six connection sources, Extended, routing order, DNS, IPv6, TLS and existing UCI keys.
- No automatic probes, saves, route changes or remote assets on navigation.
- Preserve draft nodes and reveal validation errors inside collapsed groups.
- Do not expose proxy credentials or full subscription URLs in summary text.
- Work on the feature branch; verify source, tests and build before integration. Router installation requires a fresh independent backup/rollback.

## Review focus

- Unknown/legacy rule actions remain distinguishable; summaries must not promise unverified routing scope.
- Mixed include/exclude/device/list conditions retain their meaning and full editor access.
- Grouping preserves field identity, dependencies, conditional visibility and hidden-value parsing.
- Long localized names, empty states, keyboard operation and mobile widths remain usable.
- Async tool refresh and output masking retain their existing correctness guards.

### Task 1: Explain rules at a glance

Files: `section.js`, `forkop.js`, a focused `workspace/rules.ts` presentation helper and its tests; exports in `src/main.ts`; synchronized Russian catalogs.

- [x] Add behavioral tests for readable actions, match/source summaries, disabled/unknown/empty states and secret-safe summaries; run RED.
- [x] Implement display-only helper and native grid integration; retain every modal option and native row action.
- [x] Localize actions consistently between grid/editor and rename user-facing section terminology to rules; run GREEN.

### Task 2: Guide native forms and workspace destinations

Files: `workspace/formGuide.ts`, `workspace/render.ts`, `workspace/styles.ts`, focused DOM tests.

- [x] Add behavioral tests for task descriptions, semantic native form groups, unchanged field nodes/drafts and error auto-expansion; run RED.
- [x] Implement scoped headings/disclosure groups with an explicit advanced summary. Keep connection source types findable, preserve native IDs and dependencies.
- [x] Reduce excessive native table action wrapping/vertical spacing; keep touch targets and responsive labeled rows; run GREEN.

### Task 3: Make tool results understandable

Files: `next/advanced.ts`, `next/tools.ts`, `next/compatibility.ts`, focused renderer tests.

- [x] Test configured labels in route explanations, temporary rules and device assignments; test meaningful empty/status text and embedded mode without repeated versions/headings; run RED.
- [x] Implement only the observed copy/output gaps, preserving raw diagnostics via existing detail access; run GREEN.

### Task 4: Verify and review

- [x] Baseline: 721 tests in 71 frontend suites passed.
- [x] Capture six areas and the native rule editor on a synthetic native-LuCI preview. User's live screenshot also grounds the rules problem.
- [x] Run complete frontend tests, types/lint/format/build, native localization and relevant shell checks.
- [x] One batched desktop/mobile visual inspection, one bounded correction/confirmation pass if needed. Clearly label synthetic data.
- [x] Independent whole-branch review, repair demonstrated defects with TDD, record results and feature coverage in docs/tdd and docs/INTERFACE.md.
- [x] Commit reviewable source and provide the working preview; do not claim router installation from preview tests.
