# REALITY Extended Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Restore REALITY with fresh Xray while retaining Extended and older-server compatibility.
**Architecture:** Reuse the pinned upstream Extended hybrid key-share correction. Couple generated flags to verified runtime capabilities; preserve selected-outbound probe and legacy opt-out. Xray stays reserve only.
**Tech Stack:** ucode, Python unittest, official Linux core binaries, GitHub Actions, existing OpenWrt packaging.
**Spec:** docs/superpowers/specs/2026-10-23-reality-extended-design.md

## Global Constraints

- TDD: observe behavioral failure before every product behavior change.
- Fixtures only; no live router/VPS changes or exposed chat credentials.
- Preserve Extended, IPv6, DNS isolation, TLS validation and existing namespaces.
- Reuse isolated task clone; primary owns publication and version/package files.
- Fixed official release URLs and verified SHA256; no unverified custom binaries.

## Review Focus

- Stock and unknown cores must not receive an unsupported Extended JSON field.
- An explicit legacy flag or fingerprint must not be silently rewritten.
- Subscription and manual paths must yield the same effective capability.
- A displayed version or successful unrelated HTTP request must not forge certification.
- A component update must not silently remove a required working capability.

### Task 1: Native Extended interoperability harness

**Files:** tools/provision-test-cores.py; tests/backend/test_extended_reality.py.
**Interfaces:** consume existing actual generator and loopback TLS/core fixture helpers; expose pinned official Extended and older Xray paths for required-mode CI.

- [ ] Add fixed archives/digests and bounded exact-member extraction for Extended and two older Xray versions; exercise checksum mismatch without writes.
- [ ] Add generated REALITY positive tests against three Xray versions, hybrid-off negative control, strict CA and authentication negatives, and Extended schema preservation checks.
- [ ] Publish test-first baseline through existing draft PR; run native CI and inspect exact expected generator/handshake failures.

### Task 2: Generator and preflight capability adapter

**Files:** forkop/files/usr/lib/singbox/compatibility.uc or focused adjacent module; generator/subscription output paths; service/compatibility.uc; focused backend tests.
**Interfaces:** shared pure admitted-core/fingerprint predicate and outbound transformation, used for generated and imported outbounds. Existing compatibility response envelope stays unchanged.

- [ ] Write and observe failed tests for admitted Extended hybrid generation, stock/unknown exclusion, explicit false preservation and consistent imported/manual paths.
- [ ] Implement minimal opt-in/out adaptation and evidence-based preflight allowance for exact validated versions/configurations.
- [ ] Run focused native suites, then all backend and shell checks; fix root causes, preserving RED artifacts.
- [ ] Inspect installer/update behavior; add a reproduced safeguard if needed to preserve hybrid-enabled Extended configurations.

### Task 3: Independent review and release

**Files:** VERSION, README.md, docs/COMPATIBILITY.md, docs/PROVENANCE.md, docs/tdd/reality-extended.md; workflow only if required-mode coverage needs it.

- [ ] Independent review of immutable patch, schema choices, negative controls and update behavior; resolve concrete findings with TDD.
- [ ] Record pinned upstream correction, exact success matrix and unsupported combinations; prepare next candidate version.
- [ ] Publish to existing PR, await complete backend/frontend/shell/build gates.
- [ ] Download six packages, verify SHA256/version/runtime payloads, save source archive and manifest under current outputs, update PR evidence.
