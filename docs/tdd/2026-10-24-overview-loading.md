# Overview initial-read deduplication — 2026-10-24

## Scope

Share only the initial `status` and `profile_list` reads between the overview,
device/profile tools and compatibility panel. Preserve the UI, action paths,
error handling and all capability/Extended behavior. Each mount owns its initial
promises; explicit refresh and action handlers retain the original request
function and therefore do not reuse startup results.

## RED

From `fe-app-forkop`:

```
node node_modules/vitest/vitest.mjs run src/forkop/next/tests/render.test.ts
```

Observed 2026-10-24: 21 passed, 2 failed. Initial status read count was 3 instead
of 1. With the first status read unresolved, explicit refresh produced 4 reads
instead of 2. Failures occurred on request-count assertions before production
changes.

## GREEN

The two new integration tests verify one initial read per shared operation,
independent rendering while device data remains unresolved, populated profile
controls, and fresh explicit refresh while the original status remains pending.

```
node node_modules/vitest/vitest.mjs run src/forkop/next/tests/render.test.ts src/forkop/next/tests/tools.test.ts src/forkop/next/tests/compatibility.test.ts
```

37/37 passed. Broader verification after formatting:

```
node node_modules/vitest/vitest.mjs run src/forkop/next/tests
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/forkop/next/render.ts src/forkop/next/tools.ts src/forkop/next/compatibility.ts src/forkop/next/tests/render.test.ts --max-warnings=0
git diff --check
```

57/57 tests passed across 9 files; typecheck, scoped lint and whitespace checks
passed. Existing tests cover profile preview invalidation, explicit probe and
Smart Detect actions, failed reads and retry, selected-server data, compatibility,
device/profile actions and CLI boundaries.

## Limits

No router access, deployment, commit or GitHub write. This source change reduces
the nine initial high-level loads to six; it does not certify live latency or
compression. Generated LuCI bundle rebuilding remains an integration step.
