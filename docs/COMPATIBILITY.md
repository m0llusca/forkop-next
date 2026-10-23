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
