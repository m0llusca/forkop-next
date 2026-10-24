# Forkop: full interface redesign

Approved by the user on 2026-10-24 as “1+2”: connection-first home and persistent workspace navigation for the whole application. This extends the previously approved simple home with advanced settings separate.

## Intent

People opening Forkop must understand service state, whether network access was actually checked, the selected outgoing server, and where to change routing. Existing LuCI forms and Extended features remain usable. The current screenshot buries these decisions in long text, unformatted bytes and competing controls; a global LuCI header style also contaminates the overview.

## Chosen composition and alternatives

1. Connection-first: strong overview, little room for repeated configuration. Chosen for home.
2. Workspace sections: persistent navigation, common status, focused forms. Chosen for the rest, combined with 1.
3. List and detail: efficient for large inventories but adds complexity for one connection. Not selected.

Desktop has a compact internal left navigation and flexible main area. Home opens with connection/check state and the selected server side by side, then a compact strip of traffic readings. Six primary destinations are Главная, Серверы, Правила, Устройства, Диагностика, Настройки. Secondary destinations have a small local tab row. On narrow screens the primary navigation becomes a horizontally scrollable labeled row, then a single-column page. Navigation never saves or discards form drafts.

## Preserved truth and functional map

- Главная: service state, explicit current-router-route probe, main selected outgoing connection, separate additional routes, readable traffic, links to relevant sections. Running process does not imply connectivity. Unknown and zero differ.
- Серверы: existing Dashboard outgoing selectors, URLTest, subscriptions and groups; secondary Входящие подключения retains existing native server editor. Do not call an inbound listener the selected outgoing server.
- Правила: native ordered rule grid and all modal conditions/actions; secondary temporary rules and recommendations.
- Устройства: configured device route assignments and gaming presets; explain that other include/exclude conditions are edited in rules. No fabricated online status or reachability.
- Диагностика: existing checks, route explanation/probes and monitoring. Preserve diagnostic masking, active jobs and controllers.
- Настройки: native global settings, components/updates, compatibility with 3x-ui/Xray, profiles/diff/import/export/recovery. Preserve capability-based visibility, comparison before profile activation, and TLS/DNS/IPv6 safeguards.

Existing native data-tab IDs, form.Map parsing/dependencies, rule priority, modal lifecycle and unsaved values remain stable. New display names and navigation grouping do not rename UCI keys or APIs. New pure UI sections contain no persistent form options. Advanced panels mount once on first visit; hidden telemetry suspends and late responses cannot overwrite newer state. No automatic probes or route changes on navigation. Settings that are not loaded must still skip parsing.

## Visual system

Operate surface in LuCI: local system typography, 8px spacing rhythm, 24/32px section gaps, clear type hierarchy, restrained mint accent and slate surfaces. Light and dark theme use existing proven token colors; default follows surrounding LuCI when detectable, then system preference. One workspace theme control belongs in the shell, not each content panel. Components use explicit classes rather than generic header selectors. Scope all new styles to Forkop workspace and marked Forkop modals; preserve surrounding LuCI/Atlas.

Controls are at least 42px high, mobile input text 16px, visible focus outline 2px with 3px offset. States include empty, unknown, loading, error with recovery, disabled and pending. Readable quantities use binary units Б/КиБ/МиБ/ГиБ/ТиБ and /с for speed, with tabular numerals. No remote fonts/assets or new UI framework. Avoid decorative charts without actual time-series data.

## Architecture and boundaries

Keep the native LuCI map and original tab links as activation authorities. A TypeScript workspace adapter groups them into six sections, providing primary and secondary navigation and a shared status strip. Existing controllers continue observing their original data-tab IDs. New API-backed tools are grouped by area and created once; legacy standalone renderers keep their current default behavior for compatibility. The overview accepts a workspace mode to omit duplicated advanced/theme controls while retaining its standalone contract.

Implementation may settle spacing, exact copy, grouping details and local helpers. It may not remove features, silently change routing semantics, invent live metrics, expose private endpoints, or bypass validation for speed.

## Acceptance

Behavioral TDD for navigation/draft preservation, grouped lazy panels, status/async guards and metric formatting. Full frontend tests, types, lint, format, build and native bundle checks. Visual pass covers all six areas including forms/modals in desktop and mobile sizes; batch fixes then at most one confirmation pass. Record measured loading costs without promising instant remote requests. Build verified packages before any router installation; installation is a separate acceptance step with a fresh verified UI backup and rollback. Existing routes and installed cores remain unaffected by development.
