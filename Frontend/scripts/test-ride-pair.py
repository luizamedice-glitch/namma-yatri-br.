#!/usr/bin/env python3
"""Two real APKs, foreground switching, Google places/routes and Lightsail PostgreSQL."""
from pathlib import Path
import json,os,re,subprocess,time,unicodedata,urllib.request,xml.etree.ElementTree as ET

out=Path('ride-pair-evidence');out.mkdir(exist_ok=True)
base='https://52-67-246-31.sslip.io'
packages={'passenger':'in.juspay.nammayatri.debug','driver':'in.juspay.nammayatripartner.debug'}
sessions={};ride_id=None;driver_touched=False
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
    # Only pre-assignment/public-place screens are captured; no real plate/code.
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
def wait_driver_panel():
    for _ in range(12):
        ns=nodes()
        if label(ns,'Disponível') is not None and label(ns,'Início') is not None and all(label(ns,text) is None for text in ['Voltar ao painel','Viagem concluída','Viagem cancelada','Nova solicitação']):return
        time.sleep(2)
    raise AssertionError('O motorista não retornou ao painel')
def start(role):
    adb('shell','am','start','-W','-n',packages[role]+'/in.juspay.mobility.MainActivity')
    time.sleep(2)
def call(role,path,body=None):
    request=urllib.request.Request(base+'/v1'+path,data=json.dumps(body).encode() if body is not None else None,
      headers={'Content-Type':'application/json','Authorization':'Bearer '+sessions[role]})
    with urllib.request.urlopen(request,timeout=20) as r:return json.load(r)
def pair(role):
    start(role)
    connect=wait_label('Conectar ao servidor')
    ns=nodes();field=next(n for n in ns if n.get('class')=='android.widget.EditText')
    capture(role+'-ativacao-vazia');tap(field)
    activation=json.loads(Path(os.environ['RIDE_'+role.upper()+'_ACTIVATION']).read_text())
    try:
        result=subprocess.run(['adb','shell','input','text',activation['code']],capture_output=True,timeout=30)
    except subprocess.TimeoutExpired:
        # TimeoutExpired normally includes argv, which contains the private code.
        raise AssertionError('Tempo esgotado ao inserir a ativação privada') from None
    assert result.returncode==0,'Falha ao inserir codigo privado'
    tap(connect)
    for _ in range(15):
        time.sleep(2)
        root=ET.fromstring(adb('shell','run-as',packages[role],'cat','shared_prefs/godel.xml'))
        values={n.get('name'):n.text for n in root if n.tag=='string'}
        prefix='YATRI_'+role.upper()
        if re.fullmatch('[a-f0-9]{64}',values.get(prefix+'_SESSION','')):
            assert values[prefix+'_BACKEND_URL']==base
            sessions[role]=values[prefix+'_SESSION'];return
    raise AssertionError('A interface nao provisionou a sessao de '+role)
def where(ns):return next((n for n in ns if n.get('content-desc') in {'Where To : Button','Where are you going? : Button','Para onde?: botão','Para onde você vai?: botão'}),None)
def home():
    for _ in range(15):
        ns=nodes()
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

def map_state(role):
    # Read only this debug diagnostic; never collect page HTML, tokens or requests.
    import websocket
    pid=adb('shell','pidof',packages[role]).decode().strip().split()[0]
    adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid)
    with urllib.request.urlopen('http://127.0.0.1:9222/json',timeout=8) as response:targets=json.load(response)
    for target in targets:
        if not target.get('webSocketDebuggerUrl'):continue
        ws=websocket.create_connection(target['webSocketDebuggerUrl'],timeout=5,suppress_origin=True)
        try:
            contexts=[];counter=0
            def command(method,params=None):
                nonlocal counter
                counter+=1;request_id=counter
                ws.send(json.dumps({'id':request_id,'method':method,'params':params or {}}))
                while True:
                    message=json.loads(ws.recv())
                    if message.get('method')=='Runtime.executionContextCreated':contexts.append(message['params']['context']['id'])
                    if message.get('id')==request_id:return message
            command('Runtime.enable')
            for context in contexts:
                result=command('Runtime.evaluate',{'expression':"JSON.stringify(window.__YATRI_TRIP_MAP__?Object.assign({},window.__YATRI_TRIP_MAP__,{nativeMarkerPresent:window.JBridge.checkMarkerAvailable?window.JBridge.checkMarkerAvailable(JSON.stringify({markerId:'br-live-driver'})):null}):null)",'contextId':context,'returnByValue':True})
                raw=result.get('result',{}).get('result',{}).get('value')
                if raw:
                    value=json.loads(raw)
                    if value:return value
        finally:ws.close()
    return {}

