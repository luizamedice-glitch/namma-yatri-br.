#!/usr/bin/env python3
"""Operator provisioning: keep the backend session outside the APK, repository and console."""
import json,re,subprocess,sys,urllib.parse,xml.etree.ElementTree as ET
from pathlib import Path
if len(sys.argv)!=3:raise SystemExit('Uso: provision-driver-device.py URL_BASE ARQUIVO_PRIVADO_DA_SESSAO')
base=sys.argv[1].rstrip('/');url=urllib.parse.urlparse(base)
if url.scheme not in ('http','https') or not url.hostname or url.username or url.password:raise SystemExit('URL inválida')
if url.path not in ('','/'):raise SystemExit('Use a URL base, sem /v1')
session=json.loads(Path(sys.argv[2]).read_text())
if not re.fullmatch('[a-f0-9]{64}',session.get('token','')):raise SystemExit('Sessão inválida')
package='in.juspay.nammayatripartner.debug'
def adb(*args):return subprocess.check_output(['adb',*args],timeout=30)
adb('shell','am','force-stop',package)
root=ET.Element('map')
# Preserve the original application preferences instead of replacing its entire store.
try:root=ET.fromstring(adb('shell','run-as',package,'cat','shared_prefs/godel.xml'))
except subprocess.CalledProcessError:pass
values={'YATRI_DRIVER_BACKEND_URL':base,'YATRI_DRIVER_SESSION':session['token']}
for child in list(root):
    if child.get('name') in values:root.remove(child)
for key,value in values.items():ET.SubElement(root,'string',name=key).text=value
adb('shell','run-as',package,'mkdir','-p','shared_prefs')
subprocess.run(['adb','shell','run-as',package,'sh','-c','"cat > shared_prefs/godel.xml"'],input=ET.tostring(root),check=True,timeout=30)
print('Dispositivo de desenvolvimento provisionado; nenhum segredo incluído no APK.')
