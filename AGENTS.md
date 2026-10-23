# Forkop Next contributor contract

Retain the forkop service, filesystem, UCI and LuCI namespaces for migration.

- Use behavioral TDD for runtime changes: observe RED, implement, verify GREEN.
- Record new regression evidence in docs/tdd; do not claim unavailable checks.
- Preserve upstream copyright/license notices and docs/PROVENANCE.md.
- Never commit credentials, private endpoint metadata or deployment backups.
- Do not weaken TLS validation, IPv6 behavior or DNS isolation implicitly.
- Verify explicit download destinations and release SHA256 before execution.
- Deployment acceptance requires authorization, verified backups and independent
  rollback. Development fixtures alone do not certify a live installation.
- Coordinate shared API contracts in docs/API.md. Request independent review
  before integration and verify the final source/package identities.