def check_map(role,name,expected_lat=None):
    from PIL import Image
    from io import BytesIO
    for _ in range(12):
        state=map_state(role)
        (out/(name+'-mapa.json')).write_text(json.dumps({key:state.get(key) for key in ['ready','routePoints','gpsFresh','nativeMarkerPresent','phase','error']}))
        if state.get('ready') and state.get('routePoints',0)>2 and (expected_lat is None or state.get('gpsFresh') and abs(state.get('driverLat',0)-expected_lat)<0.0001 and state.get('nativeMarkerPresent') is True):break
        time.sleep(2)
    else:raise AssertionError('Mapa/rota/GPS não confirmados: '+role)
    # Save only the upper map area, excluding the private vehicle card entirely.
    for _ in range(6):
        image=Image.open(BytesIO(adb('exec-out','screencap','-p'))).convert('RGB')
        ns=nodes()
        headings=['Estimativa da viagem','Procurando motorista','Motorista a caminho','Motorista no embarque','Viagem em andamento','Nova solicitação','Viagem aceita','No local de embarque']
        headers=[n for n in ns if n.get('text') in headings or role=='driver' and n.get('text')=='Fagner']
        top=max(int(re.findall(r'\d+',n.get('bounds'))[-1]) for n in headers)
        addresses=[n for n in ns if normalized(n.get('text','')).startswith('praca da se')]
        assert addresses,'Endereço público de origem ausente para delimitar mapa'
        bottom=min(int(re.findall(r'\d+',n.get('bounds'))[1]) for n in addresses)
        assert bottom>top+100,'Área do mapa não foi alocada'
        safe=image.crop((0,top,image.width,bottom))
        purple=sum(1 for r,g,b in safe.getdata() if abs(r-116)<6 and abs(g-52)<6 and abs(b-84)<6)
        if purple>30:break
        time.sleep(1)
    safe.save(out/(name+'-mapa.png'))
    assert purple>30,'Traçado da rota não apareceu no mapa nativo de '+role
    return state


