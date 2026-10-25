# Preserve DNS after a rejected native Apply

The public CLI used to restore dnsmasq's original resolver after every failed
reload child. A reload can fail before changing a healthy runtime: validation
can reject a setting, or the native operation can report a busy lock or missing
checkpoint. The lifecycle deliberately preserves the old runtime in these cases.
The CLI's blanket recovery then detached DNS from that still-running runtime.

The normal DNS and selective firewall generators are unchanged from the 1.1.4
baseline when the later optional all-HTTPS mode is disabled. This fix preserves
that behavior without introducing an address cache, resolver or capture worker.
Modern-core adaptation, Extended features and maintenance recovery remain.

## Behavioral tests

Run with native ucode and its fs/UCI modules:

```sh
sh tests/cli_reload_dns_preservation.sh
sh tests/maintenance_lifecycle.sh
```

The fixture runs the real public CLI, production lifecycle functions and final
dispatcher, runtime validator, Next operation lock/preflight, DNS apply and
file-backed UCI writes. Only external process/service boundaries are replaced.
All configuration, subscription, FakeIP and service-marker files are temporary.

The initial test failed for each pre-mutation rejection: managed DNS changed,
the forwarder detached, UCI was committed and dnsmasq was restarted. Source
configuration, subscription and FakeIP bytes remained protected by assertions.

A first candidate that exempted every reload error passed those cases but failed
additional negative controls: a broken reload loader and a crash after stopping
the core left DNS pointing to an unavailable runtime. That candidate is not the
final fix.

## Completion acknowledgement

Each public reload now has its own private temporary result directory. The
lifecycle acknowledges its exact status only after the normal dispatcher and
lock cleanup return. Handled pre-mutation rejection preserves the old forwarder.
Errors after runtime cleanup remain unacknowledged to retain the caller's final
recovery attempt, including when the first DNS restart failed. The CLI skips
redundant DNS recovery only when the acknowledgement matches the child's
original status. A mismatched result cannot suppress recovery or change status.

A missing/broken loader or unexpected termination has no valid acknowledgement,
so DNS recovery remains active. The directory and result file are removed by
the caller. Failure to prepare the private directory rejects the operation
before invoking the child. No persistent settings or user-facing options are
introduced. The result file contains only the numeric command status.

Both native commands above passed for the final implementation. The focused
fixture also confirmed the failed-first-restart recovery retry and rejection of
a mismatched acknowledgement, while preserving the original command status.
Normal and strict compilation passed. Full backend/frontend/package gates remain
required before release; these checks do not certify live application connectivity.
