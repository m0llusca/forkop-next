# Current-core compatibility audit (2026-10-23)

Baseline: version 1.1.2, commit 271c38c7. No router or VPS changes.
Native Linux checks run in GitHub Actions; local Windows cannot execute ucode.

## Test-first evidence

Tests-only commit 78063572, Backend CI run 40002513467:
176 tests, 18 failed assertions. The nine new compatibility methods reproduced
panel JSON-string parsing, selected-client flow ambiguity, invalid metadata,
transport aliases, removed transports, REALITY transport restrictions and wrong
same-port inbound association. The nonterminal route-options control passed.

Tests-only commit 9a9a8978, Backend CI run 40003408891:
183 tests, 42 failed assertions (including finite subcases). Six additional
methods reproduced transport case/method precedence, REALITY byte-equivalent
short IDs, invalid IDs, Vision transport and TLS-version restrictions.
These are native service assertions, not assertions about source text.

Both runs preserve backend logs as Actions artifacts. SHA256:

- First RED: d5bc98448a12360571134548116d272f07c38fdffbcb68527093ee06ab42a886
- Second RED: 2e2746aeb2a675c106867bf6e37b259d629bcb86f5b03882858ee5a6cf6677c7

## Real-core evidence

The provisioner downloads fixed official release assets and verifies SHA256 before
extracting executables: Xray 26.10.21 and sing-box 1.13.7 / 1.14.3.
The integration test runs actual generated Forkop VLESS outbounds, actual cores,
a loopback TLS 1.3 HTTPS fixture with a random response, and curl with strict CA
verification. Missing tools/cores fail release CI rather than silently skipping.

The first run exposed test-fixture mistakes: the current key command emits
`Password (PublicKey):`; Xray now blocks private target IPs by default. The fixture
allows only its exact loopback target and port, followed by a deny rule. Production
server policies are unchanged. A unit test covers the actual key-output format.

The second run passed TLS/Vision through both sing-box versions, including wrong
UUID rejection and untrusted destination certificate rejection (curl 60).
REALITY failed on both stock clients. This is a real inter-core incompatibility:
Xray's pinned REALITY dependency requires an X25519MLKEM768 key share, while both
pinned sing-box clients explicitly strip that share. The resulting cover-site
certificate rejection must not be bypassed. See COMPATIBILITY.md for source links.

Further guard RED/GREEN evidence and final full-suite results are recorded after
the corresponding native runs, not inferred from the patch.

Commit be26da4d, native Backend CI 40004674651: 188 tests, 17 failed
assertions. All original 15 current-schema methods now pass; the TLS/Vision
control remains green. Newly added guard tests fail as intended: known stock
REALITY clients were wrongly certified (four version subcases), unknown/Extended
clients lacked capability evidence, an explicit empty method fell back to network,
and five non-string short-ID values became the valid empty ID. The two original
REALITY success assertions still fail against actual cores. Artifact SHA256:
f50452aefba520ad837a78ecb904af2c29199dfefe4afc158dd4cc6674bea582.

Only after these failures were observed, add the pinned REALITY capability guard,
preserve typed short IDs until validation, and honor explicit method presence.
Replace the incorrect universal REALITY-success expectation with an honest
incompatibility characterization that requires a same-Xray positive control
through the exact same server/keys/cover/target before checking stock rejection.

## Additional review skills

Installed from pinned primary repositories: Trail of Bits property-based-testing
and post-patch-validation (196a9073ab10d35bacf111f945e02c00b2c6883a), and Sentry
code-simplifier (f57ada2d0b640406ea7e25b11d636c530e77c58b).
The representation and short-ID matrices are deterministic generated invariants;
no randomized fuzzing or Hypothesis run is claimed. No dependency was added.
Post-patch validation also compared the previous ACL fix against its vulnerable
parent using a runtime JSON authorization model; this does not execute rpcd.
The simplification review avoided global caches that would weaken freshness and
retained bounded download/digest checks. No speedup is claimed without a benchmark.
