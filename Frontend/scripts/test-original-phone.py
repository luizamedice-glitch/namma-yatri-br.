#!/usr/bin/env python3
"""Exercise native onboarding controls without submitting a phone number or OTP."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

out = Path(sys.argv[1])
package = 'in.juspay.nammayatri.debug'
trace = []

def adb(*args):
    return subprocess.check_output(['adb', *args], timeout=30)

def capture(stage):
    adb('shell', 'uiautomator', 'dump', '/sdcard/phone-window.xml')
    xml = adb('shell', 'cat', '/sdcard/phone-window.xml')
    (out / f'phone-{stage}.xml').write_bytes(xml)
    (out / f'phone-{stage}.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    return list(ET.fromstring(xml).iter('node'))

def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds', '')))
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))

try:
    adb('shell', 'svc', 'wifi', 'enable')
    adb('shell', 'svc', 'data', 'enable')
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-W', '-n', package+'/in.juspay.mobility.MainActivity')
    for step in range(16):
        time.sleep(4)
        nodes = capture(f'navigate-{step}')
        labels = [n.get('text') or n.get('content-desc') for n in nodes]
        trace.append({'step': step, 'labels': [s for s in labels if s]})
        fields = [n for n in nodes if n.get('class') == 'android.widget.EditText']
        if fields:
            break
        # Never click Continue: on the phone screen that sends an OTP.
        allowed = {'Get Started', 'Get Started : Button', 'Try Again', 'Allow',
                   'ALLOW', 'While using the app', 'Only this time', 'English'}
        target = next((n for n in nodes if (n.get('text') or n.get('content-desc')) in allowed), None)
        if target is not None:
            tap(target)
    else:
        raise AssertionError('Nao foi possivel chegar ao campo original de telefone; consultar capturas.')
    tap(fields[0])
    adb('shell', 'input', 'text', '11987654321')
    time.sleep(3)
    nodes = capture('typed')
    fields = [n for n in nodes if n.get('class') == 'android.widget.EditText']
    trace.append({'typed': [n.get('text') for n in fields]})
    assert any(n.get('text') == '11987654321' for n in fields), 'O campo nao preservou os 11 digitos brasileiros.'
    assert any(n.get('text') == '+55' for n in nodes), 'O codigo do Brasil nao esta selecionado.'
    assert any(n.get('content-desc') == 'Continue : Button' for n in nodes), 'O controlador nao habilitou Continuar.'
    message = 'Backend de desenvolvimento não configurado.'
    assert any(message in (n.get('text') or '') for n in nodes), 'Diagnostico de backend ausente nao foi exibido.'
    # Only this explicitly unconfigured build may be clicked: no OTP can be sent.
    target = next(n for n in nodes if n.get('content-desc') == 'Continue : Button')
    tap(target)
    time.sleep(3)
    nodes = capture('continue-without-backend')
    assert any(n.get('class') == 'android.widget.EditText' and n.get('text') == '11987654321' for n in nodes), 'Continuar perdeu o formulario sem backend.'
    assert not any(n.get('text') == "You're Offline" for n in nodes), 'Configuracao ausente foi confundida com falta de internet.'
    tap(next(n for n in nodes if n.get('class') == 'android.widget.EditText'))
    # Invalid mobile prefix must disable the original button again.
    adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
    for _ in range(11):
        adb('shell', 'input', 'keyevent', 'KEYCODE_DEL')
    adb('shell', 'input', 'text', '11887654321')
    time.sleep(3)
    nodes = capture('invalid')
    assert not any(n.get('content-desc') == 'Continue : Button' for n in nodes), 'Numero invalido habilitou Continuar.'
    result = 'PASS: 11 digitos, +55 e validacao real do controlador; nenhum OTP solicitado.'
    (out / 'phone-result.txt').write_text(result+'\n')
    print(result)
except Exception as error:
    (out / 'phone-result.txt').write_text(f'FAIL: {error}\n')
    raise
finally:
    (out / 'phone-navigation.json').write_text(json.dumps(trace, ensure_ascii=False, indent=2))

    log = adb('logcat', '-d').decode(errors='replace')
    log = re.sub(r'AIza[0-9A-Za-z_-]{20,}', '[REDACTED_GOOGLE_KEY]', log)
    log = re.sub(r'(?i)(bearer\s+)[a-z0-9._~-]+', r'\1[REDACTED]', log)
    (out / 'phone-logcat.txt').write_text(log)
