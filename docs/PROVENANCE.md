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
  in the area-specific TDD journals.
- Regression specifications include Forkop pull requests #68, #80, #90, #103,
  #109, #112, #138, #139 and #142. Implementation provenance is recorded with
  the corresponding modules/tests rather than treating unmerged patches as proven.

The Next transaction, routing explanation, recommendation and connectivity-probe
extensions are developed and verified against fixture configurations. No user
credentials, real subscriptions, private server configuration or chat tokens are
part of this source tree.
