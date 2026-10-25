#!/usr/bin/env python3
"""Real Android location foreground service, locked-screen offer, isolated API/PG.
No CDP/debugger/timer wake-up and no HTTP GPS injection after going online.
"""
import importlib.util,json,os,re,time,subprocess,xml.etree.ElementTree as ET,hashlib
from threading import Event,Thread
from pathlib import Path
spec=importlib.util.spec_from_file_location('helpers',Path(__file__).with_name('test-passenger-foreground.py'))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
p.package='in.juspay.nammayatripartner.debug';p.out=Path('driver-background-evidence');p.out.mkdir(exist_ok=True)
report={'acceptance':'running','backend':'isolated_postgresql','push_transport':'native_service_polling_not_fcm','cases':[]}
gps_point=(-46.6333,-23.5505);gps_stop=Event()
def fix(lng,lat):
    global gps_point
    gps_point=(lng,lat);p.adb('emu','geo','fix',str(lng),str(lat))
def pulse_gps():
    # A real location provider emits fresh stationary fixes too. Drive only the
    # emulator sensor, never the API or a JS callback; native code must publish it.
    while not gps_stop.is_set():
        point=gps_point
        try:p.adb('emu','geo','fix',str(point[0]),str(point[1]))
        except subprocess.CalledProcessError:return
        gps_stop.wait(5)
def native():
    root=ET.fromstring(p.adb('shell','run-as',p.package,'cat','shared_prefs/yatri_br_tracking_diagnostic.xml'))
    allowed={'state','uploads','snapshots','notifications','errors','observedAt','stopped'}
    return {v.get('name'):v.text if v.tag=='string' else v.get('value') for v in root if v.get('name') in allowed}
def await_native(predicate,message,attempts=20):
    for _ in range(attempts):
        try:
            state=native()
            if predicate(state):return state
        except (subprocess.CalledProcessError,ET.ParseError):pass
        time.sleep(2)
    raise AssertionError(message)
def ui_button(pattern):
    for _ in range(20):
        ns=p.nodes()
        if any("Pixel Launcher isn't responding" in n.get('text','') for n in ns):
            close=next((n for n in ns if n.get('text','').casefold()=='close app'),None)
            if close is not None:p.tap(close);time.sleep(2);continue
        if any('use Location Accuracy' in n.get('text','') for n in ns):
            consent=next((n for n in ns if n.get('text','')=='Turn on'),None)
            if consent is not None:p.tap(consent);time.sleep(2);continue
        found=next((n for n in ns if re.fullmatch(pattern,n.get('text',''),re.I)),None)
        if found is not None:return found
        time.sleep(2)
    raise AssertionError('Controle do painel original ausente')
