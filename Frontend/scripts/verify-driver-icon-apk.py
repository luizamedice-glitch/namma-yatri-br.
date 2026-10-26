#!/usr/bin/env python3
"""Check packaged launcher pixels and preservation of the approved APK's assets."""
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
import hashlib, io, json
built=list(Path('Frontend/android-native/app/build/outputs/apk/nyDriverProd/debug').glob('*.apk'))
old=list(Path('bundle-source-apk').glob('*.apk'))
assert len(built)==len(old)==1
with ZipFile(built[0]) as new, ZipFile(old[0]) as baseline:
    assets=[name for name in baseline.namelist() if name.startswith('assets/') and not name.endswith('/')]
    for name in assets:
        assert new.read(name)==baseline.read(name),name
    count=0
    expected=Path('Frontend/android-native/app/src/brTest/driver/res')
    for png in expected.glob('mipmap-*/*.png'):
        matches=[n for n in new.namelist() if n.startswith('res/'+png.parent.name) and n.endswith('/'+png.name)]
        assert len(matches)==1,(png.name,matches)
        packed=Image.open(io.BytesIO(new.read(matches[0]))).convert('RGBA')
        source=Image.open(png).convert('RGBA')
        assert packed.size==source.size and packed.tobytes()==source.tobytes(),png
        count+=1
    assert count==15
out=Path('driver-icon-evidence');out.mkdir(exist_ok=True)
(out/'apk-integrity.json').write_text(json.dumps({'sha256':hashlib.sha256(built[0].read_bytes()).hexdigest(),
    'bytes':built[0].stat().st_size,'all_baseline_assets_identical':True,'assets_checked':len(assets),
    'icon_pngs_checked':count,'pureScript_compiler_executed':False},indent=2))
print('Approved bundle and all original assets unchanged; all 15 icon PNGs match source pixels.')
