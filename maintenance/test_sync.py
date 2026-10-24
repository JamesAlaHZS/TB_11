import copy,importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('sync',Path(__file__).with_name('sync.py'))
sync=importlib.util.module_from_spec(spec);spec.loader.exec_module(sync)
class PolicyTests(unittest.TestCase):
 def test_encoded_promotion_is_rejected(self):
  import base64
  with self.assertRaises(ValueError):sync.suspicious(base64.b64encode(b'https://m.tb.cn/h.authorX').decode())
 def test_nested_escape_is_rejected(self):
  with self.assertRaises(ValueError):sync.suspicious('https%253A%252F%252Fm.tb.cn%252Fh.authorX')
 def test_new_resource_is_rejected(self):
  with self.assertRaises(ValueError):sync.text_replace(sync.POLICY['upstream_base']+'new.js')
 def test_json_structure_and_values_survive(self):
  data={'activity':{'tip':'hello','list':['old']},'taskData':{'n':3,'list':[1,2]},'urlArr':[]}
  got=sync.checked_json(__import__('json').dumps(data));self.assertEqual(got['taskData'],data['taskData']);self.assertEqual(got['activity']['list'],['old'])
 def test_new_js_shape_is_rejected(self):
  with self.assertRaises(Exception):sync.ast_check("function run(){return 1}","function run(){return 2}")
 def test_shortcodes_have_role(self):
  self.assertIn(sync.CART,sync.text_replace('taobao://m.tb.cn/h.old','$.购物车.url'))
  self.assertIn(sync.RED,sync.text_replace('taobao://m.tb.cn/h.old','$.endPage'))
 def test_git_transport_uses_one_revision_for_all_resources(self):
  from subprocess import CompletedProcess
  from unittest.mock import patch
  calls=[]
  def fake_run(command,**kwargs):
   calls.append(command)
   if command[1]=='clone':return CompletedProcess(command,0)
   self.assertEqual(command[3],'show')
   self.assertTrue(command[4].startswith('HEAD:'))
   return CompletedProcess(command,0,stdout=('\ufeff'+command[4][5:]).encode('utf-8'))
  with patch.object(sync.subprocess,'run',side_effect=fake_run),patch.object(sync.subprocess,'check_output',return_value='abc123\n'):
   result=sync.git_sources()
  self.assertEqual(result,[r['source'] for r in sync.POLICY['resources']])
  self.assertEqual(len(calls),len(result)+1)
  self.assertEqual(calls[0][-2],sync.POLICY['upstream_git'])
  self.assertTrue(all(c[4]=='HEAD:'+r['source'] for c,r in zip(calls[1:],sync.POLICY['resources'])))
if __name__=='__main__':unittest.main()
