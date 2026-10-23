#!/usr/bin/env ucode
// Forkop Next local operations. GPL-2.0-or-later, see repository LICENSE.
let fs = require('fs');
let native = require('uci');
const DIR = getenv('FORKOP_NEXT_DIR') || '/etc/forkop/next';
const CONFIG = getenv('FORKOP_CONFIG_FILE') || '/etc/config/forkop';
const LIB = getenv('FORKOP_LIB') || '/usr/lib/forkop';
const BIN = getenv('FORKOP_BIN') || '/usr/bin/forkop';
const INIT = getenv('FORKOP_SERVICE_INIT') || '/etc/init.d/forkop';
const MAX = 1048576;
const WORK = sprintf("/tmp/.forkop-next-%x-%x",clock()[0],clock()[1]);
function quote(s) { return "'" + replace(''+s, /'/g, "'\\''") + "'"; }
function contains(values,value) {return index(values,value)>=0;}
function ok(data) { return {success:true,data:data || {}}; }
function fail(error) { return {success:false,error}; }
function mkdir(path) {
    let current='';
    for(let part in split(path,'/')) {
        if(part=='')continue;
        current+='/'+part;
        let info=fs.lstat(current);
        if(info && info.type!='directory')return false;
        if(!info && !fs.mkdir(current,448))return false;
    }
    let final=fs.stat(path);return final && ((final.mode & 511)==448 || fs.chmod(path,448));
}
function available(path) {
    let pipe=fs.popen('df -P -k '+quote(path)+' 2>/dev/null','r');if(!pipe)return -1;
    let text=pipe.read(8193),status=pipe.close();if(status!=0 || !text || length(text)>8192)return -1;
    let last='';for(let line in split(text,'\n'))if(trim(line)!='')last=trim(line);
    let fields=split(last,/\s+/);return length(fields)>=6 && match(fields[3],/^[0-9]+$/)?int(fields[3])*1024:-1;
}
function read(path) {
    let stat=fs.lstat(path);
    return stat && stat.type=='file' && stat.size<=MAX ? fs.readfile(path) : null;
}
function atomic(path, value) {
    let old=fs.lstat(path), tmp=path+'.stage';
    if(old && old.type!='file') return false;
    if(fs.lstat(tmp) && !fs.unlink(tmp)) return false;
    let file=fs.open(tmp,'wex',384);
    if(!file) return false;
    let good=file.write(value)==length(value); file.flush(); file.close();
    if(!good || system('sync')!=0 || !fs.rename(tmp,path)) {fs.unlink(tmp);return false;}
    return system('sync')==0;
}
function digest(path) {
    let p=fs.popen('sha256sum '+quote(path)+' 2>/dev/null','r');
    if(!p) return '';
    let value=p.read(128),status=p.close(),m=match(value||'',/^([a-f0-9]{64}) /);
    return status==0 && m ? m[1] : '';
}
function bytes_digest(text) {
    if(type(text)!='string' || !mkdir(WORK) || !atomic(WORK+'/digest',text))return '';
    return digest(WORK+'/digest');
}
function valid_name(name) {return type(name)=='string' && length(name)>0 && length(name)<=64 && name!='.' && name!='..' && index(name,"/")<0 && index(name,"\\")<0 && !match(name,/[\r\n\t]/);}
function profile(name) {return DIR+'/profiles/'+name+'.uci';}
function parsed(text) {
    if(type(text)!='string' || length(text)>MAX || length(text)==0) return null;
    let path=WORK; if(!mkdir(path) || !atomic(path+'/forkop',text)) return null;
    let c=native.cursor(path, path+'/state');
    if(!c || !c.load('forkop')) return null;
    let rows=[]; c.foreach('forkop',null,function(row){push(rows,row);});
    if(length(rows)==0) return null;
    let settings=false;
    for(let row in rows) if(row['.type']=='settings') settings=true;
    if(!settings) return null;
    return {cursor:c,rows,path};
}
function flatten(rows) {
    let result={};
    for(let row in rows) {
        result[row['.name']+'.$type']=row['.type'];
        for(let key in keys(row)) if(substr(key,0,1)!='.') result[row['.name']+'.'+key]=sprintf('%J',row[key]);
    }
    return result;
}
function validate(text) {
    let data=parsed(text);if(!data)return false;
    let byname={};for(let row in data.rows)byname[row['.name']]=row;
    for(let row in data.rows)if(row.next_target) {
        let target=byname[row.next_target];
        if(!target || target['.type']!='section' || target.enabled=='0' || target.next_target || target.action!=row.action) return false;
    }
    let fixture={};
    for(let row in data.rows) {
        let kind=row['.type'];
        if(kind=='settings')fixture.settings=row;
        else {if(type(fixture[kind])!='array')fixture[kind]=[];push(fixture[kind],row);}
    }
    let file=WORK+'/candidate.json';
    if(!atomic(file,sprintf('%J',fixture)))return false;
    return system('ucode -L '+quote(LIB)+' '+quote(LIB+'/config/validator.uc')+' validate-runtime-fixture '+quote(file)+' '+quote('{}')+' >/dev/null 2>&1')==0;
}
function activate() {
    let hook=getenv('FORKOP_NEXT_ACTIVATE');
    if(hook) return system(quote(hook)+' >/dev/null 2>&1')==0;
    if(system(quote(INIT)+' running >/dev/null 2>&1')!=0) return true;
    return system(quote(BIN)+' restart >/dev/null 2>&1')==0;
}
function process_identity(pid) {
    let text=fs.readfile('/proc/'+pid+'/stat');if(!text)return null;
    let fields=split(trim(substr(text,rindex(text,')')+1)),/\s+/);
    return {pid:substr(text,0,index(text,' ')),parent:fields[1],ticks:fields[19]};
}
function active_ancestor() {
    let state;try{state=json(read(DIR+'/journal.json')||'null');}catch(e){return false;}
    let owner=state?state.owner:null;if(!owner)return false;
    let live=process_identity(owner.pid),current=process_identity('self');
    if(!live || live.ticks!=owner.ticks)return false;
    for(let depth=0;current && depth<128;depth++) {
        if(current.pid==owner.pid && current.ticks==owner.ticks)return true;
        if(current.parent=='0' || current.parent==current.pid)break;
        current=process_identity(current.parent);
    }
    return false;
}
function recovery(passive) {
    let saved=read(DIR+'/journal.json');
    if(saved==null) return ok({restored:false});
    let state; try{state=json(saved);}catch(e){return fail('invalid_recovery');}
    let original=read(DIR+'/original.uci');
    if(state.schema!=1 || original==null || bytes_digest(original)!=state.digest) return fail('invalid_recovery');
    if(!atomic(CONFIG,original)) return fail('restore_write_failed');
    if(!passive && !activate()) return fail('restore_activation_failed');
    fs.unlink(DIR+'/journal.json'); system('sync');
    return ok({restored:true});
}
function apply(text, expected, previous) {
    if(fs.lstat(DIR+'/journal.json')) return fail('recovery_required');
    let current=digest(CONFIG);
    if(expected && expected!=current) return fail('conflict');
    if(!validate(text)) return fail('invalid_config');
    let original=previous==null?read(CONFIG):previous;
    if(original==null) return fail('invalid_original');
    let needed=3*length(original)+length(text)+65536;
    if(available(DIR)<needed || available(substr(CONFIG,0,rindex(CONFIG,'/')))<needed)return fail('insufficient_space');
    if(!atomic(DIR+'/original.uci',original) || !atomic(DIR+'/journal.json',sprintf('%J',{schema:1,digest:digest(DIR+'/original.uci'),expected_current:current,owner:process_identity('self')}))) return fail('backup_failed');
    if(digest(CONFIG)!=current) {fs.unlink(DIR+'/journal.json');return fail('conflict');}
    if(!atomic(CONFIG,text)) return fail('replace_failed');
    if(!activate()) {
        let restored=atomic(CONFIG,original), running=restored && activate();
        if(restored && running) fs.unlink(DIR+'/journal.json');
        return {success:false,error:'activation_failed',data:{restored,service_restored:running,recovery_pending:!(restored&&running)}};
    }
    if(!atomic(DIR+'/previous.uci',original)) {
        let restored=atomic(CONFIG,original); if(restored && activate())fs.unlink(DIR+'/journal.json');
        return fail('previous_write_failed');
    }
    if(!atomic(DIR+'/applied.uci',read(CONFIG)))return fail('checkpoint_write_failed');
    fs.unlink(DIR+'/journal.json'); system('sync');
    return ok({digest:digest(CONFIG)});
}
function rows() {let p=parsed(read(CONFIG));return p?p.rows:[];}
function sections() {let out=[];for(let row in rows()) if(row['.type']=='section' && row.enabled!='0' && !row.next_kind) push(out,{name:row['.name'],label:row.label||row['.name'],action:row.action||''});return out;}
function list_value(value) {return type(value)=='array'?value:value==null?[]:[value];}
function address(value) {
    if(type(value)!='string' || !match(value,/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/)) return false;
    for(let part in split(value,'.')) if(int(part)>255 || (length(part)>1 && substr(part,0,1)=='0')) return false;
    return true;
}
function domain(value) {return type(value)=='string' && length(value)<=253 && match(value,/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/) && index(value,'..')<0 && index(value,'.')>0;}
function policy(action,payload) {
    let data=parsed(read(CONFIG));if(!data)return fail('invalid_config');
    let c=data.cursor, all=data.rows, items=[];
    if(action=='devices') {
        for(let row in all) if(row['.type']=='section') for(let ip in list_value(row.fully_routed_ips)) push(items,{address:ip,section:row['.name']});
        return ok({items});
    }
    if(action=='temporary_list') {
        for(let row in all) if(row.next_kind=='temporary') push(items,{id:row['.name'],domain:list_value(row.domain_suffix)[0],section:row.next_target,expires:int(row.next_expires)});
        return ok({items});
    }
    let base_digest=digest(data.path+'/forkop');
    if(base_digest=='')return fail('snapshot_failed');
    if(payload.expected && payload.expected!=base_digest)return fail('conflict');
    if(action=='smart_detect_configure') {
        if(type(payload.enabled)!='bool')return fail('invalid_request');
        if(payload.enabled) {
            let target=c.get_all('forkop',payload.section);
            if(!target || target['.type']!='section' || target.enabled=='0' || !contains(['connection','proxy','outbound','vpn'],target.action) || target.mixed_proxy_enabled!='1' || !match(target.mixed_proxy_port||'',/^[0-9]+$/) || int(target.mixed_proxy_port)<1 || int(target.mixed_proxy_port)>65535)return fail('section_probe_unavailable');
            c.set('forkop','settings','smart_detect_section',payload.section);
        }
        c.set('forkop','settings','smart_detect_enabled',payload.enabled?'1':'0');
    }
    else if(action=='device_set') {
        if(!address(payload.address))return fail('invalid_address');
        if(payload.section=='direct') {
            let existing=c.get_all('forkop','nxt_direct');
            c.set('forkop','nxt_direct','section');c.set('forkop','nxt_direct','enabled','1');c.set('forkop','nxt_direct','action','bypass');
            c.reorder('forkop','nxt_direct',0);payload.section='nxt_direct';
            if(!existing || existing['.type']!='section')push(all,{'.type':'section','.name':'nxt_direct'});
        }
        let target=payload.section?c.get_all('forkop',payload.section):null;
        if(payload.section && (!target || target['.type']!='section' || target.enabled=='0'))return fail('invalid_section');
        for(let row in all) if(row['.type']=='section') {
            let ips=[];for(let ip in list_value(row.fully_routed_ips))if(ip!=payload.address)push(ips,ip);
            if(row['.name']==payload.section)push(ips,payload.address);
            if(length(ips))c.set('forkop',row['.name'],'fully_routed_ips',ips);else c.delete('forkop',row['.name'],'fully_routed_ips');
        }
    }
    else if(action=='temporary_delete' || action=='expire') {
        let found=false;
        for(let row in all) if(row.next_kind=='temporary' && (action=='expire'?int(row.next_expires)<=time():row['.name']==payload.id)) {c.delete('forkop',row['.name']);found=true;}
        if(!found)return action=='expire'?ok({expired:0}):fail('not_found');
    }
    else {
        let target=c.get_all('forkop',payload.section);
        if(!target || target['.type']!='section' || target.enabled=='0' || target.next_kind || !contains(['connection','proxy','outbound','vpn','bypass','block'],target.action))return fail('invalid_section');
        let names=[],kind='temporary',expires=0;
        if(action=='temporary_add') {
            if(!domain(payload.domain))return fail('invalid_domain');
            if(type(payload.ttl)!='int' || payload.ttl<60 || payload.ttl>86400)return fail('invalid_ttl');
            names=[lc(payload.domain)];expires=time()+payload.ttl;
        }
        else if(action=='recommendation_apply') {
            if(!domain(payload.domain))return fail('invalid_domain');
            names=[lc(payload.domain)];kind='recommendation';
        }
        else if(action=='gaming_apply') {
            let presets={steam:['steampowered.com','steamcommunity.com','steamstatic.com'],playstation:['playstation.net','playstation.com'],xbox:['xboxlive.com','xbox.com']};
            names=presets[payload.preset];kind='gaming';if(!names)return fail('invalid_preset');
            if(payload.device && !address(payload.device))return fail('invalid_address');
        }
        else return fail('unknown_action');
        let id=sprintf('nxt_%x_%x',clock()[0],clock()[1]);
        c.set('forkop',id,'section');c.set('forkop',id,'enabled','1');c.set('forkop',id,'action',target.action);
        c.set('forkop',id,'next_kind',kind);c.set('forkop',id,'next_target',payload.section);
        c.set('forkop',id,'next_expires',''+expires);c.set('forkop',id,'domain_suffix',names);
        if(payload.device)c.set('forkop',id,'source_ip_cidr',[payload.device]);
        c.reorder('forkop',id,0);
    }
    if(!c.commit('forkop'))return fail('config_write_failed');
    return apply(read(data.path+'/forkop'),base_digest);
}
function handle(action,payload) {
    if(action=='recover' || action=='startup_recover')return recovery(action=='startup_recover');
    if(action=='checkpoint') {
        let current=read(CONFIG);return current!=null && atomic(DIR+'/applied.uci',current)?ok():fail('checkpoint_write_failed');
    }
    if(action=='native_apply') {
        let current=read(CONFIG),previous=read(DIR+'/applied.uci');
        if(previous==null)return fail('no_checkpoint');
        if(current==null) {
            if(payload.expected || fs.lstat(CONFIG)!=null)return fail('conflict');
            let restored=atomic(CONFIG,previous);return {success:false,error:'invalid_config',data:{restored}};
        }
        let current_digest=bytes_digest(current);
        if(current_digest=='')return fail('snapshot_failed');
        if((payload.expected && payload.expected!=current_digest) || digest(CONFIG)!=current_digest)return fail('conflict');
        if(current==previous)return ok({unchanged:true});
        let valid=validate(current);
        if(digest(CONFIG)!=current_digest)return fail('conflict');
        if(!valid) {
            let restored=atomic(CONFIG,previous);return {success:false,error:'invalid_config',data:{restored}};
        }
        return apply(current,current_digest,previous);
    }
    if(action=='status') {
        let version='unknown',pipe=fs.popen('sing-box version 2>/dev/null','r');
        if(pipe){let text=pipe.read(4096),status=pipe.close(),found=match(text||'',/sing-box version ([0-9][0-9A-Za-z.+_-]*)/);if(status==0 && found)version=found[1];}
        let settings={};for(let row in rows())if(row['.type']=='settings')settings=row;
        return ok({digest:digest(CONFIG),recovery_pending:fs.lstat(DIR+'/journal.json')!=null,previous_available:read(DIR+'/previous.uci')!=null,sections:sections(),versions:{forkop:require('core.constants').FORKOP_VERSION,sing_box:version},smart_detect:{enabled:settings.smart_detect_enabled=='1',section:settings.smart_detect_section||'',interval:60}});
    }
    if(action=='profile_list') {let items=[];for(let name in fs.lsdir(DIR+'/profiles')||[]) if(match(name,/\.uci$/))push(items,{name:substr(name,0,-4)});return ok({items});}
    if(action=='rollback') {let text=read(DIR+'/previous.uci');return text==null?fail('no_previous'):apply(text,payload.expected);}
    if(index(action,'profile_')==0) {
        if(!valid_name(payload.name))return fail('invalid_name');
        let path=profile(payload.name),text=read(path);
        if(action=='profile_save' || action=='profile_import') {
            text=action=='profile_save'?read(CONFIG):payload.config;
            if(!validate(text))return fail('invalid_config');
            return atomic(path,text)?ok({name:payload.name}):fail('write_failed');
        }
        if(text==null)return fail('not_found');
        if(action=='profile_export')return ok({name:payload.name,config:text});
        if(action=='profile_apply') {
            if(payload.expected_profile && payload.expected_profile!=bytes_digest(text))return fail('profile_conflict');
            return apply(text,payload.expected);
        }
        if(action=='profile_diff') {
            let old=parsed(read(CONFIG));if(!old)return fail('invalid_config');
            let current_digest=digest(old.path+'/forkop'),a=flatten(old.rows),saved=parsed(text);if(!saved)return fail('invalid_config');
            let profile_digest=digest(saved.path+'/forkop'),b=flatten(saved.rows),changed=[];
            for(let key in keys(a))if(a[key]!=b[key])push(changed,key);
            for(let key in keys(b))if(a[key]==null)push(changed,key);
            sort(changed);return ok({changed,current_digest,profile_digest});
        }
    }
    if(contains(['smart_detect_configure','devices','device_set','gaming_apply','temporary_add','temporary_list','temporary_delete','expire'],action))return policy(action,payload);
    if(action=='compatibility_check' || action=='compatibility_updates')return require('service.compatibility').handle(action,payload);
    if(action=='probe')return require('service.probe').handle(payload);
    if(action=='recommendation_accept') {
        let smart=require('service.smart_detect'),proposal=smart.handle(action,payload);
        if(!proposal.success)return proposal;
        let suggestion=proposal.data.suggestion;suggestion.expected=payload.expected;
        let result=policy('recommendation_apply',suggestion);
        if(!result.success)return result;
        let completed=smart.handle('recommendation_complete',{id:payload.id});
        if(!completed.success)return {success:false,error:'recommendation_state_failed',data:{applied:true}};
        return result;
    }
    if(contains(['recommendations','recommendation_record','recommendation_scan','recommendation_tick','recommendation_accept','recommendation_dismiss'],action))return require('service.smart_detect').handle(action,payload);
    return fail('unknown_action');
}
let result;
try {
    let action=ARGV[1]||'',payload=json(ARGV[2]||'{}');
    if(action=='timer') {
        while(system('sleep 60')==0) {
            system(quote(BIN)+' next expire '+quote('{}')+' >/dev/null 2>&1');
            system(quote(BIN)+' next recommendation_tick '+quote('{}')+' >/dev/null 2>&1');
        }
        exit(0);
    }
    if(type(payload)!='object')result=fail('invalid_request');
    else if(!mkdir(DIR) || !mkdir(DIR+'/profiles'))result=fail('storage_unavailable');
    else if((action=='startup_recover' || action=='checkpoint') && active_ancestor())result=ok({active_transaction:true});
    else {
        let file=fs.open(DIR+'/operation.lock','ae',384);
        if(!file || !file.lock('xn'))result=fail('busy');
        else {result=handle(action,payload);file.close();}
    }
} catch(e) {result=fail('operation_failed');warn('Forkop Next: '+sprintf('%J',e)+'\n');}
for(let name in fs.lsdir(WORK)||[])fs.unlink(WORK+'/'+name);
fs.rmdir(WORK);
print(sprintf('%J\n',result));
