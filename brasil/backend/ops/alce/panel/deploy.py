#!/usr/bin/env python3
"""Add the standalone admin API to the existing isolated Alce runtime.

The runner provides PRIVATE_CONFIG, CODE_BUNDLE and SOURCE_SHA in memory.
No application users, rides, sessions or pilot settings are edited here.
"""
import base64,hashlib,json,os,shutil,socket,subprocess,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

NAME='alce-panel-api';PORT=8086;ROOT=Path('/opt/alce-lab/panel');CADDY=Path('/etc/caddy/Caddyfile')
EXPECTED_IMAGE='sha256:e82970a9acfba71d5fdb6710a29ec9a3124edd9085f02ddeef25c70ce18b5bb4'
EXPECTED_CADDY='4e91f00376e78625d6d644418920141cbd6821c57c3f472a7098d8bcfa61cdc1'
EXPECTED_MOTOR='443039397360e1ef4f306b1400b17095c7d32392bc83dfca820a097d5eeb8dee'
EXPECTED_BANNERS='65bcd0e769477381f6bab6c01ac7b8b300f93deb51b3005dc9aa572b5b73b656'

def run(args,timeout=40):
 p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
 if p.returncode:raise RuntimeError('COMMAND_FAILED:'+str(args[0]))
 return p.stdout.strip()
def digest(data):return hashlib.sha256(data).hexdigest()
def inspect(name):return json.loads(run(['docker','inspect',name]))[0]
def request(path,method='GET',body=None,session=None,service=True,public=False):
 headers={'Content-Type':'application/json'}
 if service:headers['X-Alce-Service-Key']=PRIVATE_CONFIG['serviceKey']
 if session:headers['X-Alce-Operator-Session']=session
 url=('https://52-67-246-31.sslip.io/api/admin' if public else 'http://127.0.0.1:'+str(PORT)+'/api/admin')+path
 req=Request(url,data=json.dumps(body).encode()if body is not None else None,method=method,headers=headers)
 try:
  with urlopen(req,timeout=20)as r:return r.status,json.loads(r.read())
 except HTTPError as e:
  return e.code,json.loads(e.read())

