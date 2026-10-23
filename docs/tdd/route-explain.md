# Route explanation TDD evidence

Scope: read-only configured UCI policy explanation, distinct from availability.
Tests execute the ucode CLI with the existing real `core.uci` fixture boundary and
assert JSON decisions and unchanged fixture bytes. They cover DNS-label suffix
boundaries, exact domains, order, disabled sections, unknown external sets, ports,
devices, exclusions, expiry and input validation.

Initial command (Windows bundled Python):

```
python -m unittest discover -s tests/backend -p test_route_explain.py
```

Initial run: 9 failures at a missing-module presence assertion. This was rejected
as insufficient behavioral RED; that assertion was removed. A candidate module
was staged outside the production tree while the Linux ucode runner was being
prepared. The temporary-expiry case was then added, making 10 tests.

Behavioral RED: the orchestrator ran the absent-module tests in the isolated
Alpine/ucode VM snapshot `71aae8506eff`; all ten route tests failed on CLI output
execution because the implementation was absent. Only after this runtime RED
was the candidate restored to production.

GREEN command, run through `work/toolchain/vm.py --repo . --command`:

```
python3 -m unittest discover -s tests/backend -p test_route_explain.py -v
```

Snapshot `034d5463da48`: 10 tests passed. Snapshot `b5c2e687068c`: 12 tests
passed after adding characterization cases for existing target metadata and
IPv4 source CIDR boundaries. These two characterization tests passed immediately;
the existing shared target resolver and CIDR matcher already supported them.

Full backend Python suite: snapshot `fbb2990f1ee2`, command
`python3 -m unittest discover -s tests/backend -v`: **54 tests passed**, 29.113s.
Both normal and strict compilation of `service/route_explain.uc` passed with
`ucode -c -o /dev/null` and `ucode -S -c -o /dev/null`.

The existing full shell suite was also launched in snapshot `896162f7eea4` with
`printf '%s\\0' tests/*.sh | xargs -0 -n1 -P4 bash`. It reported
`stable ref is unavailable and could not be fetched: 0.7.19.9` because isolated
snapshots omit Git metadata; remaining checks were still running at handoff.
The orchestrator owns final full-suite status. No live router commands or
network probes were executed by route explanation.

Current limits: configured policy only, not applied packet-capture state;
external rule-set membership, regex semantics and IPv6 CIDR matches remain
indeterminate. Unknown earlier rules prevent falsely claiming a later route.

Design reference: Trafira `diagnostics/route_match.uc` uses three-valued matching
and stops certainty at an unknown earlier rule. This implementation is original
code against Forkop's existing UCI schema; no Trafira code was copied.
