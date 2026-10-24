#!/usr/bin/env python3
"""Generate the BR-only solid-pink opening and Android icons from uploaded originals.
Requires ffmpeg and Pillow; never changes the original uploads.
"""
from pathlib import Path
import subprocess
from PIL import Image, ImageOps
root=Path(__file__).resolve().parents[2]; src=root/'brasil/branding/abertura-rosa-2026-10-23'
dest=root/'Frontend/android-native/app/src/brTest'
archive=root/'brasil/branding/abertura-rosa-2026-10-23'; archive.mkdir(parents=True,exist_ok=True)
# Original uploaded assets are preserved beside this conversion's inputs.
# The original animation is white over pink. Recover coverage from its green
# channel and render against one exact pink, eliminating video compression seams.
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(src/'original.mp4'),'-vf','fps=30,scale=640:360','-f','rawvideo','-pix_fmt','rgb24','-'])
palette=[]
for a in range(256): palette.extend((255,a,round(190+(255-190)*a/255)))
frames=[]; size=640*360*3
for start in range(0,len(raw),size):
 rgb=Image.frombytes('RGB',(640,360),raw[start:start+size])
 frame=Image.frombytes('P',(640,360),rgb.getchannel('G').tobytes()); frame.putpalette(palette); frames.append(frame)
assets=dest/'passenger/assets/branding'; assets.mkdir(parents=True,exist_ok=True)
# Start at the first clearly visible AY instead of the empty opening fade.
# Redistribute centiseconds to preserve the owner's requested total of 2500 ms.
frames=frames[8:]
durations=[((i+1)*250//len(frames)-i*250//len(frames))*10 for i in range(len(frames))]
frames[0].save(assets/'br_abertura.gif',save_all=True,append_images=frames[1:],duration=durations,optimize=False,disposal=1)
res=dest/'res'
# A matching launch-window poster removes the blank pink before Activity draws.
# 820 px at xhdpi gives a 410 dp canvas, close to the original portrait viewport.
preview=res/'drawable-xhdpi'; preview.mkdir(parents=True,exist_ok=True)
frames[0].convert('RGB').resize((820,462),Image.Resampling.LANCZOS).save(preview/'br_opening_preview.png')
coverage=frames[0].convert('RGB').getchannel('G')
monogram=Image.new('RGBA',coverage.size,'white');monogram.putalpha(coverage)
monogram=monogram.crop(coverage.point(lambda p:255 if p>8 else 0).getbbox())
system_icon=Image.new('RGBA',(288,288)); art=ImageOps.contain(monogram,(160,160),Image.Resampling.LANCZOS)
system_icon.alpha_composite(art,((288-art.width)//2,(288-art.height)//2))
(res/'drawable-nodpi').mkdir(parents=True,exist_ok=True)
system_icon.save(res/'drawable-nodpi/br_opening_monogram.png')
logo=Image.open(src/'15803.png').convert('RGBA'); logo=logo.crop(logo.getchannel('A').getbbox()); logo.save(res/'drawable-nodpi/br_logo_transparent.png')
# Isolate the supplied white AY/BR using its saturation, preserving edge coverage.
icon=Image.open(src/'15695.png').convert('RGB'); alpha=icon.getchannel('G').point(lambda p: min(255,max(0,round((p-12)*255/215))))
icon.putalpha(alpha); icon=icon.crop(alpha.point(lambda p:255 if p>25 else 0).getbbox())
for density,px,adaptive in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
 folder=res/('mipmap-'+density)
 fg=Image.new('RGBA',(adaptive,adaptive)); art=ImageOps.contain(icon,(round(adaptive*.53),round(adaptive*.53)),Image.Resampling.LANCZOS); fg.alpha_composite(art,((adaptive-art.width)//2,(adaptive-art.height)//2)); fg.save(folder/'br_launcher_foreground.png')
 legacy=Image.new('RGBA',(px,px),'#FF00BE'); art=ImageOps.contain(icon,(round(px*.80),round(px*.80)),Image.Resampling.LANCZOS); legacy.alpha_composite(art,((px-art.width)//2,(px-art.height)//2))
 for name in ['ic_launcher_debug.png','ic_launcher_debug_round.png']:legacy.save(folder/name)
print('Prepared',len(frames),'frames; duration',sum(durations),'ms; initial fade advanced by 267 ms')

frames[-1].convert('RGB').save(res/'drawable-nodpi/br_splash.png')
