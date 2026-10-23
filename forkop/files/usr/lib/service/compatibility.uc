// Forkop Next capability preflight. GPL-2.0-or-later.
let fs=require('fs'),uci=require('core.uci'),common=require('core.common');
function ok(data){return {success:true,data};}
function fail(error){return {success:false,error};}
function obj(x){return type(x)=='object'?x:{};}
function arr(x){return type(x)=='array'?x:[];}
function str(x){return type(x)=='string'?x:'';}
function quote(x){return "'"+replace(x,/'/g,"'\\''")+"'";}
function command(cmd,limit){let p=fs.popen(cmd+' 2>/dev/null','r');if(!p)return null;let raw=p.read(limit),status=p.close();return status==0?raw:null;}
function version(){return require('singbox.reality').runtime_version();}
function semver(s){let m=match(str(s),/^v?([0-9]+)\.([0-9]+)\.([0-9]+)$/);return m?[int(m[1]),int(m[2]),int(m[3])]:null;}
function safe_version(s){return semver(s)?s:'';}
function update_status(installed,latest){let a=semver(installed),b=semver(latest);if(!a||!b)return 'unknown';for(let i=0;i<3;i++){if(b[i]>a[i])return 'update_available';if(b[i]<a[i])return 'current';}return 'current';}
function updates(payload){
    let installed=obj(payload.installed),result=[];
    for(let item in [{component:'3x-ui',repo:'MHSanaei/3x-ui',installed:safe_version(installed.panel)},{component:'xray',repo:'XTLS/Xray-core',installed:safe_version(installed.xray)}]){
        let url='https://api.github.com/repos/'+item.repo+'/releases/latest';
        let raw=command('curl --silent --fail --proto =https --connect-timeout 3 --max-time 8 --max-filesize 262144 '+quote(url),262145),release={};
        try{release=obj(json(raw||'{}'));}catch(e){}
        let latest=semver(release.tag_name)&&release.prerelease!=true&&release.draft!=true?release.tag_name:'';
        push(result,{component:item.component,installed:item.installed,latest,status:update_status(item.installed,latest),url:'https://github.com/'+item.repo+'/releases',checked_at:int(clock()[0])});
    }
    return ok({updates:result,automatic_install:false});
}
function metadata_object(raw,key){
    if(index(keys(raw),key)<0)return {};
    let value=raw[key];
    if(type(value)=='string'){
        try{value=json(value);}catch(e){return null;}
    }
    return type(value)=='object'?value:null;
}
function canonical_transport(value){
    value=lc(str(value));
    if(value=='raw')return 'tcp';
    if(value=='websocket')return 'ws';
    if(value=='splithttp')return 'xhttp';
    if(value=='mkcp')return 'kcp';
    return value;
}
function canonical_short_id(value){
    if(type(value)!='string'||length(value)>16||length(value)%2!=0||!match(value,/^[0-9A-Fa-f]*$/))return null;
    value=lc(value);
    while(length(value)<16)value+='0';
    return value;
}
function normalize(raw,server){
    raw=obj(raw);
    let stream=metadata_object(raw,'streamSettings'),settings=metadata_object(raw,'settings');
    if(stream==null||settings==null)return null;
    let tls=obj(raw.tls),reality=obj(tls.reality),rs=obj(stream.realitySettings),ts=obj(stream.tlsSettings);
    // Current Xray prefers clients over users, and inherits the settings flow.
    let users=arr(settings.clients!=null?settings.clients:settings.users);
    let user=length(users)==1?obj(users[0]):{};
    let transport=raw.transport,transport_type=type(transport)=='object'?transport.type:transport;
    let security=raw.security||stream.security||(tls.enabled?(reality.enabled?'reality':'tls'):'none');
    let client_reality=obj(raw.reality),short_id='';
    if(index(keys(client_reality),'short_id')>=0)short_id=client_reality.short_id;
    else if(index(keys(reality),'short_id')>=0)short_id=reality.short_id;
    return {
        protocol:str(raw.protocol||raw.type),
        transport:canonical_transport(transport_type||(stream.method!=null?stream.method:(stream.network||'tcp'))),
        flow:str(raw.flow!=null?raw.flow:(user.flow||settings.flow||'')),
        encryption:str(raw.encryption||settings.decryption||'none'),
        security:lc(str(security)),
        sni:str(raw.sni||tls.server_name),
        server_names:arr(raw.server_names||rs.serverNames),
        short_ids:arr(raw.short_ids||rs.shortIds),
        short_id,
        public_key:str(obj(raw.reality).public_key||reality.public_key),
        insecure:tls.insecure==true,
        tls_max_version:str(tls.max_version||ts.maxVersion),
        ambiguous_client:server&&index(keys(raw),'settings')>=0&&length(users)!=1
    };
}
function local_client(payload){
    let config_path=getenv('FORKOP_SINGBOX_CONFIG')||uci.get(getenv('FORKOP_CONFIG_NAME')||'forkop','settings','config_path')||'/etc/sing-box/config.json';
    let stat=fs.stat(config_path);if(!stat||stat.size>1048576)return null;
    let config={};try{config=obj(json(fs.readfile(config_path)));}catch(e){return null;}
    let section=str(payload.section),tag=str(payload.outbound_tag),row=obj(uci.get_all(getenv('FORKOP_CONFIG_NAME')||'forkop',section));
    if(!match(section,/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/)||!common.bool_option(row,'mixed_proxy_enabled',false))return null;
    let port=int(row.mixed_proxy_port),inbound=null,outbound=null,count=0;
    let expected_tag=require('singbox.constants').inbound_tag(section+'-mixed');
    for(let i in arr(config.inbounds))if(i.tag==expected_tag){
        if(i.type!='mixed'||i.listen_port!=port)return null;
        let ip=require('core.ip');
        if(!ip.valid_ipv4(i.listen)&&!ip.valid_ipv6(i.listen))return null;
        inbound=i.tag;count++;
    }
    if(count!=1||port<1||port>65535)return null;
    // First matching unconditional inbound rule must lead directly to this outbound.
    for(let rule in arr(obj(config.route).rules)){
        if(rule.inbound==null&&index(['route','reject','hijack-dns'],rule.action||'route')>=0){
            // HTTPS on TCP/443 cannot hit a DNS-only guard; other unscoped
            // terminal rules may shadow this mixed inbound, so do not certify.
            if(!(rule.action=='hijack-dns'&&(rule.port==53||rule.protocol=='dns')))return null;
        }
        let ins=type(rule.inbound)=='array'?rule.inbound:[rule.inbound];
        if(index(ins,inbound)<0)continue;
        if(length(keys(rule))>3||rule.action!='route'||(tag&&rule.outbound!=tag))return null;
        for(let out in arr(config.outbounds))if(out.tag==rule.outbound&&out.type!='selector'&&out.type!='urltest')outbound=out;
        return outbound;
    }
    return null;
}
function check(payload){
    if((payload.client!=null&&type(payload.client)!='object')||(payload.server!=null&&type(payload.server)!='object'))return fail('invalid_compatibility_metadata');
    let local=local_client(payload),c=normalize(local||payload.client,false),s=normalize(payload.server,true),v=version(),extended=index(lc(v),'extended')>=0;
    if(c==null||s==null)return fail('invalid_compatibility_metadata');
    let checks=[],blocked=false,unknown=false;
    function add(capability,status,detail,next_step){push(checks,{capability,status,detail,next_step:next_step||''});if(status=='unsupported')blocked=true;if(status=='unknown')unknown=true;}
    if(!c.protocol||!s.protocol)add('metadata','unknown','Client or server metadata is missing.','Select the generated outbound and import redacted inbound metadata.');
    else{
        if(s.ambiguous_client)add('server_client','unknown','Server inbound does not identify one selected client.','Supply normalized metadata for exactly the selected client.');
        for(let field in ['protocol','transport','flow','encryption','security']){
            if(field=='flow'&&s.ambiguous_client)continue;
            if(c[field]!=s[field])add(field,'unsupported','Client and server settings differ.','Align this capability on the client and server, then repeat preflight.');
            else add(field,'matched','Client and server metadata agree.');
        }
        if(c.protocol!='vless')add('protocol_support','unknown','This protocol has no verified compatibility adapter.','Run a dedicated section probe and review the core documentation.');
        if(index(['tcp','ws','grpc','httpupgrade'],c.transport)<0)add('transport_support',extended?'unknown':'unsupported','Transport requires a confirmed core capability.','Use a core that explicitly supports this transport and run preflight.');
        if(index(['http','h2','h3','quic'],s.transport)>=0)add('server_transport','unsupported','This transport was removed from the current Xray capability profile.','Select a transport supported by both cores, then repeat preflight.');
        if(s.security=='reality'&&index(['tcp','xhttp','grpc'],s.transport)<0)add('server_reality_transport','unsupported','Current Xray cannot use REALITY with this transport.','Use a supported REALITY transport on both sides.');
        if(index(['','xtls-rprx-vision'],c.flow)<0)add('flow_support',extended?'unknown':'unsupported','Flow is not in the stock VLESS capability set.','Check the selected core capability and run a dedicated section probe.');
        if(c.encryption!='none')add('encryption_support',extended?'unknown':'unsupported','Non-default VLESS encryption requires explicit client support.','Use a matching supported client core; preserve the server encryption settings.');
        for(let side in [c,s])if(side.flow=='xtls-rprx-vision'&&side.encryption=='none'){
            if(side.transport!='tcp'||index(['tls','reality'],side.security)<0)add('vision_transport','unsupported','Vision requires direct TLS or REALITY over RAW/TCP.','Select matching RAW/TCP with TLS or REALITY.');
            if(side.security=='tls'&&index(['1.0','1.1','1.2'],side.tls_max_version)>=0)add('vision_tls_version','unsupported','Vision requires TLS 1.3, but metadata limits TLS below it.','Allow TLS 1.3 on both sides.');
        }
        if(index(['tls','reality','none'],c.security)<0)add('security_support','unknown','Security capability is unknown.','Check current core documentation and repeat preflight.');
        if(c.insecure)add('certificate_validation','unsupported','Client disables certificate verification.','Enable certificate validation and use the correct server name.');
        if(c.security=='tls'||c.security=='reality'){
            if(!c.sni||length(s.server_names)==0)add('sni','unknown','Server name evidence is incomplete.','Supply the allowed server names and client SNI.');
            else if(index(s.server_names,c.sni)<0)add('sni','unsupported','Client SNI is not accepted by server metadata.','Set an allowed server name with valid certificate or REALITY configuration.');
            else add('sni','matched','Server name matches.');
        }
        if(c.security=='reality'){
            // Pinned native handshake evidence; do not extrapolate future versions.
            if(replace(str(obj(payload.installed).xray),/^v/,'')=='26.10.21'){
                let known_stock=index(['1.13.7','1.14.3'],replace(v,/^v/,''))>=0;
                let adapter=require('singbox.reality'),profile=adapter.verified_runtime(v);
                let hybrid=local&&adapter.hybrid_enabled(local,profile);
                add('reality_key_exchange',hybrid?'matched':(known_stock?'unsupported':'unknown'),
                    hybrid?'Selected outbound uses the validated Extended hybrid REALITY profile.':(known_stock?'This stock client omits the hybrid key share required by Xray 26.10.21.':'This client has no validated hybrid REALITY handshake profile for Xray 26.10.21.'),
                    hybrid?'':'Use the validated Extended binary with Chrome uTLS and generated support_x25519mlkem768 enabled, then probe this section. Preserve explicit legacy choices and certificate validation.');
            }
            let client_id=canonical_short_id(c.short_id),server_ids=[],invalid_id=client_id==null;
            for(let id in s.short_ids){let normalized=canonical_short_id(id);if(normalized==null)invalid_id=true;else push(server_ids,normalized);}
            if(!c.public_key||length(s.short_ids)==0)add('reality','unknown','REALITY key or short ID evidence is incomplete.','Import a fresh client link from the configured inbound, then probe the section.');
            else if(invalid_id)add('reality','unsupported','REALITY short ID encoding is invalid.','Use even-length hexadecimal short IDs of at most eight bytes.');
            else if(index(server_ids,client_id)<0)add('reality','unsupported','REALITY short ID does not match.','Refresh the client link from this inbound.');
            else add('reality','matched','REALITY short ID matches; the key still needs a live handshake.');
        }
    }
    let result={status:blocked?'unsupported':'probe_required',checks,outbounds:local?[{outbound_tag:local.tag,label:local.tag}]:[],client:{core:'sing-box',version:v},server:{panel_version:safe_version(obj(payload.installed).panel),xray_version:safe_version(obj(payload.installed).xray)},scope:'metadata_preflight',future_compatibility_guaranteed:false};
    if(payload.probe==true&&!blocked&&!unknown&&local&&payload.domain){
        let p=require('service.probe').handle({domain:payload.domain,section:payload.section});
        if(p.success){result.probe={reachable:p.data.reachable,http_status:p.data.http_status,curl_status:p.data.curl_status,checked_at:p.data.checked_at,route:p.data.route};if(p.data.reachable)result.status='verified';}
        else result.probe={error:p.error};
    }
    if(result.status!='verified')add('runtime_probe','unknown','A current selected-outbound handshake is required.','Enable the section mixed proxy, select its generated outbound, and run an explicit HTTPS probe.');
    return ok(result);
}
function handle(action,payload){if(type(payload)!='object')return fail('invalid_compatibility_metadata');if(action=='compatibility_updates')return updates(payload);if(action=='compatibility_check')return check(payload);return fail('unknown_action');}
return {handle};
