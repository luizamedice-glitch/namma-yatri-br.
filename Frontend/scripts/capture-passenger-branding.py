#!/usr/bin/env python3
"""Capture the real launcher and cold start; never render or inject substitute UI."""
from pathlib import Path
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

out = Path(sys.argv[1])

def adb(*args, timeout=30):
    return subprocess.check_output(['adb', *args], timeout=timeout)

def screenshot(name):
    (out / name).write_bytes(adb('exec-out', 'screencap', '-p'))

adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
time.sleep(2)
# Use the launcher's actual accessibility control rather than screen-size guesses.
icons = []
for attempt in range(3):
    adb('shell', 'uiautomator', 'dump', '/sdcard/branding-launcher.xml')
    xml = adb('shell', 'cat', '/sdcard/branding-launcher.xml')
    (out / f'branding-launcher-{attempt}.xml').write_bytes(xml)
    screenshot(f'branding-launcher-{attempt}.png')
    nodes = list(ET.fromstring(xml).iter('node'))
    icons = [n for n in nodes if 'Alce Yatri' in (n.get('text', '') + n.get('content-desc', ''))]
    if icons:
        (out / 'branding-launcher.xml').write_bytes(xml)
        break
    app_list = next((n for n in nodes if n.get('content-desc') == 'Apps list'), None)
    if app_list is not None:
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', app_list.get('bounds')))
        adb('shell', 'input', 'swipe', str((x1+x2)//2), str((y1+y2)//2), str((x1+x2)//2), '300', '500')
    else:
        width, height = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').decode())[-1])
        adb('shell', 'input', 'swipe', str(width//2), str(height*7//10), str(width//2), str(height//5), '500')
    time.sleep(2)
screenshot('branding-launcher.png')
(out / 'branding-launcher.json').write_text(json.dumps({
    'icon_found': bool(icons),
    'label': icons[0].get('text') if icons else None,
    'bounds': icons[0].get('bounds') if icons else None,
    'evidence': 'branding-launcher.png', 'visual_review_required': True,
}, indent=2) + '\n')
adb('shell', 'am', 'force-stop', 'in.juspay.nammayatri.debug')
# Record the cold start, including frames too brief for a synchronous screenshot.
record = subprocess.Popen(['adb', 'shell', 'screenrecord', '--time-limit', '8', '/sdcard/branding-start.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.4)
launch = subprocess.Popen(['adb', 'shell', 'am', 'start', '-W', '-n', 'in.juspay.nammayatri.debug/in.juspay.mobility.MainActivity'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
for index, delay in enumerate([.2, .3, .5, 1, 2]):
    time.sleep(delay)
    screenshot(f'branding-start-{index}.png')
output, _ = launch.communicate(timeout=60)
(out / 'branding-launch.txt').write_bytes(output)
if launch.returncode:
    raise SystemExit('Falha ao abrir APK')
record.wait(timeout=20)
adb('pull', '/sdcard/branding-start.mp4', str(out / 'branding-start.mp4'))
# Native screenshots/video are the acceptance evidence, not resource presence alone.
