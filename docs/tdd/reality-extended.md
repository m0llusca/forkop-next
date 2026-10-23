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

Second native GREEN: 91bee312, Backend CI 40011641800, 218 tests in 22.630
seconds, no failures or skips; all 70 shell suites pass. The ten review
regressions now pass without weakening positive or authentication controls.
The three-version actual-core matrix remains green. Artifact SHA256:
7ce06695f48445569a05af2742570545c7abe14efd4150ac68a6316d7f913cb4.
Independent review of this immutable revision found no remaining concrete
blockers. Frontend and ShellCheck gates pass. Build 40011641786 succeeds;
the downloaded archive contains all six 1.1.4 IPK/APK packages. SHA256:
664e8f237495c35dd58b7f593da86e74b76362638ecb7a946e0b4c62e259f7be.
IPK version, runtime capability manifest, adapter, update code, UI and ACL
payloads match the reviewed source. APK metadata is checked by the build gate.
No router or remote server was modified. Linux amd64 interoperability and
schema/start checks do not establish live Aeza or every-architecture behavior.

## Additional 1.1.4 review

User requested another review after cf611a0d. Independent runtime review found
no new concrete adapter/handshake defect. It confirmed an evidence boundary:
the preflight policy tests use an admitted shell/curl fixture, while actual-core
tests exercise the generated outbound in a minimal native configuration. These
are separate checks, not a full production preflight deployment test.

Independent update review found a missing-marker rollback variant. Upstream
Extended installations can be identified by version without a Forkop variant
marker. Exact runtime restore succeeded, but the service helper deleted the
only managed init when the previous marker was empty. Tests-first eaea1797,
Backend CI 40015874201: 221 tests, one expected assertion failure at the deleted
init; missing-init recreation and failed-recreation controls passed. Artifact:
e453cbc85e8c34355d074e34e76f907fee35577c8e37f9965157a5916f3e8149.

Variant analysis searched all restore_sing_box_service_from_marker callers and
all move_file_to_backup/cronet_touched transitions. Another pre-existing family
sets the library-touched flag before a successful backup; rollback then deletes
an intact library when no backup exists. Package preparation also removes the
managed init before binary backup. Tests-first b37d3b2f inject backup failures
through the actual install entry point, preserve real local files and forbid
package removal/installation before backup completion. This first backup run
(Backend CI 40016226481, 223 tests) stopped before injection because the isolated
ucode fixture forward-referenced local functions. That is a fixture failure,
not backup-bug RED. Corrected dependency order in tests-only 0f926919, removed
the implementation-coupled assertion requiring a particular rollback helper,
and retained all file-preservation and no-package-mutation assertions. Package
restore attempts are now observed too; stable fixtures use stable metadata.
Native backup-bug RED: 0f926919, release gate 40016728161, 223 tests in
23.533 seconds, five failed assertions: compressed rollback deletes old library;
both package forms mutate packages before safe backup; missing-marker init is
deleted; failed binary backup restarts without init. All injections are reached.
Artifact SHA256:
43c009d19d629b8c98b88ce217f277f1d964c7776dbed6bcdd9cd19013a0af92.
Only then implement local-only early recovery and complete package backups before
removal/service replacement. The stable/tiny installer at the fourth touched-flag
match is a false positive for destructive library recovery: its early failure
already restores the binary directly and does not touch the intact library.

An additional compressed-archive variant has no incoming libcronet, but package
removal can still remove the previous runtime's library. Tests-only ab2921c9
requires the existing library to be backed up independently of archive contents,
before any package mutation. Native RED: release gate 40017263140, 224 tests
in 23.631 seconds, six failed assertions. The extra variant reaches old-package
removal without ever attempting the required old-library backup. Artifact:
3f198695602aaffaf7dff4951a5907262ec30a83616d040199622c5e72fec85e.

After this evidence, back up an existing compressed runtime's library regardless
of incoming archive contents. A new local-only backup-failure helper restores
the already moved executable and usable service without package operations;
the intact failed-to-back-up library stays untouched. Complete both package
backups before deleting a service or removing conflicting packages. The test
harness mechanically extracts the new helper before installer callers. No
file-preservation, mutation-boundary or authentication assertion is weakened.
Fresh native GREEN and release packaging are pending.

Independent local archive recheck verified all 54 official cached asset SHA256s
and their extracted executable identities against the packaged manifest (30
unique ELF digests). Both provisioning/checksum helper tests pass on Windows.
No native core or router/VPS service was executed locally.
