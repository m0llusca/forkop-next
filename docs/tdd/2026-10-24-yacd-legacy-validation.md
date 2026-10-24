# Legacy YACD validation — 2026-10-24

## Cause and native LuCI behavior

Older configurations can contain `enable_yacd=1` without a secret. The current
backend keeps that controller private, but the native settings form required a
nonempty secret and blocked unrelated rule saves.

Read-only inspection of the installed LuCI form/UI sources confirmed:

- AbstractValue.parse rejects an active empty field when rmempty/optional are
  false, independently of a custom validator.
- Value.renderWidget passes optional || rmempty to Textfield validation.
- Flag.parse writes the current checkbox value when rmempty is false.

The fix therefore does not rely on an optional Textfield validator to protect
remote enablement. A save-time guard on the enabling flag rejects empty or
whitespace secrets before delegating to native Flag.parse.

## Behavior

- Effective checkbox value is off when the stored secret is missing/whitespace.
- Rendering performs no UCI write. An ordinary save delegates the effective off
  checkbox value to native parsing, matching the existing private controller.
- The description explains the private state of incomplete old configurations.
- A newly checked enable flag requires an entered nonempty secret at save time.
- The secret field retains masking and conditional validation; it can be empty
  when remote access is off. No secret is generated and backend behavior is
  unchanged.

## RED

From fe-app-forkop:

```
node node_modules/vitest/vitest.mjs run src/forkop/next/tests/controllerSettings.test.ts
```

Observed before production changes: 4 passed, 3 failed. Legacy empty/whitespace
cases returned enabled instead of off; explicit enable with an empty optional
secret resolved instead of rejecting. The fixture evaluates the actual shipped
settings.js and supplies minimal native option/UCI interfaces, including native
Flag.parse's write behavior. It is not a full LuCI browser integration test.

## GREEN

Controller settings: 7/7 passed, covering effective legacy off, no render-time
mutation or generated key, safe off persistence, explicit enable rejection before
write, valid secret enablement, whitespace rejection and field masking/dependency.

```
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
```

Full frontend: 600/600 passed across 56 files. Typecheck passed. No generated
main.js rebuild, commit, deployment or GitHub write was performed for this fix.
No live save or latency claim is made by these local checks.
