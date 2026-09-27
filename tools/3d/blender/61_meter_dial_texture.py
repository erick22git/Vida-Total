# Textura PROPIA del dial del medidor de energía (reemplaza a `Energy_(1).png`, que dice «WATTS/PER HOUR» y no sirve para calorías).
# Python normal (necesita Pillow), no Blender:  python tools/3d/blender/61_meter_dial_texture.py
# Arco de 270° (de abajo-izquierda a abajo-derecha, en sentido horario). La meta está a 2/3 del recorrido (mismo ARC_GOAL_POS que el arco
# y calorie-state.ts): amarillo→verde hasta la meta, rojo pasada la meta. El número de kcal y el estado NO están aquí: son una etiqueta viva.
import math, os
from PIL import Image, ImageDraw, ImageFont

N = 1024
OUT = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/meter_dial.png"
GOAL_POS = 2 / 3
START, SWEEP = 225.0, 270.0            # grados matemáticos: 0 % en 225°, 150 % en −45°
C = N / 2
YEL, GRN, RED = (234, 179, 8), (34, 197, 94), (239, 68, 68)


def ang(p):
    return math.radians(START - SWEEP * p)


def pt(p, r):
    a = ang(p)
    return (C + r * math.cos(a), C - r * math.sin(a))


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


img = Image.new("RGB", (N, N), (244, 241, 234))
d = ImageDraw.Draw(img)
d.ellipse([6, 6, N - 6, N - 6], outline=(30, 30, 34), width=10)
d.ellipse([C - 0.92 * C, C - 0.92 * C, C + 0.92 * C, C + 0.92 * C], outline=(30, 30, 34), width=4)

# banda de color: segmentos finos para el degradado
R0, R1 = 0.50 * C, 0.66 * C
STEPS = 300
for i in range(STEPS):
    p0, p1 = i / STEPS, (i + 1.15) / STEPS
    p = (i + 0.5) / STEPS
    col = mix(YEL, GRN, p / GOAL_POS) if p <= GOAL_POS else RED
    poly = [pt(p0, R1), pt(min(p1, 1), R1), pt(min(p1, 1), R0), pt(p0, R0)]
    d.polygon(poly, fill=col)
d.arc([C - R1, C - R1, C + R1, C + R1], 0, 360, fill=(30, 30, 34), width=0)

# marcas cada 10 % de la meta (0..150 %) y grandes cada 50 %
for k in range(0, 16):
    pct = k * 10
    p = (pct / 100) * GOAL_POS
    big = pct % 50 == 0
    d.line([pt(p, R1 + 8), pt(p, R1 + (52 if big else 30))], fill=(30, 30, 34), width=9 if big else 4)

f_big = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 44)
f_mid = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 38)


def label(p, text, r, font, fill=(30, 30, 34)):
    x, y = pt(p, r)
    w = d.textlength(text, font=font)
    d.text((x - w / 2, y - font.size / 2), text, font=font, fill=fill)


R_LAB = 0.80 * C
label(0, "0", R_LAB, f_big)
label(0.5 * GOAL_POS, "50%", R_LAB, f_mid)
label(GOAL_POS, "META", R_LAB, f_big, (21, 128, 61))
label(1.5 * GOAL_POS, "150%", R_LAB, f_mid, (185, 28, 28))

# nombres de zona dentro de la banda, girados para seguir el arco (texto tangente)
f_z = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 34)


def arc_text(p, text, fill):
    w = int(d.textlength(text, font=f_z)) + 8
    tile = Image.new("RGBA", (w, 44), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((4, 2), text, font=f_z, fill=fill)
    a = math.degrees(ang(p)) - 90          # la base del texto mira al centro
    tile = tile.rotate(a, expand=True, resample=Image.BICUBIC)
    x, y = pt(p, (R0 + R1) / 2)
    img.paste(tile, (int(x - tile.width / 2), int(y - tile.height / 2)), tile)


arc_text(0.30 * GOAL_POS, "BAJO", (60, 45, 0, 255))
arc_text(1.25 * GOAL_POS, "EXCEDIDO", (255, 255, 255, 255))

# eje central (la aguja gira sobre él)
d.ellipse([C - 28, C - 28, C + 28, C + 28], fill=(30, 30, 34))
os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT)
print("OK", OUT, os.path.getsize(OUT))
