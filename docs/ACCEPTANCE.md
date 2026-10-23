# Forkop Next v1 acceptance

This checklist separates development verification from deployment acceptance.
Tests run in isolated localhost-only Linux fixtures using real ucode fs/UCI modules;
the production ASUS router and Aeza VPS are not changed by development checks.
Fresh complete-suite and package-build outcomes are recorded in
[integration evidence](tdd/integration.md). A passing fixture does not certify a
live device, remote server or an untested future core release.

| Requirement | Executable evidence | Acceptance scope |
| --- | --- | --- |
| Existing configuration remains authoritative | Upstream migration, package lifecycle and runtime fixtures; `test_next_profiles.py` | Same `forkop` UCI/service/LuCI namespaces, no implicit reset |
| Validate, apply, restore and recover | `test_next_profiles.py`, `test_native_lifecycle.py` | Profile and native settings changes, invalid input, rejected activation, durable journal, low space, stale digest |
| Profiles with preview/import/export | `test_next_profiles.py`, UI profile scenarios | Export is explicit and contains the configuration's secrets; diff omits values |
| Device and gaming policies | `test_next_policies.py`, `test_policy_generator.py` | Actual UCI changes and generated route targets, store/download domains, optional source-device scope |
| Expiring rules | `test_next_policies.py`, `test_policy_generator.py`, `test_route_explain.py` | Supervised expiry tick; positive expiry removes rules, zero means permanent |
| Explain route separately from network test | `test_route_explain.py`, `test_probe.py` | Unknown remote rules remain indeterminate; explanations do not claim reachability |
| Persistent manual server choice | `test_manual_selection.py` | Identity survives renaming and process restart; automatic selection does not write flash |
| Connection interruption and routing fixes | `test_routing_regressions.py`, upstream DNS/URLTest fixtures | Interrupt setting, source-DNS isolation, URLTest timing/exclusions, elapsed scheduler |
| Bounded parallel latency | `test_parallel_latency.py` | Real local HTTP server verifies overlap, maximum four transfers, request timeouts and JSON-error handling |
| Smart Detect suggestions | `test_smart_detect.py`, `test_next_policies.py` | Opt-in bounded log-candidate scan; repeated failures with alternate success; explicit transactional acceptance only |
| 3x-ui/Xray update awareness | `test_compatibility.py` | Fixed official release endpoints, numeric comparison, bounded transport, unknown on insufficient evidence; no install |
| Current sing-box schemas | `test_compatibility.py` | Real published 1.13.7 and 1.14.3 check generated fixtures; migration preserves download route and source DNS scope |
| Extended REALITY with old/current Xray | `test_extended_reality.py`, `test_extended_reality_generation.py` | Official SHA-pinned Extended 2.7.3, actual generated connections against Xray 26.6.27 / 26.9.30 / 26.10.21, strict certificate/authentication negatives, explicit legacy mode; native Linux amd64 |
| Preserve Extended through updates | `test_extended_update_safety.py` | Verified official release content and exact local runtime rollback; package database registration remains separate |
| Selected-section compatibility preflight | `test_compatibility.py`, `test_probe.py` | Generated mixed listener and outbound association; mismatches blocked, secrets omitted, HTTPS evidence required |
| Usable desktop/mobile UI | Frontend component tests, native LuCI bundle integration and four browser captures | Simple/detailed modes, themes, reconnect states, actionable read failures, narrow screens |
| Verified release inputs | `test_release_download.py` | SDK hashes checked before use; translation tool built from pinned official LuCI commit |

## Deployment acceptance still requires a real target

1. Keep a verified backup/export of the existing router configuration and known
   working packages. Install the release packages matching the target OpenWrt
   package format and check migration without resetting existing policies.
2. Confirm service startup, DNS, IPv4/IPv6, device policies and connection switching
   on the target network. Compare explanation against actual connection evidence.
3. Import only redacted selected 3x-ui inbound metadata, choose the corresponding
   local connection, and run its explicit HTTPS probe. Compare the current server
   core and any proposed upgrade using the same inbound settings and destinations.
4. Exercise rollback on a controlled rejected configuration and verify the previous
   working service returns. Check the opt-in monitor under normal router load.

Compatibility means capabilities plus observed handshake, not a promise based on
version numbers. Stock sing-box cannot be assumed to support every new Xray flow,
transport or encryption feature. Selector/URLTest groups need their selected child
resolved before certification. A successful HTTPS response does not establish
application login or every destination's availability. These limits are detailed in
[compatibility contract](COMPATIBILITY.md).

The new per-device assignment operation currently accepts explicit IPv4 addresses.
Existing IPv6 routing remains supported by the underlying configuration; IPv6
device assignment through this new control needs a separate extension.
