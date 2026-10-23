const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const moduleCode=fs.readFileSync(root+'/maintenance/cookie-input.js','utf8');
const ctx=vm.createContext({});vm.runInContext(moduleCode,ctx);
const fake='WAPFDFDTGFG=opaque%2B%2F; _nk_=fake; _m_h5_tk=fakeToken_9999999999999; _m_h5_tk_enc=pad==; extra=a=b=c;';
const special=fake+' edge=` ${neverExecute} </script> #中文&"\\;';
let cases=0;
for(const input of [fake,special,{cookie:fake},{fakeAccount:fake},JSON.stringify({cookie:fake}),JSON.stringify({fakeAccount:fake}),[fake],JSON.stringify(fake),'Cookie: '+fake+'\r\n']){
 assert.equal(ctx.normalizeCookieInput(input),input===special?special:fake);cases++;
}
for(const input of ['',null,{},[],{a:fake,b:fake},[fake,fake],'_nk_=fake;','{invalid']){
 assert.throws(()=>ctx.normalizeCookieInput(input));cases++;
}
const merged=ctx.mergeRefreshedCookie(fake,{_m_h5_tk:'newToken_99',_m_h5_tk_enc:'next=='});
assert.equal(ctx.parseCookiePairs(merged)._m_h5_tk,'newToken_99');
assert.equal(ctx.parseCookiePairs(merged)._m_h5_tk_enc,'next==');
assert.equal(ctx.parseCookiePairs(merged).extra,'a=b=c');cases+=3;
const template=fs.readFileSync(__dirname+'/cookie_request_template.html','utf8');
for(const rel of ['scripts/ck-racing.js','scripts/ck-china.js']){
 const source=fs.readFileSync(root+'/'+rel,'utf8');
 const config={tag:rel.includes('china')?'tmzb11':'tm1111'};
 for(const input of [fake,special,{cookie:fake},{fakeAccount:fake},'',{a:fake,b:fake},'_nk_=fake;']){
  const inputText=typeof input==='string'?input:JSON.stringify(input);
  const html=template.replace('__REMOTE_SCRIPT__',source).replace('__CONFIG__',Buffer.from(JSON.stringify(config)).toString('base64')).replace('__COOKIE__',Buffer.from(inputText).toString('base64'));
  const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const document={body:{textContent:''}};
  vm.runInNewContext(script,{document,atob},{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
  const output=JSON.parse(document.body.textContent);
  if(input===''||input==='_nk_=fake;'||(input && typeof input==='object' && input.a)){
   assert.equal(output.succes,'error');assert.ok(output.message);assert.equal(output.data.url,'');
   assert.ok(!JSON.stringify(output).includes('fakeToken'));
  }else{
   assert.equal(output.succes,'ok');assert.equal(typeof output.data.ck,'string');
   const url=new URL(output.data.url);assert.equal(url.hostname,'service-qd1gmnyf-1257225808.sh.apigw.tencentcs.com');
   assert.equal(url.searchParams.get('k'),config.tag);assert.equal(url.searchParams.get('t'),'fakeToken_9999999999999');
   assert.equal(output.data.ck,(input===special?special:fake).replace(/\s+/g,''));
  }
  cases++;
 }
}
// Show why the former unencoded HTML path was fragile, without using account data.
for(const sourceRel of ['scripts/ck-racing.js','scripts/ck-china.js']){
 const source=fs.readFileSync(root+'/'+sourceRel,'utf8');
 const legacy='var ALLDATA={tag:"tm1111"};var cookies=`'+special+'`;'+source+';run();';
 assert.throws(()=>vm.runInNewContext(legacy,{}, {timeout:1000}));cases++;
}
const fixtures=JSON.parse(fs.readFileSync(__dirname+'/cookie-workflow-fixtures.json','utf8'));
(async()=>{
 for(const fixture of fixtures){
  // Verify real serialized HTML and UTF-16 attachment offsets, rather than just a handwritten template.
  const value=fixture.html;
  let text=value.string;
  const substitutions=[fs.readFileSync(root+'/scripts/'+fixture.source,'utf8'),Buffer.from(JSON.stringify({tag:fixture.tag})).toString('base64'),Buffer.from(special).toString('base64')];
  Object.keys(value.attachmentsByRange).sort((a,b)=>parseInt(b.slice(1))-parseInt(a.slice(1))).forEach(key=>{
   const offset=parseInt(key.slice(1));assert.equal(text[offset],'\ufffc');
   const index=Object.keys(value.attachmentsByRange).indexOf(key);
   text=text.slice(0,offset)+substitutions[index]+text.slice(offset+1);
  });
  const document={body:{textContent:''}};
  vm.runInNewContext(text.match(/<script>([\s\S]*)<\/script>/)[1],{document,atob},{timeout:1000});
  assert.equal(JSON.parse(document.body.textContent).succes,'ok');cases++;
  for(const input of [fake,{cookie:fake},{fakeAccount:fake}]){
   let output,requests=0;
   class Request {constructor(){requests++;this.response={cookies:[{name:'_m_h5_tk',value:'refreshed_9'},{name:'_m_h5_tk_enc',value:'padding=='}]};}async loadJSON(){assert.equal(this.headers.Cookie,fake);return {};}}
   await vm.runInNewContext('(async()=>{'+fixture.refresh+'})()',{args:{shortcutParameter:input},Request,Script:{setShortcutOutput:v=>{output=v;},complete:()=>{}}},{timeout:1000});
   assert.equal(requests,1);assert.equal(ctx.parseCookiePairs(output.cookie)._m_h5_tk,'refreshed_9');
   assert.equal(ctx.parseCookiePairs(output.cookie)._m_h5_tk_enc,'padding==');
   assert.equal(ctx.parseCookiePairs(output.cookie).extra,'a=b=c');cases++;
  }
 }
 console.log(JSON.stringify({passed:true,cases,network:'mocked only; no account credentials used'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