try:
    adb('shell','settings','put','secure','location_mode','3')
    adb('emu','geo','fix','-46.63','-23.55')
    pair('passenger');assert not call('passenger','/snapshot')['rides'],'Há uma viagem ativa; aceite não deve interferir nela';home()
    select_place('Avenida Paulista Sao Paulo','paulista',False)
    select_place('Praca da Se Sao Paulo','praca da se',True)
    tap(wait_label('Ver estimativa'));wait_label('Solicitar viagem')
    capture('passageiro-estimativa');check_map('passenger','passageiro-estimativa')
    pair('driver')
    assert not call('driver','/snapshot')['rides'],'Há uma viagem ativa do motorista'
    driver_touched=True
    call('driver','/driver/availability',{'available':False})
    tap(wait_label('Ativar'))
    for _ in range(12):
        if call('driver','/snapshot')['available']:break
        time.sleep(2)
    else:raise AssertionError('Disponibilidade nao confirmada no servidor real')
    capture('motorista-disponivel')
    start('passenger');tap(wait_label('Solicitar viagem'))
    for _ in range(10):
        state=call('passenger','/snapshot')
        if state['rides']:break
        time.sleep(2)
    else:raise AssertionError('Pedido da interface nao foi persistido')
    ride=state['rides'][0];ride_id=ride['id']
    assert ride['status']=='searching' and ride['route']['distanceMeters']>0
    assert ride['route']['encodedPolyline']!='fixture-only' and ride['fare_cents']>0
    wait_label('Procurando motorista');capture('passageiro-procurando')
    start('driver');wait_label('Nova solicitação')
    offer=call('driver','/snapshot')['offers'][0]
    assert offer['id']==ride_id,'A oferta nao corresponde ao pedido do passageiro'
    capture('motorista-oferta');check_map('driver','motorista-oferta')
    tap(wait_label('Aceitar viagem'))
    for _ in range(12):
        assigned=call('passenger','/rides/'+ride_id)
        if assigned['status']=='accepted':break
        time.sleep(2)
    else:raise AssertionError('Aceite nao chegou ao banco')
    assert assigned['driver_name']=='Giselo' and assigned['model'] and assigned['plate']
    start('passenger');wait_label('Motorista a caminho')
    ns=nodes()
    assert label(ns,'Giselo') is not None,'Passageiro nao recebeu motorista atribuido'
    # Never save screenshots/XML with the real vehicle identifiers.
    assert any(assigned['plate'] in n.get('text','') for n in ns),'Veiculo real nao apareceu para passageiro'
    tap(wait_label('Cancelar viagem'));wait_label('Viagem cancelada')
    assert call('passenger','/rides/'+ride_id)['status']=='cancelled'
    tap(wait_label('Voltar ao início'));home();capture('passageiro-home-final')
    start('driver');wait_label('Viagem cancelada');tap(wait_label('Voltar ao painel'));wait_driver_panel()
    # A second real request exercises the full trip, preserving cancellation regression.
    start('passenger');home();tap(wait_label('Ver estimativa'));wait_label('Solicitar viagem')
    tap(wait_label('Solicitar viagem'));wait_label('Procurando motorista')
    active=call('passenger','/snapshot')['rides'];assert len(active)==1
    ride_id=active[0]['id'];assert active[0]['status']=='searching'
    start('driver');wait_label('Nova solicitação');tap(wait_label('Aceitar viagem'))
    wait_label('Cheguei ao embarque');assert call('driver','/rides/'+ride_id)['status']=='accepted'
    check_map('driver','motorista-embarque')
    # Simulated Android GPS movement enters through the real driver app/HTTP/DB.
    for lat,lng in [(-23.551,-46.631),(-23.552,-46.632)]:
        adb('emu','geo','fix',str(lng),str(lat))
        for _ in range(15):
            location=call('passenger','/rides/'+ride_id)
            if abs((location.get('driver_lat') or 0)-lat)<0.0001:break
            time.sleep(2)
        else:raise AssertionError('GPS do Android não chegou ao servidor')
        start('passenger');wait_label('Motorista a caminho')
        check_map('passenger','passageiro-acompanhamento-'+str(abs(lat)),lat)
        start('driver');wait_label('Cheguei ao embarque')
    tap(wait_label('Cheguei ao embarque'));wait_label('No local de embarque')
    assert call('driver','/rides/'+ride_id)['status']=='arrived'
    start('passenger');wait_label('Motorista no embarque')
    assert call('passenger','/rides/'+ride_id)['status']=='arrived'
    start('driver');tap(wait_label('Iniciar viagem'));wait_label('Viagem em andamento')
    assert call('driver','/rides/'+ride_id)['status']=='in_progress'
    assert label(nodes(),'Cancelar viagem') is None,'Não deve oferecer cancelamento de uma viagem iniciada'
    start('passenger');wait_label('Viagem em andamento')
    assert call('passenger','/rides/'+ride_id)['status']=='in_progress'
    check_map('passenger','passageiro-viagem')
    assert label(nodes(),'Cancelar viagem') is None
    # Recreate each process: backend state and private ride IDs must restore the UI.
    adb('shell','am','force-stop',packages['driver']);start('driver');wait_label('Viagem em andamento')
    tap(wait_label('Concluir viagem'));wait_label('Viagem concluída')
    assert call('driver','/rides/'+ride_id)['status']=='completed'
    start('passenger');wait_label('Viagem concluída')
    assert call('passenger','/rides/'+ride_id)['status']=='completed'
    adb('shell','am','force-stop',packages['driver']);start('driver');wait_label('Viagem concluída')
    tap(wait_label('Voltar ao painel'))
    wait_driver_panel()
    capture('motorista-painel-final')
    adb('shell','am','force-stop',packages['passenger']);start('passenger');home()
    tap(wait_label('Acompanhar viagem'));wait_label('Viagem concluída');tap(wait_label('Voltar ao início'));home()
    capture('passageiro-home-concluida')
    assert not call('passenger','/snapshot')['rides'] and not call('driver','/snapshot')['rides']
    call('driver','/driver/availability',{'available':False})
    result={'acceptance':'passed','backend':'lightsail_https','two_original_apks':True,'foreground_switching':True,
      'native_pairing_both_roles':True,'google_places_and_routes_real':True,'request_persisted':True,
      'offer_same_ride':True,'driver_accept_persisted':True,'passenger_received_driver_and_vehicle':True,
      'ride_id':ride_id,'initial_cancel_scenario_passed':True,'arrive_persisted':True,'start_persisted':True,
      'complete_persisted':True,'both_apps_display_all_trip_states':True,'process_recreation_restores_trip':True,
      'driver_returns_to_dashboard':True,'native_route_drawn_both_apps':True,
      'pickup_route_google_real':True,'android_gps_movement_received_by_passenger':True,
      'gps_source':'emulator_location_provider','native_passenger_vehicle_marker_exists':True,
      'driver_offline_after_test':True}
    (out/'acceptance.json').write_text(json.dumps(result,indent=2))
finally:
    if ride_id and 'passenger' in sessions:
        try:
            current=call('passenger','/rides/'+ride_id)
            if current['status'] in ['searching','accepted','arrived']:call('passenger','/rides/'+ride_id+'/cancel',{})
            elif current['status']=='in_progress' and 'driver' in sessions:call('driver','/rides/'+ride_id+'/complete',{})
            elif current['status']=='in_progress' and 'driver' in sessions:call('driver','/rides/'+ride_id+'/complete',{})
        except Exception:pass
    if driver_touched and 'driver' in sessions:
        try:call('driver','/driver/availability',{'available':False})
        except Exception:pass
    # Native transports may encode whole responses; regex redaction cannot prove
    # raw logcat contains no credentials/vehicle data. Publish only counters.
    raw=adb('logcat','-d').decode(errors='replace')
    diagnostics={'fatal_exception_count':raw.count('FATAL EXCEPTION'),
      'driver_anr_count':raw.count('ANR in '+packages['driver']),
      'passenger_anr_count':raw.count('ANR in '+packages['passenger']),
      'raw_logcat_published':False}
    (out/'android-diagnostics.json').write_text(json.dumps(diagnostics,indent=2))
