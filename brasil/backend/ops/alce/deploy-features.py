#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Add chat/campaigns only to the current isolated Alce compatibility container."""
import hashlib,json,os,re,subprocess,sys,tarfile,time
from pathlib import Path
from urllib.request import urlopen
ROOT=Path('/opt/alce-lab');CADDY=Path('/etc/caddy/Caddyfile');BACKUP='alce-lab-compat-before-features'
def run(args,timeout=120):return subprocess.run(args,capture_output=True,text=True,check=True,timeout=timeout).stdout.strip()
def health(port):
 with urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=5)as r:return r.status==200

def main(bundle,expected_file):
 if os.geteuid()!=0:raise RuntimeError('ROOT_REQUIRED')
 global BACKUP
 expected=json.loads(Path(expected_file).read_text());BACKUP='alce-lab-compat-before-'+expected['release'];assert hashlib.sha256(Path(bundle).read_bytes()).hexdigest()==expected['bundleSha256'];meta=json.loads(run(['docker','inspect','alce-lab-compat']))[0]
 env=dict(x.split('=',1)for x in meta['Config']['Env']if '='in x)
 if env.get('ALCE_ISOLATED_MODE')!='true' or not env.get('DATABASE_URL','').split('?',1)[0].endswith('/alce_lab'):raise RuntimeError('ISOLATED_ALCE_REQUIRED')
 current=Path(next(m['Source']for m in meta['Mounts']if m['Destination']=='/app/alce-compat'))
 if current.name!=expected['release']:raise RuntimeError('RUNTIME_CHANGED_SINCE_REVIEW')
 for name,digest in expected['moduleHashes'].items():
  if hashlib.sha256((current/name).read_bytes()).hexdigest()!=digest:raise RuntimeError('RUNTIME_MODULE_CHANGED_SINCE_REVIEW')
 for port in [8080,8082,8083,8084]:
  if not health(port):raise RuntimeError('EXISTING_SERVICE_UNHEALTHY')
 if run(['docker','ps','-a','--filter','name=^'+BACKUP+'$','--format','{{.ID}}']):raise RuntimeError('EXISTING_ROLLBACK_CONTAINER')
 backup=json.loads(run(['python3',str(ROOT/'operations/current/maintenance.py'),'backup'],timeout=210));assert backup.get('backupCreated') and backup.get('encrypted')
 digest=hashlib.sha256(Path(bundle).read_bytes()).hexdigest()[:16];release=ROOT/'compat/releases'/digest
 if release.exists():raise RuntimeError('RELEASE_EXISTS')
 release.mkdir(mode=0o755,parents=True)
 with tarfile.open(bundle,'r:gz')as archive:
  for m in archive.getmembers():
   if not m.isfile()or '/'in m.name or m.name.startswith('.')or not m.name.endswith(('.mjs','.json')):raise RuntimeError('INVALID_MODULE')
   data=archive.extractfile(m).read()
   if len(data)>2_500_000:raise RuntimeError('MODULE_TOO_LARGE')
   (release/m.name).write_bytes(data);(release/m.name).chmod(0o644)
 for name in ['server.mjs','http.mjs','models.mjs','maps.mjs','geocoding.mjs','reporting.mjs','nearby.mjs','chat.mjs','banners.mjs','campaign-seeds.json','verify-features.mjs']:
  if not (release/name).is_file():raise RuntimeError('INCOMPLETE_MODULES')
 # Preserve the ACTUAL environment, including current pilot expiry and map keys.
 if any('\n'in x or '\r'in x for x in meta['Config']['Env']):raise RuntimeError('MULTILINE_ENV_REFUSED')
 runtime=release/'runtime.env';runtime.write_text('\n'.join(meta['Config']['Env'])+'\n');runtime.chmod(0o600)
 before=CADDY.read_text();candidate=before
 begin=before.index('# BEGIN ALCE LEGACY COMPAT');end=before.index('# END ALCE LEGACY COMPAT',begin)
 block=before[begin:end]
 if '/mensagem/*'not in block:
  block,n=re.subn(r'(?m)^(\s*path [^\n]+)$',r'\1 /mensagem/*',block,count=1)
  if n!=1:raise RuntimeError('CADDY_SCOPE_NOT_FOUND')
  candidate=before[:begin]+block+before[end:]
 candidate_file=release/'Caddyfile';candidate_file.write_text(candidate);candidate_file.chmod(0o600)
 run(['caddy','validate','--config',str(candidate_file),'--adapter','caddyfile'])
 previous_file=release/'Caddyfile.before';previous_file.write_text(before);previous_file.chmod(0o600)
 changed=False;stopped=False
 try:
  run(['docker','stop','alce-lab-compat']);stopped=True;run(['docker','rename','alce-lab-compat',BACKUP])
  args=['docker','run','-d','--name','alce-lab-compat','--restart','unless-stopped','--network','alce-lab','--memory','256m','--cpus','0.5','--log-driver','json-file','--log-opt','max-size=10m','--log-opt','max-file=3','--env-file',str(runtime),'-p','127.0.0.1:8084:8084']
  for m in meta['Mounts']:
   source=str(release)if m['Destination']=='/app/alce-compat'else str(release/Path(m['Source']).name)if m['Destination']in ['/app/src/maps.mjs','/app/src/geocoding.mjs']else m['Source']
   args+=['-v',source+':'+m['Destination']+(''if m.get('RW')else ':ro')]
  args+=['--entrypoint','node',meta['Config']['Image'],'/app/alce-compat/server.mjs'];run(args)
  for network in meta['NetworkSettings']['Networks']:
   if network!='alce-lab':run(['docker','network','connect',network,'alce-lab-compat'])
  for _ in range(30):
   try:
    if health(8084):break
   except Exception:pass
   time.sleep(1)
  else:raise RuntimeError('NEW_COMPAT_UNHEALTHY')
  CADDY.write_text(candidate);changed=True;run(['systemctl','reload','caddy'])
  report=run(['docker','exec','alce-lab-compat','node','/app/alce-compat/verify-features.mjs']);json.loads(report)
  # Existing read-only session/history/GPS acceptance; mutation opt-in stays off.
  previous=run(['docker','exec','alce-lab-compat','node','/app/alce-compat/verify-https.mjs']);json.loads(previous)
  for port in [8080,8082,8083]:
   if not health(port):raise RuntimeError('NAMMA_SERVICE_UNHEALTHY')
  (ROOT/'compat/current-release').write_text(digest+'\n')
  (ROOT/'compat/features-rollback.json').write_text(json.dumps({'release':digest,'previous':str(current),'container':BACKUP,'caddyBefore':str(previous_file)}))
  print(json.dumps({'featuresDeployed':True,'previousRelease':current.name,'release':digest,'encryptedBackupCreated':True,'environmentAndPilotPreserved':True,'nammaServicesPreserved':True,'checks':json.loads(report),'priorChecks':json.loads(previous)}))
 except Exception:
  if changed:CADDY.write_text(before);run(['systemctl','reload','caddy'])
  # Do not destroy the previous runtime if creation/rename failed.
  if run(['docker','ps','-a','--filter','name=^'+BACKUP+'$','--format','{{.ID}}']):
   subprocess.run(['docker','rm','-f','alce-lab-compat'],capture_output=True);run(['docker','rename',BACKUP,'alce-lab-compat']);run(['docker','start','alce-lab-compat'])
  elif stopped:run(['docker','start','alce-lab-compat'])
  raise
if __name__=='__main__':
 try:main(*sys.argv[1:])
 except Exception as e:print(json.dumps({'deploymentFailed':True,'reason':str(e)if isinstance(e,RuntimeError)else type(e).__name__}));sys.exit(1)
