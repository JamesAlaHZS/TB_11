const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const policy = JSON.parse(fs.readFileSync(path.join(__dirname,'policy.json'),'utf8'));
const upstream = process.argv[2];
function normalize(x) {
  if (typeof x === 'string') return x.replace(/m\.tb\.cn\/h\.[a-zA-Z0-9]+/g,'m.tb.cn/h.<campaign>');
  if (Array.isArray(x)) return x.map(normalize);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,normalize(v)]));
  return x;
}
function run(code,fn,config,mode=1,start=1,data=[],db=null) {
  const math = Object.create(Math); math.random = ()=>0.25;
  const ctx = vm.createContext({ALLDATA:structuredClone(config),DATA:structuredClone(config),DB:structuredClone(db),
    configValue:mode,runNum:start,video:'0',data:structuredClone(data),cookies:'_m_h5_tk=fake_token; x=1;',
    Math:math,Date:{now:()=>1792690000000}}, {codeGeneration:{strings:false,wasm:false}});
  const result = vm.runInContext(code+`;${fn}()`,ctx,{timeout:1000});
  return result ? JSON.parse(result) : result;
}
let count=0;
if (upstream) {
 for (const r of policy.resources.filter(r=>r.kind==='js')) {
  const original = fs.readFileSync(path.join(upstream,r.source),'utf8');
  const current = fs.readFileSync(path.join(root,r.target),'utf8');
  const jsonPath=r.target.includes('china')?'config/ck-china.json':'config/ck-racing.json';
  const config=JSON.parse(fs.readFileSync(path.join(root,jsonPath),'utf8'));
  const direct=[{needTimes:'0',index:0,deliveryId:'skip',implId:'x_0',fromToken:'fake'},
    {needTimes:'1',index:2,deliveryId:'task1',implId:'x_2',fromToken:'fake'},
    {needTimes:'5',index:1,deliveryId:'task2',implId:'y_1',fromToken:'fake'}];
  const models=direct.map(i=>({progress:{needTimes:i.needTimes,times:i.index},taskParams:{deliveryId:i.deliveryId,implId:i.implId,fromToken:i.fromToken}}));
  const cases = r.target.endsWith('ck-common.js') ?
    [ ['run',1,1,[]],['run',2,1,[]],['run',1,2,[]],['run',1,20,[]] ] :
    [ ['runTask',1,1,direct],['runTask',1,1,[]],['runTask',1,1,direct,{run:1,keys:{task1:true},items:[]}],
      ];
  if (!r.target.endsWith('ck-common.js') && /function run\s*\(/.test(original)) cases.push(['run',1,1,[]]);
  if (original.includes('function runTask1')) cases.push(['runTask1',1,1,{ret:['SUCCESS::调用成功'],data:{model:models}}],['runTask1',1,1,{ret:['FAIL'],data:{}}]);
  for (const [fn,mode,start,data,db] of cases) {
    const a=run(original,fn,config,mode,start,data,db), b=run(current,fn,config,mode,start,data,db);
    assert.deepEqual(normalize(a),normalize(b),r.target+' '+fn);
    if (b) {
      const codes=JSON.stringify(b).match(/m\.tb\.cn\/h\.([a-zA-Z0-9]+)/g)||[];
      for(const code of codes) assert.ok(Object.values(policy.campaigns).some(c=>c.mobile.endsWith(code.slice(code.indexOf('h.')+2))))
    }
    count++;
  }
 }
}
// Production validation parses every mirror and checks actual URL strings.
for (const r of policy.resources) {
 const body=fs.readFileSync(path.join(root,r.target),'utf8');
 if(r.kind==='json') {
   const obj=JSON.parse(body);
   for(const dest of Object.values(obj.taskData.common)) assert.ok(dest.startsWith(policy.raw_base));
   assert.ok(body.includes('1095180136'));
 } else new vm.Script(body);
 const codes=body.match(/m\.tb\.cn\/h\.([a-zA-Z0-9]+)/g)||[];
 for(const code of codes) assert.ok(Object.values(policy.campaigns).some(c=>c.mobile.endsWith(code.slice(code.indexOf('h.')+2))));
 assert.ok(!/jiutiao|九条|963696474|884282432|714153240|imeituan:|eleme:|pinduoduo/.test(body));
}
console.log(JSON.stringify({differential_cases:count,resource_checks:policy.resources.length,passed:true}));
