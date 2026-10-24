# Forkop Next 1.2.0 acceptance

This checklist separates development verification from deployment acceptance.
Tests run in isolated localhost-only Linux fixtures using real ucode fs/UCI modules;
target routers and remote servers are not changed by development checks.
Fresh complete-suite and package-build outcomes are recorded in
[verification scope](tdd/README.md). A passing fixture does not certify a
live device, remote server or an untested future core release.

## F01–F20 integration gate

All twenty source changes are integrated. The item-by-item mapping to behavioral
tests and observed synthetic browser checks is maintained in
[Task 7's matrix](tdd/twenty-ux-task-7.md). Checkpoint browser observations belong
to their named revisions; they do not certify the final 1.2.0 bundle.

The complete frontend gate passed **912 tests in 89 files**, with types/lint/format,
native syntax, regenerated bundle and its execution smoke at the exact basis
recorded in [Task 7](tdd/twenty-ux-task-7.md). Independent whole-branch review,
integrated Linux backend/package CI and remaining final browser scenarios remain **pending**.
Release and device installation follow only after these gates. No final-device
performance, screen-reader result or deployment is claimed by the source work.

The final browser pass must exercise the generated shipped renderer and native
LuCI forms in light/dark themes, widths 320/390/430 and desktop, 200% zoom,
long/error/unknown states, exact rule navigation and all six source editors.
The final native checkpoint confirmed desktop light/dark, all six source editors,
exact rule navigation, masked-error export blocking, draft/reorder/Reset semantics,
large-list search and untouched Extended main preview. The matrix records tested
mobile surfaces, the untested Servers destination at 320, pending nested-child
preview and unavailable actual 200% zoom. Screen-reader/performance results are
not claimed.

Check draft protection and remaining UCI reorder after Reset, clipboard/manual
fallback, current-context evidence, large-list search, Extended draft composition,
component impact and symptom flows without a navigation-triggered mutation/probe.

| Requirement                                  | Executable evidence                                                                                                        | Acceptance scope                                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing configuration remains authoritative | Upstream migration, package lifecycle and runtime fixtures; `test_next_profiles.py`                                        | Same `forkop` UCI/service/LuCI namespaces, no implicit reset                                                                                                                                         |
| Validate, apply, restore and recover         | `test_next_profiles.py`, `test_native_lifecycle.py`                                                                        | Profile and native settings changes, invalid input, rejected activation, durable journal, low space, stale digest                                                                                    |
| Profiles with preview/import/export          | `test_next_profiles.py`, UI profile scenarios                                                                              | Export is explicit and contains the configuration's secrets; diff omits values                                                                                                                       |
| Device and gaming policies                   | `test_next_policies.py`, `test_policy_generator.py`                                                                        | Actual UCI changes and generated route targets, store/download domains, optional source-device scope                                                                                                 |
| Expiring rules                               | `test_next_policies.py`, `test_policy_generator.py`, `test_route_explain.py`                                               | Supervised expiry tick; positive expiry removes rules, zero means permanent                                                                                                                          |
| Explain route separately from network test   | `test_route_explain.py`, `test_probe.py`                                                                                   | Unknown remote rules remain indeterminate; explanations do not claim reachability                                                                                                                    |
| Persistent manual server choice              | `test_manual_selection.py`                                                                                                 | Identity survives renaming and process restart; automatic selection does not write flash                                                                                                             |
| Connection interruption and routing fixes    | `test_routing_regressions.py`, upstream DNS/URLTest fixtures                                                               | Interrupt setting, source-DNS isolation, URLTest timing/exclusions, elapsed scheduler                                                                                                                |
| TProxy routing guards                        | `test_network_rule_guards.py`                                                                                              | Mark/table on the same universal rule; exact IPv4/IPv6 default route and loopback interface, with external ip command fixtures                                                                       |
| Share-link TLS intent                        | `test_manual_tls_guards.py`                                                                                                | Trojan default TLS, known mode normalization, unknown-node rejection, SNI intent and deliberate explicit none across manual/subscription inputs                                                      |
| Bounded parallel latency                     | `test_parallel_latency.py`                                                                                                 | Real local HTTP server verifies overlap, maximum four transfers, request timeouts and JSON-error handling                                                                                            |
| Smart Detect suggestions                     | `test_smart_detect.py`, `test_next_policies.py`                                                                            | Opt-in bounded log-candidate scan; repeated failures with alternate success; explicit transactional acceptance only                                                                                  |
| 3x-ui/Xray update awareness                  | `test_compatibility.py`                                                                                                    | Fixed official release endpoints, numeric comparison, bounded transport, unknown on insufficient evidence; no install                                                                                |
| Current sing-box schemas                     | `test_compatibility.py`                                                                                                    | Real published 1.13.7 and 1.14.3 check generated fixtures; migration preserves download route and source DNS scope                                                                                   |
| Extended REALITY with old/current Xray       | `test_extended_reality.py`, `test_extended_reality_generation.py`                                                          | Official SHA-pinned Extended 2.7.3, actual generated connections against Xray 26.6.27 / 26.9.30 / 26.10.21, strict certificate/authentication negatives, explicit legacy mode; native Linux amd64    |
| Preserve Extended through updates            | `test_extended_update_safety.py`                                                                                           | Verified official release content and exact local runtime rollback; package database registration remains separate                                                                                   |
| Selected-section compatibility preflight     | `test_compatibility.py`, `test_probe.py`                                                                                   | Generated mixed listener and outbound association; mismatches blocked, secrets omitted, HTTPS evidence required                                                                                      |
| Six-section desktop/mobile workspace         | Frontend component tests, native LuCI Map/Grid/Value fixture, executed native bundle and labeled synthetic browser preview | Draft retention, native save/reset and validation locations, lazy focused tools, theme scoping, outgoing selection, readable metrics, stale-reply rejection; real-device acceptance remains separate |
| Verified release inputs                      | `test_release_download.py`                                                                                                 | SDK hashes checked before use; translation tool built from pinned official LuCI commit                                                                                                               |

## Deployment acceptance still requires a real target

1. Keep a verified backup/export of the existing router configuration and known
   working packages. Install the release packages matching the target OpenWrt
   package format and check migration without resetting existing policies.
   Before network-affecting installation, verify an independent recovery path
   and arm a delayed rollback that does not depend on the active UI/session.
2. Confirm service startup, DNS, IPv4/IPv6, device policies and connection switching
   on the target network. Compare explanation against actual connection evidence.
3. Import only redacted selected 3x-ui inbound metadata, choose the corresponding
   local connection, and run its explicit HTTPS probe. Compare the current server
   core and any proposed upgrade using the same inbound settings and destinations.
4. Exercise rollback on a controlled rejected configuration and verify the previous
   working service returns. Check the opt-in monitor under normal router load.
   Disarm the independent rollback only after observing healthy access, service,
   DNS and representative network/UI checks. Retain deployment evidence and
   backups privately; do not publish endpoints, credentials or device identity.

Compatibility means capabilities plus observed handshake, not a promise based on
version numbers. Stock sing-box cannot be assumed to support every new Xray flow,
transport or encryption feature. Selector/URLTest groups need their selected child
resolved before certification. A successful HTTPS response does not establish
application login or every destination's availability. These limits are detailed in
[compatibility contract](COMPATIBILITY.md).

The new per-device assignment operation currently accepts explicit IPv4 addresses.
Existing IPv6 routing remains supported by the underlying configuration; IPv6
device assignment through this new control needs a separate extension.
