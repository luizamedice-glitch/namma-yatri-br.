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
# Pixel 2 / Launcher3: open the actual installed-app drawer.
adb('shell', 'input', 'swipe', '540', '1650', '540', '350', '500')
time.sleep(2)
adb('shell', 'uiautomator', 'dump', '/sdcard/branding-launcher.xml')
xml = adb('shell', 'cat', '/sdcard/branding-launcher.xml')
(out / 'branding-launcher.xml').write_bytes(xml)
nodes = list(ET.fromstring(xml).iter('node'))
icons = [n for n in nodes if 'Alce Yatri' in (n.get('text', '') + n.get('content-desc', ''))]
if not icons:
    raise SystemExit('Icone Alce Yatri nao encontrado no launcher real')
screenshot('branding-launcher.png')
(out / 'branding-launcher.json').write_text(json.dumps({
    'label': icons[0].get('text'), 'bounds': icons[0].get('bounds'),
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
