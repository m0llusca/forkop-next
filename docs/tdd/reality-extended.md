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

Native RED: 7254d57f, release gate run 40009525457, 209 Python tests,
19 failed assertions including subcases. Three generator input paths lack the
hybrid flag; trusted preflight remains unknown. Installer tests reproduce missing
digest/URL admission, corrupt archive processing, mutable-latest rollback and
ignored library-restore failure. The valid-archive control passes. Original
backend tests remain green; 70 shell suites and frontend gate pass.
Saved artifact SHA256:
86eb81261335a1236f8e769f86d4e462fd1785e87d5a52cc541e8ac971d6da57.

Actual Extended current-Xray positive transfer fails with hybrid absent, while
explicit hybrid-off rejection, XHTTP schema and VLESS Encryption schema controls
pass. Older-Xray positive tests initially stop at the Xray-to-Xray fixture
control: their freedom outbound also blocks private targets. Pinned old sources
support finalRules; apply the same exact TCP 127.0.0.1/32 HTTPS-port allow plus
block-all fixture rule to all three releases. This fixture failure does not
establish old-core incompatibility. All negative/authentication controls remain.
