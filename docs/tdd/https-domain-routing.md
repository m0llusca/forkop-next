# Opt-in HTTPS domain routing

Date: 2026-10-25.

`forkop.settings.https_domain_routing` accepts scalar `0` or `1`, defaulting
to `0` when absent. With `1`, an inet `https_prerouting` hook at priority `-99`
captures TCP/443 from the configured source interfaces for the existing tproxy
inbound. This runs after standard first-packet DNAT at `-100`, unlike the legacy
mangle hook at `-149`. The late hook excludes DNAT, local IPv4/IPv6 ranges,
router-owned public addresses (`fib daddr type local`), existing tproxy marks and
the outbound loop mark. It rechecks ordered priority rules: an `accept` in the
earlier mangle hook does not skip a subsequent base hook. Its own IPv4 and IPv6
TCP tproxy consumers handle the newly marked packets without moving legacy hooks.
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
- Enabled mode adds only the late HTTPS chain, with DNAT, both local guards,
  router ownership, mark guards and a repeated priority-chain jump. Legacy
  commands are identical, including
  UDP, other ports, output rules and existing outbound-mark loop protection.
- Both legacy IPv4/IPv6 tproxy consumers remain and new TCP consumers run in the
  late chain. IPv4/IPv6 explicit bypass keeps its terminating verdict in both hooks.
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

## Review correction: first-packet DNAT

Independent review found that the original capture rule at `-149` ran before
standard DNAT. The within-chain DNAT guard could not yet identify a new forwarded
connection. The initial GREEN above did not cover that cross-hook behavior.

The focused fixture now runs `tests/helpers/https_packet_path.uc` against the
generated commands. This bounded model orders the emitted prerouting hooks,
inserts the first-packet DNAT event at `-100`, and applies rule matching, jumps,
terminating verdicts, marks and tproxy actions. Unsupported reached expressions
fail. Destinations are abstract labels with explicit set membership and FIB
ownership inputs; it does not implement CIDR classification or kernel sockets.
It covers IPv4/IPv6 DNAT, ordinary HTTPS, local/router-owned destinations, source
LAN scope, UDP/other ports, loop marks, already proxied flows and bypass across
base hooks. The test helper's initial function-binding error was corrected before
production edits; that error is not counted as behavioral RED.

- Behavioral RED against the first implementation: native fixture archive
  `c2d17da73f88ae5a660b13722adcd5f154b4cd006f29feae595fd43cc6b902fb`,
  exit `1`: `FAIL: first-packet hairpin DNAT IPv4: expected 0 captures, got 1`.
- GREEN after moving only the new path to `-99`: native fixture archive
  `d96b4d742a59278dec0854ecf20f90e12cc53e16df6af26fe2b5851f484ca312`,
  exit `0`: `HTTPS packet-path model checks passed` twice, followed by
  `HTTPS domain routing checks passed`. The tested generator, shell fixture and
  model SHA-256 values were compared with the final source files and matched.
- Actual kernel syntax validation also passed: generated commands were captured
  into a script with a unique table name and checked with `nft --check -f`.
  Output: `NATIVE_KERNEL_NFT_DRY_RUN_PASSED_NO_LIVE_TABLE_CREATED`. The table was
  absent before and after the dry run, and the live configuration hash was unchanged.

The router ownership guard requires the generic nft FIB kernel support
(`kmod-nft-fib` on OpenWrt); packaging must include it. The rule runs after standard
dstnat; custom DNAT hooks placed later than `-99` are outside this ordering model.
The relevant reference is [nftables hook priorities](https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks).

## Native control and localization integration

The native settings tests verify the flag's UCI binding, default and network
panel placement without adding a Main writer. Three focused assertions first
failed and then passed; the complete frontend suite passed with 918 tests.
The integrated backend gate then caught an unsynchronized source Russian
catalog. `tests/luci_localization.sh` reproduced that failure locally; copying
the new native strings into the matching source PO/POT restored the gate.
