#!/usr/bin/env python3
"""Launcher and startup smoke check only; does not claim a new ride acceptance."""
from pathlib import Path
import json, re, subprocess, time, xml.etree.ElementTree as ET
out=Path('driver-icon-evidence');out.mkdir(exist_ok=True)
package='in.juspay.nammayatripartner.debug'
def adb(*args): return subprocess.check_output(['adb',*args],timeout=45)
def screenshot(name): (out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
def nodes():
    adb('shell','uiautomator','dump','/sdcard/driver-icon-ui.xml')
    data=adb('shell','cat','/sdcard/driver-icon-ui.xml')
    return list(ET.fromstring(data).iter('node'))
size=adb('shell','wm','size').decode()
w,h=map(int,re.findall(r'(\d+)x(\d+)',size)[-1])
adb('shell','input','keyevent','KEYCODE_HOME');time.sleep(3)
adb('shell','input','swipe',str(w//2),str(h*9//10),str(w//2),str(h//5),'500');time.sleep(3)
items=nodes()
icon=next((n for n in items if 'Alce' in (n.get('text','')+' '+n.get('content-desc',''))),None)
assert icon is not None,'Driver icon not found in launcher drawer'
screenshot('launcher-driver')
x1,y1,x2,y2=map(int,re.findall(r'\d+',icon.get('bounds','')))
adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(20)
screenshot('driver-opening')
activities=adb('shell','dumpsys','activity','activities').decode(errors='replace')
resumed=[line for line in activities.splitlines() if 'ResumedActivity' in line]
assert any(package in line for line in resumed),'Driver did not open from its launcher icon'
crash=adb('logcat','-d','-s','AndroidRuntime:E').decode(errors='replace')
assert not ('FATAL EXCEPTION' in crash and package in crash),'Driver crashed on startup'
(out/'acceptance.json').write_text(json.dumps({'launcher_icon_present':True,'launch_from_icon':True,
    'startup_no_fatal_exception':True,'scope':'icon and startup only; no new ride-flow test'},indent=2))

adb('shell','am','force-stop',package)
