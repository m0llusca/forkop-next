# HTTPS Domain Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close cached-public-IP bypass and install a complete corrected 1.2.1 revision while retaining Main and Extended.

**Architecture:** Opt-in LAN TCP/443 interception feeds the existing sing-box sniff and routing policy after local/DNAT/priority exceptions. Maintenance restart preserves DNS forwarding while the runtime is replaced. Deployment retains independent recovery.

**Tech Stack:** OpenWrt, ucode, nftables, sing-box, native LuCI JavaScript, TypeScript/Vitest, shell/Python test fixtures, APK/IPK.

**Spec:** `docs/superpowers/specs/2026-10-25-https-domain-routing-design.md`

## Global Constraints

- UCI flag `forkop.settings.https_domain_routing`, default `0`; live enable `1` is authorized for the whole home LAN.
- Capture only LAN TCP/443; keep IPv4/IPv6, local access, DNAT and priority exceptions, existing outbound decisions and direct final behavior.
- Preserve all existing Main domains/order/duplicates, lists, other rules and selected servers. No private data in public artifacts.
- TDD RED before runtime changes; meaningful native checks and full CI before installation.
- Corrected 1.2.1 revision must have distinct package/release identity. Never silently overwrite old artifacts.
- Fresh verified off-router backup, independent timer/boot recovery, registered worker, atomic decision; no end-of-turn active guard.

## Review Focus

- Explicit bypass must terminate capture before the new fallback; test ordered rules and a bypass traffic scenario.
- Disabled/missing/invalid flags must not widen interception; test default and input rejection.
- Both IP families and router-originated/local traffic must retain their scope; test each boundary.
- DNS listener failure must recover safely without changing normal explicit Stop; test restart failure and ordinary Stop independently.
- An unchanged UCI list is insufficient: verify actual cached-IP traffic, selected outbound, unrelated direct traffic and app WebSocket after restart.

### Task 1: Runtime HTTPS interception

**Files:** Modify `forkop/files/usr/lib/nft/apply.uc`, `config/validator.uc`, `service/state.uc`; tests `tests/nft_apply.sh` and a focused backend behavioral test; evidence `docs/tdd/https-domain-routing.md`.

**Interfaces:** Consumes existing nft source-interface/local/priority sets and existing sniff inbounds. Produces `https_domain_routing` flag handling and reload fingerprint; no new outbound or forced default proxy.

- [ ] Write failing tests for enabled IPv4/IPv6 TCP443 capture, disabled default, local/DNAT/priority bypass ordering, LAN-only scope and reload fingerprint.
- [ ] Run focused tests and record RED caused by missing behavior.
- [ ] Add minimal capture rules after priority guards, boolean validation and nft fingerprint input.
- [ ] Run focused/native checks to GREEN, review and commit only owned files.

### Task 2: LuCI control and documentation

**Files:** Modify native `settings.js`, frontend native-view test(s), translation source as required, `docs/API.md`, README user guidance.

**Interfaces:** Consumes Task 1 boolean. Produces visible opt-in setting explaining preserved routing policy and additional CPU cost.

- [ ] Write and run a failing behavior test for the flag binding/default/help and absence of edits to Main.
- [ ] Add the native form control using existing settings layout, retaining Extended.
- [ ] Run frontend tests/build and verify packaged native resources include the control; review and commit.

### Task 3: Maintenance DNS contract

**Files:** Modify `service/lifecycle.uc` and package lifecycle only where required; tests `tests/backend/test_native_lifecycle.py`, `tests/package_lifecycle_upgrade.sh` and focused restart fixtures.

**Interfaces:** Ordinary Stop restores ordinary DNS; maintenance restart preserves forwarding and selector/FakeIP state. Coordinate the installation worker with the maintenance path.

- [ ] Write RED tests tracing DNS restoration order for restart/upgrade vs ordinary Stop, plus failure recovery.
- [ ] Implement the minimal maintenance path, preserving existing rollback/transaction ownership.
- [ ] Verify native restart/failure/selection tests and package lifecycle; review and commit.

### Task 4: Corrected package revision and release verification

**Files:** Build/version validation, recipes/workflow and build tests only as needed; release notes/provenance.

**Interfaces:** Produce a distinct corrected revision of 1.2.1 accepted by OpenWrt APK and IPK, with source SHA and six package hashes.

- [ ] Pin the supported revision syntax with RED tests before changing validators.
- [ ] Update only required build/version paths; run all frontend/backend gates and independent whole-branch review.
- [ ] Publish the verified source/PR and build artifacts through authorized GitHub access; attach PR. Verify final source and package identities.

### Task 5: Protected live acceptance and install

**Files:** Private deployment scripts and reports outside this repository.

- [ ] Snapshot current complete state and Main, verify fresh recovery off-router and independently review frozen guards.
- [ ] Install full corrected packages, enable only the approved flag, and retain all other UCI values/selector choices.
- [ ] Repeat observed-public-IP vs fresh-DNS probes, verify Main/outbound, unrelated direct/bypass/block, IPv4/IPv6 and local UI.
- [ ] Exercise restart/reload; check actual Codex initialized WebSocket/rendezvous and bounded resource/load measurements.
- [ ] Confirm only on acceptance; otherwise recover. Save report and screenshot with no active unexpected rollback.
