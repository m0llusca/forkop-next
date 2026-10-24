# Status version lookup — 2026-10-24

## Scope and measured cause

Read-only router measurements supplied by the integrating agent found `next
status` took 3.57 seconds, versus 0.21 seconds for `get_ui_state` and 0.04 seconds
for capabilities. Status launched `sing-box version` on every request; the
installed compressed core is approximately 21 MB and took approximately 3.5
seconds to start for this query.

Reuse the existing `singbox/runtime.uc version` contract. For an installed
`extended-compressed` core this reads the existing installed-version state;
other variants still query the binary. The status response continues to return
`unknown` for empty, malformed, or failed version reads. No new cache, runtime
owner changes, or capability admission changes are introduced. Version display
does not attest the binary's capabilities or identity.

## Behavioral regression

```
sh tests/next_status_version.sh
```

The test runs the real `service/next.uc` and canonical version reader with native
ucode/fs/uci. Configuration, Next storage, variant/version state and a controlled
core executable are isolated under a temporary directory. Assertions cover the
returned version, actual core executions, and the surrounding status contract.

Seven scenarios cover valid compressed state, missing compressed version state,
malformed compressed version state, stable and unmarked binary fallback, failed
binary execution, and malformed binary output. Stable fallback includes a stale
installed-version file to prove that a non-compressed binary is still queried.

## RED

Before changing production source, the integrating agent uploaded the source
tree and test into an isolated router `/tmp` fixture and ran the command with
the router's native ucode. The compressed valid-state case launched the core
once instead of zero times. Missing and malformed compressed-version cases
returned the executable's version instead of `unknown`, also launching the core
once instead of zero times. Stable, unmarked, failed-execution and malformed
output scenarios already passed. The production installation was unchanged.

## GREEN

After replacing only the status version lookup with the canonical reader CLI,
the integrating agent repeated the same isolated native fixture. All seven
scenarios passed: compressed valid/missing/malformed cases launched the core
zero times; stable/unmarked/failed/malformed binary cases each launched it once.
There were no reported runtime errors. The test itself was unchanged between
RED and GREEN.

The production edit quotes the library paths, checks the helper's exit status,
and accepts only a version token beginning with a digit. The remainder of the
status response and all write/action paths remain unchanged.

## Validation limits

The implementing agent's Windows environment has no bash or ucode, and WSL is
not installed. Native RED/GREEN execution above was performed and reported by
the integrating agent on the actual router using isolated temporary fixtures.
The implementing agent verified the scoped production diff with
`git diff --check -- forkop/files/usr/lib/service/next.uc`.

The full backend suite (`bash tests/run-backend.sh`) requires a Linux environment
with bash, Python and ucode/uci; it was not run for this scoped change in this
agent's environment. Integration must record any later full-suite results and
staged/live timing separately. The focused fixture does not certify deployment,
network connectivity or capability admission, and no live-file deployment was
performed by this agent.

## Integration timing

The integrating agent ran the modified source in an isolated read-only fixture
on the actual router: three status calls took 0.06, 0.06 and 0.05 seconds,
versus the measured baseline of 3.57 seconds. This is backend request timing,
not measured browser first paint. Production deployment is still pending.
