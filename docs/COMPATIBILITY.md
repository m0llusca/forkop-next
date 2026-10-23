# 3x-ui / Xray compatibility

Forkop compares connection capabilities and performs an explicit preflight. A newer
panel or server core is not inherently incompatible; a version number alone cannot
prove a successful connection. No downgrade or disabled certificate checking is
recommended. Update checks never install anything or contact the panel/VPS.

`forkop next compatibility_updates '{"installed":{"panel":"3.9.9","xray":"26.1.0"}}'`
reads the fixed official GitHub `releases/latest` endpoints for `MHSanaei/3x-ui` and
`XTLS/Xray-core`. TLS verification stays enabled, connect timeout is 3 seconds,
overall timeout 8 seconds per component, response limit 256 KiB. Missing/invalid
metadata, unknown installed versions, prereleases and network failures yield
`unknown`. Numerically newer stable releases yield `update_available`; same or
older releases yield `current`. The supplied installed versions are operator
metadata, not remotely authenticated observations. No credentials are stored.

`compatibility_check` accepts `section`, optional `outbound_tag`, redacted `server`
inbound metadata and optionally `domain` plus `probe:true`. A generated mixed inbound
and its first unconditional direct outbound rule determine the local connection.
When the association is unambiguous, the internal outbound tag can be omitted.
The result includes `outbounds:[{outbound_tag,label}]` for the UI. Selector/URLTest
groups currently require resolving the selected child before a verified result;
they never silently fall back to the current general route.

Server input can be one Xray inbound (`protocol`, `settings.clients`,
`settings.decryption`, `streamSettings`) or normalized metadata:

```json
{
  "protocol": "vless",
  "transport": "tcp",
  "flow": "xtls-rprx-vision",
  "encryption": "none",
  "security": "reality",
  "server_names": ["example.org"],
  "short_ids": ["aabb"]
}
```

Use exactly one selected client when importing an Xray inbound; multiple different
clients require normalized metadata for the chosen connection. Local generated
outbound data takes precedence over optional `client` metadata. Supplying `client`
can compare a proposal but cannot prove a live connection. Inputs are processed in
memory and results omit UUIDs, passwords, private/public keys, short IDs and SNI.
Do not paste complete panel backups. Remove credentials before importing metadata.

3x-ui 3.10.2 serializes `settings` and `streamSettings` as JSON strings. Both
strings and already decoded objects are accepted; malformed JSON is rejected.
Current Xray also accepts `settings.users`, gives `clients` precedence, and
inherits `settings.flow` when the selected client's flow is empty. Transport
aliases and case are normalized, including `raw`/`tcp` and `websocket`/`ws`;
an explicit `streamSettings.method` overrides `network`.
REALITY short IDs are validated as hexadecimal bytes, including Xray's eight-byte
zero padding. Vision without VLESS Encryption requires direct RAW/TCP with
TLS/REALITY; a TLS ceiling below 1.3 is incompatible.

## Pinned current-core results (2026-10-23)

Official latest releases checked: Xray 26.10.21 and 3x-ui 3.10.2. The panel's
source/API serialization was reviewed; a live 3x-ui service was not deployed.
Actual loopback-core tests use checksum-pinned Xray 26.10.21 and stock sing-box
1.13.7 / 1.14.3. TLS/Vision succeeds with both clients, including strict
certificate validation, authenticated VLESS, and an exact random HTTPS payload.

REALITY on those stock clients is incompatible with this Xray release. Xray's
REALITY dependency requires an X25519MLKEM768 share before optional X25519, while
both sing-box versions explicitly remove the hybrid share. An authentication
failure followed by a cover-site certificate error is not a CA-installation
problem. Do not trust a cover certificate or disable verification to hide it.

When supplied installed Xray metadata is exactly 26.10.21, the preflight marks
the two tested stock versions unsupported for REALITY. Other/Extended clients
remain unknown until a capable implementation is validated. This table is
deliberately pinned: it does not infer support or rejection for future releases.
TLS/Vision remains eligible for a selected-outbound probe. Using the latest Xray
with REALITY requires a client implementation supporting its handshake; a core
downgrade is not required for the tested TLS/Vision alternative. Server security
settings are never changed automatically.

Primary implementation references:

- https://github.com/XTLS/Xray-core/releases/tag/v26.10.21
- https://github.com/MHSanaei/3x-ui/releases/tag/v3.10.2
- https://github.com/XTLS/REALITY/blob/83f621788ca8/tls.go#L204-L224
- https://github.com/SagerNet/sing-box/blob/v1.14.3/common/tls/reality_client.go#L138-L148
- https://github.com/SagerNet/sing-box/blob/v1.13.7/common/tls/reality_client.go#L124-L134
- https://github.com/XTLS/Xray-core/blob/v26.10.21/infra/conf/vless.go
- https://github.com/XTLS/Xray-core/blob/v26.10.21/infra/conf/transport_internet.go
- https://github.com/XTLS/Xray-core/blob/v26.10.21/infra/conf/transport_security.go

