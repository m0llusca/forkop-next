# Source provenance

Forkop Next retains the Forkop runtime and UCI namespace. Existing copyright and
license notices are retained. Repository license: GPL-2.0-or-later as declared in
the original package metadata; see LICENSE for the supplied GPL version 2 text.

- Base: ushan0v/forkop `dd483297be0ac4e52bb8f482e2640238b75af532`.
- WebSocket recovery port: petrouspetr-pixel/trafira
  `ce5e4f33253c74664f6d4a7727918a30bb011217`, frontend socket service. Adapted to
  the existing Forkop service and verified with reconnect/cancellation tests.
- URLTest duration/idle-timeout handling and section-level pool exclusions were
  adapted from the same Trafira revision (generator functions), with new behavioral
  tests before integration. The 1.14 schema adapter is a new implementation based
  on official migration documentation and the studied source-aware bypass shape.
- Design and behavior references studied: rock12/FlowGate, Gavr1024/forkop-mod,
  Screamshow/forkop-x and petrouspetr-pixel/trafira. Their branding and installation
  defaults are not adopted wholesale. Exact additional code ports are recorded
  in the corresponding test modules.
- Regression specifications include Forkop pull requests #68, #80, #90, #103,
  #109, #112, #138, #139 and #142. Implementation provenance is recorded with
  the corresponding modules/tests rather than treating unmerged patches as proven.

The Next transaction, routing explanation, recommendation and connectivity-probe
extensions are developed and verified against fixture configurations. No user
credentials, real subscriptions, private server configuration or tokens are
part of this source tree.

## Extended REALITY adapter

Use the upstream correction already shipped by shtorm-7/sing-box-extended,
v1.14.3-extended-2.7.3, source d9442d14b19ddd02605bf3ee893a171947038e19.
The option `tls.reality.support_x25519mlkem768` was introduced by upstream
aae5f7ff022e834a991bd16e13537d5f899372ec. Legacy Extended 2.6.5 has no such
option. No stock-core replacement or independent cryptographic implementation
is imported. The Forkop adapter and identity checks are new code.

`singbox/validated-cores.json` records executable SHA256 derived from 54 official
Linux standard/compressed archives and OpenWrt IPK assets (30 unique binaries),
after checking every archive against its official release-API SHA256. Entries
include exact asset name, archive digest, source revision and limited admitted
Chrome profile. Hash admission does not claim native testing on every CPU;
the real interoperability matrix runs Linux amd64. Keep the original source
license and the Extended package/features intact.
