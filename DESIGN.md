---
name: Forkop
description: A connection-first operating workspace embedded in LuCI.
colors:
  light-background: "#f6f7f8"
  light-foreground: "#17252d"
  light-muted: "#455863"
  light-line: "#ced7dc"
  light-accent: "#14635e"
  light-field: "#fff"
  light-hover: "#e6eeed"
  light-selected: "#dceee9"
  light-danger: "#a02b32"
  light-warning: "#815210"
  dark-background: "#16232b"
  dark-foreground: "#eef4f6"
  dark-muted: "#b8c8d0"
  dark-line: "#455963"
  dark-accent: "#8bd6c8"
  dark-field: "#21333e"
  dark-hover: "#29423f"
  dark-selected: "#29473f"
  dark-danger: "#ffb4b8"
  dark-warning: "#f2ca87"
typography:
  headline:
    fontFamily: "inherit"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-.025em"
  title:
    fontFamily: "inherit"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-.015em"
  body:
    fontFamily: "inherit"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: "inherit"
    fontSize: "12px"
    lineHeight: 1.5
  help:
    fontFamily: "inherit"
    fontSize: "13px"
    lineHeight: 1.6
rounded:
  badge: "4px"
  control: "6px"
  choice: "8px"
  workspace: "12px"
spacing:
  micro: "4px"
  tight: "8px"
  compact: "12px"
  base: "16px"
  section: "24px"
  major: "32px"
components:
  button-primary:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-background}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-dark:
    backgroundColor: "{colors.dark-accent}"
    textColor: "{colors.dark-background}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-secondary:
    backgroundColor: "{colors.light-field}"
    textColor: "{colors.light-foreground}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  input:
    backgroundColor: "{colors.light-field}"
    textColor: "{colors.light-foreground}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  navigation-current:
    backgroundColor: "{colors.light-selected}"
    textColor: "{colors.light-accent}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  server-choice:
    backgroundColor: "{colors.light-field}"
    textColor: "{colors.light-foreground}"
    rounded: "{rounded.choice}"
    padding: "16px"
---

# Design System: Forkop

## Overview

Forkop is a Russian-first operating interface inside LuCI. Its approved direction combines a connection-first home with a persistent six-section workspace: Главная, Серверы, Правила, Устройства, Диагностика, Настройки. Local secondary navigation keeps related tools within their task.

The visual system uses slate surfaces, a restrained mint/teal accent, local inherited typography, open divisions and explicit native controls. The same hierarchy serves desktop and phone; status text distinguishes evidence from assumptions. No ornamental imagery is part of this system.

**Key Characteristics:**
- Connection state, selected outgoing server and deliberate checking remain distinct.
- Open sections and thin separators organize dense operational content.
- Native LuCI forms retain their behavior and draft state.
- Light and dark themes share hierarchy, readable states and labeled controls.

## Colors

### Primary

The light accent is deep teal; the dark accent is pale mint. Use the active theme's accent for primary actions, selected navigation, links and focus. Selected and hover surfaces provide quieter reinforcement; text must still name the state.

### Neutral

Use the active theme's background for the workspace, field for inputs and discrete server choices, foreground for primary text, muted for descriptions and line for thin separators. Danger and warning identify errors and caution alongside explanatory text. Frontmatter values are normative and come directly from the implementation.

**The Evidence Rule.** A running service, selected outbound, previous latency and an explicit network probe are separate evidence. Color never substitutes for their labels.

One workspace theme control defaults to the surrounding LuCI theme, then OS preference. An explicit light/dark choice applies to Forkop and positively identified Forkop dialogs. Embedded Next content inherits the workspace theme.

## Typography

All interface type inherits the local LuCI platform stack. No remote font or image dependency is introduced. Body, help, headings and compact measurement labels use the frontmatter roles. The workspace title becomes (26px) on mobile; selected outgoing names use (24px), becoming (22px) on mobile. Descriptions wrap within (75ch); standalone Next paragraphs use (70ch).

Measurements use tabular numerals. Totals and rates use binary Russian units, with explicit `/с` for rates. Unknown differs from zero. Long endpoint names and diagnostic output wrap without widening the page.

## Layout

Desktop uses an internal sidebar (184px) and a flexible `minmax(0,1fr)` main region. Main padding is (24px 32px 32px). At (1050px) and below the sidebar narrows to (160px), main padding becomes (24px), and the status strip can wrap. At (720px) and below the workspace becomes one column; one native select exposes all six destinations and names the current section, main padding becomes (16px), and local navigation wraps within the available width.

The shared service/last-check strip precedes the section title. The workspace theme control lives in Settings preferences, outside native editable panes. Home shows status and the selected outgoing connection before its change action and collapsed connectivity-check form, followed by service controls, the semantic traffic strip and additional routes. Embedded home omits repeated status headings; its refresh action follows the main content. Standalone Next retains its theme control. Server choices precede secondary telemetry; incoming listeners remain a separate destination. Section gaps use the established spacing scale, with open divisions rather than nested cards. Traffic metrics use five columns, three at (900px), then two at (720px).

