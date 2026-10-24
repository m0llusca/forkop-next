# REALITY record compatibility implementation plan

The user approved a corrected sing-box as primary, preserving Extended features and compatibility with current and older Xray. This plan implements the experimentally validated TLS-record fix, without changing authentication, DNS or IPv6 policy.

1. [x] Compare saved clients and server cores; reproduce the direct-path failure.
2. [x] Observe TLS-record A/B/A/B controls on the same WAN path.
3. [x] Implement an opt-in first-record wrapper with TDD; independently review it.
4. [x] Build ARM64 with every upstream Extended release tag; test direct connectivity, wrong-key rejection and older Xray.
5. [x] Build a genuine compressed binary and repeat actual-router positive/negative checks.
6. [x] Add hash-admitted generation/validation with native RED/GREEN fixtures. Default record size is 256 only for an explicitly installed, verified record-capable Chrome REALITY core. Explicit zero remains an opt-out. Official cores retain their behavior.
7. [ ] Add a separately pinned compressed-core source, sticky updates and exact rollback, with transaction failure tests before live installation.
8. [ ] Run full Linux backend/frontend/package gates and independent review. Publish only generic provenance and source artifacts.
9. [ ] Install with verified backups and an independent rollback timer; preserve the user's working selected route until controlled acceptance.

Core assets use a separate core-prefixed release tag. Numeric Forkop package releases remain separate. Unsupported architectures or unavailable custom assets fail clearly without switching to an incompatible channel.

An early compressed sidecar trial exhausted router memory because an unnecessary uncompressed temporary copy remained in tmpfs. The primary process recovered automatically. That copy was removed; subsequent tests used a memory threshold and verified no additional OOM events, main service availability, DNS and HTTPS. Do not run two temporary cores or retain large unused binaries on the router.
