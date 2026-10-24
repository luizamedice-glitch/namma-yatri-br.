#!/usr/bin/env python3
"""Exercise the original driver dashboard against the real local API/database."""
from pathlib import Path
import atexit, json, os, re, subprocess, time, urllib.request, xml.etree.ElementTree as ET
out=Path('driver-original-evidence');out.mkdir(exist_ok=True)
package='in.juspay.nammayatripartner.debug'
remote=os.environ.get('DRIVER_REMOTE')=='true'
base='https://52-67-246-31.sslip.io' if remote else 'http://127.0.0.1:8080'
def adb(*args):return subprocess.check_output(['adb',*args],timeout=45)
def capture(name):
    (out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
    for attempt in range(3):
        try:
            adb('shell','rm','-f','/sdcard/driver-ui.xml')
            adb('shell','uiautomator','dump','/sdcard/driver-ui.xml')
            xml=adb('shell','cat','/sdcard/driver-ui.xml')
            root=ET.fromstring(xml);(out/(name+'.xml')).write_bytes(xml)
            return list(root.iter('node'))
        except Exception:
            if attempt==2:raise
            time.sleep(2)
def diagnostics():
    try:
        subprocess.run([os.environ.get('CDP_PYTHON','python3'),'Frontend/scripts/inspect-original-webview.py',str(out),package],timeout=90,check=False)
        stores={}
        names=adb('shell','run-as',package,'ls','shared_prefs').decode().split()
        for name in names:
            if not re.fullmatch(r'[a-zA-Z0-9._-]+\.xml',name):continue
            try:
                root=ET.fromstring(adb('shell','run-as',package,'cat','shared_prefs/'+name))
                stores[name]=[child.get('name') for child in root]
            except Exception:pass
        (out/'preference-keys.json').write_text(json.dumps(stores))
        raw=adb('logcat','-d').decode(errors='replace')
        raw=re.sub(r'AIza[0-9A-Za-z_-]{20,}','[REDACTED_GOOGLE_KEY]',raw)
        raw=re.sub(r'\b[a-fA-F0-9]{64}\b','[REDACTED_SESSION]',raw)
        raw=re.sub(r'\b[a-fA-F0-9]{32}\b','[REDACTED_ACTIVATION]',raw)
        raw=re.sub(r'(?i)(bearer\s+)[a-z0-9._~-]+',r'\1[REDACTED]',raw)
        (out/'logcat.txt').write_text(raw)
        (out/'activity.txt').write_bytes(adb('shell','dumpsys','activity','activities'))
    except Exception:pass
atexit.register(diagnostics)

def snapshot():
    req=urllib.request.Request(base+'/v1/snapshot',headers={'Authorization':'Bearer '+session['token']})
    with urllib.request.urlopen(req,timeout=10) as response:return json.load(response)
# The session is delivered outside the APK, only into this disposable emulator's private sandbox.
if not remote:
    session=json.loads(Path(os.environ['DRIVER_ACCEPTANCE_SESSION_FILE']).read_text())
    values={'YATRI_DRIVER_BACKEND_URL':base,'YATRI_DRIVER_SESSION':session['token']}
    root=ET.Element('map')
    for key,value in values.items():ET.SubElement(root,'string',name=key).text=value
    adb('shell','run-as',package,'mkdir','-p','shared_prefs')
    subprocess.run(['adb','shell','run-as',package,'sh','-c','"cat > shared_prefs/godel.xml"'],input=ET.tostring(root),check=True,timeout=30)
    adb('reverse','tcp:8080','tcp:8080')
adb('emu','geo','fix','-46.63','-23.55')
(out/'launch.txt').write_bytes(adb('shell','am','start','-W','-n',package+'/in.juspay.mobility.MainActivity'))
if remote:
    time.sleep(12)
    setup=capture('conectar-celular') # Empty password field; no code in artifacts.
    def tap(node):
        x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds','')))
        adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
    field=next(n for n in setup if n.get('class')=='android.widget.EditText')
    connect=next(n for n in setup if n.get('text')=='Conectar ao servidor')
    tap(field)
    activation=json.loads(Path(os.environ['DRIVER_REMOTE_ACTIVATION_FILE']).read_text())
    entered=subprocess.run(['adb','shell','input','text',activation['code']],capture_output=True,timeout=30)
    assert entered.returncode==0,'Falha ao preencher ativacao privada'
    tap(connect)
    time.sleep(12)
    preferences=ET.fromstring(adb('shell','run-as',package,'cat','shared_prefs/godel.xml'))
    stored={n.get('name'):n.text for n in preferences if n.tag=='string'}
    assert stored.get('YATRI_DRIVER_BACKEND_URL')==base,'URL remota nao provisionada pela interface'
    session={'token':stored.get('YATRI_DRIVER_SESSION','')}
    assert re.fullmatch('[a-f0-9]{64}',session['token']),'Sessao nao provisionada pela interface'
    # Leave a deterministic initial state without fabricating operational responses.
    req=urllib.request.Request(base+'/v1/driver/availability',data=b'{"available":false}',
        headers={'Content-Type':'application/json','Authorization':'Bearer '+session['token']})
    with urllib.request.urlopen(req,timeout=15) as response:assert response.status==200
time.sleep(40)
subprocess.run([os.environ.get('CDP_PYTHON','python3'),'Frontend/scripts/inspect-original-webview.py',str(out),package],timeout=90,check=False)
nodes=capture('dashboard-offline')
labels=[n.get('text','') for n in nodes]
assert not any('Enter Mobile' in text or 'Enter OTP' in text for text in labels),'Entrou em autenticação original'
assert any(re.search(r'online|offline|dispon.vel',text,re.I) for text in labels),'Painel operacional ausente'
assert snapshot()['available'] is False
# Prefer the original large online button, with a fallback to its original toggle.
button=next((n for n in nodes if re.fullmatch(r'go online|ficar dispon.vel|ativar',n.get('text',''),re.I)),None)
if button is None:raise AssertionError('Botão original de disponibilidade não encontrado')
x1,y1,x2,y2=map(int,re.findall(r'\d+',button.get('bounds','')))
adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
for attempt in range(12):
    time.sleep(3)
    if snapshot()['available']:break
else:raise AssertionError('Backend não confirmou disponibilidade real')
capture('dashboard-online')
(out/'acceptance.json').write_text(json.dumps({'acceptance':'passed','no_login':True,'gps_and_availability_real_api':True,
    'driver_name':snapshot()['user']['name'],'backend':'lightsail_https' if remote else 'local',
    'native_mobile_pairing':remote}))
if remote:
    req=urllib.request.Request(base+'/v1/driver/availability',data=b'{"available":false}',
        headers={'Content-Type':'application/json','Authorization':'Bearer '+session['token']})
    with urllib.request.urlopen(req,timeout=15) as response:assert response.status==200
# Never publish session files or raw logcat containing credentials.
log=adb('logcat','-d').decode(errors='replace')
log=re.sub(r'AIza[0-9A-Za-z_-]{20,}','[REDACTED_GOOGLE_KEY]',log)
log=re.sub(r'\b[a-fA-F0-9]{64}\b','[REDACTED_SESSION]',log)
log=re.sub(r'\b[a-fA-F0-9]{32}\b','[REDACTED_ACTIVATION]',log)
log=re.sub(r'(?i)(bearer\s+)[a-z0-9._~-]+',r'\1[REDACTED]',log)
(out/'logcat.txt').write_text(log)
assert 'FATAL EXCEPTION' not in log,'Exceção fatal Android'
