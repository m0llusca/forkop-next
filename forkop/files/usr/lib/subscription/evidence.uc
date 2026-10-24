// Observed import outcomes. Old cache contents never manufacture history.
let fs=require('fs');
let common=require('core.common');
let sha=require('core.sha256').digest;
let DIR=getenv('FORKOP_SOURCE_EVIDENCE_DIR') || '/var/run/forkop/source-evidence';
function valid_id(id){return type(id)=='string'&&match(id,/^[A-Za-z0-9_-]{1,128}$/)!=null;}
function unknown(){return {status:'unknown',lastAttempt:null,lastSuccess:null,error:null,
    import:{added:null,accepted:null,skipped:null,duplicates:null,unsupported:null}};}
function read(id,identity){
    let empty=unknown();if(!valid_id(id))return empty;
    try {
        let stored=json(fs.readfile(DIR+'/'+id+'.json'));
        if(stored.schema!=1||stored.identity!=sha(identity))return empty;
        return {status:stored.status,lastAttempt:stored.lastAttempt,lastSuccess:stored.lastSuccess,
            error:stored.error,import:stored.import};
    }catch(e){return empty;}
}
function number(value){return type(value)=='int'&&value>=0?value:null;}
function record(id,identity,outcome){
    if(!valid_id(id)||number(outcome.attemptedAt)==null)return false;
    let value=read(id,identity);
    value.schema=1;value.identity=sha(identity);value.lastAttempt=outcome.attemptedAt;
    value.status=outcome.succeeded?'success':'failed';
    value.error=outcome.succeeded?null:index(['download_failed','download_or_import_failed','source_changed','invalid_source'],outcome.reason)>=0?outcome.reason:'download_or_import_failed';
    if(outcome.succeeded){value.lastSuccess=outcome.attemptedAt;value.import={added:number(outcome.added),accepted:number(outcome.accepted),
        skipped:number(outcome.skipped),duplicates:null,unsupported:null};}
    fs.mkdir(DIR,0700);
    let target=DIR+'/'+id+'.json',temporary=target+'.'+clock()[0]+'.'+clock()[1]+'.tmp';
    let file=fs.open(temporary,'wex',0600);if(!file)return false;
    let ok=file.write(sprintf('%J',value))!=null;file.close();
    if(ok&&fs.rename(temporary,target))return true;
    fs.unlink(temporary);return false;
}
function identity(section,entry) {
    let c=require('config.connections');
    return sprintf('%J',[entry,c.subscription_user_agent(section,entry),c.subscription_hwid(section,entry),c.subscription_download_section(section,entry)]);
}
function read_section(section_id) {
    if(!valid_id(section_id))return {success:false,error:'invalid_request'};
    let c=require('config.connections'),uci=require('core.uci'),section=uci.get_all('forkop',section_id);
    if(common.object_or_empty(section)['.type']!='section')return {success:false,error:'section_missing'};
    let sources=[],index=0;
    for(let entry in c.subscription_urls(section)) {
        index++;let source=section_id+'-subscription-'+index;
        push(sources,{id:source,index,usedBy:[section_id],evidence:read(source,identity(section,entry))});
    }
    return {success:true,data:{section:section_id,sources,connectivity_tested:false}};
}
if(ARGV[0]=='read-section')print(sprintf('%J\n',read_section(ARGV[1])));
return {read,record,identity,read_section};