See `docs/tdd/current-core-compatibility.md` for the RED/GREEN trail and limits.

## Verified Extended REALITY profile (Forkop 1.1.4)

The primary corrected core is official sing-box Extended
`1.14.3-extended-2.7.3`. Upstream already supplies the opt-in correction
`tls.reality.support_x25519mlkem768`; Forkop integrates it rather than replacing
Extended with stock sing-box or maintaining another cryptographic fork.
Legacy Extended `1.13.18-extended-2.6.5` cannot parse this field and must be updated
explicitly before using this profile. No component is installed automatically.

The final generator pass applies to manual links, JSON outbounds and subscriptions.
It enables the field only for a SHA256-admitted actual executable with enabled
REALITY and Chrome uTLS, and only when the option is absent. Explicit false is
the legacy opt-out; explicit fingerprints/security choices remain unchanged.
Stock, legacy and unknown core builds do not receive the new automatic field.
An existing user-supplied unsupported field is not silently erased to make an
incompatible core pass its mandatory configuration validation.

`singbox/validated-cores.json` is the packaged identity trust anchor. A version
suffix or a variant marker alone does not admit a runtime. Changing the executable
invalidates its profile; hashing is streaming and occurs once per adapter request.
Profiles cover published standard/compressed Linux binaries and OpenWrt IPKs;
native interoperability runs on Linux amd64, not every listed architecture.

The first complete native run, ee74ff0f / 40010332390, proves generated
REALITY/Vision random HTTPS transfers against Xray **26.6.27, 26.9.30 and
26.10.21**, with untrusted-certificate and wrong UUID/key/short-ID rejection.
Legacy opt-out also succeeds against 26.6.27. Extended XHTTP and VLESS Encryption
retain generated-schema and core-start checks; these are not live protocol tests.
The same test suite retains unmodified stock-client rejection controls.

For the known hybrid-required server profiles, admission of core, fingerprint and
generated flag permits the existing explicit selected-section HTTPS probe. It
does not certify a connection without that probe. Older 26.6.27 keeps its legacy
probe behavior. Unsupported modern fingerprints stay unconfirmed. Xray remains
an optional reserve architecture; no second router process is introduced.

Operator sequence: explicitly update the sing-box component to the validated
Extended release, apply/reload the configuration, then probe the selected section.
Keep private server metadata out of reports. No certificate verification, server
REALITY policy or remote Xray version is weakened or downgraded.

Release archives/packages are accepted only from the exact official HTTPS
tag/asset URL with a valid release SHA256, checked before extracting/executing or
stopping services. Redirect transport behavior is unchanged. Exact local runtime
backups are used for rollback; this does not reconstruct package-manager database
registration. See `docs/tdd/reality-extended.md` for subsequent review regressions
and final acceptance results.

The response envelope is `{success:true,data:{status,checks,outbounds,client,server}}`.
Each check contains `capability,status,detail,next_step`. Status is `unsupported`
for known mismatches, `probe_required` for missing or unconfirmed evidence, and
`verified` only after a successful HTTPS request through that section's configured
mixed SOCKS inbound with matching capability metadata. `verified` describes this
bounded network test at its timestamp, not application login, every destination,
or compatibility with future releases. REALITY public-key validity is established
by the actual connection, not by comparing an untrusted boolean or a version.

Stock sing-box's documented VLESS capability set does not include Xray's non-none
VLESS Encryption, XHTTP or `xtls-rprx-vision-udp443`. Such a stock combination is
reported unsupported. An Extended core's version suffix does not prove a capability:
unconfirmed extensions remain `probe_required`. The server encryption settings
are never silently removed or downgraded.

Official references consulted:

- https://xtls.github.io/en/config/outbounds/vless.html
- https://sing-box.sagernet.org/configuration/outbound/vless/
- https://sing-box.sagernet.org/migration/
- https://sing-box.sagernet.org/configuration/dns/rule_action/
- https://sing-box.sagernet.org/configuration/rule-set/
- https://sing-box.sagernet.org/configuration/shared/http-client/

## Local core schema migration

`singbox.compatibility.transform(config, actual_version)` preserves the legacy
1.13 shape. For 1.14+, it removes `independent_cache`, changes generated
source-aware bypass address filtering to `evaluate` followed by response matching
and `respond`, and converts remote rule-set `download_detour` into `http_client`
without changing the chosen download outbound. Existing custom HTTP clients are
preserved. Transforming an already migrated configuration is idempotent.

Only the generated, understood logical AND bypass shape is rewritten. An arbitrary
legacy address expression is rejected with `unsupported_dns_response_migration`
instead of changing its routing semantics. Unknown runtime versions retain the
legacy shape and must pass the actual core's mandatory configuration check before
activation. No flag enables deprecated schemas or weakens transport security.
Published sing-box 1.13.7 and 1.14.3 both passed actual configuration checks on the
behavioral fixtures. This establishes those schemas, not universal support for
future core features or protocol extensions.
