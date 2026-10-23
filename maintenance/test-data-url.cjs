const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'data-url-fixtures.json'),'utf8'));
let cases=0;
for(const f of fixtures){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'shortcuts',f.file))).digest('hex'),f.sha256);
 assert.equal(f.links.length,8);
 for(const {url,encoder,source}of f.links){
  const v=url.WFWorkflowActionParameters.WFURLActionURL.Value,entry=Object.entries(v.attachmentsByRange)[0],index=parseInt(entry[0].slice(1));
  assert.equal(v.string[index],'\ufffc');assert.equal(v.string.slice(0,index),'data:text/html;charset=utf-8;base64,');
  assert.equal(entry[1].OutputUUID,encoder.WFWorkflowActionParameters.UUID);
  assert.equal(encoder.WFWorkflowActionIdentifier,'is.workflow.actions.base64encode');assert.equal(encoder.WFWorkflowActionParameters.WFBase64LineBreakMode,'None');
  assert.equal(encoder.WFWorkflowActionParameters.WFInput.Value.OutputUUID,source.WFWorkflowActionParameters.UUID);
  assert.equal(source.WFWorkflowActionIdentifier,'is.workflow.actions.gettext');cases++;
 }
}
for(const value of ['https://github.com/JamesAlaHZS/TB_11#readme','中文#fragment%2B+&="quotes"']){
 const html='<html><body><script>var DATA='+JSON.stringify({url:value})+';document.write(JSON.stringify(DATA));</script></body></html>';
 const legacy=new URL('data:text/html,'+html);assert.ok(legacy.hash);assert.ok(!legacy.pathname.includes('</script>'));
 const uri=new URL('data:text/html;charset=utf-8;base64,'+Buffer.from(html,'utf8').toString('base64'));assert.equal(uri.hash,'');
 assert.equal(Buffer.from(uri.pathname.split(',')[1],'base64').toString('utf8'),html);cases++;
}
console.log(JSON.stringify({passed:true,cases,scope:'actual serialized URL encoding links and #readme regression',deviceVerified:false}));
