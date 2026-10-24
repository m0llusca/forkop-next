# Verification scope

The 1.2.0 frontend gate passed 913 tests in 90 files, full source
types/lint/format checks, generated LuCI execution smoke and native syntax.
[Task 7](twenty-ux-task-7.md) records exact source/bundle identities and the
F01–F20 matrix. The full Linux backend release gate passed, including 16 Extended
preview and 4 component-impact tests. IPK/APK generation passed in run
`40142529145`, job `121017552548`, for the exact runtime candidate recorded in
Task 7; PR publication was skipped. Published assets require the final
release-tree workflow.
Native browser scope and unmeasured zoom/screen-reader/hardware behavior remain
explicit. Device installation is a separate acceptance step.

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