def launch():p.adb('shell','am','start','-W','-n',p.package+'/in.juspay.mobility.MainActivity')
try:
    prefs=ET.Element('map')
    for key,value in {'YATRI_DRIVER_BACKEND_URL':p.base,'YATRI_DRIVER_SESSION':p.sessions['driver']}.items():ET.SubElement(prefs,'string',name=key).text=value
    p.adb('shell','run-as',p.package,'mkdir','-p','shared_prefs')
    subprocess.run(['adb','shell','run-as',p.package,'sh','-c','"cat > shared_prefs/godel.xml"'],input=ET.tostring(prefs),capture_output=True,check=True)
    p.adb('reverse','tcp:8080','tcp:8080')
    p.adb('shell','settings','put','system','screen_off_timeout','1800000')
    p.adb('shell','settings','put','secure','location_mode','3')
    fix(-46.6333,-23.5505);Thread(target=pulse_gps,daemon=True).start()
    launch();time.sleep(12)
    button=ui_button(r'go online|ficar dispon.vel|ativar');time.sleep(5);p.tap(button)
    started=await_native(lambda s:int(s.get('uploads','0'))>=2,'Serviço nativo não enviou GPS após ativação')
    assert p.call('driver','/snapshot')['available'] is True
    pid=p.adb('shell','pidof',p.package).decode().strip()
    p.capture('online-service')
    # Service, not WebView, must stay responsible with Activity stopped + screen off.
    p.adb('shell','input','keyevent','KEYCODE_HOME');p.adb('shell','input','keyevent','KEYCODE_SLEEP')
    time.sleep(3)
    power=p.adb('shell','dumpsys','power').decode();assert re.search(r'mWakefulness=(Asleep|Dozing)',power),'Tela não foi bloqueada'
    activities=p.adb('shell','dumpsys','activity','activities').decode()
    assert not any(p.package in line for line in activities.splitlines() if 'ResumedActivity' in line),'Motorista permaneceu em primeiro plano'
    locked_uploads=int(native()['uploads'])
    fix(-46.6319,-23.5514)
    await_native(lambda s:int(s.get('uploads','0'))>=locked_uploads+3,'GPS não continuou com tela bloqueada')
    origin={'lat':-23.5514,'lng':-46.6319,'address':'Embarque público do teste em São Paulo'}
    destination={'lat':-23.5614,'lng':-46.6559,'address':'Destino público do teste na Avenida Paulista'}
    quote=p.call('passenger','/quotes',{'origin':origin,'destination':destination})
    ride=p.call('passenger','/rides',{'quoteId':quote['id']})
    notified=await_native(lambda s:int(s.get('notifications','0'))>=1,'Oferta não gerou notificação com tela bloqueada')
    time.sleep(12)
    assert int(native()['notifications'])==1,'Mesma oferta gerou alertas repetidos'
    services=p.adb('shell','dumpsys','activity','services',p.package).decode()
    assert 'BrDriverService' in services and 'isForeground=true' in services,'Serviço não está em foreground Android'
    report['cases'].append({'case':'locked_screen_gps_and_deduplicated_offer','passed':True,'native_uploads':int(native()['uploads'])-locked_uploads})
    # Tap actual notification: do not launch via adb here. UI must recover the real offer.
    p.adb('shell','input','keyevent','KEYCODE_WAKEUP');p.adb('shell','wm','dismiss-keyguard')
    p.adb('shell','cmd','statusbar','expand-notifications');time.sleep(2)
    p.capture('notification-shade')
    p.tap(ui_button(r'Nova solicitação de corrida'))
    p.wait_label('Aceitar viagem');p.capture('offer-restored')
    p.tap(p.wait_label('Aceitar viagem'));p.wait_label('Cheguei ao embarque')
    assert p.call('passenger','/rides/'+ride['id'])['status']=='accepted'
    p.adb('shell','input','keyevent','KEYCODE_HOME');p.adb('shell','input','keyevent','KEYCODE_SLEEP')
    fix(-46.6329,-23.5507)
    for _ in range(20):
        snapshot=p.call('passenger','/rides/'+ride['id'])
        if abs(snapshot.get('driver_lat',0)+23.5507)<0.0001 and abs(snapshot.get('driver_lng',0)+46.6329)<0.0001:break
        time.sleep(2)
    else:raise AssertionError('Nova posição nativa não chegou ao passageiro com tela bloqueada')
    assert p.adb('shell','pidof',p.package).decode().strip()==pid
    report['cases'].append({'case':'notification_opens_offer_and_assigned_gps_reaches_passenger','passed':True,'same_pid':True})
    # Cancel through the actual passenger actor, then explicitly go offline remotely.
    p.call('passenger','/rides/'+ride['id']+'/cancel',{})
    fix(-46.6329,-23.5507)
    p.call('driver','/driver/availability',{'available':False})
    await_native(lambda s:s.get('stopped')=='true','Serviço não parou ao ficar offline sem corrida')
    report['cases'].append({'case':'offline_without_ride_stops_gps_service','passed':True})
    report['api']=p.adb('shell','getprop','ro.build.version.sdk').decode().strip()
    report['apk_sha256']=hashlib.sha256(next(Path('driver-apk').glob('*.apk')).read_bytes()).hexdigest()
    report['apk_source_run']=os.environ.get('DRIVER_APK_SOURCE_RUN');report['acceptance']='passed'
finally:
    gps_stop.set()
    try:(p.out/'native-diagnostic.json').write_text(json.dumps(native(),indent=2))
    except Exception:pass
    (p.out/'acceptance.json').write_text(json.dumps(report,indent=2))
    try:
        p.adb('shell','input','keyevent','KEYCODE_WAKEUP');p.adb('shell','wm','dismiss-keyguard');p.capture('final')
    except Exception:pass
    log=p.adb('logcat','-d').decode(errors='replace')
    # Never upload raw logs, even on failure.
    fatal=[line for line in log.splitlines() if 'FATAL EXCEPTION' in line or 'AndroidRuntime: Caused by:' in line]
    for token in p.sessions.values():fatal=[line.replace(token,'[REDACTED]') for line in fatal]
    (p.out/'fatal-summary.json').write_text(json.dumps({'fatalCount':len(fatal),'lines':fatal}))
