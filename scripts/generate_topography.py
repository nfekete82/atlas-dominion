"""Derive display-only geography from Natural Earth 10m public-domain data.

Usage: python scripts/generate_topography.py /path/to/downloaded/archives
Requires Pillow and pyshp. No runtime network or Python dependency.
"""
from pathlib import Path
import hashlib, json, re, sys, zipfile
from PIL import Image, ImageDraw
import shapefile

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
text = (ROOT / 'src/data/europe.ts').read_text()
b = json.loads(re.search(r'GEO_BOUNDS = (\{.*?\})', text)[1])
w = int(re.search(r'WORLD_WIDTH = (\d+)', text)[1])
h = int(re.search(r'WORLD_HEIGHT = (\d+)', text)[1])
grid_w = int(re.search(r'MAP_WIDTH = (\d+)', text)[1])
grid_h = int(re.search(r'MAP_HEIGHT = (\d+)', text)[1])
archives = ['SR_LR', 'ne_10m_lakes', 'ne_10m_lakes_europe']
hashes = {}
for name in archives:
    path = source / (name + '.zip')
    hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as archive:
        archive.extractall(source / name)

# Countries outside the game's Europe selection are still real land. They
# block navigation (e.g. Tunisia, Iran), without changing playable ownership.
global_path = source / 'ne_110m_admin_0_countries.geojson'
hashes['ne_110m_admin_0_countries.geojson'] = hashlib.sha256(global_path.read_bytes()).hexdigest()
playable = {c['name'] for c in json.loads(re.search(r'export const COUNTRIES.*?= (\[.*\]);',text)[1])}
mask = Image.new('1',(grid_w*8,grid_h*8)); draw=ImageDraw.Draw(mask)
def grid_project(p):
    return ((p[0]-b['west'])/(b['east']-b['west'])*grid_w*8,
            (b['north']-p[1])/(b['north']-b['south'])*grid_h*8)
for feature in json.loads(global_path.read_text())['features']:
    properties=feature['properties']
    names={properties.get(k) for k in ['ADMIN','NAME','NAME_EN','SOVEREIGNT']}
    if names & playable: continue
    geometry=feature['geometry']
    polygons=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        for k,ring in enumerate(polygon): draw.polygon([grid_project(p) for p in ring],fill=1 if k==0 else 0)
blocked=[i for i in range(grid_w*grid_h) if mask.getpixel(((i%grid_w)*8+4,(i//grid_w)*8+4))]
(ROOT/'src/data/navigation-barriers.ts').write_text('// Natural Earth 110m countries outside the playable Europe selection. Public domain.\n'
    '// Display ownership is unchanged; actual non-European land is not navigable ocean.\n'
    'export const NAVIGATION_BARRIERS:readonly number[] = '+json.dumps(blocked,separators=(',',':'))+';\n')

# Read pixel-centre georeferencing; crop edges in geographic degrees.
Image.MAX_IMAGE_PIXELS = 150_000_000
raster = Image.open(source / 'SR_LR/SR_LR.tif')
dx, _, _, dy, cx, cy = map(float, (source / 'SR_LR/SR_LR.tfw').read_text().split())
west, north = cx - dx / 2, cy - dy / 2
crop = ((b['west']-west)/dx, (b['north']-north)/dy,
        (b['east']-west)/dx, (b['south']-north)/dy)
relief = raster.transform((w*2,h*2), Image.Transform.EXTENT, crop, Image.Resampling.BICUBIC).convert('L')
# Water/plains are ~206 gray. Remove the flat tint, retain actual hillshade.
# Alpha is bounded at 18%; both lit slopes and shadows retain territory hue.
rgba = Image.new('RGBA', relief.size)
rgba.putdata([(255,255,245,min(46,round(max(0,v-206)*1.2))) if v>206
              else (13,27,29,min(46,round(max(0,206-v)*1.2))) for v in relief.getdata()])
assets = ROOT / 'src/assets'; assets.mkdir(exist_ok=True)
rgba.save(assets / 'europe-relief.png', optimize=True)

def project(p):
    return [round((p[0]-b['west'])/(b['east']-b['west'])*w,2),
            round((b['north']-p[1])/(b['north']-b['south'])*h,2)]

def simplify(points, tolerance=.12):
    # Ramer-Douglas-Peucker in projected pixels; preserve original geometry.
    if len(points)<3: return points
    a,z=points[0],points[-1];dx,dy=z[0]-a[0],z[1]-a[1];den=dx*dx+dy*dy
    maximum,index=0,0
    for k,p in enumerate(points[1:-1],1):
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
        d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
        if d>maximum: maximum,index=d,k
    if maximum<=tolerance*tolerance:return [a,z]
    return simplify(points[:index+1],tolerance)[:-1]+simplify(points[index:],tolerance)

lakes=[]
for name in archives[1:]:
    reader=shapefile.Reader(str(source/name/(name+'.shp')),encoding='utf-8')
    for record in reader.iterShapeRecords():
        x0,y0,x1,y1=record.shape.bbox
        if x1<b['west'] or x0>b['east'] or y1<b['south'] or y0>b['north']: continue
        attrs=record.record.as_dict()
        label=attrs.get('name_en') or attrs.get('name') or 'Unnamed lake'
        parts=list(record.shape.parts)+[len(record.shape.points)]
        rings=[simplify([project(p) for p in record.shape.points[parts[k]:parts[k+1]]]) for k in range(len(parts)-1)]
        lakes.append({'name':label,'rings':rings,'bounds':[x0,y0,x1,y1]})
(ROOT/'src/data/topography.ts').write_text('// Generated from Natural Earth 10m lakes + Europe supplement; public domain.\n'
    '// See docs/GEODATA.md and scripts/generate_topography.py. Display only.\n'
    'export const TOPOGRAPHY_BOUNDS = '+json.dumps(b,separators=(',',':'))+' as const;\n'
    'export const LAKES = '+json.dumps(lakes,separators=(',',':'),ensure_ascii=False)+';\n')
(assets/'topography-sources.json').write_text(json.dumps({'bounds':b,'size':[w*2,h*2],'sha256':hashes,'lakeCount':len(lakes)},indent=2)+'\n')
print('Generated',len(lakes),'lakes;',rgba.size,'relief;',hashes)
