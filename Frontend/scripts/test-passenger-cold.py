#!/usr/bin/env python3
"""Real Android/API/PG: first-start controls, warm resume, and process-cold restore."""
import importlib.util,json,os,time,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
spec=importlib.util.spec_from_file_location('passenger',Path(__file__).with_name('test-passenger-foreground.py'))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
report={'acceptance':'running','cases':[],'backend':'isolated_postgresql','driver_actor':'real_authenticated_http'}
def launch(expect_home=True):
    p.adb('shell','am','start','-W','-n',p.package+'/in.juspay.mobility.MainActivity')
    if expect_home:p.home()
def pid():return p.adb('shell','pidof',p.package).decode().strip()
def search_new(select=False):
    if select:
        p.select_place('Avenida Paulista Sao Paulo','paulista',False)
        p.select_place('Praca da Se Sao Paulo','praca da se',True)
    p.tap(p.wait_label('Ver estimativa'));p.wait_label('Solicitar viagem')
    p.tap(p.wait_label('Solicitar viagem'));p.wait_label('Procurando motorista')
    ride=p.call('passenger','/snapshot')['rides'][0]
    assert ride['status']=='searching'
    return ride
try:
    values={'YATRI_PASSENGER_BACKEND_URL':p.base,'YATRI_PASSENGER_SESSION':p.sessions['passenger']}
    root=ET.Element('map')
    for key,value in values.items():ET.SubElement(root,'string',name=key).text=value
    p.adb('shell','run-as',p.package,'mkdir','-p','shared_prefs')
    subprocess.run(['adb','shell','run-as',p.package,'sh','-c','"cat > shared_prefs/godel.xml"'],input=ET.tostring(root),check=True,capture_output=True,timeout=30)
    p.adb('reverse','tcp:8080','tcp:8080')
    p.adb('shell','settings','put','system','screen_off_timeout','1800000')
    p.adb('shell','svc','power','stayon','true')
    p.adb('shell','settings','put','secure','location_mode','3')
    p.adb('emu','geo','fix','-46.6333','-23.5505')
    launch();first_pid=pid();ride=search_new(True)
    p.capture('cold-first-search')
    # Pure local navigation must work before any driver response or Activity resume.
    p.tap(p.wait_label('Voltar ao início'));p.home();p.same_foreground(first_pid)
    p.tap(p.wait_label('Acompanhar viagem'));p.wait_label('Procurando motorista')
    p.tap(p.wait_label('Cancelar viagem'));p.wait_label('Viagem cancelada')
    assert p.call('passenger','/rides/'+ride['id'])['status']=='cancelled'
    p.tap(p.wait_label('Voltar ao início'));p.home()
    report['cases'].append({'case':'first_cold_controls','passed':True,'same_pid':True})
    ride=search_new()
    p.adb('shell','input','keyevent','KEYCODE_BACK');p.home()
    p.tap(p.wait_label('Acompanhar viagem'));p.wait_label('Procurando motorista')
    # Warm resume keeps the process and active ride, matching the reported recovery.
    p.adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(12);launch(False)
    assert pid()==first_pid
    if p.label(p.nodes(),'Procurando motorista') is None:
        p.tap(p.wait_label('Acompanhar viagem'));p.wait_label('Procurando motorista')
    report['cases'].append({'case':'warm_resume','passed':True,'same_pid':True})
    # Force-stop models a process reclaimed after a longer period closed.
    p.adb('shell','am','force-stop',p.package);time.sleep(5);launch()
    cold_pid=pid();assert cold_pid!=first_pid
    p.tap(p.wait_label('Acompanhar viagem'));p.wait_label('Procurando motorista')
    p.tap(p.wait_label('Voltar ao início'));p.home()
    p.tap(p.wait_label('Acompanhar viagem'));p.wait_label('Procurando motorista')
    p.adb('shell','input','keyevent','KEYCODE_BACK');p.home()
    p.tap(p.wait_label('Acompanhar viagem'));p.wait_label('Procurando motorista')
    point={'lat':ride['origin']['lat']-0.001,'lng':ride['origin']['lng']+0.001}
    p.call('driver','/driver/location',point);p.call('driver','/driver/availability',{'available':True})
    for action,phase,heading in [('accept','accepted','Motorista a caminho'),('arrive','arrived','Motorista no embarque'),('start','in_progress','Viagem em andamento'),('complete','completed','Viagem concluída')]:
        p.call('driver','/driver/location',point);p.call('driver','/rides/'+ride['id']+'/'+action,{})
        p.wait_label(heading);assert p.call('passenger','/rides/'+ride['id'])['status']==phase
        p.same_foreground(cold_pid);p.capture('cold-restored-'+phase)
    report['cases'].append({'case':'cold_process_restore_controls_and_all_states','passed':True,'restarts_during_states':0})
    p.tap(p.wait_label('Voltar ao início'));p.home()
    report['acceptance']='passed'
finally:
    (p.out/'cold-acceptance.json').write_text(json.dumps(report,indent=2))
    try:p.safe_webview()
    except Exception:pass
    try:p.capture('cold-final')
    except Exception:pass
