# HTTPS domain routing and maintenance restart

Scope: the whole configured source LAN when explicitly enabled.

The observed failure is domain routing bypass by clients using a public address:
the same service reaches the selected proxy through fresh FakeIP DNS but exits
directly with an already known public address. This is a packet-level observation,
not a claim about the native application's internal DNS cache implementation.

Add an opt-in `forkop.settings.https_domain_routing` flag, default `0` for existing
and new installations. When enabled, capture LAN TCP/443 after existing local,
DNAT and explicit priority bypass guards. Existing sing-box sniffing and route
rules select Main, another configured target, reject, or the direct final route.
No TLS decryption or certificate changes. Preserve IPv4 and IPv6 and exclude
router-originated traffic from this new LAN capture path. The flag participates
in the nft reload fingerprint and is visible in LuCI with the CPU cost explained.
The live installation will enable the flag for the whole configured source LAN.

Preserve the DNS forwarding contract during maintenance restarts/upgrades. Normal
explicit Stop remains unchanged. Reuse the existing reload-restart behavior where
possible, preserve FakeIP cache and selector choices, and restore the prior runtime
on failure. Do not rely on client cache clearing or a hard-coded service IP list.

All existing Extended features and native Main editor preservation remain.
Preserve all existing Main domains, their order/duplicates, lists, other rules and
selected servers. Enabling the settings flag is an explicit configuration choice.

Deliver a distinguishable corrected 1.2.1 package revision rather than silently
replacing existing published binaries. Validate complete packages and CI before
installation. Use a fresh off-router verified recovery snapshot, independent
watchdog, boot guard, registered worker and atomic confirm/rollback decision.
Acceptance requires cached-public-IP routing through Main, unrelated-domain direct
routing, explicit bypass/block preservation, reload/restart recovery, actual Codex
connections, resource checks and exact original Main preservation.

Private endpoints, adapter identifiers, logs, captures and backups stay outside
the public repository. Runtime fixtures use reserved example addresses.
