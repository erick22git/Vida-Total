"""Uso: python days_sheet.py <carpeta con day_0..day_7.png> <salida.png> — hoja de contacto 4x2 sobre gris (RGBA→RGB)."""
import sys
from PIL import Image, ImageDraw
P, out = sys.argv[1], sys.argv[2]
sheet = Image.new("RGB", (400 * 4, 400 * 2), (70, 74, 82))
d = ImageDraw.Draw(sheet)
for k in range(8):
    im = Image.open(f"{P}/day_{k}.png").convert("RGBA").resize((400, 400))
    x, y = (k % 4) * 400, (k // 4) * 400
    sheet.paste(im, (x, y), im); d.text((x + 8, y + 6), f"DIA {k}", fill=(255, 255, 255))
sheet.save(out)
