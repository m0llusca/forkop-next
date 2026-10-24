# Verification scope

The prepared 1.2.0 frontend gate passed 910 tests in 88 files, full source
types/lint/format checks, generated LuCI execution smoke and native syntax.
[Task 7](twenty-ux-task-7.md) records exact source/bundle identities and the
F01–F20 matrix. Final integrated backend/package CI, whole-branch review,
browser acceptance and device installation are still separate pending gates.

Forkop Next 1.1.4 has behavioral regression coverage for configuration transactions,
recovery, routing explanations, TLS intent, network guards, core updates and UI.
The preceding release verification passed 243 backend tests without skips,
70 shell suites and 594 frontend tests in 56 files. A new source revision must
rerun its own gates; these counts are not a substitute for a fresh successful run.

Official checksum-pinned Linux amd64 cores exercise real REALITY/Vision HTTPS
transfers against Xray 26.6.27, 26.9.30 and 26.10.21, plus authentication and
certificate rejection controls. XHTTP/Encryption tests cover schema/start only.
Kernel routing fixtures, preflight checks and core transfers are separate tests.
See ../COMPATIBILITY.md and ../ACCEPTANCE.md for the bounded evidence.

New behavior changes require a test-first RED/GREEN record here, with commands,
observed failures and verified success. Use synthetic/redacted fixtures only;
never record real deployment addresses, credentials, device names or backups.
