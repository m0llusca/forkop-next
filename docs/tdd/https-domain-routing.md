# Opt-in HTTPS domain routing

Date: 2026-10-25.

`forkop.settings.https_domain_routing` accepts scalar `0` or `1`, defaulting
to `0` when absent. With `1`, one inet prerouting rule marks TCP/443 arriving
on the configured source interfaces for the existing tproxy inbound. DNAT,
local IPv4/IPv6 and ordered priority rules run first. Explicit bypass uses
`accept` in the priority chain, terminating that evaluation before capture.
Existing sing-box sniffing and routing choose the outbound; this flag does not
select or change Main or force a proxy route.

The appended optional argument 18 of `nft-create-runtime-base` exposes the flag
without changing existing argument positions. The UCI wrapper reads it with
default `0`. Both nft fingerprint builders include the normalized flag, so a
toggle changes the reload decision; absent and explicit `0` agree.

## Behavioral regression fixture

Run `sh tests/https_domain_routing.sh` with native ucode and its fs module.
The fixture executes production nft, service-state and configuration-validator
entry points. Only external nft/logger calls are mocked; unexpected ip, sysctl,
service, ubus or uci calls fail. Configuration comes from temporary fixture files.

Checks cover:

- Omitted and explicit-off settings generate identical runtime commands.
- Enabled mode adds exactly one LAN TCP/443 inet rule after DNAT, both local
  guards and the priority-chain jump. Other commands are identical, including
  UDP, other ports, output rules and existing outbound-mark loop protection.
- Both IPv4 and IPv6 TCP tproxy consumers remain, with no address-family filter
  on the new capture rule. IPv4/IPv6 explicit bypass keeps its terminating verdict.
- Apply and service-state fingerprints agree; enabling changes the fingerprint.
- The validator accepts absent/`0`/`1` and rejects invalid strings and list values.
- Original CLI arity stays disabled; the trailing opt-in argument matches UCI.

## RED to GREEN

Native execution used an isolated temporary source tree with network/service
commands mocked. No firewall or routing configuration was applied.

- RED, before production edits: archive SHA-256
  `8e4e16a1de49b2671ec7ad0ff0fe982faf706db7a3b3b18bdf54a0f7b373bf82`.
  `sh tests/https_domain_routing.sh` exited `1` with
  `FAIL: enabled LAN TCP443 capture is missing`.
- GREEN, with the minimal implementation: archive SHA-256
  `5b695b83cce73789f2804e4d35856482f2e88d557d85b4d079bbce68b8fc92af`.
  The same native invocation exited `0` with
  `HTTPS domain routing checks passed`.
- Local shell syntax checks of this fixture and `tests/nft_apply.sh` passed;
  `git diff --check` passed. The three explicit nft signature expectations in
  `tests/nft_apply.sh` were updated for the default-off fingerprint field.

The full Linux backend suite and package CI remain integration checks. This
fixture verifies command generation and validation, not live packet routing or
application acceptance. Enabling this mode increases the TCP/443 traffic handled
by sing-box; live resource use and cached-public-IP/direct/bypass/block acceptance
belong to deployment validation.
