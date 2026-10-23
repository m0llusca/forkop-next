# Installer deadline regression

2026-10-23, isolated Alpine VM. The existing installer ownership test exercises
real stubborn process trees and service probes, without touching router services.

Root-cause investigation found two distinct problems:

1. The test used `kill -0` as proof a descendant still ran. Diagnostic snapshot
   `1afda303d6f2` showed the reported PID 31000 was already `State: Z`, parent 1.
   It had been killed and was awaiting reaping. Assertions now distinguish dead
   zombie/exited states from executable processes; live descendants still fail.
2. Every recursive child lookup read every field of every `/proc/*/status` file,
   twice during termination. This traversal consumed the timeout budget itself
   under slower execution. Snapshot `347c2c091094` failed the unchanged prompt
   deadline assertion after correcting the zombie-only false failure. Earlier
   integration snapshots also failed the unchanged 15-second cleanup bound.

Minimal implementation uses Linux `/proc/PID/task/PID/children` when available,
with the existing process-table fallback retained. The fallback stops after
reading both PID and parent PID instead of parsing the remaining status fields.

GREEN: `bash tests/installer_owner.sh`, snapshot `f5d4c9cd61a9`, exit 0:
`installer ownership checks passed`. All original time limits remain unchanged,
including less than 4 seconds for a one-second command deadline and less than
15 seconds for the hanging service cleanup. Successful commands, stubborn
children, orphan probes, retry cancellation and legacy migration are exercised.
`Killed` fixture notices are expected evidence of deliberate process termination.
