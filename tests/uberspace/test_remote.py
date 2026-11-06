import hashlib, importlib.util, json, os, pathlib, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('remote',pathlib.Path(__file__).resolve().parents[2]/'scripts/uberspace/remote.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Releases(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name).resolve()
  self.globals=patch.multiple(m,ROOT=self.root,HTML=self.root/'html',MANAGED=self.root/'.sandforge',RELEASES=self.root/'.sandforge/releases',PASSWORD=self.root/'.htpasswd');self.globals.start()
  m.HTML.mkdir();m.RELEASES.mkdir(parents=True);m.PASSWORD.write_text('nobby:$2y$12$test-hash-placeholder\n');os.chmod(m.PASSWORD,0o600);(m.HTML/'.htaccess').write_text('fixed auth guard\n');(self.root/'nf.uber.space').symlink_to(m.HTML)
  self.environment=patch.dict(os.environ,{'USER':'nf'});self.environment.start()
  def config(command):
   return json.dumps([{'name':'nf.uber.space'}] if 'domain' in command else [{'domain':None,'path':'/','destination':'APACHE'}]).encode()
  self.commands=patch.object(m.subprocess,'check_output',side_effect=config);self.commands.start()
  self.token=m.lease({})['token'];self.guard=(m.HTML/'.htaccess').read_bytes();self.password=m.PASSWORD.read_bytes()
 def tearDown(self):
  self.commands.stop();self.environment.stop();self.globals.stop();self.temp.cleanup()
 def release(self,name,body='game'):
  target=m.release_path(name);target.mkdir();(target/'index.html').write_text(body)
  manifest={'release':name,'commit':'a'*40,'files':{'index.html':{'size':len(body),'sha256':hashlib.sha256(body.encode()).hexdigest()}}}
  (target/'deployment.json').write_text(json.dumps(manifest));return {'token':self.token,'release':name}
 def test_activation_retains_old_and_guard_rollback_restores(self):
  old=self.release('v-old-111');m.switch('v-old-111');new=self.release('v-new-222');new['expected']='v-old-111'
  m.activate(new);self.assertEqual(m.current(),'v-new-222');self.assertTrue(m.release_path('v-old-111').exists())
  m.commit({**new,'previous':'v-old-111'});self.assertEqual(m.read_json(m.MANAGED/'state.json')['previous'],'v-old-111')
  m.restore({'token':self.token,'failed':'v-new-222','previous':'v-old-111'});self.assertEqual(m.current(),'v-old-111')
  self.assertEqual((m.HTML/'.htaccess').read_bytes(),self.guard);self.assertEqual(m.PASSWORD.read_bytes(),self.password)
 def test_corrupt_upload_never_replaces_live_release(self):
  self.release('v-old-111');m.switch('v-old-111');new=self.release('v-new-222');(m.release_path(new['release'])/'index.html').write_text('broken')
  with self.assertRaises(RuntimeError):m.activate({**new,'expected':'v-old-111'})
  self.assertEqual(m.current(),'v-old-111')
 def test_incomplete_or_secret_payload_rejected(self):
  p=self.release('v-new-222');(m.release_path(p['release'])/'.env').write_text('not a real secret')
  with self.assertRaises(RuntimeError):m.verify(p)
 def test_paths_symlinks_and_concurrent_switch_are_refused(self):
  for name in ['../html','v-good/../bad','foo','v-../../nf']:
   with self.assertRaises(RuntimeError):m.release_path(name)
  (m.RELEASES/'v-link-111').symlink_to(m.HTML)
  with self.assertRaises(RuntimeError):m.release_path('v-link-111')
  p=self.release('v-new-222')
  with self.assertRaises(RuntimeError):m.activate({**p,'expected':'v-other-333'})
  self.assertIsNone(m.current())
 def test_lease_prevents_parallel_deploy_and_wrong_unlock(self):
  with self.assertRaises(RuntimeError):m.lease({})
  with self.assertRaises(RuntimeError):m.unlock({'token':'wrong'})
  m.unlock({'token':self.token});self.assertTrue(m.lease({})['token'])
 def test_backend_bypass_is_rejected(self):
  with patch.object(m.subprocess,'check_output',return_value=b'[{"domain":null,"path":"/","destination":"STATIC"}]'):
   with self.assertRaises(RuntimeError):m.inspect({})
 def test_dry_inspection_does_not_create_or_modify_files(self):
  before={p.relative_to(self.root):p.read_bytes() for p in self.root.rglob('*') if p.is_file() and not p.is_symlink()}
  m.inspect({});after={p.relative_to(self.root):p.read_bytes() for p in self.root.rglob('*') if p.is_file() and not p.is_symlink()}
  self.assertEqual(before,after)
if __name__=='__main__':unittest.main()
