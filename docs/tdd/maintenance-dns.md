# Maintenance DNS preservation

Date: 2026-10-25.

## Failure reproduced

Ordinary restart and package pre-upgrade restored public DNS before stopping the
core. The init-script restart path bypassed backend lifecycle restart, and an
unclean-shutdown start restored DNS again. Package hook errors could also lose
their exit status or leave DNS forwarding to a stopped core.

Native regression fixtures first failed for maintenance stop/restart DNS
preservation, CLI reason forwarding, init-script integration, running upgrades,
IPK stop-error propagation, migration failure and unavailable postinst recovery.
Additional regressions reproduced a broken lifecycle loader bypassing cleanup
and a non-private JSON handoff authorizing maintenance startup. A follow-up
regression reproduced lost automatic retry after an init-script restart failure;
the existing retry scheduler is now invoked after DNS cleanup, while success and
missing-executable behavior remain unchanged.

## Verification

The following scripts passed with native ucode and temporary filesystem paths;
all network and service operations were replaced by closed fixtures:

```sh
sh tests/maintenance_lifecycle.sh
sh tests/maintenance_initd.sh
sh tests/package_lifecycle_upgrade.sh
sh tests/package_maintenance_hooks.sh
```

Coverage includes ordinary Stop, maintenance restart/start, DNS failure cleanup,
identity-checked snapshot sequencing, default/custom FakeIP cache retention,
portable ruleset cleanup, procd timer registration, running/stopped upgrades,
private state ownership and permissions, legacy markers, and removal behavior.
Hook fixtures preserve original failure codes and exercise direct DNS recovery
when the CLI is unavailable.

The optional `tests/helpers/maintenance_legacy_overlay.sh` also passed against a
verified code-only legacy dependency tree plus exactly five updated integration
files. The tested archive SHA256 was
`5199204ac32d6a7f72f28719dac130535680350c41d3c79067f5a23578451f32`.

Two fixture issues were corrected during verification: the native environment
has no external `stat` utility, so permissions are checked through ucode; JSON
selector assertions inspect parsed values rather than serialization whitespace.

These focused tests do not replace complete CI, independent integration review
or protected live acceptance.
