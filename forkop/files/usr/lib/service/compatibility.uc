// Forkop Next capability preflight. GPL-2.0-or-later.
let fs=require('fs'),uci=require('core.uci'),common=require('core.common');
function ok(data){return {success:true,data};}
function fail(error){return {success:false,error};}
function obj(x){return type(x)=='object'?x:{};}
function arr(x){return type(x)=='array'?x:[];}
function str(x){return type(x)=='string'?x:'';}
function quote(x){return "'"+replace(x,/'/g,"'\\''")+"'";}
function command(cmd,limit){let p=fs.popen(cmd+' 2>/dev/null','r');if(!p)return null;let raw=p.read(limit),status=p.close();return status==0?raw:null;}
function version(){let s=command('sing-box version',2048)||'';let m=match(s,/version ([A-Za-z0-9.+_-]+)/);return m?m[1]:'';}
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
function normalize(raw,server){
    raw=obj(raw);let stream=obj(raw.streamSettings),tls=obj(raw.tls),reality=obj(tls.reality),rs=obj(stream.realitySettings),ts=obj(stream.tlsSettings),settings=obj(raw.settings);
    let users=arr(settings.clients),user=length(users)==1?obj(users[0]):{};
    let transport=raw.transport,transport_type=type(transport)=='object'?transport.type:transport;
    let security=raw.security||stream.security||(tls.enabled?(reality.enabled?'reality':'tls'):'none');
    let result={protocol:str(raw.protocol||raw.type),transport:str(transport_type||stream.network||'tcp'),flow:str(raw.flow!=null?raw.flow:user.flow),encryption:str(raw.encryption||settings.decryption||'none'),security:str(security),sni:str(raw.sni||tls.server_name),server_names:arr(raw.server_names||rs.serverNames||ts.serverNames),short_ids:arr(raw.short_ids||rs.shortIds),short_id:str(obj(raw.reality).short_id||reality.short_id),public_key:str(obj(raw.reality).public_key||reality.public_key),insecure:tls.insecure==true};
    if(result.transport=='raw')result.transport='tcp';
    return result;
}
function local_client(payload){
    let config_path=getenv('FORKOP_SINGBOX_CONFIG')||uci.get(getenv('FORKOP_CONFIG_NAME')||'forkop','settings','config_path')||'/etc/sing-box/config.json';
    let stat=fs.stat(config_path);if(!stat||stat.size>1048576)return null;
    let config={};try{config=obj(json(fs.readfile(config_path)));}catch(e){return null;}
    let section=str(payload.section),tag=str(payload.outbound_tag),row=obj(uci.get_all(getenv('FORKOP_CONFIG_NAME')||'forkop',section));
    if(!match(section,/^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/)||!common.bool_option(row,'mixed_proxy_enabled',false))return null;
    let port=int(row.mixed_proxy_port),inbound=null,outbound=null;
    for(let i in arr(config.inbounds))if(i.type=='mixed'&&i.listen_port==port)inbound=i.tag;
    if(!inbound)return null;
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
    let checks=[],blocked=false,unknown=false;
    function add(capability,status,detail,next_step){push(checks,{capability,status,detail,next_step:next_step||''});if(status=='unsupported')blocked=true;if(status=='unknown')unknown=true;}
    if(!c.protocol||!s.protocol)add('metadata','unknown','Client or server metadata is missing.','Select the generated outbound and import redacted inbound metadata.');
    else{
        for(let field in ['protocol','transport','flow','encryption','security']){
            if(c[field]!=s[field])add(field,'unsupported','Client and server settings differ.','Align this capability on the client and server, then repeat preflight.');
            else add(field,'matched','Client and server metadata agree.');
        }
        if(c.protocol!='vless')add('protocol_support','unknown','This protocol has no verified compatibility adapter.','Run a dedicated section probe and review the core documentation.');
        if(index(['tcp','ws','grpc','http','httpupgrade'],c.transport)<0)add('transport_support',extended?'unknown':'unsupported','Transport requires a confirmed core capability.','Use a core that explicitly supports this transport and run preflight.');
        if(index(['','xtls-rprx-vision'],c.flow)<0)add('flow_support',extended?'unknown':'unsupported','Flow is not in the stock VLESS capability set.','Check the selected core capability and run a dedicated section probe.');
        if(c.encryption!='none')add('encryption_support',extended?'unknown':'unsupported','Non-default VLESS encryption requires explicit client support.','Use a matching supported client core; preserve the server encryption settings.');
        if(index(['tls','reality','none'],c.security)<0)add('security_support','unknown','Security capability is unknown.','Check current core documentation and repeat preflight.');
        if(c.insecure)add('certificate_validation','unsupported','Client disables certificate verification.','Enable certificate validation and use the correct server name.');
        if(c.security=='tls'||c.security=='reality'){
            if(!c.sni||length(s.server_names)==0)add('sni','unknown','Server name evidence is incomplete.','Supply the allowed server names and client SNI.');
            else if(index(s.server_names,c.sni)<0)add('sni','unsupported','Client SNI is not accepted by server metadata.','Set an allowed server name with valid certificate or REALITY configuration.');
            else add('sni','matched','Server name matches.');
        }
        if(c.security=='reality'){
            if(!c.public_key||length(s.short_ids)==0)add('reality','unknown','REALITY key or short ID evidence is incomplete.','Import a fresh client link from the configured inbound, then probe the section.');
            else if(index(s.short_ids,c.short_id)<0)add('reality','unsupported','REALITY short ID does not match.','Refresh the client link from this inbound.');
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
