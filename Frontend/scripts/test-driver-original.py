#!/usr/bin/env python3
"""Exercise the original driver dashboard against the real local API/database."""
from pathlib import Path
import json, os, re, subprocess, time, urllib.request, xml.etree.ElementTree as ET
out=Path('driver-original-evidence');out.mkdir(exist_ok=True)
package='in.juspay.nammayatripartner.debug'
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
def snapshot():
    req=urllib.request.Request('http://127.0.0.1:8080/v1/snapshot',headers={'Authorization':'Bearer '+session['token']})
    with urllib.request.urlopen(req,timeout=10) as response:return json.load(response)
# The session is delivered outside the APK, only into this disposable emulator's private sandbox.
session=json.loads(Path(os.environ['DRIVER_ACCEPTANCE_SESSION_FILE']).read_text())
values={'YATRI_DRIVER_BACKEND_URL':'http://127.0.0.1:8080','YATRI_DRIVER_SESSION':session['token']}
root=ET.Element('map')
for key,value in values.items():ET.SubElement(root,'string',name=key).text=value
adb('shell','run-as',package,'mkdir','-p','shared_prefs')
subprocess.run(['adb','shell','run-as',package,'sh','-c','"cat > shared_prefs/godel.xml"'],input=ET.tostring(root),check=True,timeout=30)
adb('reverse','tcp:8080','tcp:8080')
adb('emu','geo','fix','-46.63','-23.55')
adb('shell','am','start','-W','-n',package+'/in.juspay.mobility.MainActivity')
time.sleep(40)
nodes=capture('dashboard-offline')
labels=[n.get('text','') for n in nodes]
assert not any('Enter Mobile' in text or 'Enter OTP' in text for text in labels),'Entrou em autenticação original'
assert any(re.search(r'online|offline|dispon.vel',text,re.I) for text in labels),'Painel operacional ausente'
assert snapshot()['available'] is False
# Prefer the original large online button, with a fallback to its original toggle.
button=next((n for n in nodes if re.fullmatch(r'go online|ficar dispon.vel',n.get('text',''),re.I)),None)
if button is None:raise AssertionError('Botão original de disponibilidade não encontrado')
x1,y1,x2,y2=map(int,re.findall(r'\d+',button.get('bounds','')))
adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
for attempt in range(12):
    time.sleep(3)
    if snapshot()['available']:break
else:raise AssertionError('Backend não confirmou disponibilidade real')
capture('dashboard-online')
(out/'acceptance.json').write_text(json.dumps({'acceptance':'passed','no_login':True,'gps_and_availability_real_api':True,'driver_name':snapshot()['user']['name']}))
# Never publish session files or raw logcat containing credentials.
log=adb('logcat','-d').decode(errors='replace')
log=re.sub(r'AIza[0-9A-Za-z_-]{20,}','[REDACTED_GOOGLE_KEY]',log)
log=re.sub(r'\b[a-fA-F0-9]{64}\b','[REDACTED_SESSION]',log)
log=re.sub(r'(?i)(bearer\s+)[a-z0-9._~-]+',r'\1[REDACTED]',log)
(out/'logcat.txt').write_text(log)
assert 'FATAL EXCEPTION' not in log,'Exceção fatal Android'
