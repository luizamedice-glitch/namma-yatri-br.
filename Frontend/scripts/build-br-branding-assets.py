#!/usr/bin/env python3
"""Gera os PNG Android brTest a partir das artes oficiais já versionadas.

Uso: python3 Frontend/scripts/build-br-branding-assets.py
Requer Pillow; nunca modifica variantes release ou motorista.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "brasil/branding/oficiais-2026-10-23/originais"
DEST = ROOT / "Frontend/android-native/app/src/brTest/res"


def extract_art(image, icon=False):
    """Remove o fundo azul e preserva a estrada, o pino e os textos."""
    im = image.convert("RGB")
    pixels = list(im.getdata())
    w, h = im.size
    alpha = bytearray(len(pixels))
    for i, (r, g, b) in enumerate(pixels):
        ratio = max(r, g) / max(1.0, b)
        signal = max(0.0, min(1.0, (ratio - 0.67) / 0.23))
        light = max(0.0, min(1.0, (max(r, g) - 65) / 90))
        a = int(255 * signal * light)
        # Elimina áreas azuis/ciano do fundo e reflexos desconectados.
        if b > g * 1.08 and b > r * 1.3:
            a = 0
        if icon and (i % w) < w * 0.30 and (i // w) < h * 0.27:
            a = 0
        alpha[i] = a
    mask = Image.frombytes("L", im.size, bytes(alpha)).filter(ImageFilter.GaussianBlur(1))
    bbox = mask.point(lambda v: 255 if v >= 32 else 0).getbbox()
    if bbox is None:
        raise RuntimeError("Nenhum elemento de arte identificado")
    im.putalpha(mask)
    pad = max(2, int(min(w, h) * 0.008))
    x1, y1, x2, y2 = bbox
    return im.crop((max(0, x1-pad), max(0, y1-pad),
                    min(w, x2+pad), min(h, y2+pad)))


def fit(img, w, h):
    img = img.copy()
    img.thumbnail((w, h), Image.Resampling.LANCZOS)
    return img


def save_splash():
    image = Image.open(SOURCE / "02_logo_completo_fundo_azul.png")
    artwork = fit(extract_art(image), 955, 1040)
    blue = Image.linear_gradient("L").resize((1080, 2400))
    canvas = ImageOps.colorize(blue, black="#0072ED", white="#0732B6").convert("RGBA")
    canvas.alpha_composite(artwork, ((1080-artwork.width)//2,
                                     (2400-artwork.height)//2))
    dest = DEST / "drawable-nodpi/br_splash.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(dest, optimize=True)


def save_text_logo():
    logo = Image.open(SOURCE / "01_logo_texto_transparente.png").convert("RGBA")
    bounds = logo.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("O texto original não possui transparência válida")
    dest = DEST / "drawable-nodpi/br_logo_transparent.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    logo.crop(bounds).save(dest, optimize=True)


def save_icons():
    artwork = extract_art(Image.open(SOURCE / "03_icone_original.png"), icon=True)
    for density, n in (("mdpi", 108), ("hdpi", 162), ("xhdpi", 216),
                       ("xxhdpi", 324), ("xxxhdpi", 432)):
        dest = DEST / ("mipmap-" + density)
        dest.mkdir(parents=True, exist_ok=True)
        canvas = Image.new("RGBA", (n, n))
        art = fit(artwork, int(n * 0.57), int(n * 0.57))
        canvas.alpha_composite(art, ((n-art.width)//2, (n-art.height)//2))
        canvas.save(dest / "br_launcher_foreground.png", optimize=True)
        # Ícones legados: não arredondar/cortar antecipadamente.
        square = Image.new("RGBA", (n, n), "#0732B6")
        square.alpha_composite(canvas)
        px = n * 48 // 108
        legacy = square.convert("RGB").resize((px, px), Image.Resampling.LANCZOS)
        legacy.save(dest / "ic_launcher_debug.png", optimize=True)
        legacy.save(dest / "ic_launcher_debug_round.png", optimize=True)


if __name__ == "__main__":
    save_splash()
    save_text_logo()
    save_icons()
    print("Recursos brTest: splash sem moldura, logo transparente e ícones adaptativos gerados.")