def main():
 original=inspect('alce-lab-compat')
 assert original['State']['Running'] and original['Image']==EXPECTED_IMAGE,'UNEXPECTED_ORIGINAL_RUNTIME'
 assert not run(['docker','ps','-a','--filter','name=^'+NAME+'$','--format','{{.ID}}']),'ADMIN_CONTAINER_ALREADY_EXISTS'
 assert digest(CADDY.read_bytes())==EXPECTED_CADDY,'CADDY_CHANGED_SINCE_PREFLIGHT'
 assert shutil.disk_usage('/opt/alce-lab').free>512*1024*1024,'INSUFFICIENT_DISK'
 available=next(int(x.split()[1]) for x in Path('/proc/meminfo').read_text().splitlines()if x.startswith('MemAvailable:'))
 assert available>384*1024,'INSUFFICIENT_MEMORY'
 with socket.socket()as probe:probe.bind(('127.0.0.1',PORT))
 values=dict(v.split('=',1)for v in original['Config']['Env']if '=' in v)
 assert values.get('ALCE_ISOLATED_MODE')=='true','NOT_ISOLATED'
 # Verify database and original module hashes INSIDE the original container.
 probe="import{readFileSync}from'node:fs';import{createHash}from'node:crypto';const h=p=>createHash('sha256').update(readFileSync(p)).digest('hex');if(new URL(process.env.DATABASE_URL).pathname!=='/alce_lab')throw Error('DATABASE_GUARD');console.log(JSON.stringify({motor:h('/app/src/mobility.mjs'),banners:h('/app/alce-compat/banners.mjs')}));"
 hashes=json.loads(run(['docker','exec','alce-lab-compat','node','--input-type=module','-e',probe]))
 assert hashes=={'motor':EXPECTED_MOTOR,'banners':EXPECTED_BANNERS},'ORIGINAL_MODULE_CHANGED'
 backup=json.loads(run(['python3','/opt/alce-lab/operations/current/maintenance.py','backup'],timeout=210))
 assert backup.get('backupCreated')and backup.get('encrypted'),'ENCRYPTED_BACKUP_REQUIRED'
 ROOT.mkdir(mode=0o700,parents=True,exist_ok=True);release=ROOT/'releases'/SOURCE_SHA[:16];release.mkdir(mode=0o700,parents=True,exist_ok=False)
 source=release/'backend';source.mkdir(mode=0o755)
 for name,item in CODE_BUNDLE.items():
  assert name in ['api.mjs','drafts.mjs','schema.sql','server.mjs']
  data=base64.b64decode(item['data']);assert digest(data)==item['sha256']
  path=source/name;path.write_bytes(data);path.chmod(0o644)
 values.update({'ALCE_ADMIN_SERVICE_KEY':PRIVATE_CONFIG['serviceKey'],'ALCE_OPERATOR_USERNAME':PRIVATE_CONFIG['operatorUsername'],'ALCE_OPERATOR_NAME':PRIVATE_CONFIG['operatorName'],'ALCE_OPERATOR_PASSWORD':PRIVATE_CONFIG['operatorPassword'],'ALCE_ADMIN_PORT':str(PORT),'HOST':'0.0.0.0','ALCE_COMPAT_ROOT':'/app/alce-compat','NAMMA_BACKEND_ROOT':'/app'})
 # New app registrations stay disabled until the pilot onboarding is reviewed.
 values.pop('ALCE_PANEL_REGISTRATION_INVITE',None)
 assert all('\n'not in v and '\r'not in v for v in values.values()),'UNSUPPORTED_ENV_VALUE'
 envfile=release/'runtime.env';envfile.write_text('\n'.join(k+'='+v for k,v in values.items())+'\n');envfile.chmod(0o600)
 before=CADDY.read_text();beforefile=release/'Caddyfile.before';beforefile.write_text(before);beforefile.chmod(0o600)
 marker='52-67-246-31.sslip.io {';assert before.count(marker)==1
 snippet='\n    # Alce independent administrative API; service key and operator session required.\n    handle /api/admin/* {\n        reverse_proxy 127.0.0.1:8086\n    }\n'
 candidate=before.replace(marker,marker+snippet,1);candidatefile=Path('/etc/caddy/.alce-panel-candidate');candidatefile.write_text(candidate);candidatefile.chmod(0o600)
 run(['caddy','validate','--config',str(candidatefile),'--adapter','caddyfile'])
 created=False;changed=False
 try:
  networks=list(original['NetworkSettings']['Networks']);assert 'alce-lab'in networks
  args=['docker','run','-d','--name',NAME,'--restart','unless-stopped','--network','alce-lab','--memory','256m','--cpus','0.5','--log-driver','json-file','--log-opt','max-size=10m','--log-opt','max-file=2','--security-opt','no-new-privileges:true','--env-file',str(envfile),'-p','127.0.0.1:8086:8086','-v',str(source)+':/opt/alce-panel/backend:ro']
  for mount in original['Mounts']:
   assert mount['Type']=='bind'and mount['Destination']in ['/app/alce-compat','/app/src/maps.mjs','/app/src/geocoding.mjs'],'UNEXPECTED_MOUNT'
   args+=['-v',mount['Source']+':'+mount['Destination']+':ro']
  args+=[original['Image'],'/opt/alce-panel/backend/server.mjs'];run(args);created=True
  for network in networks:
   if network!='alce-lab':run(['docker','network','connect',network,NAME])
  ready=False
  for _ in range(50):
   try:
    code,_=request('/session',service=False)
    if code==401:ready=True;break
   except Exception:pass
   time.sleep(.5)
  assert ready,'ADMIN_DID_NOT_START'
  code,login=request('/session','POST',{'username':PRIVATE_CONFIG['operatorUsername'],'password':PRIVATE_CONFIG['operatorPassword']});assert code==200,'ADMIN_LOGIN_FAILED'
  session=login['session'];code,overview=request('/overview',session=session);assert code==200 and 'stats'in overview,'OVERVIEW_FAILED'
  for endpoint,field in [('/people','people'),('/banners','banners'),('/drafts/categories','drafts'),('/audit','audit')]:
   code,data=request(endpoint,session=session);assert code==200 and field in data,'READ_API_FAILED'
  code,_=request('/session','DELETE',session=session);assert code==200,'SESSION_REVOCATION_FAILED'
  CADDY.write_text(candidate);changed=True;run(['systemctl','reload','caddy'])
  code,_=request('/session',service=False,public=True);assert code==401,'PUBLIC_AUTH_GUARD_FAILED'
  with urlopen('http://127.0.0.1:8084/health',timeout=10)as r:assert r.status==200,'LEGACY_HEALTH_FAILED'
  with urlopen('http://127.0.0.1:8080/health',timeout=10)as r:assert r.status==200,'NAMMA_HEALTH_FAILED'
  after=inspect('alce-lab-compat');assert after['Id']==original['Id']and after['State']['StartedAt']==original['State']['StartedAt'],'ORIGINAL_CONTAINER_RESTARTED'
  (ROOT/'current').symlink_to(release)
  report={'source':SOURCE_SHA,'backupCreated':True,'encryptedBackup':True,'backendReady':True,'httpsAuthenticationRequired':True,'originalContainerPreserved':True,'statsKeys':sorted(overview['stats']),'port':PORT,'at':time.time()}
  (release/'deployment.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
 except Exception:
  if changed and digest(CADDY.read_bytes())==digest(candidate.encode()):CADDY.write_text(before);run(['systemctl','reload','caddy'])
  if created:run(['docker','rm','-f',NAME])
  raise
 finally:candidatefile.unlink(missing_ok=True)

if __name__=='__main__':
 try:main()
 except Exception as error:
  # Never print environment, bootstrap data, SQL rows or command output.
  print(json.dumps({'deployed':False,'reason':str(error)if isinstance(error,AssertionError)else type(error).__name__}));raise SystemExit(1)
