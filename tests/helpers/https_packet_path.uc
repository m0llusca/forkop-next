// Bounded packet-path model for generated nft commands, not a kernel substitute.
// Abstract destinations, set membership and FIB ownership are explicit inputs.
// This models hook/verdict order, not CIDR classification or socket lookup.
let fs = require("fs");
let chains = {};
let hooks = [];
for (let line in split(fs.readfile(ARGV[0]), "\n")) {
    let fields = split(line, " ");
    if (fields[0] != "add" || fields[2] != "inet")
        continue;
    if (fields[1] == "chain") {
        chains[fields[4]] = [];
        let priority = match(line, /hook prerouting priority (-?[0-9]+);/);
        if (priority)
            push(hooks, { name: fields[4], priority: int(priority[1]) });
    }
    if (fields[1] == "rule")
        push(chains[fields[4]], slice(fields, 5));
}
// Standard first-packet DNAT establishes the binding at dstnat (-100).
push(hooks, { name: "fixture_dnat", priority: -100 });
sort(hooks, function(a, b) { return a.priority - b.priority; });

function number(value) {
    if (substr(value, 0, 2) != "0x") return int(value);
    let result = 0;
    for (let i = 2; i < length(value); i++)
        result = result * 16 + index("0123456789abcdef", lc(substr(value, i, 1)));
    return result;
}

function member(packet, field, value) {
    if (substr(value, 0, 1) != "@")
        return packet[field] == value;
    let memberships = packet[field + "_sets"] || [];
    for (let set in memberships)
        if ("@" + set == value)
            return true;
    return false;
}

let evaluate_chain;
function rule(args, packet) {
    for (let i = 0; i < length(args);) {
        let key = args[i++];
        if (key == "counter")
            continue;
        if (key == "return" || key == "accept")
            return key;
        if (key == "jump") {
            let verdict = evaluate_chain(args[i++], packet);
            if (verdict == "accept")
                return verdict;
            continue;
        }
        if (key == "ct") {
            if (args[i++] != "status" || args[i++] != "dnat")
                die("Unsupported ct expression\n");
            if (!packet.dnat)
                return null;
            continue;
        }
        if (key == "fib") {
            if (join(" ", slice(args, i, i + 4)) != "daddr type local return")
                die("Unsupported fib expression\n");
            return packet.fib_local ? "return" : null;
        }
        if (key == "meta") {
            let field = args[i++];
            if (field == "mark") {
                if (args[i] == "set") {
                    i++;
                    packet.mark = number(args[i++]);
                    continue;
                }
                if (args[i] == "&") {
                    i++;
                    let mask = number(args[i++]);
                    if (args[i++] != "==") die("Unsupported mark operator\n");
                    if ((packet.mark & mask) != number(args[i++])) return null;
                    continue;
                }
                if (packet.mark != number(args[i++])) return null;
                continue;
            }
            if (field != "l4proto") die("Unsupported meta field\n");
            let inverted = args[i] == "!=";
            if (inverted) i++;
            if ((packet.protocol == args[i++]) == inverted) return null;
            continue;
        }
        if (key == "iifname" || key == "ip" || key == "ip6" || key == "tcp" || key == "udp") {
            let field = "iif";
            if (key == "ip" || key == "ip6") {
                if (packet.family != (key == "ip" ? 4 : 6)) return null;
                field = args[i++];
            }
            if (key == "tcp" || key == "udp") {
                if (packet.protocol != key) return null;
                if (args[i++] != "dport") die("Unsupported transport expression\n");
                field = "port";
            }
            let inverted = args[i] == "!=";
            if (inverted) i++;
            if (member(packet, field, args[i++]) == inverted) return null;
            continue;
        }
        if (key == "tproxy") {
            let family = args[i++];
            if (packet.family != (family == "ip" ? 4 : 6)) return null;
            if (args[i++] != "to") die("Unsupported tproxy expression\n");
            packet.target = args[i++];
            packet.captures++;
            continue;
        }
        die("Unsupported generated nft expression: " + key + "\n");
    }
    return null;
}

evaluate_chain = function(name, packet) {
    for (let args in chains[name] || []) {
        let verdict = rule(args, packet);
        if (verdict != null)
            return verdict;
    }
    return null;
};

function check(label, family, overrides, expected) {
    let packet = {
        family, protocol: "tcp", port: "443", iif: "br-lan",
        iif_sets: [ "forkop_interfaces" ], daddr: "internet-destination",
        daddr_sets: [], mark: 0, dnat: false, fib_local: false,
        captures: 0, target: ""
    };
    for (let key, value in overrides) packet[key] = value;
    for (let hook in hooks) {
        if (hook.name == "fixture_dnat") {
            if (packet.translate) {
                packet.dnat = true;
                packet.daddr = "translated-local-server";
                packet.daddr_sets = [ family == 4 ? "localv4" : "localv6" ];
            }
        }
        else evaluate_chain(hook.name, packet);
    }
    if (packet.captures != expected)
        die("FAIL: " + label + " IPv" + family + ": expected " + expected + " captures, got " + packet.captures + "\n");
    if (expected == 0 && packet.mark != (overrides.mark || 0))
        die("FAIL: " + label + " acquired an unexpected tproxy mark\n");
}

for (let family in [ 4, 6 ]) {
    if (ARGV[1] == "bypass") {
        check("explicit priority bypass across hooks", family,
            { daddr_sets: [ family == 4 ? "forkop_rule_bypass_subnets" : "forkop_rule_bypass_subnets6" ] }, 0);
        continue;
    }
    check("first-packet hairpin DNAT", family, { translate: true }, 0);
    check("ordinary Internet HTTPS", family, {}, 1);
    check("router-owned public address", family, { fib_local: true }, 0);
    check("local destination", family, { daddr_sets: [ family == 4 ? "localv4" : "localv6" ] }, 0);
    check("outside source LAN", family, { iif: "wan", iif_sets: [] }, 0);
    check("UDP443", family, { protocol: "udp" }, 0);
    check("TCP8443", family, { port: "8443" }, 0);
    check("outbound loop mark", family, { mark: 0x00200000 }, 0);
    check("existing proxy flow", family, { mark: 0x00100000 }, 1);
}
print("HTTPS packet-path model checks passed\n");
