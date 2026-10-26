#!/usr/bin/env python3
"""Resample supplied artwork only; no redrawing/removal of the original design.

Requires Pillow. The complete source sits in 68/108 dp. Its visible artwork is
inside the adaptive 66 dp safe circle. Legacy icons use the central 72 dp viewport.
"""
from pathlib import Path
from PIL import Image, ImageDraw

here = Path(__file__).resolve().parent
root = here.parents[2]
res = root / 'Frontend/android-native/app/src/brTest/driver/res'
source = Image.open(here / 'official-driver.jpg').convert('RGBA')
background = '#800253'
for density, scale in [('mdpi',1),('hdpi',1.5),('xhdpi',2),('xxhdpi',3),('xxxhdpi',4)]:
    directory = res / ('mipmap-' + density)
    directory.mkdir(parents=True, exist_ok=True)
    side, art_side = round(108*scale), round(68*scale)
    layer = Image.new('RGBA',(side,side),background)
    art = source.resize((art_side,art_side),Image.Resampling.LANCZOS)
    inset = (side-art_side)//2
    layer.alpha_composite(art,(inset,inset))
    layer.save(directory/'br_launcher_foreground.png')
    viewport = layer.crop((round(18*scale),round(18*scale),round(90*scale),round(90*scale)))
    legacy = viewport.resize((round(48*scale),round(48*scale)),Image.Resampling.LANCZOS)
    legacy.save(directory/'ic_launcher_debug.png')
    mask = Image.new('L',legacy.size)
    ImageDraw.Draw(mask).ellipse((0,0,legacy.width-1,legacy.height-1),fill=255)
    circular = legacy.copy()
    circular.putalpha(mask)
    circular.save(directory/'ic_launcher_debug_round.png')
# Readable previews of launcher masks; these are not packaged in the application.
layer = Image.open(res/'mipmap-xxxhdpi/br_launcher_foreground.png')
viewport = layer.crop((72,72,360,360))
preview = Image.new('RGB',(900,330),'#eeeeee')
for index, radius in enumerate([0,144,64]):
    mask=Image.new('L',(288,288));draw=ImageDraw.Draw(mask)
    draw.rounded_rectangle((0,0,287,287),radius=radius,fill=255)
    preview.paste(viewport,(6+300*index,12),mask)
preview.save(here/'launcher-masks.png')
print('Generated 15 driver-only icon PNGs and three launcher mask previews.')
