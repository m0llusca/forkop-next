# Network skills review and TDD evidence

Baseline: d57ff974, unreleased 1.1.4 candidate, four successful workflows,
224 backend tests, 70 shell suites and 594 frontend tests. No live router/VPS
operation is authorized by this development audit.

## Installed and applied instructions

User explicitly requested development and network analysis skills. Read the
skill-installer instructions, reviewed pinned original SKILL.md files before
installation, installed with the official installer script, then checked the
installed file SHA256 against the reviewed bytes. Exact repositories, revisions,
paths, hashes and applied scopes are in docs/development-skills.json.

- Protocol Reverse Engineering: network boundary and protocol review; inspect
  actual TProxy parser/installer callers and native handshake evidence. No live
  capture, MITM, key logging or certificate-validation weakening is performed.
- Sharp Edges: security mode defaults, empty/unknown enums, controller/proxy
  settings, probes and lifecycle failures. Explicit security=none is a deliberate
  existing choice; missing/unknown security must not silently produce plaintext.
- Spec-to-Code Compliance: independently trace the single source-aware DNS
  isolation requirement through generator, schema adapter, nft and runtime check.
  Source scope is preserved on the inspected production paths. The description
  of supported AND migration shapes was narrower than the implementation; clarify
  documentation without changing this already-tested DNS behavior.

The existing TDD, systematic-debugging, property-based-testing, variant-analysis
and verification-before-completion methods remain in use. Finite matrices here
are deterministic boundary tests, not randomized fuzzing.

## Tests before implementation

Tests-only 987cda9a adds actual nft CLI guard tests (external ip output is a
fixture) and actual generator/parser tests. Native RED, release gate 40022906218:
238 tests in 22.657 seconds, 24 failed assertions. Correct same-line rules,
default routes, canonical TLS/REALITY and explicit none controls pass.

Observed failures:
- Matching table and mark from two unrelated policy-rule lines are combined.
- Source/destination/interface-constrained rules falsely satisfy a universal rule.
- IPv6 host/prefix routes and interface lo0 falsely satisfy the default lo route.
- Bare manual Trojan misses the subscription parser's TLS default.
- Mixed-case or unknown manual security silently drops TLS/REALITY.

RED artifact SHA256:
0289b640e7557722527e0467b61925e354521f89b27bf221c54efe53607abc92.

Variant tracing found the unknown/mixed-case enum problem in subscription add_tls
too. Tests-only e525b29f adds parser cases and missing-security VLESS/SNI coverage.
The known legacy xtls alias is tested as secure-or-explicitly-rejected manually
and as TLS in the parser, rather than incorrectly classifying it as an unknown
mode. This preserves the no-plaintext requirement. Additional native RED,
Backend CI 40023179463: 242 tests in 25.056 seconds, 31 failed assertions.
New failures show parser typos/uppercase returning plaintext and missing-security
VLESS/SNI omitting TLS manually. Known parser tls/reality/xtls and explicit none
controls pass. Artifact SHA256:
c56a7b70f93c917fb43983247fc819630a222206be4b26dc09cb3495b1c065b5.

Only after these failures, normalize known security modes, preserve xtls as TLS,
default manual Trojan and missing-security/SNI links to TLS, reject unknown
manual modes and invalid subscription nodes. Preserve explicit none and all
certificate-verification defaults. Parse one complete universal marking rule at
a time; require exact default-route destination and exact lo interface tokens.
Unknown policy-rule selectors are conservatively unconfirmed.

First GREEN: cbcd85b7, Backend CI 40023642826, 242 tests in 23.961 seconds,
no skips/failures; all 70 shell suites pass. Artifact SHA256:
8e79f7b54b81a40be77ab7d9709967dd8ddd4746130c5caac778279bfffec161.
Independent patch reviews found no blockers in NFT guards, TLS enum rejection
or the clarified DNS documentation. The original core matrix remains green.

One review observation extends the same TLS-intent family: the subscription
parser also understands peer, ALPN, fingerprint and public-key hints when
security is omitted. Manual links can still lose that intent. Tests-only
a4d6147d adds eight cases, preserving explicit-none controls. Native RED,
Backend CI 40023977937: 243 tests in 24.372 seconds, six failed assertions:
four VLESS hints omit TLS; Trojan loses peer SNI and inferred REALITY. The
other two hint controls pass. Artifact SHA256:
9f1870d20cb94e76197d793594a22283ec8cf138f5485bb01f92b42618bd2791.

After this observation, infer TLS from peer/ALPN/fingerprint and REALITY from a
public-key hint only when no explicit security mode was selected. REALITY gets
the same default Chrome uTLS profile as the parser. Explicit none still returns
before TLS generation, and explicit TLS remains TLS even with unrelated hints.
Fresh native verification and final package verification are pending.

## Primary networking references

- https://cdn.kernel.org/doc/html/latest/networking/tproxy.html
- https://xtls.github.io/en/document/level-2/tproxy_ipv4_and_ipv6.html
- https://sing-box.sagernet.org/migration/
- https://sing-box.sagernet.org/configuration/dns/rule_action/
- https://trojan-gfw.github.io/trojan/protocol

The OS policy-routing/traffic tests use command fixtures, not a live kernel
network namespace. Native REALITY transfers run isolated Linux amd64 cores;
these limits remain distinct from real router/Aeza deployment acceptance.
