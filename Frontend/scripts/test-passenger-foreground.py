#!/usr/bin/env python3
"""Passenger stays foreground: real Android -> HTTP -> PostgreSQL, driver via HTTP.
Test accounts/vehicle exist only in an isolated disposable database, no simulated rides.
"""
from pathlib import Path
import hashlib
import json,os,re,signal,subprocess,time,unicodedata,urllib.request,xml.etree.ElementTree as ET
out=Path('passenger-foreground-evidence');out.mkdir(exist_ok=True)
base='http://127.0.0.1:8080'
package='in.juspay.nammayatri.debug'
sessions=json.loads(Path(os.environ['PASSENGER_FOREGROUND_SESSIONS']).read_text())
def adb(*args):return subprocess.check_output(['adb',*args],timeout=40)
def nodes():
    for attempt in range(3):
        try:
            adb('shell','rm','-f','/sdcard/ride-ui.xml')
            adb('shell','uiautomator','dump','/sdcard/ride-ui.xml')
            return list(ET.fromstring(adb('shell','cat','/sdcard/ride-ui.xml')).iter('node'))
        except Exception:
            if attempt==2:raise
            time.sleep(2)
def capture(name):
    # Screens contain only isolated CI accounts/vehicle fixtures and public places.
    ns=nodes();(out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
    return ns
def tap(node):
    x,y,xx,yy=map(int,re.findall(r'\d+',node.get('bounds','')))
    adb('shell','input','tap',str((x+xx)//2),str((y+yy)//2))
def label(ns,text):return next((n for n in ns if n.get('text','').casefold()==text.casefold()),None)
def wait_label(text,attempts=12):
    for _ in range(attempts):
        found=label(nodes(),text)
        if found is not None:return found
        time.sleep(2)
    raise AssertionError('Controle ausente: '+text)
def call(role,path,body=None):
    request=urllib.request.Request(base+'/v1'+path,data=json.dumps(body).encode() if body is not None else None,
      headers={'Content-Type':'application/json','Authorization':'Bearer '+sessions[role]})
    with urllib.request.urlopen(request,timeout=20) as r:return json.load(r)
def cut_transport():
    # Await the server's acknowledgement before starting another HTTP actor.
    # Otherwise SIGUSR2 may destroy the driver's newly opened socket too.
    path=Path(os.environ['PASSENGER_FOREGROUND_SESSIONS']+'.faults')
    previous=json.loads(path.read_text()).get('cuts',0) if path.exists() else 0
    adb('reverse','--remove','tcp:8080')
    os.kill(int(os.environ['PASSENGER_TEST_API_PID']),signal.SIGUSR2)
    for _ in range(40):
        try:
            if path.exists() and json.loads(path.read_text()).get('cuts',0)>previous:return
        except json.JSONDecodeError:pass
        time.sleep(0.1)
    raise AssertionError('Servidor não confirmou corte das conexões')
def where(ns):return next((n for n in ns if n.get('content-desc') in {'Where To : Button','Where are you going? : Button','Para onde?: botão','Para onde você vai?: botão'}),None)
def home():
    for _ in range(15):
        ns=nodes()
        if any("Pixel Launcher isn't responding" in n.get('text','') for n in ns):
            close=label(ns,'Close app')
            assert close is not None,'Dialogo do launcher sem controle para fechar'
            tap(close);time.sleep(2);continue
        if any('use Location Accuracy' in n.get('text','') for n in ns):
            turn_on=label(ns,'Turn on')
            assert turn_on is not None,'Dialogo de localizacao sem controle'
            tap(turn_on);time.sleep(2);continue
        permission=next((n for n in ns if 'permissioncontroller' in n.get('package','') and n.get('resource-id','').endswith((':id/permission_allow_foreground_only_button',':id/permission_allow_button'))),None)
        if permission is not None:
            tap(permission);time.sleep(1);continue
        if where(ns) is not None:return ns
        time.sleep(2)
    raise AssertionError('Home original do passageiro ausente')
def normalized(text):return ''.join(c for c in unicodedata.normalize('NFD',text).casefold() if not unicodedata.combining(c))
def select_place(query,match,source):
    tap(where(home()));time.sleep(1)
    fields=[n for n in nodes() if n.get('class')=='android.widget.EditText']
    assert len(fields)>=2,'Campos originais de enderecos ausentes'
    field=fields[0] if source else fields[-1];tap(field)
    if field.get('text'):
        adb('shell','input','keyevent','KEYCODE_MOVE_END')
        adb('shell','input','keyevent',*(['KEYCODE_DEL']*len(field.get('text'))))
    adb('shell','input','text',query.replace(' ','%s'))
    found=None
    for _ in range(10):
        time.sleep(2)
        found=next((n for n in nodes() if n.get('class')=='android.widget.TextView' and match in normalized(n.get('text',''))),None)
        if found is not None:break
    assert found is not None,'Google Places nao apresentou endereco real'
    tap(found);home()

def safe_webview():
    # Read-only CDP. Never collect console, requests, tokens or private preferences.
    import websocket
    pid=adb('shell','pidof',package).decode().strip().split()[0]
    adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
    with urllib.request.urlopen('http://127.0.0.1:9222/json',timeout=8) as r:targets=json.load(r)
    states=[]
    for target_index,target in enumerate(targets):
        if not target.get('webSocketDebuggerUrl'):continue
        stage='connect';ws=None
        try:
            ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=3,suppress_origin=True)
            contexts=[]
            def evaluate(method,params=None):
                evaluate.counter+=1;request_id=evaluate.counter
                ws.send(json.dumps({'id':request_id,'method':method,'params':params or {}}))
                deadline=time.monotonic()+15
                while time.monotonic()<deadline:
                    msg=json.loads(ws.recv())
                    if msg.get('method')=='Runtime.executionContextCreated':contexts.append(msg['params']['context']['id'])
                    if msg.get('id')==request_id:return msg
                raise TimeoutError('CDP read deadline')
            evaluate.counter=0
            stage='enable';evaluate('Runtime.enable')
            for context in list(contexts):
                stage='evaluate'
                result=evaluate('Runtime.evaluate',{'expression':"JSON.stringify({geocoding:window.__YATRI_GEOCODING__||null,phase:window.__YATRI_PASSENGER_RIDE__&&window.__YATRI_PASSENGER_RIDE__.phase,diagnostics:window.__YATRI_PASSENGER_POLL__||null,callbacks:window.__YATRI_PASSENGER_CALLBACKS__||null,backEnabled:window.enableBackpress===true,nativeClock:window.JBridge.getYatriPassengerClockDiagnostics?JSON.parse(window.JBridge.getYatriPassengerClockDiagnostics()):null,hidden:document.hidden,visibility:document.visibilityState})",'contextId':context,'returnByValue':True})
                value=result.get('result',{}).get('result',{}).get('value')
                if value:states.append(json.loads(value))
        except Exception as e:states.append({'target':target_index,'stage':stage,'error':type(e).__name__})
        finally:
            if ws:ws.close()
    (out/'webview-phases.json').write_text(json.dumps(states))
    return states

def same_foreground(pid):
    assert adb('shell','pidof',package).decode().strip()==pid,'Processo passageiro foi recriado'
    activities=adb('shell','dumpsys','activity','activities').decode()
    assert any(package in line for line in activities.splitlines() if 'ResumedActivity' in line),'Passageiro saiu do primeiro plano'

def main():
    try:
        # Private provisioning in disposable emulator before first launch; not embedded in APK.
        values={'YATRI_PASSENGER_BACKEND_URL':base,'YATRI_PASSENGER_SESSION':sessions['passenger']}
        root=ET.Element('map')
        for key,value in values.items():ET.SubElement(root,'string',name=key).text=value
        adb('shell','run-as',package,'mkdir','-p','shared_prefs')
        subprocess.run(['adb','shell','run-as',package,'sh','-c','"cat > shared_prefs/godel.xml"'],input=ET.tostring(root),check=True,capture_output=True,timeout=30)
        adb('reverse','tcp:8080','tcp:8080')
        adb('shell','settings','put','system','screen_off_timeout','1800000')
        adb('shell','svc','power','stayon','true')
        adb('shell','settings','put','secure','location_mode','3')
        adb('emu','geo','fix','-46.6333','-23.5505')
        adb('shell','am','start','-W','-n',package+'/in.juspay.mobility.MainActivity')
        home()
        (out/'device.json').write_text(json.dumps({'api':adb('shell','getprop','ro.build.version.sdk').decode().strip(),'model':adb('shell','getprop','ro.product.model').decode().strip()}))
        if os.environ.get('PASSENGER_EXPECT_GEOCODING')=='true':
            time.sleep(4)
            states=safe_webview()
            assert any((s.get('geocoding') or {}).get('successes',0)>0 for s in states),'Geocoder Android não retornou endereço real'
            tap(where(home()));time.sleep(1)
            fields=[n for n in nodes() if n.get('class')=='android.widget.EditText']
            assert fields and len(fields[0].get('text','').strip())>=5
            assert fields[0].get('text','')!='Localização atual' and not re.fullmatch(r'[-\d., ]+',fields[0].get('text',''))
            capture('gps-endereco-real')
            adb('shell','input','keyevent','KEYCODE_BACK');home()
        select_place('Avenida Paulista Sao Paulo','paulista',False)
        select_place('Praca da Se Sao Paulo','praca da se',True)
        tap(wait_label('Ver estimativa'));wait_label('Solicitar viagem')
        quote_pid=adb('shell','pidof',package).decode().strip()
        faults_path=Path(os.environ['PASSENGER_FOREGROUND_SESSIONS']+'.faults')
        if os.environ.get('PASSENGER_RECONNECT')=='true':
            cut_transport()
            wait_label('Sem atualização — verificando conexão')
            capture('cotacao-sem-conexao');same_foreground(quote_pid)
            adb('reverse','tcp:8080','tcp:8080')
            for _ in range(12):
                if label(nodes(),'Sem atualização — verificando conexão') is None:break
                time.sleep(2)
            else:raise AssertionError('Cotação não recuperou conexão')
            wait_label('Solicitar viagem');same_foreground(quote_pid)
            os.kill(int(os.environ['PASSENGER_TEST_API_PID']),signal.SIGWINCH)
            for _ in range(20):
                if faults_path.exists() and json.loads(faults_path.read_text())['armed']:break
                time.sleep(0.1)
            else:raise AssertionError('Falha de resposta não armada')
        tap(wait_label('Solicitar viagem'));wait_label('Procurando motorista')
        if os.environ.get('PASSENGER_RECONNECT')=='true':
            faults=json.loads(faults_path.read_text())
            assert faults['droppedResponses']==1 and faults['requests']==1,'Solicitação não recuperada após perder resposta real: '+json.dumps(faults)
            same_foreground(quote_pid);capture('solicitacao-recuperada')
        pid=adb('shell','pidof',package).decode().strip()
        ride=call('passenger','/snapshot')['rides'][0];ride_id=ride['id']
        assert ride['route']['distanceMeters']>0 and ride['route']['encodedPolyline']!='fixture-only'
        capture('procurando')
        # A genuine second authenticated actor changes this database while the UI remains open.
        driver_point={'lat':ride['origin']['lat']-0.001,'lng':ride['origin']['lng']+0.001}
        call('driver','/driver/location',driver_point)
        call('driver','/driver/availability',{'available':True})
        assert any(r['id']==ride_id for r in call('driver','/snapshot')['offers'])
        timings={}
        idle=int(os.environ.get('PASSENGER_IDLE_SECONDS','0'))
        assert 0<=idle<=360
        for action,phase,heading in [('accept','accepted','Motorista a caminho'),('arrive','arrived','Motorista no embarque'),('start','in_progress','Viagem em andamento'),('complete','completed','Viagem concluída')]:
            if action=='arrive':
                for elapsed in range(0,idle,30):
                    time.sleep(min(30,idle-elapsed));same_foreground(pid)
                    call('driver','/driver/location',driver_point)
                    print('Passageiro mantido em primeiro plano:',min(elapsed+30,idle),'s',flush=True)
            same_foreground(pid);started=time.monotonic()
            call('driver','/driver/location',driver_point)
            reconnect=action=='arrive' and os.environ.get('PASSENGER_RECONNECT')=='true'
            if reconnect:
                cut_transport()
            call('driver','/rides/'+ride_id+'/'+action,{})
            if reconnect:
                time.sleep(12)
                wait_label('Sem atualização — verificando conexão',attempts=4)
                wait_label('Motorista a caminho',attempts=2)
                same_foreground(pid);capture('conexao-interrompida')
                adb('reverse','tcp:8080','tcp:8080')
            assert call('passenger','/rides/'+ride_id)['status']==phase
            wait_label(heading,attempts=7)
            if reconnect:
                assert label(nodes(),'Sem atualização — verificando conexão') is None,'Aviso de conexão permaneceu após recuperar o estado'
            timings[phase]=round(time.monotonic()-started,2)
            same_foreground(pid);capture(phase)
        if os.environ.get('PASSENGER_EXPECT_NATIVE_CLOCK')=='true':
            states=safe_webview()
            assert any(s.get('diagnostics') and s['diagnostics'].get('clock')=='native' and s['diagnostics'].get('nativeTicks',0)>=4 for s in states),'Callbacks nativos nao chegaram ao frontend'
            if os.environ.get('PASSENGER_RECONNECT')=='true':
                assert any(s.get('diagnostics',{}).get('errors',0)>0 for s in states if s.get('diagnostics')),'Corte de rede nao foi observado pelo cliente'
        tap(wait_label('Voltar ao início'));home()
        result={'acceptance':'passed','isolated_database':True,'driver_actions_real_http':True,'google_routes_real':True,
          'passenger_remains_foreground':True,'same_pid':True,'restarts_during_trip':0,'native_clock_required':os.environ.get('PASSENGER_EXPECT_NATIVE_CLOCK')=='true','idle_seconds':idle,'network_recovery':os.environ.get('PASSENGER_RECONNECT')=='true','quote_recovery':os.environ.get('PASSENGER_RECONNECT')=='true','gps_reverse_geocoding_real':os.environ.get('PASSENGER_EXPECT_GEOCODING')=='true','committed_request_response_loss_recovered':os.environ.get('PASSENGER_RECONNECT')=='true','network_fault':'tunnel_removed_and_existing_sockets_closed' if os.environ.get('PASSENGER_RECONNECT')=='true' else None,'state_latency_seconds':timings,'apk_source_run':os.environ.get('PASSENGER_APK_SOURCE_RUN'),'apk_sha256':hashlib.sha256(next(Path('passenger-apk').glob('*.apk')).read_bytes()).hexdigest()}
        (out/'acceptance.json').write_text(json.dumps(result,indent=2))
    finally:
        try:
            faults=Path(os.environ['PASSENGER_FOREGROUND_SESSIONS']+'.faults')
            if faults.exists():(out/'transport-faults.json').write_text(faults.read_text())
        except Exception:pass
        try:safe_webview()
        except Exception as e:(out/'cdp-error.txt').write_text(type(e).__name__)
        try:capture('final')
        except Exception:pass

if __name__=="__main__":main()
