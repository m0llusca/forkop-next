# Pinned compressed core source — 2026-10-24

## Contract and boundaries

The explicit `sing_box install_forkop_record_compressed` action selects the
allowlisted `forkop-next-record` channel. Its executable remains a genuine
`extended-compressed` runtime. `/etc/forkop/sing-box-source` stores update routing,
not capability admission. Missing source state retains the official updater.
Unknown source state refuses automatic fallback.

The resolver uses the local `validated-cores.json`: exactly one entry for the
channel and architecture must have `source_current: true`. Historical admitted
cores remain available for runtime verification without becoming update targets.
The release tag must equal `core-` plus the executable version, and the archive
name and GitHub destination are constructed from the pinned identity. No API
request or arbitrary URL selects a release. An unsupported architecture or
ambiguous manifest fails closed.

The custom path verifies archive SHA256, extracts to a temporary file, and verifies
the executable SHA256 plus exact runtime capability profile before its first
`version` invocation. The selected manifest also pins `validation_memory_kb`
(a positive integer, at most 4194304 kB; the current core requires 140000 kB).
After executable admission, the verified archive is removed to release tmpfs,
then at least that much `MemAvailable` is required before candidate execution or
service stop. Missing, malformed, duplicate or overflowing memory evidence fails
closed. There is no environment switch or action argument to bypass the gate.
This local check addresses the observed UPX validation OOM risk without adding a
global runtime memory policy.

The installer refuses a package-owned binary or unknown
ownership; an existing engine must be an admitted compressed runtime with its
matching variant marker. It performs no package database changes. Absence of an
engine is supported when the package ownership query also confirms no owner.

Before stopping the service, the transaction snapshots the binary, optional
library, generated configuration, sing-box UCI file, init script and variant,
version and source files. It preserves regular-file contents and modes and
absent-file state; unusual filesystem objects are refused before mutation. A
failed commit/start/source write restores those snapshots. Source selection is
written only after candidate identity and startup checks succeed. If restoration
fails, automatic restart is suppressed and independent recovery material is
retained outside the updater stale-temp glob.

Generic checks and installs stay on the persisted channel. Official compressed,
official package, stable and tiny transitions cannot remove an already admitted
record-fragment capability before stopping the service. The official archive
validation and existing installation paths otherwise retain their behavior.

Component check cache paths distinguish sources; result JSON also carries source
evidence so a delayed official result cannot populate the selected custom cache.
Old source-less official results remain compatible when the marker is absent.

## RED

The root agent ran `tests/record_source_installer.sh` against the original native
code in an isolated temporary directory. Observed failure:

```text
FAIL: pinned custom archive source must be accepted before extraction
```

No live installer, service action or download was invoked. The network boundary
only copied a local inert fixture.

`tests/record_source_policy.sh` additionally accepts
`FORKOP_ACTION_SOURCE_FILE=/path/to/baseline-action.uc` to compare the actual
baseline dispatcher and downgrade gates without modifying the working tree.
The root agent observed behavioral RED against the baseline: a request for the
selected custom channel dispatched to the official installer instead.

The first complete transaction run then exposed a real declaration-order defect
after the isolated `download, execute, stop` boundaries: `left-hand side is not a
function`. New installer helpers referred to later lexical declarations. The
helpers were moved after their existing dependencies, and the fixture retained
the real staged-copy helper before the installer. The corrected run below
exercises those calls successfully. No live service was stopped by this RED run.

The root agent subsequently ran the new `low-memory` transaction case against
the ungated installer. The existing ten cases passed, followed by:

```text
FAIL: insufficient-memory candidate executed or stopped service
```

Only after that native RED observation was the memory gate implemented.

## Behavioral fixtures

```text
sh tests/record_source_installer.sh
sh tests/record_source_policy.sh
sh tests/record_source_transaction.sh
sh tests/record_source_memory.sh
python3 -m unittest discover -s tests/backend -p test_extended_update_safety.py -v
```

The source fixture covers destination/checksum rejection before download;
current-versus-history manifest selection and ambiguous current targets;
first-install executable hash admission without execution; unsupported
architectures; marker allowlisting/absence; cache source separation and stale
result rejection; and apk/opkg ownership including command failure.

The policy fixture exercises the real dispatcher for selected, default and
unknown sources, plus compressed/package/stable/tiny capability downgrade guards.
The full transaction fixture extracts the actual custom installer, hash and
snapshot/restore functions. Only its external service, download and executable
invocation boundaries are stubbed. Real local tar extraction, checksums and
portable file copies run solely inside the fixture directory. Failure cases
include wrong executable hash, missing capability, ownership, variant, version,
copy, health and source commit; first-install rollback checks absent state.

The existing Extended safety fixtures retain their complete real official
installation functions; extraction lists include the shared URL verifier.

## Verification status

The root agent ran the fixtures on the native router interpreter, exclusively
inside temporary fixture directories:

- Source/resolver/marker/cache: five groups PASS, including current-target
  history/ambiguity and stale source evidence; apk/opkg ownership: ten cases PASS.
- Selected/default/unknown dispatch and four official downgrade gates: 9/9 PASS.
- Complete custom transaction after the memory gate: 11/11 PASS (`success`, `bad-sha`, `bad-cap`,
  `owned`, `wrong-variant`, `bad-version`, `copy-fail`, `health-fail`,
  `source-fail`, `first-health-fail`, `low-memory`).
- Pure memory gate: all 19 memory samples PASS, plus default proc-source reading,
  unavailable proc evidence, eight invalid requirements and positive min/max
  requirement boundaries. The source resolver also rejects invalid pinned
  memory requirements. The transaction fixture confirms verified archive
  removal before the memory check and no execution/stop on insufficient memory.

These expanded GREEN runs were observed by the root agent after the memory-gate
change, before any actual installer entry point was invoked.

Local `git diff --check` passed. The Windows development host has no native
ucode/bash interpreter, so native execution evidence above is explicitly the
root agent's isolated run. The existing Python Extended safety suite and broader
backend CI remain integration checks; they are not claimed as run here.

No production installation, release publication or network mutation is performed
by these fixtures. Native isolated tests do not establish a live installation or
independent rollback acceptance.

## Existing package-job fixture dependency regression

The first Linux CI run at `44fff3c` passed the new source/memory/transaction/policy
fixtures, syntax checks and pinned-core provisioning, but
`components_updater_job.sh` failed. Its isolated `package_runtime_lib` lacked the
new `singbox.reality` dependency required by the actual stable/tiny pre-mutation
admission guard. The native error identified `sing_box_verified_runtime`; the
recorded package-manager log contained only the initial version lookup, so the
existing assertion correctly reported that the package list update never ran.

The fixture now copies the actual admission module and supplies an explicitly
empty local trust manifest. It still represents an unadmitted/no-engine runtime;
the security guard is neither bypassed nor replaced by a permissive stub.
No production source change was needed. A Linux CI rerun is required to establish
GREEN for this existing job fixture. The complete legacy package fixture is not
run on a live router because its package installation entry retains production
filesystem paths; native record-source fixtures remain separately isolated.
