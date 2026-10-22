#!/usr/bin/env python3
"""Verify the actual original HomeScreen opens without authentication, offline and online."""
import json
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
    # Map/IME accessibility events may prevent one idle snapshot; never reuse an old XML.
    (out / f'home-{stage}.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    for attempt in range(3):
        adb('shell', 'rm', '-f', '/sdcard/home-window.xml')
        dump = adb('shell', 'uiautomator', 'dump', '/sdcard/home-window.xml').decode(errors='replace')
        try:
            xml = adb('shell', 'cat', '/sdcard/home-window.xml')
            nodes = list(ET.fromstring(xml).iter('node'))
            break
        except (subprocess.CalledProcessError, ET.ParseError):
            trace.append({'stage': stage, 'capture_attempt': attempt + 1, 'dump': dump[:300]})
            if attempt == 2:
                raise RuntimeError(f'No fresh UI hierarchy after 3 attempts at {stage}: {dump[:200]}')
            time.sleep(2)
    (out / f'home-{stage}.xml').write_bytes(xml)
    (out / f'home-{stage}.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    trace.append({'stage': stage, 'labels': [n.get('text') or n.get('content-desc') for n in nodes if n.get('text') or n.get('content-desc')]})
    return nodes

def tap(node):
    x1,y1,x2,y2 = map(int,re.findall(r'\d+',node.get('bounds','')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))

def where(nodes):
    # Both controls exist in the historical HomeScreen (primary button and new-home layout).
    hints = {'Where To : Button', 'Where are you going? : Button'}
    return next((n for n in nodes if n.get('package') == package and n.get('content-desc') in hints), None)

def no_auth(nodes):
    labels = ' '.join(n.get('text','') for n in nodes)
    assert "You're Offline" not in labels, 'Tela offline bloqueou a home de desenvolvimento.'
    assert 'Enter your Mobile Number' not in labels, 'Onboarding foi aberto no modo de desenvolvimento.'
    assert 'Enter 4 digit OTP' not in labels, 'Tela OTP foi aberta.'

try:
    diagnostic = json.loads((out/'webview-state.json').read_text())
    development = []
    for c in diagnostic['contexts']:
        value = c.get('state',{}).get('result',{}).get('result',{}).get('value')
        if isinstance(value,str):
            state = json.loads(value)
            if state.get('developmentMode'):
                development.append(state)
    assert development, 'Flag de desenvolvimento nao chegou ao frontend.'
    assert all(isinstance(s.get('configDiagnostics'), dict) for s in development), 'Adaptador Android de diagnosticos nao foi carregado.'
    assert all(s['configDiagnostics'].get('notices') == (1 if s['configDiagnostics'].get('warnings', 0) else 0) for s in development), 'Avisos de configuracao nao foram agregados.'
    assert all(s.get('hasRegistrationToken') is False for s in development), 'Home depende de um token preexistente ou a leitura nao foi verificada.'
    nodes = capture('offline')
    no_auth(nodes)
    button = where(nodes)
    assert button is not None, 'Controle central Where To original nao apareceu.'
    tap(button)
    time.sleep(3)
    nodes = capture('search')
    fields = [n for n in nodes if n.get('class') == 'android.widget.EditText']
    assert len(fields)>=2, 'O botao central nao abriu os campos originais de origem/destino.'
    tap(fields[-1])
    adb('shell','input','text','Avenida%sPaulista')
    time.sleep(3)
    nodes=capture('typed')
    assert any(n.get('class')=='android.widget.EditText' and n.get('text')=='Avenida Paulista' for n in nodes), 'Campo de destino original nao aceita edicao.'
    no_auth(nodes)
    for attempt in range(3):
        adb('shell','input','keyevent','KEYCODE_BACK')
        time.sleep(2)
        nodes=capture(f'back-{attempt}')
        if where(nodes) is not None:
            break
    else:
        raise AssertionError('Voltar nao retornou a home original.')
    adb('shell','svc','wifi','enable')
    adb('shell','svc','data','enable')
    adb('shell','am','force-stop',package)
    adb('shell','am','start','-W','-n',package+'/in.juspay.mobility.MainActivity')
    for attempt in range(12):
        time.sleep(3)
        nodes=capture(f'online-{attempt}')
        if where(nodes) is not None:
            no_auth(nodes)
            break
    else:
        raise AssertionError('Reabertura com rede nao chegou diretamente a home.')
    assert adb('shell','pidof',package).strip(), 'Processo encerrou.'
    (out/'home-result.txt').write_text('PASS: HomeScreen original sem token, offline/online, busca editavel e retorno; nenhuma corrida ou sessao simulada.\n')
    print((out/'home-result.txt').read_text())
except Exception as error:
    (out/'home-result.txt').write_text(f'FAIL: {error}\n')
    raise
finally:
    (out/'home-navigation.json').write_text(json.dumps(trace,ensure_ascii=False,indent=2))
    log=adb('logcat','-d').decode(errors='replace')
    log=re.sub(r'AIza[0-9A-Za-z_-]{20,}','[REDACTED_GOOGLE_KEY]',log)
    log=re.sub(r'(?i)(bearer\s+)[a-z0-9._~-]+',r'\1[REDACTED]',log)
    (out/'home-logcat.txt').write_text(log)
