import pathlib,subprocess,json,hashlib,sys,time,urllib.request,urllib.error,os
assert os.geteuid()==0
payload=json.load(sys.stdin)
d=json.loads(subprocess.check_output(['docker','inspect','alce-lab-compat'],text=True))[0]
root=pathlib.Path(next(m['Source'] for m in d['Mounts'] if m['Destination']=='/app/alce-compat'))
assert str(root).startswith('/opt/alce-lab/compat/releases/')
p=root/'http.mjs';before=p.read_bytes();assert hashlib.sha256(before).hexdigest()=='09c6a80b7759d05f3d948f2b19090386275d9b8b7f4ab2e8ab9a737f1ab01805','LIVE_VERSION_CHANGED'
s=before.decode();needle='const quote=await service.quote(user,points(body));';assert s.count(needle)==1
s="import {recoverRideAddresses} from './ride-addresses.mjs';\n"+s.replace(needle,'const selected=await recoverRideAddresses(points(body),{user,pool:addresses?pool:null,maps});\n        const quote=await service.quote(user,selected);')
backup=pathlib.Path('/opt/alce-lab/private/address48-http-before.mjs');assert not backup.exists();backup.write_bytes(before);backup.chmod(0o600)
helper=root/'ride-addresses.mjs';assert not helper.exists()
def write(path,data):
 tmp=path.with_suffix(path.suffix+'.address48-tmp');tmp.write_bytes(data);tmp.chmod(0o644);tmp.replace(path)
def check():
 for _ in range(20):
  try:
   with urllib.request.urlopen('http://127.0.0.1:8084/health',timeout=3) as r:
    if r.status==200:break
  except Exception:time.sleep(1)
 else:raise RuntimeError('HEALTH_FAILED')
 try:urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8084/solicitacao20/estimativasCorrida',data=b'{}',headers={'Content-Type':'application/json'}),timeout=5)
 except urllib.error.HTTPError as e:assert e.code==401
 else:raise RuntimeError('AUTH_GUARD_FAILED')
try:
 write(helper,payload['helper'].encode());write(p,s.encode())
 for n in ['http.mjs','ride-addresses.mjs']:subprocess.run(['docker','exec','alce-lab-compat','node','--check','/app/alce-compat/'+n],check=True,capture_output=True)
 subprocess.run(['docker','restart','alce-lab-compat'],check=True,capture_output=True);check()
 print(json.dumps({'addressRecoveryDeployed':True,'health':True,'authGuard':True,'databaseMutated':False,'existingRideAddressesBackfilled':False,'httpSha256':hashlib.sha256(p.read_bytes()).hexdigest()}))
except Exception:
 write(p,before);helper.unlink(missing_ok=True);subprocess.run(['docker','restart','alce-lab-compat'],capture_output=True);raise
