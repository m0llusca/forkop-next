# Intuitive native forms and workspace guidance

Scope: approved six-section composition, task descriptions, native field grouping and targeted layout repair. No backend or routing configuration changes.

## Behavioral evidence

- `workspace/tests/formGuide.test.ts`: interface stub RED 5 failed / 1 passed; implementation GREEN 6 passed. Checks original widget identity/value/listeners, all six source mechanisms visible, advanced disclosure/error expansion, preserved dependency visibility, future fields, distinct device conditions, inbound security/credentials and unrelated nested editors.
- `workspace/tests/workspace.test.ts`: integration RED 2 failed / 13 passed; GREEN 15 passed. Checks destination explanations and lazy native settings grouping/error expansion after native updates.
- Real native-LuCI synthetic preview found inherited 210px widget width and both native modal tabs visible. `visualSystem.test.ts` RED 2 failed / 7 passed, GREEN 9 passed. Tests target real `cbid.forkop.*` wrappers and active/inactive native modal panes, plus existing host-theme/mobile/action regression tests.
- Desktop action controls keep wrapping available for long translations; reserved column width and tighter padding prevent routine two-line actions. Native priorities and controls are unchanged.
- Follow-up disclosure regression: RED 1 failed / 6 passed, GREEN 7 passed. A checked advanced option may open its group initially; subsequent refresh respects the user's manual closure. A validation error still reopens the group.
- Native LuCI reused a previous dialog's scroll offset. New regression RED (220 instead of 0), GREEN workspace 16/16: new header/content starts at the beginning; in-dialog updates retain the user's scroll. Independent scoped review confirmed native `showModal()` replaces the header and approved the repair.

## Preservation and implementation decisions

Fields are moved as existing DOM nodes into semantic groups, never cloned, parsed or cleared. Native IDs, UCI option objects, listeners, tab activation and conditional `.hidden` classes remain authoritative. Collapsed groups reveal invalid controls. Only explicitly identified Forkop roots/modals are enhanced. Unknown fields remain accessible and unrecognized child editors are left alone.

Global groups: DNS; interfaces; controller; updates/downloads; system. Rule editor: action; six connection sources; action-specific DNS; cascade/local proxy/additional parameters. Conditions: destinations/lists; device scope; additional conditions. Inbounds: access; TLS/REALITY; transport; credentials; route. Required inbound credentials are not collapsed.

No remote assets, framework dependency, automatic network probes or save/apply operations were introduced. Existing lazy tools and telemetry guards remain. Successful area-scoped status no longer duplicates metadata already in diagnostics.

## Validation limits

The preview uses native LuCI/Atlas with synthetic public example data and disabled production writes. It does not certify live router installation, real server availability, full accessibility compliance or end-to-end import/apply operations. Final integrated commands/results are recorded after review in the interface guide and handoff.

## Independent review

Reviewer identified an omitted `rule_set_with_subnets` scope count; repaired with native-grid RED→GREEN coverage, union/dedup and DNS-specific semantics. Also reviewed the disclosure repair. Independent focused rerun: 43/43 tests (25 rules, 7 grouping, 11 tools). No remaining actionable source blockers reported.

## Final integrated verification

- Frontend: **769 tests / 74 suites passed**, no skipped tests (baseline 721/71).
- Full TypeScript, ESLint with zero warnings and source Prettier check passed.
- tsup build and `scripts/check-luci-bundle.mjs` native module render passed.
- Nine shell checks passed: localization, DNS action, built-in lists, cascade, interface settings, DynamicList layout, stacked validation, server authentication and duration validation.
- `dashboard_server_filter.sh` could not run locally: Windows lacks the `ucode` executable; no pass claimed for it.
- Native synthetic browser pass: all six primary destinations; rule editor/settings/conditions; inbound VLESS security/transport/route; profiles/compatibility; 390px rules and editor. Confirmed new modal opens at scrollTop 0 and only one native tab is visible. Temporary viewport override reset.
- No production router files, packages, core binaries or routing settings were changed in this UI follow-up.