Native form labels occupy (200px) beside a flexible field, with a (24px) gap and controls capped at (42rem). On mobile labels stack above controls and input text is (16px). Rule/server tables become labeled stacked rows with wrapping actions; other wide native tables scroll within their section and retain a (520px) minimum width. Do not apply the stacked-row conversion to every table.

## Elevation & Depth

The workspace and ordinary sections are flat, with tonal changes and thin separators providing structure. Native buttons and panels suppress inherited shadows. Only positively identified Forkop modals use the implemented shadow (`0 16px 48px rgba(0,0,0,.22)`). Dialogs scroll within the viewport; desktop bounds are `min(960px,calc(100vw - 32px))` by `calc(100dvh - 32px)`, becoming viewport minus (16px) on mobile.

## Shapes

The workspace and desktop modal use the workspace radius; mobile uses the choice radius. Controls use the control radius, error-count badges the badge radius, and discrete server choices the choice radius. Borders are (1px). Open task sections retain square, unboxed divisions. Checkboxes and radios remain native (20px) controls inside appropriately spaced rows.

## Components

### Buttons and fields

Native workspace buttons use the documented padding and at least (42px) height; navigation uses at least (44px). Next buttons have (8px 12px) padding and Next inputs (9px 10px); these are existing scoped variants. Primary actions use accent over background; secondary actions use field over foreground. Disabled controls use opacity (.55); busy controls show a progress cursor. Invalid fields use the danger border.

Focus is a (2px) accent outline with (3px) offset. Workspace button feedback uses `background-color 140ms ease-out`; standalone Next uses `.15s ease-out`. Primary check hover retains accent and uses `brightness(.93)`. Reduced-motion rules remove the relevant transitions and animations. No decorative motion is required.

### Navigation and native integration

Primary and local navigation use current-page semantics, tinted selection and explicit validation counts. Keep native `data-tab` IDs and original anchors as activation authorities. Navigation mirrors native current/invalid-field state without recreating draft fields. No navigation triggers a probe or route change.

**The Scoped Host Rule.** Scope new CSS to `.fkp-workspace`, `.fkp-next` or positively identified `.fkp-workspace-modal`. Strong host-theme overrides are bounded by `#cbi-forkop.fkp-workspace[data-theme]` and `#modal_overlay .fkp-workspace-modal[data-theme]`; never style generic LuCI headers or other applications.

### Server choices, traffic and diagnostics

Server choices are discrete field surfaces with selected tint, accent border and explicit selection wording. Traffic uses a semantic definition list with tabular values. Diagnostic output wraps, scrolls locally and states what was tested. Advanced features stay under their task rather than a single large advanced dashboard.

Native rules/settings retain parsing, dependencies, priority, modal editing and save/apply behavior. Settings that are not loaded must not parse empty values. Rebuilding a native map must rebuild the adapter, dispose previous subscriptions and preserve validation-location feedback.

Rule enable controls name their rule. Above/below buttons have at least (44px)
targets and stage the same native UCI order as optional drag/drop. Moving a row
keeps draft fields mounted and announces its position and Save/Apply requirement;
edge buttons disable and keyboard focus stays in the moved row. Rule-grid
checkboxes are (24px); native dialog controls retain their established sizing.

A probe result names its captured target and scope; route/service/configuration changes invalidate it. Hidden telemetry suspends, reset clears old live readings, requests do not overlap, and stale replies cannot restore obsolete state. Profile activation requires a current comparison.

Implementation sources: [workspace styles](fe-app-forkop/src/forkop/workspace/styles.ts), [Next styles](fe-app-forkop/src/forkop/next/styles.ts), renderers under `fe-app-forkop/src/forkop/workspace/` and `next/`, and native integration under `luci-app-forkop/htdocs/luci-static/resources/view/forkop/`. See [interface guide](docs/INTERFACE.md), [acceptance limits](docs/ACCEPTANCE.md), [surface direction](.impeccable/surfaces/fe-app-forkop-src-forkop-next-render-ts.md) and [finish review](.superpowers/sdd/2026-10-24-full-interface/impeccable-finish-review.md). The review's ship disposition covers its supplied implementation captures, not live installation, measured performance or unobserved runtime behavior.

## Do's and Don'ts

### Do:
- Do preserve native fields, activation authorities and validation-location feedback.
- Do use the active theme consistently inside the workspace and identified dialogs.
- Do keep status meaning explicit and unknown measurements distinct from zero.
- Do retain the mobile navigation, stacked form labels and targeted table adaptation.
- Do respect reduced motion and visible keyboard focus.

### Don't:
- Don't infer connection success from a running process, selected server or version check.
- Don't invent live metrics or expose deployment credentials and private endpoint metadata.
- Don't let Forkop styling escape into surrounding LuCI applications.
- Don't introduce remote fonts, ornamental imagery or a new token palette.
- Don't treat static screenshot review as proof of router installation or performance.
