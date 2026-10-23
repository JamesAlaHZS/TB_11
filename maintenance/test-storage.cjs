const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').join(__dirname,'storage-parser.js'),'utf8');
const ctx=vm.createContext({});vm.runInContext(code,ctx);
function parse(text,mode='add'){return JSON.parse(JSON.stringify(ctx.parseStore(text,mode)));}
const ck='_nk_=old; _m_h5_tk=fake_token; x=1;';
const good=JSON.stringify({old:ck});
for(const t of ['', ' ', '\ufeff{}','{}',good,JSON.stringify(good),ck,'Cookie: '+ck+'\r\n']) assert.equal(parse(t).ok,'yes');
for(const t of ['{bad','null','[]','{"old":2}','{"old":"invalid"}','{"__proto__":"_m_h5_tk=x"}']) assert.equal(parse(t).ok,'no');
assert.equal(parse('{}','run').json,'');
assert.equal(parse('{}','add').json,'{}');
const old=JSON.parse(parse(good).json);old.new='_nk_=new; _m_h5_tk=second;';
assert.equal(old.old,ck);assert.equal(Object.keys(old).length,2);
// Base64 transport must keep Unicode, backticks, HTML and multiline text inert.
for(const raw of ['中文','` ${globalThis.secret} </script>','a\r\nb']){
 const b=Buffer.from(raw).toString('base64');assert.equal(Buffer.from(b,'base64').toString(),raw);
}
console.log('Storage parser and account preservation checks passed (20 cases)');
