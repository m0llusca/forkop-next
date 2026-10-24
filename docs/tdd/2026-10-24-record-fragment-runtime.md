# Verified-core REALITY record policy

Scope: `singbox/reality.uc`, `config/validator.uc`, focused fixtures and this
record. The identity manifest, core installer/source channel, runtime markers,
updater and UI are owned by the integration task and were not changed here.

## Contract

The existing generator final pass already calls `adapt_outbound` for every
generated outbound. That boundary now adds
`tls.reality.record_fragment_size = 256` only when the field is absent, the exact
executable/version matches a packaged profile whose
`reality_record_fragment === true`, and the outbound meets the established
enabled TLS + REALITY + Chrome uTLS profile. Existing hybrid adaptation remains.

Explicit integer values 0..16384 are preserved. Explicit zero opts out. Any
explicit record field, including zero, requires exact verified record capability;
unknown versions, changed executable hashes and ordinary nonrecord cores cannot
admit the new schema. Invalid numeric bounds and noninteger JSON types fail with
a field-specific error that does not echo the outbound or credentials.

The generator adaptation checks explicit fields before writing generated output,
including subscription fields that bypass UCI JSON validation. Both current
`outbound_jsons` and legacy `outbound_json` validation use the same shared rule.
Ordinary JSON without the field does not initiate extra validator core/version
discovery. Explicit-field validation resolves and hashes its runtime once per
validator invocation, rather than once per JSON item.

No new UCI option, certificate bypass, security downgrade, transport rewrite,
fingerprint rewrite or Vision change was introduced. Default behavior on
nonrecord profiles remains the previous behavior.

## Shared internal API

- `verified_runtime(version, binary_path?)`: unchanged exact executable admission.
- `record_fragment_supported(outbound, profile)`: established supported Chrome
  REALITY predicate plus strict boolean record capability.
- `record_fragment_error(outbound, profile)`: empty string for absent/valid fields;
  otherwise a safe schema/capability error.
- `adapt_outbound(outbound, profile)`: validates explicit fields, preserves their
  values and applies the absent-field policy described above.

The installer must check its admitted target profile's record capability and
preserve required capabilities during updates; the outbound-specific helper is
for generator policy, not installer source admission.

## Observed RED and GREEN

Windows has no native ucode interpreter. The root task ran the actual unchanged
source in an isolated router temporary fixture before implementation, without
network probes, service actions or production configuration writes:

- Adapter RED: missing expected `record_fragment_size=256` on the verified fixture.
- Validator RED: accepted `record_fragment_size=-1`.

After implementation, the root reran the staged actual source and reported:

- `PASS: adapter auto-policy and explicit opt-out`
- `PASS: real validator schema and exact identity`
- `PASS: real generator policy`

The portable test creates a temporary shell-script executable, an exact local
trust manifest and UCI fixture JSON. It does not launch a proxy, use production
identity admission, activate a generated configuration or contact an endpoint.

```sh
FORKOP_TEST_LIB=/tmp/isolated-fixture/lib sh tests/reality_record_fragment_fixture.sh adapter
FORKOP_TEST_LIB=/tmp/isolated-fixture/lib sh tests/reality_record_fragment_fixture.sh validator
FORKOP_TEST_LIB=/tmp/isolated-fixture/lib sh tests/reality_record_fragment_fixture.sh generator
```

`FORKOP_TEST_LIB` identifies the copied full source library tree in that isolated
fixture; the script owns and cleans a separate `mktemp` directory.

## Broader native fixture suite

`tests/backend/test_record_fragment_runtime.py` adds nine native CLI test methods
covering link/JSON/subscription generation; explicit 0/1/256/16384; existing hybrid
behavior on nonrecord profiles; Chrome/TLS/REALITY gates; unknown version and
changed executable identity; current and legacy JSON validation; invalid types
and bounds; and invalid/unsupported subscription fields at final generation.

```sh
python3 -m unittest discover -s tests/backend -p test_record_fragment_runtime.py -v
```

This Python suite requires Linux ucode with fs/uci modules and has not been run on
this Windows host. Its Python syntax/AST check passed. `git diff --check` passed.
The root task owns the full native CI run, exact real identity manifest,
independent source review and integration. The live ARM64/core interoperability
matrix belongs to the separate core verification evidence; it is not claimed as
part of these generator/validator fixtures.
