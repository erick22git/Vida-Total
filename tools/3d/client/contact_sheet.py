import sys
from PIL import Image, ImageDraw
P = sys.argv[1]; out = sys.argv[2]
ims = [Image.open(f"{P}/preview_stage_{k}.png").convert("RGB").resize((426, 240)) for k in range(9)]
sheet = Image.new("RGB", (426 * 3, 240 * 3))
d = ImageDraw.Draw(sheet)
for i, im in enumerate(ims):
    x, y = (i % 3) * 426, (i // 3) * 240
    sheet.paste(im, (x, y)); d.text((x + 8, y + 6), f"STAGE_{i}", fill=(255, 255, 255))
sheet.save(out)
