// Explicit network probe, independent from configuration-only route explanation.
let fs = require("fs"), common = require("core.common"), uci = require("core.uci");
let ip = require("core.ip");
function failure(error) { return { success: false, error }; }
function quote(value) { return "'" + replace(common.as_string(value), /'/g, "'\\''") + "'"; }
function valid_domain(value) {
    if (type(value) != "string" || length(value) > 253) return false;
    if (!match(value, /^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$/) || index(value,".") < 0 || index(value,"..") >= 0 || match(value,/^[0-9.]+$/)) return false;
    if (match(lc(value),/\.(local|lan|localhost|internal|home|arpa)$/)) return false;
    for (let label in split(value,".")) if (length(label)>63 || substr(label,0,1)=="-" || substr(label,-1)=="-") return false;
    return true;
}
function handle(payload) {
    if (type(payload) != "object" || !valid_domain(payload.domain)) return failure("invalid_probe_domain");
    let args = [ "curl", "--silent", "--head", "--location", "--max-redirs", "3", "--connect-timeout", "3", "--max-time", "8",
        "--proto", "=https", "--proto-redir", "=https", "--output", "/dev/null", "--write-out",
        "{\"http_status\":%{http_code},\"duration\":%{time_total},\"remote_ip\":\"%{remote_ip}\"}" ];
    let section = payload.section;
    if (section != null && section != "") {
        if (type(section) != "string" || !match(section,/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/)) return failure("invalid_section");
        let configured = common.object_or_empty(uci.get_all(getenv("FORKOP_CONFIG_NAME") || "forkop",section));
        let port = common.option(configured,"mixed_proxy_port","");
        if (!common.bool_option(configured,"mixed_proxy_enabled",false) || !match(port,/^[0-9]+$/) || int(port)<1 || int(port)>65535)
            return failure("section_probe_unavailable");
        let config_path = getenv("FORKOP_SINGBOX_CONFIG") || uci.get(getenv("FORKOP_CONFIG_NAME") || "forkop", "settings", "config_path") || "/etc/sing-box/config.json";
        let info = fs.stat(config_path), generated = {}, listener = null;
        if (!info || info.type != "file" || info.size > 1048576) return failure("section_probe_unavailable");
        try { generated = json(fs.readfile(config_path)); } catch (e) { return failure("section_probe_unavailable"); }
        let expected_tag = require("singbox.constants").inbound_tag(section + "-mixed");
        for (let inbound in common.array_or_empty(generated.inbounds))
            if (inbound.type == "mixed" && inbound.tag == expected_tag && int(inbound.listen_port) == int(port)) listener = inbound;
        if (!listener || type(listener.listen) != "string") return failure("section_probe_unavailable");
        let address = listener.listen;
        if (address == "0.0.0.0") address = "127.0.0.1";
        if (address == "::") address = "::1";
        if (!ip.valid_ipv4(address) && !ip.valid_ipv6(address)) return failure("section_probe_unavailable");
        push(args,"--proxy","socks5h://"+(ip.valid_ipv6(address)?"["+address+"]":address)+":"+port);
        let users = common.array_or_empty(listener.users);
        if (length(users) > 0)
            push(args,"--proxy-user",common.as_string(users[0].username)+":"+common.as_string(users[0].password));
    }
    push(args,"https://"+lc(payload.domain)+"/");
    let quoted=[]; for(let arg in args) push(quoted,quote(arg));
    let pipe=fs.popen(join(" ",quoted)+" 2>/dev/null","r");
    if(!pipe)return failure("probe_unavailable");
    let raw=pipe.read(8192),status=int(pipe.close()); if(status>255)status=int(status/256);
    let result={};try {result=json(raw);}catch(e){}
    let http=int(result.http_status||0);
    return {success:true,data:{reachable:status==0 && http>=100 && http<=599,http_status:http,curl_status:status,
        duration_ms:int((result.duration||0)*1000),remote_ip:common.as_string(result.remote_ip),checked_at:int(clock()[0]),
        route:section?"section":"current",section:section||null,limitation:"network_probe_only"}};
}
return { handle, valid_domain };
