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

Candidate 6066ab4d, build run 40005035881: all 20 current-schema/preflight
methods pass, as do prior backend tests and TLS/Vision. One of 188 tests fails:
the new Xray-to-Xray REALITY control times out before the cover responds.
Artifact SHA256 b6231470e39c3a9738a32bd0e49cb452739c6293f73733a78963c8ea3cd108b2.
This is not treated as a passing build or ignored expected failure.

Pinned REALITY `record_detect.go` starts six concurrent target-probe connections;
the single-connection OpenSSL cover serializes them. Replace only that fixture
with a threaded TLS 1.3 cover and assert that an idle raw socket cannot block
a second strictly verified TLS handshake. REALITY also initializes record
detection asynchronously (up to five seconds): use a bounded authenticated
transfer readiness check before the original single positive assertion. All
attempts are logged; per-request timeouts and TLS/authentication controls remain
unchanged. Each stock client's rejection must appear in its own fresh server-log
range, excluding errors from earlier clients and controls.

GREEN: ebed05268daebd20f27d68782b8dd126845eb663, native build release gate
40005681722: **188 Python tests in 12.150 seconds, OK; all 70 shell suites
pass; no skips**. Normal and strict ucode compilation pass. Both published
sing-box schema checks execute. TLS/Vision exact-payload transfers through both
stock clients pass, with wrong-UUID and strict certificate rejection controls.
The same-version Xray REALITY positive control succeeds against the same
server/cover/keys/target; each stock client is then rejected in its own fresh log
range. This establishes the observed incompatibility; the hybrid-key mechanism
is supported by the pinned implementation sources, not a packet-capture claim.
Downloaded native artifact SHA256:
d02af5f5098bb6b5cfa30b62dd6fb5a9a8e090ee7e37815cd37c13dbba82ec59.
The frontend release gate also passes formatting, lint, 594 tests and build.
Final archive/metadata verification is reported with the downloaded artifacts.

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
