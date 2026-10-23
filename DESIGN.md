# Interface implementation direction

The confirmed direction in PRODUCT.md is an Operate surface: a calm home control panel, Russian first, compatible with LuCI, phone and desktop, with explicit detailed diagnostics. Existing routing/settings/server/monitoring tabs remain intact.

The new overview uses native labels, inputs and selects, open section divisions rather than nested cards, and no remote fonts/assets. Everyday decisions remain visible in the simple mode; route trace is revealed in detailed mode. State and errors use live regions. Profiles require a comparison before activation and invalidate the comparison when the selected profile changes.

Tokens are defined in fe-app-forkop/src/forkop/next/styles.ts: light background #f6f7f8, foreground #17252d, muted #455863, line #ced7dc, accent #14635e, field #ffffff; dark background #16232b, foreground #eef4f6, muted #b8c8d0, line #455963, accent #8bd6c8, field #21333e. Body follows LuCI's local platform typography; status numerals are tabular. Base spacing 8px, layout gaps 24px and 32px, inputs/buttons at least 42px, mobile fields 16px to avoid forced zoom. Breakpoint 720px switches to one column. Corners: surface 12px (mobile 8px), controls 6px. Focus uses a 2px accent outline with 3px offset. Motion is limited to control background changes and disabled for reduced-motion preferences.

Appearance defaults to operating-system dark/light preference and has explicit light/dark overrides. Native LuCI styles outside the overview are retained.
