# Compatibility TDD evidence

Read installed test-driven-development, systematic-debugging and
verification-before-completion skills and repository AGENTS/API before changes.
Tests execute the actual ucode modules in the isolated Alpine VM; only curl/core
version process boundaries use executable fixtures. No router or VPS changes.

Command (through `work/toolchain/vm.py --repo work/forkop --command`):

```
python3 -m unittest discover -s tests/backend -p test_compatibility.py -v
```

RED: snapshot `569a2852e5cd`, no production module: expected
`feature_unavailable`, 10 cases failed because the feature was absent.
GREEN: snapshot `6d7db6a29301`, 10 tests passed. Covers capability mismatches,
secret redaction, unknown extensions, stock-core rejection, forged evidence,
selected generated-outbound probe, missing versions, fixed update destinations,
bounded curl, network failure, numeric versions and prerelease handling.

Second RED: `a3594f64896e`, direct outbound discovery absent (`outbounds` missing).
Second GREEN: `f08908ccf130`, 11 tests passed after discovering only the section's
unambiguous direct outbound and making it selectable without manual internal tags.

Schema adapter tests were added next. Initial execution could not transfer the VM
snapshot because its disk filled; this infrastructure failure was not a RED signal.
After root cleared old isolated snapshots, RED `fb69b668ad9b` showed two expected
failures: legacy independent_cache and download_detour were still present.
GREEN `f5f17aae7f62`: 16 tests passed, including source scope preservation,
unchanged 1.13 configuration, HTTP download detour preservation, idempotence and
existing custom HTTP clients.

Downloaded official published Linux x86_64 cores 1.13.7 and 1.14.3 from fixed
SagerNet GitHub release URLs into the isolated VM. Alpine required `gcompat` to
execute the official binaries. An initial validation fixture lacked
route.default_domain_resolver, which both binaries correctly rejected; the real
generator already supplies this field. The fixture was corrected without adding
deprecated-feature escape flags. GREEN `c4f4fcbd4deb`: all 17 tests passed,
including actual `sing-box check -c` on both published core versions, testing
legacy and migrated source-aware bypass plus remote rule-set HTTP-client schema.
The published-core test explicitly skips when cores are not provisioned; its
successful run here was executed with both binaries present.

Final review RED `de70820fc855` caught two additional real mistakes: an earlier
unscoped terminal route could shadow the mixed proxy, and invalid version strings
could echo input credentials. GREEN `e0bd693b2869`: 19 focused tests passed after
conservative shadow handling and strict numeric installed-version sanitization.
Full backend verification `d1070b0d7376`: **104 tests passed in 34.845 seconds**,
including both published core configuration checks, no skips or failures.
