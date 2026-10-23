# Exact snapshot variants — round 2, 2026-10-23

Baseline: `c31310b82934218a029385740953fc46ed789df9`.
Applied Trail of Bits variant-analysis, pinned skills revision
`196a9073ab10d35bacf111f945e02c00b2c6883a`, plus Superpowers TDD and systematic
debugging. All runtime checks use the disposable localhost-only Alpine VM with
real ucode fs/UCI. No router or VPS is modified.

## Root cause and search

Invariant: a digest precondition must identify the bytes actually consumed, and
a read-modify-write must check the snapshot it modified, even without a caller
supplied digest. The original seed is the late `digest(CONFIG)` returned by
`profile_diff` in baseline `a1439fc9`.

| Search | Actual matches | Triage |
| --- | ---: | --- |
| `git show a1439fc9:forkop/files/usr/lib/service/next.uc` then `rg 'current_digest:digest\(CONFIG\)'` | 1 | Historical calibration |
| `rg 'digest\(path\)'` in next.uc | 2 lines | One helper declaration, one profile_apply call; only the call is a candidate |
| `rg 'digest\(path\)|digest\(CONFIG\)|digest\(DIR'` in next.uc | 8 lines | Helper plus seven calls; inspect consumers rather than treating each line as a bug |
| `rg -l 'digest\(|file_md5\(|sha256sum' forkop/files/usr/lib -g '*.uc'` | 5 files | next, lifecycle, selection, server/service, components/updates; surface triage beyond next |

The widened expression produces substantial noise and was not generalized
further. Status/return digests only report state; the final live-CONFIG rehash is
the conflict guard itself. Lifecycle/update hashes decide whether to restart a
runtime, not which previously read UCI bytes to install. Selection hashes its own
private canonical JSON snapshot. Those are not promoted to the same finding.
Only next.uc received deep review for this family; the five-file search is not
a claim of complete review of all five modules.

## Executable RED

Command: `python3 -m unittest discover -s tests/backend -p test_next_profiles.py -v`
through `work/toolchain/vm.py --repo work/forkop --command ...`.
Snapshot `4f6bcedda5fd`: 27 tests, five expected failures:

1. Profile apply hashed the live profile path after reading it; a file replacement
   made that hash refer to different bytes from the applied text.
2. Device routing used a parsed old snapshot but applied without an internal base
   precondition; an external edit during parsing was overwritten.
3. Native apply accepted its old candidate after an external edit during parsing.
4. Invalid native apply restored the checkpoint over a newer external edit.
5. Recovery hashed a re-read backup path instead of the exact backup bytes it
   restored.

The fixtures replace `sync` or `sha256sum` at the command boundary to schedule
one deterministic external file edit. They execute the production CLI, parser,
validator and transaction code; there are no timing sleeps or duplicated hashes
in a substitute implementation. The current-config variants represent competing
administrator writes. The profile/recovery variants require an external writer
to private root-owned files; they are integrity/consistency cases, not an alleged
unprivileged attack.

## GREEN

Profile/recovery checks now hash exact in-memory bytes through a private RAM
snapshot. Policy operations preserve the digest of their parsed base and pass it
to apply. Native apply preserves its candidate digest and checks it before
invalid restoration or valid application. All existing validation, journaling
and restore behavior remains exercised.

Snapshot `33e3a9895204`: the same 27 tests pass, including all five failures above.
The full suite and normal/strict compile are integration gates, reported separately.
The checks do not claim a filesystem-wide compare-and-swap against arbitrary
external writers; complete serialization still requires respecting the lock.

An extra positive recovery case caught an intermediate regression from the new
snapshot guard: native reload with a missing CONFIG returned `snapshot_failed`
instead of restoring the existing checkpoint. Snapshot `9395e2ff4aa2` observed
this RED. The missing-file branch now restores only if no expected digest was
supplied and the path remains absent; an unreadable/reappeared path fails closed.
The added behavioral case remains in normal full-suite discovery.

Integration GREEN: snapshot `f61628301848`, all 70 shell suites and 162 Python
tests passed. After the missing-file preservation case/fix, fresh snapshot
`5f4cd4b08d18` compiled all ucode in normal and strict modes and passed all
164 Python tests in 90.009s, no skips. The earlier whole-shell result remains
applicable; clean GitHub CI reruns both suites for the final commit.

## ACL RED/GREEN

Independent differential review found read-role access to controller/proxy
credentials through UCI and raw section-cache. Four new semantic ACL cases failed
before the fix. After removing both read grants and explicitly granting UCI
`read`+`write` and cache reads inside the write ACL, all six ACL tests pass.

The table-vs-array scope behavior was checked against upstream rpcd
`rpc_login_setup_acl_scope` in
<https://github.com/openwrt/rpcd/blob/master/session.c>.
Tests exercise the actual JSON and scope semantics; they do not claim an end-to-end
OpenWrt rpcd login test. Other applications' ACL grants remain outside this policy.

## CI regression guard

```sh
python3 -m unittest discover -s tests/backend -p test_next_profiles.py -v
python3 -m unittest discover -s tests/backend -p test_rpc_permissions.py -v
```

These behavior checks run in the normal backend CI discovery. A source-text
blocking rule for every `digest(path)` would incorrectly reject the legitimate
live-state guard, so the exact reviewed invariants are enforced with executable
regressions instead.
