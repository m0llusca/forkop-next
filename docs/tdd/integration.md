# Integration TDD and execution evidence

Tests run in a localhost-only, diskless Alpine 3.22.2 QEMU VM. The production router
and Aeza VPS are not modified by tests. Every invocation uses a separate repository
snapshot. Runtime is ucode v0.0.20250529 with real fs and UCI modules. UCI revision:
74f6277aabffc943d026f406df57c22595134c42. Windows toolchain remains inside work/.

## Smart Detect
`python3 -m unittest discover -s tests/backend -p test_smart_detect.py -v`

- RED snapshot 74b89f9e01e3: 7 behavioral assertion failures (feature unavailable).
- GREEN snapshot 86db1dc3ec31: 8 tests pass. Repeated evidence, recovery reset,
  spacing, protected domains, explicit acceptance preview, dismissal and TTL.
- Module cannot mutate UCI. Acceptance is integrated through the Next transaction.

## Parallel latency
`python3 -m unittest discover -s tests/backend -p test_parallel_latency.py -v`

- RED snapshot b0efa3a8ec78: all 3 behavior tests fail: maximum concurrency 1,
  JSON error interpreted as success, requested 100ms timeout took 9.8 seconds.
- GREEN snapshot 8ff5dc367fbe: 3 pass with real HTTP server and curl. Concurrency
  is bounded at 4, JSON error fails, network timeouts bound the request itself.
- Existing diagnostics_status.sh fixture passes after adapting only its external
  curl double to the multi-transfer protocol. No JSON body concatenation is used.

## Connectivity probe
`python3 -m unittest discover -s tests/backend -p test_probe.py -v`

- RED snapshot f03eab0403ad: 4 assertion failures for unavailable feature.
- GREEN snapshot 94ef9a098221: 5 pass. Reports HTTP response vs TLS failure, preserves
  403 status, never silently ignores a requested section, rejects malformed targets.

## Fork identity
`python3 -m unittest discover -s tests/backend -p test_fork_identity.py -v`

- RED snapshot 732fbd6247b6: default updater points at upstream; installer lacks
  a read-only source-reporting command.
- GREEN snapshot 9c7fe2ceb0bb: 3 pass. Both default to m0llusca/forkop-next while
  runtime release-repository environment override remains functional.

Full-suite and release verification results are added after final integration.

## Final integration gate (2026-10-23)

Isolated Alpine snapshot `35a1d3d6ba68`, only one integration runner active:
- All ucode modules compile normally and with strict mode (`ucode -S -c`).
- `bash tests/run-backend.sh`: exit 0; 70 original/new shell suites pass.
- Python unittest discovery: 125 tests pass in 53.218s, no skips.
- Published official sing-box 1.13.7 and 1.14.3 core schema checks execute.
- Report `/tmp/forkop-test-report-7044` retains individual fixture logs.

Fresh frontend verification: formatting and lint pass; Vitest 51 files / 551
cases pass; TypeScript, bundle generation and actual generated LuCI entrypoint
rendering check pass. After fixing inherited flag-file formatting, the bundle
was regenerated and the integration render check rerun successfully.

A prior simultaneous VM run exceeded a latency wall-time assertion (2.98s vs
2.5s). The unchanged test passed in both subsequent complete integration runs;
no timing limit was relaxed. Installer timeout failures were separately reproduced
and fixed as recorded in installer-deadlines.md.

Secret-pattern scan found only existing PEM delimiter parser strings; no GitHub
credentials are included. Staged diff whitespace check passes. GitHub tree identity
is checked against `git write-tree` before publishing. Package creation and live
router/VPS acceptance remain separate release gates; neither is claimed by these
fixture results.
