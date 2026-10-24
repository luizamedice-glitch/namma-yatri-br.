#!/usr/bin/env python3
"""Verify the actual original HomeScreen opens without authentication, offline and online."""
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
    hints = {'Where To : Button', 'Where are you going? : Button', 'Para onde?: botão', 'Para onde você vai?: botão'}
    return next((n for n in nodes if n.get('package') == package and n.get('content-desc') in hints), None)

def no_auth(nodes):
    labels = ' '.join(n.get('text','') for n in nodes)
    assert "You're Offline" not in labels, 'Tela offline bloqueou a home de desenvolvimento.'
    assert 'Enter your Mobile Number' not in labels, 'Onboarding foi aberto no modo de desenvolvimento.'
    assert 'Enter 4 digit OTP' not in labels, 'Tela OTP foi aberta.'

def read_places(stage):
    target = out / ('places-' + stage)
    target.mkdir(exist_ok=True)
    subprocess.run([os.environ.get('CDP_PYTHON', sys.executable),
                    'Frontend/scripts/inspect-original-webview.py', str(target)], check=True, timeout=90)
    result = json.loads((target / 'webview-state.json').read_text())
    for context in result['contexts']:
        value = context.get('state', {}).get('result', {}).get('result', {}).get('value')
        if isinstance(value, str):
            state = json.loads(value)
            if state.get('developmentMode') and isinstance(state.get('placesDiagnostics'), dict):
                return state['placesDiagnostics']
    raise AssertionError('Adaptador Places BR não foi carregado no WebView.')

def real_places_or_explicit_block(nodes):
    evidence = {'acceptance': 'not_validated', 'provider': 'Yatri backend / Google Places'}
    button = where(nodes)
    assert button is not None
    tap(button)
    time.sleep(2)
    for field, query in [('destination', 'Avenida Paulista, Sao Paulo'), ('source', 'Praca da Se, Sao Paulo')]:
        nodes = capture('places-' + field + '-input')
        fields = [n for n in nodes if n.get('class') == 'android.widget.EditText']
        assert len(fields) >= 2
        target = fields[-1] if field == 'destination' else fields[0]
        tap(target)
        time.sleep(0.7)
        # GPS can prefill the source; replace it as a user editing the field would.
        if target.get('text'):
            adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
            adb('shell', 'input', 'keyevent', *(['KEYCODE_DEL'] * len(target.get('text'))))
        adb('shell', 'input', 'text', query.replace(' ', '%s'))
        time.sleep(3)
        nodes = capture('places-' + field + '-typed')
        assert any(n.get('class') == 'android.widget.EditText' and n.get('text') == query for n in nodes), 'Digitação de origem/destino truncada.'
        status = read_places(field)
        for attempt in range(8):
            if status['phase'] not in ('searching', 'loading-place', 'typing'):
                break
            time.sleep(3)
            status = read_places(field + '-wait-' + str(attempt))
        if status['phase'] == 'error' and not status['configured']:
            evidence.update(reason='Backend Yatri/credencial não configurados no APK', fallback='explicit_error; no suggestions invented')
            # Exercise both original fields even when the environment cannot make a real query.
            if field == 'destination':
                continue
            break
        assert status['phase'] == 'results', 'Backend configurado não forneceu sugestões reais: ' + status['phase']
        suggestions = status.get('suggestions', [])
        assert suggestions, 'Nenhuma sugestão recebida do backend real.'
        nodes = capture('places-' + field + '-results')
        label = next((n for n in nodes if n.get('text') == suggestions[0]['title']), None)
        assert label is not None, 'Sugestão real não apareceu no componente original.'
        tap(label)
        time.sleep(3)
        status = read_places(field + '-selected')
        for attempt in range(8):
            if status['phase'] != 'loading-place':
                break
            time.sleep(3)
            status = read_places(field + '-selected-wait-' + str(attempt))
        assert status['phase'] == 'selected' and status.get(field), 'Seleção não recebeu detalhes reais.'
        selected = status[field]
        assert -90 <= selected['lat'] <= 90 and -180 <= selected['lng'] <= 180
        nodes = capture('places-' + field + '-map')
        assert where(nodes) is not None, 'Seleção não retornou à HomeScreen.'
        tap(where(nodes))
        time.sleep(2)
        nodes = capture('places-' + field + '-persisted')
        assert any(n.get('class') == 'android.widget.EditText' and n.get('text') == selected['address'] for n in nodes), 'Endereço selecionado se perdeu ao reabrir a busca.'
        evidence[field] = selected
    if evidence.get('source') and evidence.get('destination'):
        evidence['acceptance'] = 'passed'
    (out / 'places-acceptance.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
    if os.environ.get('YATRI_REQUIRE_PLACES') == 'true':
        assert evidence['acceptance'] == 'passed', 'Esta entrega exige pesquisa/seleção real; configuração ausente não é aceite.'
    for attempt in range(3):
        adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        time.sleep(2)
        nodes = capture('places-return-' + str(attempt))
        if where(nodes) is not None:
            break
    assert where(nodes) is not None, 'Busca bloqueou o retorno à HomeScreen.'
    return evidence

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
    places_evidence = real_places_or_explicit_block(nodes)
    print('Pesquisa real:', places_evidence['acceptance'])
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
    log=re.sub(r'\b[a-fA-F0-9]{64}\b','[REDACTED_SESSION_OR_HASH]',log)
    (out/'home-logcat.txt').write_text(log)
