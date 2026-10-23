# Forkop Next collaboration contract

This is a personal continuation of ushan0v/forkop, retaining the `forkop` UCI,
service, filesystem and LuCI namespaces so existing installations can migrate.

## Required process
- Use test-driven development for every changed behavior: write a behavioral test,
  observe its expected failure, implement, run it again, then run the affected suite.
- Record commands, expected failure and verified success in docs/tdd/<area>.md.
- Do not claim an unavailable check passed. Tests must exercise behavior, not source text.
- Read the installed test-driven-development, systematic-debugging and
  verification-before-completion skills before implementation.
- Preserve GPL notices and document imported upstream commits in docs/PROVENANCE.md.
- Do not use the token exposed in the conversation, save credentials, contact others,
  or change live router/VPS services. Development and fixtures only.
- Never silently disable IPv6, flow offloading, certificate validation, or DNS isolation.
- All remote download/install/update destinations must be explicit and verified.

## Scope of version 1
Safe apply with rollback and previous working config; route explanation distinct
from connectivity probes; persistent manual server selection; connection-interrupt
policy; robust DNS/URLTest/filter behavior; reconnecting dashboard; bounded parallel
latency checks with timestamps; device routing; gaming presets; expiring rules;
profiles and diff/import/export; recommendation-only Smart Detect; coherent modern
desktop/mobile LuCI with simple and detailed modes. Xray is an optional adapter,
not a second mandatory routing plane.

## Coordination
The primary agent owns integration, release files and packaging. Backend orchestrator
owns forkop/files and shell/ucode tests. Product orchestrator owns fe-app-forkop,
luci-app-forkop and UI tests. Coordinate shared contracts in docs/API.md before edits.
Orchestrators must use specialist subagents, one active specialist at a time across
the two orchestrators because the session has four execution slots. Do not overwrite
another agent's changes or regenerate the bundled main.js until integration time.
