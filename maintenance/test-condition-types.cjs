const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'condition-types-fixtures.json'),'utf8'));
let cases=0;
function validate(group){
 const p=group.condition.WFWorkflowActionParameters,value=p.WFInput.Variable.Value;
 assert.ok(value.Aggrandizements.some(x=>x.CoercionItemClass==='WFStringContentItem'));
 assert.ok(!value.Aggrandizements.some(x=>x.CoercionItemClass==='WFDictionaryContentItem'));
 assert.equal(group.text.WFWorkflowActionIdentifier,'is.workflow.actions.gettext');
 assert.equal(value.OutputUUID,group.text.WFWorkflowActionParameters.UUID);
 const text=group.text.WFWorkflowActionParameters.WFTextActionText;
 assert.equal(text.WFSerializationType,'WFTextTokenString');assert.equal(text.Value.string,'\ufffc');
 assert.equal(text.Value.attachmentsByRange['{0, 1}'].OutputUUID,group.source.WFWorkflowActionParameters.UUID);
 if(p.WFConditionalActionString==='ALA_STORE_OK'){
  assert.equal(group.source.WFWorkflowActionIdentifier,'is.workflow.actions.getvalueforkey');
  assert.equal(group.source.WFWorkflowActionParameters.WFDictionaryKey,'ok');
  assert.equal(group.source.WFWorkflowActionParameters.WFGetDictionaryValueType,'Value');
 }
}
const fake='_nk_=fake; _m_h5_tk=fake_9999999999999; extra=pad==;';
for(const f of fixtures){
 for(const file of [f.file,f.versioned_file])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'shortcuts',file))).digest('hex'),f.signed_sha256);
 cases++;
 assert.equal(f.conditions.length,4);
 for(const g of f.conditions){validate(g);cases++;const bad=structuredClone(g);bad.condition.WFWorkflowActionParameters.WFInput.Variable.Value.Aggrandizements=[{Type:'WFCoercionVariableAggrandizement',CoercionItemClass:'WFDictionaryContentItem'}];assert.throws(()=>validate(bad));cases++;}
 for(const template of f.storage_html){
  const index=parseInt(Object.keys(template.attachmentsByRange)[0].slice(1));assert.equal(template.string[index],'\ufffc');
  for(const input of [JSON.stringify({fake}),JSON.stringify(JSON.stringify({fake})),'\ufeff'+JSON.stringify({fake}),'{}','','{invalid']){
   const html=template.string.slice(0,index)+Buffer.from(input).toString('base64')+template.string.slice(index+1),document={body:{textContent:''}};
   vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1],{document,atob},{timeout:1000});
   const output=JSON.parse(document.body.textContent);assert.equal(typeof output.ok,'string');
   assert.equal(output.ok,input==='{invalid'?'ALA_STORE_ERROR':'ALA_STORE_OK');
   if(input.includes('fake'))assert.deepEqual(JSON.parse(output.json),{fake});cases++;
  }
 }
}
console.log(JSON.stringify({passed:true,cases,device_tested:false,scope:'actual signed delivery fixtures; scalar condition wiring and mocked storage HTML'}));
