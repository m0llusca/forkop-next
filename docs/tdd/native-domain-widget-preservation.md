# Preserve domains through the native LuCI textarea contract

The quick-site helper was inserted as the first child of the bound LuCI
`ui.Textarea` root. Native `getValue()` and `setValue()` use that first child.
Saving the rule could therefore read `undefined` and remove its domain list,
including when the existing domains were not edited.

Two behavioral regressions exercise the production field registration and the
native first-child getter/setter contract: saving 120 existing synthetic domains
without changes, and adding a domain, saving, reopening, and removing that domain
while preserving all 120 prior entries.

Observed RED: both tests failed against the original renderer (first child was
the helper section and the getter returned `undefined`). GREEN: place the helper
and the intact native widget in an outer editor container. Native field identity,
textarea annotations, and the helper's visual order are preserved.

Validation: 915 frontend tests in 90 files passed; the focused rule/workflow
checks passed, as did type checking, lint, formatting, frontend build, and the
native LuCI renderer smoke test. Runtime device acceptance is recorded privately
and must not be inferred from these development checks.
