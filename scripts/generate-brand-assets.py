"""Generate native brand graphics. Requires Pillow; override fonts on non-Windows hosts."""
import argparse
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--serif-font', default='C:/Windows/Fonts/georgiai.ttf')
parser.add_argument('--text-font', default='C:/Windows/Fonts/malgun.ttf')
parser.add_argument('--bold-font', default='C:/Windows/Fonts/malgunbd.ttf')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
assets = root / 'assets'
assets.mkdir(exist_ok=True)
ink, cream, accent = '#243c33', '#f0f2eb', '#628c6d'

# The SVG and raster variants share the same monogram and musical-note geometry.
svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
<rect width="256" height="256" rx="60" fill="#243c33"/>
<circle cx="128" cy="128" r="103" fill="none" stroke="#f0f2eb" stroke-opacity=".3" stroke-width="2"/>
<text x="40" y="185" font-family="Georgia,serif" font-style="italic" font-size="180" fill="#f0f2eb">m</text>
<path d="M196 101V55L224 49V66L203 71V101Z" fill="#b7d9a7"/>
<ellipse cx="192" cy="102" rx="13" ry="9" transform="rotate(-20 192 102)" fill="#b7d9a7"/>
</svg>'''
(assets / 'favicon.svg').write_text(svg, encoding='utf-8')

scale = 4
icon = Image.new('RGB', (256*scale, 256*scale), ink)
d = ImageDraw.Draw(icon)
d.ellipse((25*scale,25*scale,231*scale,231*scale),outline='#63776b',width=2*scale)
d.text((40*scale,185*scale),'m',font=ImageFont.truetype(args.serif_font,180*scale),fill=cream,anchor='ls')
d.polygon([(196*scale,101*scale),(196*scale,55*scale),(224*scale,49*scale),(224*scale,66*scale),(203*scale,71*scale),(203*scale,101*scale)],fill='#b7d9a7')
d.ellipse((179*scale,93*scale,205*scale,111*scale),fill='#b7d9a7')
for name,size in [('icon-512.png',512),('favicon-32.png',32),('apple-touch-icon.png',180)]:
    icon.resize((size,size),Image.Resampling.LANCZOS).save(assets/name)
icon.resize((256,256),Image.Resampling.LANCZOS).save(root/'favicon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])

card = Image.new('RGB',(1200,630),cream)
d = ImageDraw.Draw(card)
for x in range(0,1200,75):d.line((x,0,x,630),fill='#dfe5d9')
for y in range(0,630,70):d.line((0,y,1200,y),fill='#dfe5d9')
# A musical gesture flows through the playable grid on the right.
gesture=[]
for x in range(720,1141):
    y=355+math.sin((x-720)/78)*95-math.sin((x-720)/160)*40
    gesture.append((x,y))
d.line(gesture,fill='#91b388',width=3)
for i in [20,110,205,310,405]:
    x,y=gesture[i]
    for radius in [22,39,57]:d.ellipse((x-radius,y-radius,x+radius,y+radius),outline='#b7cfad',width=1)
    d.ellipse((x-5,y-5,x+5,y+5),fill=accent)

card.paste(icon.resize((64,64),Image.Resampling.LANCZOS),(70,56))
d.text((152,64),'mouvement',font=ImageFont.truetype(args.serif_font,37),fill=ink)
d.text((73,174),'움직임이 음악이 되는 순간.',font=ImageFont.truetype(args.bold_font,49),fill=ink)
d.text((74,273),'마우스로, 글쓰기로.',font=ImageFont.truetype(args.text_font,30),fill=ink)
d.text((74,322),'당신만의 음악을 연주하세요.',font=ImageFont.truetype(args.text_font,30),fill=ink)
d.text((75,439),'14가지 악기  ·  매번 달라지는 반주',font=ImageFont.truetype(args.text_font,23),fill=accent)
d.rounded_rectangle((74,510,397,558),radius=24,fill=ink)
d.text((99,522),'FOLLOW YOUR OWN RHYTHM',font=ImageFont.truetype(args.text_font,16),fill=cream)
d.text((876,568),'A PLAYGROUND FOR SOUND',font=ImageFont.truetype(args.text_font,13),fill=accent)
card.save(assets/'share-card-v1.png',optimize=True)
print('Generated favicon, touch icon and 1200x630 sharing card.')
