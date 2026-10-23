"""Original, editable pixel drawings for ATLAS DOMINION. No downloaded sprites.

Rebuild: python3 scripts/generate_pixel_art_assets.py (Pillow, development only).
All drawing coordinates are native integer pixels; no blur, noise, or resampling.
The atlases and TS/JSON manifests are committed runtime assets.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/assets/pixel-art'
OUT.mkdir(parents=True, exist_ok=True)
PAL = dict(outline='#625A55', wall='#AA927E', light='#E1CFAD', edge='#F4E6C8',
           roof='#A15F50', rooflight='#D18C6B', roofdark='#704C49', window='#414E54',
           grass='#86B476', leaf='#467857', leafdark='#2D5546', leaflight='#739D70',
           rock='#9C8B74', rocklight='#D1BE9F', rockdark='#62594F',
           metal='#7B7775', metallight='#B8A28C', metaldark='#464E56',
           concrete='#777C71', concretelight='#A4A697', concretedark='#454F4A')
TEAMS = {'blue':('#4474BB','#81A6E0','#294F83'), 'red':('#C85258','#E58C7F','#8F333D'),
         'green':('#467857','#A9C990','#2D5546'), 'neutral':('#8D8471','#D1BE9F','#62594F')}
atlases = {}

def canvas(w,h):
    im=Image.new('RGBA',(w,h)); return im,ImageDraw.Draw(im)

def rect(d,box,color): d.rectangle(box, fill=PAL.get(color,color))
def poly(d,points,color): d.polygon(points, fill=PAL.get(color,color))
def line(d,points,color,width=1): d.line(points,fill=PAL.get(color,color),width=width)

def ground(d,w,h):
    poly(d,[(2,h-10),(w-9,h-10),(w-2,h-6),(w-4,h-3),(7,h-3),(2,h-6)],(46,57,45,90))
    line(d,[(4,h-9),(w-11,h-9)],'#C6AD86')

def house(d,x,y,w,h,variant=0):
    # y = eaves. Left-lit tiled gable; a separate dark right-facing wall.
    rect(d,(x,y,x+w,y+h),'outline');rect(d,(x+1,y+1,x+w-2,y+h-1),'wall')
    rect(d,(x+1,y+1,x+w-4,y+2),'light');rect(d,(x+w-2,y+1,x+w-1,y+h-1),'roofdark')
    peak=y-max(3,w//3)
    poly(d,[(x-1,y),(x+w//2-1,peak),(x+w+1,y)],'roofdark')
    poly(d,[(x-1,y-1),(x+w//2-1,peak),(x+w-1,y-1)],'roof')
    line(d,[(x, y-2),(x+w//2-1,peak),(x+w-2,y-2)],'rooflight')
    for xx in range(x+3,x+w-1,4): rect(d,(xx,y-1,xx+1,y-1),'rooflight')
    for xx in range(x+2,x+w-2,5):
        rect(d,(xx,y+4,xx+1,y+5),'window');rect(d,(xx,y+6,xx+2,y+6),'light')
    rect(d,(x+w//2-1,y+h-4,x+w//2+1,y+h-1),'window')
    if variant: rect(d,(x+2,peak,x+3,y-3),'outline');rect(d,(x+2,peak,x+3,peak),'light')

def flag(d,x,y,team='blue'):
    line(d,[(x,y),(x,y+9)],'outline');rect(d,(x+1,y,x+5,y+2),TEAMS[team][0]);rect(d,(x+1,y,x+4,y),TEAMS[team][1])

def wall(d,x,y,w):
    rect(d,(x,y,x+w,y+5),'outline');rect(d,(x+1,y+1,x+w-1,y+3),'wall')
    line(d,[(x,y),(x+w,y)],'light')
    for xx in range(x,x+w,5): rect(d,(xx,y-2,xx+2,y),'light')
    for xx in range(x+3,x+w,6): rect(d,(xx,y+3,xx+1,y+3),'outline')

def city(level,variant):
    size=32 if level<3 else 40 if level<5 else 48
    im,d=canvas(size,size);ground(d,size,size)
    v=variant
    if level==0:
        house(d,6+v*2,17,12,9,v);flag(d,23,12)
        rect(d,(3,25,5,26),'leaflight');rect(d,(23,26,26,26),'rocklight')
    elif level==1:
        house(d,3+v,16,11,10,1);house(d,17-v,18,10,8);flag(d,24,8)
    elif level==2:
        house(d,10+v,11,10,9,1);house(d,2,20,11,7);house(d,18,19,11,8);flag(d,25,8)
    elif level in (3,4):
        house(d,4,20,11,12,1);house(d,22,18+v,12,14-v,1)
        house(d,14,12 if level==3 else 9,9,19 if level==3 else 22)
        rect(d,(17,16 if level==3 else 13,19,18 if level==3 else 15),'edge')
        rect(d,(18,16 if level==3 else 13,18,17 if level==3 else 14),'window')
        if level==4: house(d,3,11,8,9);house(d,29,12,7,8)
        wall(d,2,31,35);rect(d,(17,32,21,36),'window');rect(d,(17,32,21,32),'light');flag(d,28,3)
    else:
        house(d,3,24,11,16,1);house(d,32,22,11,18,1)
        house(d,12,17,11,22,1);house(d,25,18,11,21)
        house(d,19+v,9,10,28,1)
        rect(d,(22+v,13,25+v,16),'edge');rect(d,(24+v,13,24+v,15),'window')
        wall(d,2,37,43);rect(d,(20,38,26,43),'window');line(d,[(20,38),(26,38)],'light')
        flag(d,32,3);rect(d,(7,32,9,34),'light');rect(d,(37,31,39,33),'light')
    return im

def industry(kind):
    im,d=canvas(40,40);ground(d,40,40)
    if kind=='factory':
        rect(d,(4,21,32,33),'metaldark');rect(d,(5,22,31,31),'metal')
        for x in [4,14,24]:
            poly(d,[(x,21),(x+8,15),(x+10,21)],'metaldark')
            poly(d,[(x+1,20),(x+8,15),(x+8,20)],'metallight')
            line(d,[(x+2,20),(x+7,17)],'edge')
            rect(d,(x+3,24,x+7,27),'window');rect(d,(x+3,24,x+7,24),'rocklight')
        rect(d,(7,7,12,20),'metaldark');rect(d,(8,7,10,18),'wall')
        for y in [8,12,16]: rect(d,(8,y,11,y),'roofdark')
        rect(d,(6,6,13,8),'metaldark');rect(d,(7,6,12,6),'metallight')
        rect(d,(22,29,29,33),'metaldark');rect(d,(23,29,28,29),'metallight')
        rect(d,(32,25,37,33),'metaldark');rect(d,(33,23,36,31),'metallight')
        rect(d,(33,25,36,25),'edge');flag(d,29,8)
    elif kind=='barracks':
        # Two low wings, a recessed command building and defensive gate.
        for x,y,w in [(3,22,13),(23,20,13),(13,13,14)]:
            rect(d,(x,y,x+w,y+11),'concretedark');rect(d,(x+1,y+1,x+w-1,y+8),'concrete')
            poly(d,[(x-1,y),(x+3,y-5),(x+w-3,y-5),(x+w+1,y)],'concretedark')
            poly(d,[(x,y-1),(x+3,y-5),(x+w-4,y-5),(x+w-1,y-1)],'concretelight')
            line(d,[(x+3,y-5),(x+w-4,y-5)],'light')
            for xx in range(x+3,x+w-1,5): rect(d,(xx,y+3,xx+1,y+5),'window')
        rect(d,(17,17,22,24),'window');wall(d,2,32,35);rect(d,(17,32,23,36),'concretedark')
        flag(d,28,3);line(d,[(8,13),(8,7),(12,5)],'metaldark');rect(d,(11,4,14,5),'concretelight')
    else:
        rect(d,(11,16,28,33),'concretedark');rect(d,(12,17,23,31),'wall');rect(d,(24,17,27,31),'outline')
        rect(d,(10,13,29,19),'outline');rect(d,(11,14,28,17),'light');rect(d,(12,18,27,19),'wall')
        for x in [10,17,24]: rect(d,(x,9,x+4,14),'outline');rect(d,(x+1,9,x+3,12),'light')
        rect(d,(17,23,20,29),'window');rect(d,(18,23,18,27),'metallight')
        flag(d,27,2);rect(d,(9,32,30,34),'rockdark');rect(d,(9,32,28,32),'rocklight')
    return im

def terrain(kind,v):
    size=32 if kind in ('grass','water') else 48
    im,d=canvas(size,size)
    if kind=='grass':
        # Deliberate broad clusters, transparent edges; zero white-noise pixels.
        for x,y,w in [(2+v,9,9),(15,22-v,12),(6,27,5)]:
            poly(d,[(x,y),(x+w-3,y-1),(x+w,y+2),(x+2,y+3)],(169,201,144,30))
            line(d,[(x+2,y),(x+4,y-2),(x+5,y)],(101,142,98,65))
    elif kind=='forest':
        trees=[(18,5,15),(8,17,17),(26,19,16)] if v==0 else [(9,4,15),(23,8,18),(6,24,13),(25,26,15)] if v==1 else [(18,2,14),(5,12,16),(29,13,15),(13,25,16),(27,28,13)]
        for x,y,w in trees:
            poly(d,[(x+1,y+w+5),(x+w,y+w+5),(x+w+3,y+w+8),(x+4,y+w+8)],(45,85,70,60))
            rect(d,(x+w//2-1,y+w-1,x+w//2+1,y+w+5),'rockdark')
            poly(d,[(x+w//2,y),(x+w//2+4,y+4),(x+w//2+3,y+5),(x+w-1,y+11),(x+w-2,y+13),(x+w,y+w),(x+w-4,y+w+2),(x+1,y+w),(x,y+w-4),(x+4,y+9),(x+3,y+7)],'leafdark')
            poly(d,[(x+w//2,y+1),(x+w//2+1,y+5),(x+w//2-1,y+7),(x+w//2+3,y+11),(x+w//2-1,y+w-1),(x+2,y+w-1),(x+3,y+w-6),(x+5,y+10),(x+4,y+8)],'leaf')
            line(d,[(x+w//2,y+2),(x+w//2-3,y+7),(x+w//2,y+6)],'leaflight')
            line(d,[(x+4,y+13),(x+7,y+11),(x+9,y+12)],'leaflight')
    elif kind=='mountain':
        for x,y,w,h in ([(3,21,21,18),(17,8,25,33)] if v==0 else [(2,18,26,24),(22,24,22,17)] if v==1 else [(2,26,24,16),(15,12,30,29)]):
            poly(d,[(x+2,y+h),(x+w,y+h),(x+w+3,y+h+3),(x+7,y+h+4)],(62,63,49,80))
            poly(d,[(x,y+h),(x+w//2-2,y),(x+w,y+h)],'rockdark')
            poly(d,[(x+1,y+h-1),(x+w//2-2,y+1),(x+w//2+2,y+13),(x+w//2-1,y+19),(x+w//2+6,y+h-1)],'rock')
            poly(d,[(x+4,y+h-4),(x+w//2-2,y+3),(x+w//2-1,y+12),(x+w//2-5,y+17),(x+w//2-4,y+19)],'rocklight')
            line(d,[(x+w//2+3,y+15),(x+w//2+7,y+23)],'outline')
            if v==0: poly(d,[(x+w//2-2,y),(x+w//2+1,y+7),(x+w//2-2,y+5),(x+w//2-5,y+8)],'edge')
    else:
        for x,y,w in [(4,11,12),(12,22,15)]:
            line(d,[(x,y),(x+w,y),(x+w+2,y-1)],(146,183,185,110))
            line(d,[(x+3,y+2),(x+w-2,y+2)],(49,90,116,90))
    return im

def soldier(team,state,frame):
    im,d=canvas(20,24);mid,hi,dark=TEAMS[team]
    step=([-1,0,1,0][frame%4] if state=='move' else 0)
    recoil=-1 if state=='fire' and frame==1 else 0
    poly(d,[(3,21),(11,21),(15,22),(13,23),(4,23)],(27,43,44,85))
    rect(d,(6-step,17,8-step,21),'metaldark');rect(d,(10+step,17,12+step,21),'metaldark')
    rect(d,(5-step,21,8-step,21),'window');rect(d,(10+step,21,13+step,21),'window')
    rect(d,(5+recoil,10,12+recoil,17),dark);rect(d,(6+recoil,10,10+recoil,15),mid)
    rect(d,(6+recoil,10,7+recoil,13),hi);rect(d,(5,12,6,16),'rockdark')
    rect(d,(7,6,12,10),'outline');rect(d,(8,7,12,9),'light');rect(d,(12,7,13,8),'wall')
    poly(d,[(5,7),(5,4),(7,2),(11,2),(13,4),(13,7)],dark)
    rect(d,(6,4,12,6),mid);rect(d,(7,3,10,3),hi);rect(d,(5,7,14,7),dark)
    rect(d,(6,8,7,8),hi)
    # Rifle is horizontal with a separate wooden stock, steel barrel and grip.
    rect(d,(9+recoil,11,14+recoil,13),'rockdark');rect(d,(13+recoil,11,18+recoil,11),'metaldark')
    rect(d,(14+recoil,10,16+recoil,10),'metallight');rect(d,(12+recoil,13,13+recoil,15),'metaldark')
    rect(d,(8+recoil,12,11+recoil,13),'light');rect(d,(14+recoil,12,15+recoil,13),'wall')
    if state=='idle' and frame==1: rect(d,(7,11,8,11),hi)
    if state=='fire' and frame==1:
        poly(d,[(18,8),(19,10),(19,13),(17,12)],'#F4CC77');rect(d,(18,10,19,11),'edge')
    return im

def effect(frame):
    im,d=canvas(16,16)
    if frame<2:
        poly(d,[(7,2+frame),(9,6),(14-frame,7),(10,9),(12,13-frame),(7,10),(3+frame,12),(5,8),(2,5)],'#D18C6B')
        poly(d,[(7,5),(9,7),(12,7),(9,9),(7,11),(6,8),(4,7)],'#F4CC77');rect(d,(7,7,9,8),'edge')
    else:
        for x,y in [(3,8),(8,4),(10,9),(6,11)]: rect(d,(x,y,x+3,y+1),'rocklight' if frame==2 else 'rock')
        rect(d,(8,4,9,4),'edge' if frame==2 else 'rocklight')
    return im

def pack(name,entries):
    sheet=Image.new('RGBA',(512,((len(entries)+7)//8)*56))
    sprites={}
    for i,(key,im,state,frame,duration) in enumerate(entries):
        x=(i%8)*64+2;y=(i//8)*56+2;w,h=im.size;sheet.paste(im,(x,y))
        left,top,right,bottom=im.getbbox()
        sprites[key]=dict(x=x,y=y,width=w,height=h,pivotX=w//2,pivotY=h-3,
                          inkX=left,inkY=top,inkWidth=right-left,inkHeight=bottom-top,
                          state=state,frame=frame,duration=duration)
    sheet.save(OUT/(name+'.png'),optimize=True)
    manifest=dict(image=name+'.png',size=list(sheet.size),palette=PAL,sprites=sprites)
    (OUT/(name+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    atlases[name]=sprites

pack('buildings',[(f'city-{n}-{v}',city(n,v),'static',0,0) for n in range(6) for v in range(2)]+
     [(s,industry(s),'static',0,0) for s in ['factory','barracks','tower']])
pack('terrain',[(f'{kind}-{v}',terrain(kind,v),'static',0,0) for kind,count in [('grass',4),('forest',3),('mountain',3),('water',2)] for v in range(count)])
pack('soldiers',[(f'{team}-{state}-{f}',soldier(team,state,f),state,f,180 if state=='idle' else 110)
                 for team in TEAMS for state,count in [('idle',2),('move',4),('fire',3)] for f in range(count)])
pack('effects',[(f'impact-{f}',effect(f),'impact',f,75) for f in range(4)])
(ROOT/'src/render/pixel-art-manifest.ts').write_text('// Generated by scripts/generate_pixel_art_assets.py; edit the pixel source there.\n'
    'export const PIXEL_ART_SPRITES = '+json.dumps(atlases,separators=(',',':'))+' as const;\n')
print('Wrote four RGBA atlases and matching JSON / TypeScript manifests.')
