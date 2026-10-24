// Read-only filter drafts over a proven captured pool. Never import generator.uc.
let fs=require('fs');
let common=require('core.common');
let basis=require('singbox.preview_basis');
let connections=require('config.connections');
let resolver=require('singbox.group_resolver').create(connections);
let url=require('core.url');
let arr=common.array_or_empty, obj=common.object_or_empty;
let filter_keys=['filter_mode','detect_server_country','include_countries','include_outbounds','include_regex',
    'include_proxy_parameters','include_protocols','include_transports','include_securities',
    'exclude_countries','exclude_outbounds','exclude_regex','exclude_proxy_parameters','exclude_protocols','exclude_transports','exclude_securities'];
let group_keys=['name','interrupt_exist_connections','pick_fastest','switch_to_faster_same_priority','pin_dashboard'];
let row_keys={urltest:['.name','.type','section','name','interrupt_exist_connections','pin_dashboard'],
    priority_group:['.name','.type','section'],priority_level:['.name','.type','group','name','order','direct','country','server_name','regex']};
for(let key in filter_keys) {push(row_keys.urltest,key);push(row_keys.priority_level,key);}
for(let key in group_keys) push(row_keys.priority_group,key);
let parent_keys=['urltest_enabled','detect_server_country'];
for(let prefix in ['dashboard_','urltest_']) for(let key in filter_keys) push(parent_keys,prefix+key);
for(let key in ['dashboard_include_groups','dashboard_exclude_groups']) push(parent_keys,key);
function fail(error,reason) {return {success:false,error,reason:reason || error};}
function id(value) {return type(value)=='string'&&length(value)<=96&&match(value,/^[A-Za-z0-9_-]+$/)!=null;}
function label_context(saved,state) {
    let context={values:{},certain:true};
    function add(value) {
        if(type(value)=='string'&&value!='')context.values[value]=true;
    }
    function strings(value) {
        if(type(value)=='object'||type(value)=='array')for(let key,item in value)strings(item);
        else add(value);
    }
    function outbound(value) {
        if(type(value)!='object') {context.certain=false;return;}
        // Only the outbound's display fields are labels. All other string values,
        // including unknown protocol options and nested headers, are private context.
        for(let key,item in value)if(index(['tag','remark'],key)<0)strings(item);
    }
    function source_url(value,manual) {
        value=common.as_string(value);
        if(value=='')return;
        // Match manual_link_outbound's single preprocessing step before the
        // shared URL component helpers decode userinfo/query. Do not recurse or
        // apply this manual-link interpretation to subscription request URLs.
        if(manual&&url.scheme(value)!='vmess')value=url.strip_fragment(url.decode(value));
        let scheme=url.scheme(value);
        if(index(['http','https','vless','trojan','hysteria2','hy2','socks','socks4','socks5'],scheme)<0) {
            context.certain=false;return;
        }
        add(value);
        let user=url.userinfo(value);add(user);
        for(let part in split(user,':'))add(part);
        for(let key,item in url.query_params(value))add(item);
        for(let part in split(url.path(url.strip_fragment(value)),'/'))add(url.decode(part));
    }
    function credential_fields(value) {
        if(type(value)!='object'&&type(value)!='array')return;
        for(let key,item in value) {
            if(match(common.as_string(key),/password|passwd|uuid|private_key|preshared_key|token|secret|auth|username|hwid|user_agent|cookie|headers/i))strings(item);
            else credential_fields(item);
        }
    }
    credential_fields(saved);
    for(let section in arr(saved.section)) {
        for(let raw in connections.outbound_jsons(section)) {
            try {outbound(json(raw));}catch(e){context.certain=false;}
        }
        for(let link in connections.connection_urls(section))source_url(link,true);
        let sources=section.subscription_urls;
        for(let source in type(sources)=='array'?sources:[sources])if(source!=null)source_url(source);
    }
    for(let source in arr(saved.subscription_url))source_url(source.url);
    for(let record in arr(obj(state.previewBasis).sourceFiles)) {
        // Recheck this captured read before using it as label evidence. A concurrent
        // replacement cannot remove a credential from the context we certify.
        let raw=fs.readfile(record.path);
        if(basis.digest(raw)!=record.digest)die('source_changed');
        if(raw==null)continue;
        if(match(record.path,/\.json$/)) {
            try {for(let item in arr(obj(json(raw)).outbounds))outbound(item);}
            catch(e){context.certain=false;}
        }
        else if(match(record.path,/\.url$/))source_url(split(raw,'\n')[0]);
        else add(raw);
    }
    return context;
}
function safe_name(value,fallback,context) {
    value=common.as_string(value);
    if(!context.certain)return fallback;
    for(let secret in keys(context.values))if(index(value,secret)>=0)return fallback;
    // Keep the shape guard in addition to comparison with actual private inputs.
    if(length(value)>160||match(value,/:\/\/|@|[?&](token|key|password|secret|uuid)=|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i))return fallback;
    return value==''?fallback:value;
}
function fields(value,allowed) {
    if(type(value)!='object')return false;
    for(let key,v in value) {
        if(index(allowed,key)<0)return false;
        let values=type(v)=='array'?v:[v];
        if(length(values)>128)return false;
        for(let item in values) {
            if(type(item)!='string'||length(item)>256)return false;
            if(match(key,/regex$/)) {try {regexp(item);}catch(e){return false;}}
        }
        if(match(key,/filter_mode$/)&&index(['disabled','include','exclude','mixed'],v)<0)return false;
        if(match(key,/detect_server_country$/)&&index(['flag_emoji','country_is'],v)<0)return false;
        if(key=='order'&&(type(v)!='string'||match(v,/^[0-9]{1,8}$/)==null))return false;
        if(match(key,/^(direct|urltest_enabled|.*proxy_parameters|interrupt_exist_connections|pin_dashboard|pick_fastest|switch_to_faster_same_priority)$/)&&index(['0','1'],v)<0)return false;
    }
    return true;
}
function validate(request,saved) {
    if(type(request)!='object'||request.schema!=1||!id(request.section)||!id(request.requestId))return false;
    if(length(sprintf('%J',request))>131072)return false;
    for(let key in keys(request))if(index(['schema','section','requestId','expectedCapture','draft'],key)<0)return false;
    if(request.expectedCapture!=null&&(type(request.expectedCapture)!='string'||match(request.expectedCapture,/^[a-f0-9]{64}$/)==null))return false;
    let draft=request.draft;
    if(type(draft)!='object'||!fields(draft.section,parent_keys))return false;
    for(let key in keys(draft))if(index(['section','urltest','priority_group','priority_level'],key)<0)return false;
    let seen={},groups={};
    for(let kind in ['urltest','priority_group','priority_level']) {
        let rows=draft[kind];
        if(type(rows)!='array'||length(rows)>(kind=='priority_level'?128:64))return false;
        for(let row in rows) {
            if(!fields(row,row_keys[kind])||row['.type']!=kind||!id(row['.name'])||seen[row['.name']])return false;
            seen[row['.name']]=true;
            let owner=kind=='priority_level'?'group':'section';
            if(kind=='priority_level'?!groups[row.group]:row.section!=request.section)return false;
            for(let other_kind in ['section','subscription_url','section_interface','urltest','priority_group','priority_level'])
                for(let original in arr(saved[other_kind]))
                    if(original['.name']==row['.name']&&(other_kind!=kind||original[owner]!=row[owner]))return false;
            if(kind=='priority_group')groups[row['.name']]=true;
        }
    }
    return true;
}
function country_missing(section,state) {
    let tests=[];
    function add(method,mode,include,exclude) {
        if(method=='country_is'&&resolver.configured_country_filter(mode,include,exclude))push(tests,true);
    }
    add(connections.dashboard_detect_server_country(section),connections.dashboard_filter_mode(section),
        connections.dashboard_include_countries(section),connections.dashboard_exclude_countries(section));
    for(let u in connections.urltests(section))add(connections.urltest_detect_server_country(section,u),
        connections.urltest_filter_mode(section,u),connections.urltest_include_countries(section,u),connections.urltest_exclude_countries(section,u));
    for(let g in connections.priority_groups(section))for(let l in connections.priority_levels(g))
        if(!connections.priority_level_direct(g,l))add(connections.priority_level_detect_server_country(g,l),
            connections.priority_level_filter_mode(g,l),connections.priority_level_include_countries(g,l),connections.priority_level_exclude_countries(g,l));
    if(!length(tests))return false;
    for(let tag in arr(state.urltestCandidateTags))if(!obj(obj(state.outboundMetadata).countries)[tag])return true;
    return false;
}
function resolve(section,state,request,capture,context) {
    let tags=arr(state.urltestCandidateTags), ids={},candidates=[],groups=[];
    for(let i=0;i<length(tags);i++) {
        ids[tags[i]]='node_'+i;
        push(candidates,{id:ids[tags[i]],name:safe_name(obj(obj(state.outboundMetadata).names)[tags[i]],'Node '+(i+1),context)});
    }
    ids['direct-out']='direct';
    let pool=resolver.section_pool_candidate_outbounds(section,tags,state);
    function level(level_id,name,direct,raw,members,decisions,assigned,fallback_name) {
        let overlap=[], result=[];
        for(let tag in raw)if(index(members,tag)<0&&assigned[tag])push(overlap,{member:ids[tag],assignedLevel:assigned[tag]});
        for(let tag in tags) {
            let included=index(members,tag)>=0;
            let reason=index(pool,tag)<0?'pool_excluded':assigned[tag]&&index(raw,tag)>=0&&!included?'earlier_level':obj(decisions[tag]).reason || 'include_miss';
            push(result,{member:ids[tag],included,reasons:[reason]});
        }
        if(direct)push(result,{member:'direct',included:index(members,'direct-out')>=0,reasons:['direct_level']});
        return {id:level_id,name:safe_name(name,fallback_name,context),direct,members:map(members,function(t){return ids[t];}),
            count:length(members),empty:length(members)==0,overlap,decisions:result};
    }
    for(let u in connections.urltests(section)) {
        let trace={};resolver.set_trace(function(tag,included,reason){trace[tag]={included,reason};});
        let members=resolver.urltest_filtered_outbounds(section,u,pool,state);
        groups[length(groups)]={id:u,kind:'urltest',name:safe_name(connections.urltest_display_name(section,u),'URLTest '+(length(groups)+1),context),
            count:length(members),omitted:!length(members),interrupt:connections.urltest_interrupt_exist_connections(section,u),
            levels:[level(u,'URLTest',false,members,members,trace,{},'URLTest')],fallbackOrder:length(members)?[u]:[]};
    }
    for(let g in connections.priority_groups(section)) {
        resolver.set_trace(null);
        let assigned_levels=resolver.priority_levels_with_outbounds(g,pool,state),levels=[],assigned={},fallback=[];
        for(let entry in assigned_levels) {
            let trace={};resolver.set_trace(function(tag,included,reason){trace[tag]={included,reason};});
            let raw=resolver.priority_level_filtered_outbounds(g,entry.id,pool,state);
            push(levels,level(entry.id,entry.displayName,entry.direct,raw,entry.outbounds,trace,assigned,'Level '+(length(levels)+1)));
            if(length(entry.outbounds))push(fallback,entry.id);
            for(let tag in entry.outbounds)assigned[tag]=entry.id;
        }
        let count=length(resolver.priority_group_outbounds(assigned_levels));
        push(groups,{id:g,kind:'priority',name:safe_name(connections.priority_group_display_name(section,g),'Priority '+(length(groups)+1),context),count,omitted:count==0,
            interrupt:connections.priority_group_interrupt_exist_connections(section,g),levels,fallbackOrder:fallback,
            policy:{pickFastest:connections.priority_group_pick_fastest(section,g),switchToFasterSamePriority:connections.priority_group_switch_to_faster_same_priority(section,g)}});
    }
    resolver.set_trace(null);
    return {success:true,data:{schema:1,requestId:request.requestId,scope:'draft',basis:'captured_source_pool',capture,
        applied:false,connectivity_tested:false,sourceFreshness:'verified',missing:[],candidates,groups}};
}
function preview(request) {
    try {
        let snapshot=basis.config_snapshot(), saved=snapshot.data;
        if(!validate(request,saved))return fail('invalid_request');
        let section=null;
        for(let row in arr(saved.section))if(row['.name']==request.section)section=row;
        if(!section)return fail('section_missing');
        let path=(getenv('FORKOP_SECTION_CACHE_DIR')||'/var/run/forkop/section-cache')+'/'+request.section+'.json';
        let stat=fs.lstat(path);
        if(!stat||stat.type!='file'||stat.size>4194304)return fail('preview_unavailable','capture_missing');
        let raw=fs.readfile(path),state=json(raw),capture=basis.digest(raw);
        if(request.expectedCapture&&request.expectedCapture!=capture)return fail('capture_changed');
        if(state.section!=request.section||length(arr(state.urltestCandidateTags))>2000||!basis.verify(state.previewBasis,snapshot))return fail('preview_unavailable','unproven_source_pool');
        let context=label_context(saved,state);
        for(let key,value in request.draft.section)section[key]=value;
        connections.set_item_sections_from_data(request.draft);
        if(country_missing(section,state))return fail('preview_unavailable','country_evidence_missing');
        return resolve(section,state,request,capture,context);
    } catch(e) {return fail('preview_unavailable','capture_invalid');}
}
if(ARGV[0]=='preview') {
    let result;
    try { result=length(ARGV[1]||'')>131072?fail('invalid_request'):preview(json(ARGV[1])); }
    catch(e){result=fail('invalid_request');}
    print(sprintf('%J\n',result));
}
return {preview};
