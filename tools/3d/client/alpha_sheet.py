"""Compone los PNG RGBA sobre fondo claro y oscuro y mide la transparencia real (píxeles con alpha=0)."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]; out = sys.argv[2]
N = 8
tile = 300
sheet = Image.new("RGB", (tile * 4, tile * 4), (0, 0, 0))
d = ImageDraw.Draw(sheet)
stats = []
for i in range(N):
    im = Image.open(f"{P}/day_{i}.png").convert("RGBA")
    a = im.getchannel("A")
    total = im.width * im.height
    transparent = sum(1 for v in a.getdata() if v == 0)
    corners = [a.getpixel(p)[0] if isinstance(a.getpixel(p), tuple) else a.getpixel(p) for p in [(0, 0), (im.width - 1, 0), (0, im.height - 1), (im.width - 1, im.height - 1)]]
    stats.append((i, round(100 * transparent / total, 1), corners))
    small = im.resize((tile, tile))
    for row, bg in enumerate([(238, 240, 244), (18, 18, 22)]):
        base = Image.new("RGBA", (tile, tile), bg + (255,))
        base.alpha_composite(small)
        x, y = (i % 4) * tile, (i // 4) * (tile * 2) + row * tile
        sheet.paste(base.convert("RGB"), (x, y))
        d.text((x + 6, y + 4), f"DIA {i}" if i else "DIA 0 (vacio)", fill=(120, 120, 120) if row == 0 else (200, 200, 200))
sheet.save(out)
for s in stats:
    print("día", s[0], "| % píxeles con alpha=0:", s[1], "| alpha en las 4 esquinas:", s[2])
