# REALITY Extended execution ledger

Baseline: f74ab56ff5be0d28b86e191a0581d3fae88ca4ea, version 1.1.3;
all four native workflows green, 188 backend tests, 70 shell suites, 594 frontend
tests. Dedicated task clone is clean. Reuse it; no unrelated Atlas files touched.

Ruling: use the existing upstream Extended hybrid correction before adding a new
crypto patch. Evidence: upstream exposes support_x25519mlkem768; this preserves
Extended and reduces maintenance. Cost if insufficient: add a source patch only
after native failure identifies the missing behavior.

Ruling: user approval of the selected architecture and instruction to implement
authorize execution of the concrete plan without another approval round.
Implementation evidence is appended after observed runs, not inferred from code.

Native RED: 7254d57f, release gate run 40009525457, 209 Python tests,
19 failed assertions including subcases. Three generator input paths lack the
hybrid flag; trusted preflight remains unknown. Installer tests reproduce missing
digest/URL admission, corrupt archive processing, mutable-latest rollback and
ignored library-restore failure. The valid-archive control passes. Original
backend tests remain green; 70 shell suites and frontend gate pass.
Saved artifact SHA256:
86eb81261335a1236f8e769f86d4e462fd1785e87d5a52cc541e8ac971d6da57.

Actual Extended current-Xray positive transfer fails with hybrid absent, while
explicit hybrid-off rejection, XHTTP schema and VLESS Encryption schema controls
pass. Older-Xray positive tests initially stop at the Xray-to-Xray fixture
control: their freedom outbound also blocks private targets. Pinned old sources
support finalRules; apply the same exact TCP 127.0.0.1/32 HTTPS-port allow plus
block-all fixture rule to all three releases. This fixture failure does not
establish old-core incompatibility. All negative/authentication controls remain.

First native GREEN: ee74ff0f, Backend CI 40010332390, 209 tests in 23.249
seconds, no failures/skips; all 70 shell suites pass. Official Extended completes
random strict-HTTPS transfers through Xray 26.6.27, 26.9.30 and 26.10.21, rejects
wrong UUID/public key/short ID and untrusted target certificates. Legacy false
works with 26.6.27; current hybrid-off rejection remains. XHTTP and VLESS
Encryption generated schema/start checks pass. Artifact SHA256:
7bdb0ae3c1e17796b7ddd0f3155540de4999dea8ee67d1b8ed7002854fd8ab3b.

Independent review found two remaining update/rollback gaps: an unadmitted future
Extended could remove automatic hybrid generation, and package-to-compressed late
rollback could lose its only service script. Add behavioral regressions before
fixing them. Also extend the exact known-hybrid server profile to tested 26.9.30.

Ruling: capability/fingerprint admission is scoped to known hybrid-required
server releases, 26.9.30 and 26.10.21. Preserve older 26.6.27 legacy probe behavior;
do not impose an unrelated blanket fingerprint ban on older working servers.

Second native RED: 41aa8c8b, Backend CI 40011087401, 218 tests in 25.886
seconds, 10 failed assertions. Five 26.9.30 preflight negatives incorrectly say
verified. Unadmitted compressed replacement reaches service stop; package
replacement executes and starts. Late rollback loses the only init script;
both rollback forms ignore failed service recreation. All new positive controls
and actual core transfer/authentication tests pass, including hybrid-disabled
rejection against both hybrid-required releases. Artifact SHA256:
f0c93be6fee73a1f8c640dfa46362284062526c9bf1a642707b5753e6214839c.

Only after observing those failures, extend the exact server guard, preserve an
admitted current core's capability by checking the replacement ELF before
execution/activation (compressed before service stop, package with exact runtime
rollback on rejection), retain usable service scripts and propagate recreation
failure. No assertion is relaxed; installer fixture changes only expose the new
lazy adapter helper to its isolated native-function harness.
