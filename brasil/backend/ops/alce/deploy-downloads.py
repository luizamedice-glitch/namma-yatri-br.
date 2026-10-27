#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Fetch verified private APKs; install a time-limited HTTPS delivery route."""
import hashlib,json,os,re,shutil,subprocess,sys,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

ROOT=Path('/opt/alce-lab/downloads')
CADDY=Path('/etc/caddy/Caddyfile');HOST='52-67-246-31.sslip.io'
def run(args):return subprocess.run(args,capture_output=True,text=True,check=True,timeout=60).stdout
def status(url):
    try:
        with urlopen(url,timeout=10) as r:return r.status
    except HTTPError as e:return e.code

def main(payload,server_source):
    data=json.loads(Path(payload).read_text())
    if os.getuid()!=0 or not Path('/opt/alce-lab/private/api.env').is_file():raise RuntimeError()
    if not re.fullmatch('[a-f0-9]{64}',data['token']) or not time.time()<data['expiresAt']<=time.time()+86400:raise RuntimeError()
    before=CADDY.read_text();ROOT.mkdir(mode=0o755,parents=True,exist_ok=True)
    version=ROOT/('release-'+str(int(time.time())));version.mkdir(mode=0o755)
    metadata={'token':data['token'],'expiresAt':data['expiresAt'],'files':{}}
    for item in data['files']:
        name=item['name']
        if name not in ['AlceYatri-Passageiro-Lab-1.apk','AlceYatri-Motorista-Lab-1.apk']:raise RuntimeError()
        if not item['url'].startswith('https://raw.githubusercontent.com/luizamedice-glitch/alce-yatri-rea-analysis/'):raise RuntimeError()
        target=version/name;digest=hashlib.sha256();size=0
        with urlopen(item['url'],timeout=45) as source,target.open('wb') as dest:
            while chunk:=source.read(1024*1024):
                size+=len(chunk)
                if size>item['size']:raise RuntimeError()
                dest.write(chunk);digest.update(chunk)
        if size!=item['size'] or digest.hexdigest()!=item['sha256']:raise RuntimeError()
        target.chmod(0o644);metadata['files'][name]={'size':size,'sha256':item['sha256']}
    # Root directory is not served directly. Only the exact capability route is accepted.
    meta=version/'metadata.json';meta.write_text(json.dumps(metadata));meta.chmod(0o640)
    shutil.chown(meta,user='root',group='nogroup')
    shutil.copyfile(server_source,ROOT/'server.py');(ROOT/'server.py').chmod(0o644)
    unit=Path('/etc/systemd/system/alce-lab-downloads.service')
    unit.write_text(f'''[Unit]
Description=Temporary private Alce APK delivery
After=network.target
[Service]
User=nobody
Group=nogroup
ExecStart=/usr/bin/python3 {ROOT}/server.py {version}
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
MemoryMax=128M
[Install]
WantedBy=multi-user.target
''')
    run(['systemctl','daemon-reload']);run(['systemctl','enable','--now','alce-lab-downloads'])
    run(['systemctl','restart','alce-lab-downloads'])
    for _ in range(20):
        try:
            if status('http://127.0.0.1:8085/health')==200:break
        except OSError:pass
        time.sleep(.25)
    else:raise RuntimeError()
    clean=re.sub(r'\n[ \t]*# BEGIN ALCE DOWNLOADS[\s\S]*?# END ALCE DOWNLOADS\n','\n',before)
    pattern=r'(?m)^([ \t]*(?:https://)?'+re.escape(HOST)+r'(?::443)?[ \t]*\{)'
    if len(re.findall(pattern,clean))!=1:raise RuntimeError()
    block='''
    # BEGIN ALCE DOWNLOADS
    handle /lab-apks/* {
        reverse_proxy 127.0.0.1:8085
    }
    # END ALCE DOWNLOADS
'''
    candidate=re.sub(pattern,lambda m:m.group(1)+block,clean,count=1)
    config=ROOT/'Caddyfile.candidate';config.write_text(candidate)
    run(['caddy','validate','--config',str(config),'--adapter','caddyfile'])
    try:
        CADDY.write_text(candidate);run(['systemctl','reload','caddy'])
        assert status('https://'+HOST+'/lab-apks/invalid/file.apk')==404
        for name,info in metadata['files'].items():
            url='https://'+HOST+'/lab-apks/'+data['token']+'/'+name
            with urlopen(Request(url,method='HEAD'),timeout=15) as r:
                assert r.status==200 and int(r.headers['Content-Length'])==info['size']
                assert r.headers['Content-Type']=='application/vnd.android.package-archive'
            with urlopen(Request(url,headers={'Range':'bytes=0-1023'}),timeout=15) as r:
                assert r.status==206 and len(r.read())==1024
        for port in [8080,8082,8083,8084]:assert status(f'http://127.0.0.1:{port}/health')==200
        print(json.dumps({'privateApkDelivery':True,'contentLengthVerified':True,'rangeResumeVerified':True,'existingServicesHealthy':True,'expiresAt':data['expiresAt']}))
    except Exception:
        CADDY.write_text(before);run(['systemctl','reload','caddy']);raise

if __name__=='__main__':
    try:main(*sys.argv[1:])
    except Exception:
        print('PRIVATE_DOWNLOAD_DEPLOY_FAILED: no credentials printed; inspect private runtime.',file=sys.stderr)
        sys.exit(1)
