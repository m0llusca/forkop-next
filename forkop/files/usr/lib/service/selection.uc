// Durable explicit choices; automatic health changes never write this file.
let fs=require('fs');
const FILE=getenv('FORKOP_SELECTION_FILE')||'/etc/forkop/selections.json';
function quote(v){return "'"+replace(''+v,/'/g,"'\\''")+"'";}
function canonical(value) {
    if(type(value)=='object') {let result={};let sorted=keys(value);sort(sorted);for(let key in sorted)if(key!='tag')result[key]=canonical(value[key]);return result;}
    if(type(value)=='array') {let result=[];for(let item in value)push(result,canonical(item));return result;}
    return value;
}
function identity(outbound) {
    if(type(outbound)!='object')return null;
    let stamp=clock(),path=sprintf('/tmp/.forkop-choice-%x-%x',stamp[0],stamp[1]),file=fs.open(path,'wex',384);
    if(!file)return null;
    let content=sprintf('%J',canonical(outbound));file.write(content);file.close();
    let pipe=fs.popen('sha256sum '+quote(path),'r'),text=pipe?pipe.read(128):'';let status=pipe?pipe.close():1;fs.unlink(path);
    let found=match(text||'',/^([a-f0-9]{64}) /);return status==0 && found?found[1]:null;
}
function read() {try{let s=fs.lstat(FILE);return s && s.type=='file' && s.size<65536?json(fs.readfile(FILE)):{};}catch(e){return {};}}
function remember(group,proxy,config,origin) {
    if(origin && origin!='manual')return {success:true,skipped:true};
    let members={},selector=null;
    for(let item in config.outbounds||[]) {members[item.tag]=item;if(item.tag==group)selector=item;}
    if(!selector || selector.type!='selector' || index(selector.outbounds||[],proxy)<0)return {success:false,error:'invalid_selection'};
    let fingerprint=identity(members[proxy]);if(!fingerprint)return {success:false,error:'identity_failed'};
    let parent=substr(FILE,0,rindex(FILE,'/'));let info=fs.lstat(parent);
    if(info && info.type!='directory')return {success:false,error:'storage_unavailable'};
    if(!info && system('mkdir -p '+quote(parent))!=0)return {success:false,error:'storage_unavailable'};
    let lock=fs.open(FILE+'.lock','ae',384);if(!lock || !lock.lock('xn'))return {success:false,error:'busy'};
    let choices=read();choices[group]={fingerprint};
    let temporary=FILE+'.stage';if(fs.lstat(temporary))fs.unlink(temporary);
    let file=fs.open(temporary,'wex',384);if(!file){lock.close();return {success:false,error:'write_failed'};}
    let content=sprintf('%J',choices),good=file.write(content)==length(content);file.flush();file.close();
    good=good && fs.rename(temporary,FILE);if(good)system('sync');else fs.unlink(temporary);lock.close();
    return {success:!!good};
}
function apply(config) {
    let choices=read(),members={};for(let item in config.outbounds||[])members[item.tag]=item;
    for(let selector in config.outbounds||[]) {
        if(selector.type!='selector' || !choices[selector.tag])continue;
        for(let candidate in selector.outbounds||[])if(members[candidate] && identity(members[candidate])==choices[selector.tag].fingerprint){selector.default=candidate;break;}
    }
    return config;
}
return {remember,apply};
