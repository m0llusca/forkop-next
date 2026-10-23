# REALITY Extended execution ledger

Baseline: f74ab56ff5be0d28b86e191a0581d3fae88ca4ea, version 1.1.3;
all four native workflows green, 188 backend tests, 70 shell suites, 594 frontend
tests. Dedicated task clone is clean. Reuse it; no unrelated Atlas files touched.

Ruling: use the existing upstream Extended hybrid correction before adding a new
crypto patch. Evidence: upstream exposes support_x25519mlkem768; this preserves
Extended and reduces maintenance. Cost if insufficient: add a source patch only
after native failure identifies the missing behavior.

Ruling: user approval of the selected architecture and instruction to implement
authorize execution of the concrete plan without another approval round.
Implementation evidence is appended after observed runs, not inferred from code.
