"""Build compact Europe vector/grid data from public-domain Natural Earth low-res geometry.
Not required by normal users; checked-in generated source is authoritative.
"""
import geopandas as gpd
from shapely.geometry import box, Point
from shapely.ops import unary_union
from shapely.prepared import prep
from pathlib import Path
import json
import sys
import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv)>1 else Path('/opt/pyvenv/lib/python3.13/site-packages/pyogrio/tests/fixtures/naturalearth_lowres/naturalearth_lowres.shp')
if not source.exists():
    raise SystemExit('Usage: python scripts/generate_map.py /path/to/naturalearth_lowres.shp')
gdf = gpd.read_file(source)
selected = gdf[(gdf.continent == 'Europe') | (gdf.name.isin(['Turkey','Cyprus']))]
bounds = box(-12.5, 33.8, 43, 72.5)
features = []
poly_land = []
W,H=240,160
W_PX,H_PX=1280,800
LON_MIN,LON_MAX=-12.5,43
LAT_MIN,LAT_MAX=33.8,72.5

def project(x,y):
    return [round((x-LON_MIN)/(LON_MAX-LON_MIN)*W_PX,1),round((LAT_MAX-y)/(LAT_MAX-LAT_MIN)*H_PX,1)]

def polys(geom):
    if geom.geom_type == 'Polygon': return [geom]
    if geom.geom_type == 'MultiPolygon': return list(geom.geoms)
    if geom.geom_type == 'GeometryCollection': return [p for g in geom.geoms for p in polys(g)]
    return []

for _, row in selected.iterrows():
    geom = row.geometry.intersection(bounds)
    if geom.is_empty: continue
    rings=[]
    for p in polys(geom):
        if p.area < 0.025: continue
        poly_land.append(p)
        simp = p.simplify(0.085, preserve_topology=True)
        rings.append([project(x,y) for x,y in simp.exterior.coords])
    if rings:
        features.append({'name':row['name'], 'rings':rings})
merged=prep(unary_union(poly_land))
rows=[]
land_count=0
for y in range(H):
    row=''
    for x in range(W):
        lon=LON_MIN+(x+0.5)/W*(LON_MAX-LON_MIN)
        lat=LAT_MAX-(y+0.5)/H*(LAT_MAX-LAT_MIN)
        is_land=merged.contains(Point(lon,lat))
        row+= '1' if is_land else '0'
        land_count+=is_land
    rows.append(row)
# Fixed maritime corridors connect every isolated island and Europe/Asia strait.
# For each geographic component, link to nearest previously connected larger component.
mask = np.array([[ch=='1' for ch in row] for row in rows],dtype=bool)
visited=set()
components=[]
for yy in range(H):
    for xx in range(W):
        if not mask[yy,xx] or (yy,xx) in visited: continue
        todo=[(yy,xx)]
        visited.add((yy,xx))
        group=[]
        while todo:
            y,x=todo.pop()
            group.append((y,x))
            for dy,dx in [(0,-1),(0,1),(-1,0),(1,0)]:
                ny,nx=y+dy,x+dx
                if 0<=ny<H and 0<=nx<W and mask[ny,nx] and (ny,nx) not in visited:
                    visited.add((ny,nx))
                    todo.append((ny,nx))
        components.append(group)
components.sort(key=len,reverse=True)
connected=list(components[0]);sea_crossings=[]
for comp in components[1:]:
    tree=cKDTree(np.array(connected))
    distances,indices=tree.query(np.array(comp))
    closest=int(np.argmin(distances))
    a=comp[closest]
    b=connected[int(indices[closest])]
    sea_crossings.append([a[0]*W+a[1],b[0]*W+b[1]])
    connected+=comp

out='''// Generated from Natural Earth public-domain low-resolution boundaries.
// Dimensions and coordinates are fixed; no network requests are needed at runtime.
export const MAP_WIDTH = 240;
export const MAP_HEIGHT = 160;
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 800;
export const GEO_BOUNDS = { west: -12.5, east: 43, south: 33.8, north: 72.5 } as const;
export const LAND_ROWS: readonly string[] = '''+json.dumps(rows,separators=(',',':'))+''';
export const SEA_CROSSINGS: readonly [number,number][] = '''+json.dumps(sea_crossings,separators=(',',':'))+''';
export interface CountryShape { name: string; rings: number[][][]; }
export const COUNTRIES: readonly CountryShape[] = '''+json.dumps(features,separators=(',',':'),ensure_ascii=False)+''';
'''
(ROOT/'src/data/europe.ts').write_text(out, encoding='utf8')
print('Countries',len(features),'land tiles',land_count,'maritime corridors',len(sea_crossings),'source bytes',len(out))
