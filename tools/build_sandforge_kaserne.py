#!/usr/bin/env python3
"""Generate Sandforge military barracks as a self-contained GLB asset.
Y-up, optimized mesh/material batching, moving parts in distinct glTF nodes.
Requires numpy and trimesh, no external textures.
"""
import math
from collections import defaultdict
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUT = Path(__file__).resolve().parents[1] / 'src/assets/reborn/buildings-3d'
OUT.mkdir(parents=True, exist_ok=True)

# muted desert military palette with readable RTS silhouettes
C = {
    'foundation': ('#887D6B', 0.03, 0.96),
    'concrete_high': ('#B1A18B', 0.02, 0.95),
    'dust': ('#B09A74', 0.03, 0.98),
    'deck': ('#4B514D', 0.55, 0.75),
    'deck_light': ('#676D65', 0.50, 0.75),
    'olive': ('#687365', 0.52, 0.70),
    'olive_light': ('#818979', 0.48, 0.74),
    'olive_dark': ('#303C37', 0.48, 0.78),
    'steel': ('#808A85', 0.83, 0.49),
    'steel_light': ('#B6BAB2', 0.80, 0.42),
    'steel_dark': ('#262F31', 0.76, 0.67),
    'recess': ('#151D20', 0.34, 0.92),
    'rubber': ('#212827', 0.14, 0.94),
    'yellow': ('#E2AE39', 0.23, 0.58),
    'orange': ('#CC5D32', 0.26, 0.64),
    'white': ('#E5DCC7', 0.14, 0.68),
    'missile': ('#AEB4A2', 0.50, 0.58),
    'missile_white': ('#D2D4C5', 0.40, 0.60),
    'missile_dark': ('#374541', 0.68, 0.55),
    'glass': ('#254C5A', 0.62, 0.30),
    'red_glow': ('#E34B28', 0.20, 0.47),
    'blue_glow': ('#46C5DA', 0.20, 0.40),
    'team_blue': ('#357CCF', 0.10, 0.78),
    'core': ('#57CCEA', 0.12, 0.24),
    'ice': ('#A2EAF3', 0.24, 0.29),
    'copper': ('#A76A46', 0.68, 0.49),
    'glass_dark': ('#153C51', 0.54, 0.26),
    'screen': ('#0D7CA0', 0.26, 0.30),
    'red_glow2': ('#F24C36', 0.18, 0.45),
}

def rgb(h):
    h = h.strip('#')
    return [int(h[i:i+2], 16) for i in (0,2,4)]

materials={}
for k,(hexcol, metal, rough) in C.items():
    kw = dict(name=f'SF_{k}',baseColorFactor=np.array(rgb(hexcol)+[255], dtype=np.uint8),
              metallicFactor=metal, roughnessFactor=rough, doubleSided=False)
    if k in ('core','ice','screen'):
        kw['emissiveFactor']=np.array([0.22,0.63,0.85]) if k!='ice' else np.array([0.30,0.73,0.82])
    if k=='red_glow':
        kw['emissiveFactor'] = np.array([0.95,0.17,0.07])
    if k=='red_glow2':
        kw['emissiveFactor']=np.array([0.95,0.18,0.10])
    if k=='blue_glow':
        kw['emissiveFactor'] = np.array([0.06,0.5,0.78])
    materials[k]=PBRMaterial(**kw)

# each part tagged with a material, and with its mechanical subassembly
parts=defaultdict(list)


def put(mesh, mat, group='static'):
    if not isinstance(mesh,trimesh.Trimesh) or len(mesh.faces)==0:
        return
    # Every custom loft/ring must face outward: glTF/Three.js culls backfaces.
    if not mesh.is_winding_consistent:
        trimesh.repair.fix_normals(mesh)
    elif mesh.is_watertight and mesh.volume < 0:
        mesh.invert()
    parts[(group,mat)].append(mesh)


def box(mat, center, ext, group='static', yaw=0):
    m = trimesh.creation.box(extents=ext)
    if yaw:
        m.apply_transform(trimesh.transformations.rotation_matrix(yaw, [0,1,0]))
    m.apply_translation(center)
    put(m,mat,group)


def tapered_box(mat, center, bottom_xz, top_xz, height, group='static', chamfer=0.15):
    cx,cy,cz = center
    def outline(x,z):
        X=x/2; Z=z/2; c=min(chamfer, X*.40, Z*.40)
        return np.array([[-X+c,-Z],[X-c,-Z],[X,-Z+c],[X,Z-c],
                         [X-c,Z],[-X+c,Z],[-X,Z-c],[-X,-Z+c]],dtype=float)
    bottom=outline(*bottom_xz); top=outline(*top_xz)
    verts=[]
    for y, ol in ((cy-height/2,bottom),(cy+height/2,top)):
        verts += [[cx+p[0],y,cz+p[1]] for p in ol]
    faces=[]
    # top and bottom triangulation
    for i in range(1,7):
        faces.append([8,8+i,8+i+1]);faces.append([0,i+1,i])
    for i in range(8):
        j=(i+1)%8
        faces.append([i,j,8+j]);faces.append([i,8+j,8+i])
    m=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    put(m,mat,group)


def cylinder(mat, center, radius, height, n=20, group='static', axis='y'):
    m=trimesh.creation.cylinder(radius=radius,height=height,sections=n)
    if axis=='y':
        m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]))
    elif axis=='x':
        m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]))
    m.apply_translation(center)
    put(m,mat,group)


def frustum(mat, center, r_bottom, r_top, height, n=24, group='static'):
    cx,cy,cz=center
    verts=[]
    for dy,r in [(-height/2,r_bottom),(height/2,r_top)]:
        for j in range(n):
            a=2*math.pi*j/n
            verts.append([cx+r*math.cos(a),cy+dy,cz+r*math.sin(a)])
    faces=[]
    for j in range(n):
        k=(j+1)%n
        faces.extend([[j,k,n+k],[j,n+k,n+j]])
    for j in range(1,n-1):
        faces.extend([[0,j+1,j],[n,n+j,n+j+1]])
    put(trimesh.Trimesh(vertices=verts,faces=faces,process=False),mat,group)


def ring(mat, center, ri, ro, h, n=48, group='static', start=0, end=2*math.pi):
    cx,cy,cz=center
    end = end if end > start else end + 2*math.pi
    full=(end-start)>=2*math.pi-1e-5
    steps=n
    angles=np.linspace(start,end,steps+1 if not full else steps)
    verts=[]
    for y,r in [(cy-h/2,ri),(cy-h/2,ro),(cy+h/2,ri),(cy+h/2,ro)]:
        for a in angles:
            verts.append([cx+r*math.cos(a),y,cz+r*math.sin(a)])
    N=len(angles); faces=[]
    edges=range(N) if full else range(N-1)
    for j in edges:
        k=(j+1)%N
        # inner, outer, bottom, top
        faces.extend([[j,2*N+j,2*N+k],[j,2*N+k,k]])
        faces.extend([[N+j,N+k,3*N+k],[N+j,3*N+k,3*N+j]])
        faces.extend([[j,k,N+k],[j,N+k,N+j]])
        faces.extend([[2*N+j,3*N+j,3*N+k],[2*N+j,3*N+k,2*N+k]])
    if not full:
        for j in (0,N-1):
            k=j
            faces.extend([[j,N+k,3*N+k],[j,3*N+k,2*N+j]])
    put(trimesh.Trimesh(vertices=verts,faces=faces,process=False),mat,group)


def beam(mat, p1, p2, rad, n=10, group='static'):
    p1=np.array(p1,float);p2=np.array(p2,float);v=p2-p1
    length=np.linalg.norm(v)
    if length<0.001:return
    transform=trimesh.geometry.align_vectors([0,0,1],v)
    m=trimesh.creation.cylinder(radius=rad,height=length,sections=n,transform=transform)
    m.apply_translation((p1+p2)*0.5)
    put(m,mat,group)


def rib(mat, p1, p2, w, d=0.11,group='static'):
    p1=np.array(p1,float);p2=np.array(p2,float)
    v=p2-p1
    L=np.linalg.norm(v)
    if not L:return
    # vertical center-to-center beam, rectangular section, for rigid girder
    m=trimesh.creation.box(extents=[w,L,d])
    m.apply_transform(trimesh.geometry.align_vectors([0,1,0],v))
    m.apply_translation((p1+p2)/2)
    put(m,mat,group)


def surface_line(mat, x0,z0,x1,z1,y=1.035,width=0.045,group='static'):
    # thin rectangular strip on the horizontal floor plane
    dx=x1-x0;dz=z1-z0
    length=math.hypot(dx,dz)
    if length<0.01:return
    mesh=trimesh.creation.box(extents=[width,0.018,length])
    mesh.apply_transform(trimesh.transformations.rotation_matrix(math.atan2(-dx,dz), [0,1,0]))
    mesh.apply_translation([(x0+x1)/2,y,(z0+z1)/2])
    put(mesh,mat,group)


def bolt(x,y,z,r=.095,mat='steel_light',group='static',n=6):
    cylinder(mat,(x,y,z),r,.064,n=n,group=group)


def fin(mat, theta, bottom_y, top_y, inner_radius, outer_radius, thickness=.10,group='rocket'):
    # swept wedge fin triangular profile in plane (radial, vertical)
    c,s=math.cos(theta),math.sin(theta)
    rx,rz=c,s
    tx,tz=-s,c
    coords=[(inner_radius,bottom_y),(outer_radius,bottom_y+.21),(inner_radius,top_y),(inner_radius+.08,top_y-.18)]
    verts=[]
    for side in [-1,1]:
        for r,y in coords:
            verts.append([rx*r + tx*side*thickness/2,y,rz*r + tz*side*thickness/2])
    faces=[]
    for f in ((0,1,2),(0,2,3),(4,6,5),(4,7,6)):
        faces.append(f)
    for j in range(4):
        k=(j+1)%4
        faces.extend([(j,k,k+4),(j,k+4,j+4)])
    put(trimesh.Trimesh(vertices=verts,faces=faces,process=False),mat,group)



# ============================================================================
# SANDFORGE — BARRACKS / KASERNE
# Forward is -Z, world Y-up, accessible origins, zero external image textures.
# Tactical silhouette: pitched roof, drill square, bright troop gate, watchtower.
# ============================================================================


def door_vent(x,y,z,w=1.0,h=.85, slats=5, group='static'):
    box('steel_dark',(x,y,z),(w+.11,h+.13,.12),group)
    box('recess',(x,y,z-.072),(w-.06,h-.04,.035),group)
    for i in range(slats):
        yy=y-h*.38+i*h*.76/max(slats-1,1)
        box('steel',(x,yy,z-.104),(w-.10,.047,.061),group)


def roof_panel(x0,x1,z0,z1,y0,y1,mat='olive_dark', thickness=.20,group='static'):
    """Wedge-shaped roof panel: y0 at x0, y1 at x1, extrusion along z."""
    vv=[[x0,y0-thickness,z0], [x1,y1-thickness,z0],
        [x1,y1-thickness,z1], [x0,y0-thickness,z1],
        [x0,y0,z0], [x1,y1,z0], [x1,y1,z1], [x0,y0,z1]]
    ff=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],
        [0,1,5],[0,5,4],[1,2,6],[1,6,5],
        [2,3,7],[2,7,6],[3,0,4],[3,4,7]]
    put(trimesh.Trimesh(vertices=vv, faces=ff,process=False),mat,group)


def roof_beam(p1,p2,mat='steel_dark', width=.12,group='static'):
    a,b=np.array(p1,dtype=float),np.array(p2,dtype=float)
    vec=b-a; ll=np.linalg.norm(vec)
    if ll<1e-5:return
    m=trimesh.creation.box(extents=[width,.07,ll])
    m.apply_transform(trimesh.geometry.align_vectors([0,0,1],vec))
    m.apply_translation((a+b)*.5)
    put(m,mat,group)


def windows_front(x,y,z, width=.80, height=.64):
    box('steel_dark',(x,y,z),(width+.18,height+.19,.15))
    box('glass_dark',(x,y,z-.083),(width,height,.055))
    box('glass',(x,y+.18,z-.115),(width-.08,.12,.035))
    box('steel',(x,y-height*.47,z-.12),(width+.20,.052,.14))
    box('steel',(x,y,z-.121),(.048,height+.14,.083))
    for bx in (-.30,.30):
        box('blue_glow',(x+bx,y-.22,z-.133),(.11,.045,.036))


def barracks_base():
    # Reinforced sand/stone perimeter on tactical 20.2 x 18.4 tile.
    tapered_box('foundation',(0,.26,0),(20.2,18.25),(19.64,17.73),.69,chamfer=1.04)
    tapered_box('concrete_high',(0,.67,0),(19.35,17.42),(18.95,17.02),.22,chamfer=.75)
    tapered_box('deck',(0,.91,0),(18.85,16.95),(18.58,16.72),.26,chamfer=.56)
    # Stenciled platform edge and double outer strips.
    for z in (-8.23,8.23):
        box('olive_dark',(0,1.065,z),(17.70,.22,.16))
    for x in (-9.14,9.14):
        box('olive_dark',(x,1.065,0),(.19,.22,15.85))
    for x in (-8.63,8.63):
        for z in (-7.66,7.66):
            tapered_box('concrete_high',(x,1.19,z),(1.36,1.29),(1.18,1.17),.28,chamfer=.20)
            box('steel_dark',(x,1.36,z),(1.04,.09,.90))
            for xx in (-.37,.37):
                for zz in (-.28,.28):
                    bolt(x+xx,1.421,z+zz,.047,'steel_light')
    # Individual sidewalk plates in front-left and right forecourt.
    for x in [-8.05,-6.70,-5.35,5.35,6.70,8.05]:
        for z in [-7.25,-6.00,-4.75]:
            box('deck_light',(x,1.065,z),(1.13,.055,1.05))
            for sx in [-.43,.43]:
                bolt(x+sx,1.106,z-.4,.041,'steel_dark')
    for x in (-3.95,3.95):
        surface_line('yellow',x,-7.55,x,-2.72,y=1.10,width=.10)
        for z in np.arange(-7.25,-2.78,.50):
            surface_line('steel_dark',x-.16,z-.12,x+.16,z+.16,y=1.119,width=.095)
    # Main personnel route, apron and ramp protruding from the fortress slab.
    tapered_box('foundation',(0,.46,-9.06),(5.65,2.10),(5.50,2.02),.38,chamfer=.28)
    box('deck_light',(0,.674,-9.05),(5.1,.038,1.79))
    for x in (-2.21,2.21):
        surface_line('yellow',x,-9.91,x,-8.36,y=.709,width=.10)
    for x in np.linspace(-1.7,1.7,11):
        surface_line('steel_dark',x-.15,-9.72,x+.15,-9.37,y=.709,width=.09)
    # Anti-slip threshold to gate, high contrast from tactical camera.
    for z in [-7.78,-7.48,-7.18,-6.88]:
        box('steel',(0,1.092,z),(3.7,.028,.052))
    for x in (-4.62,4.62):
        for z in (-7.49,7.49):
            cylinder('steel_dark',(x,1.30,z),.20,.44,n=10)
            cylinder('yellow',(x,1.56,z),.19,.10,n=10)
            cylinder('blue_glow',(x,1.665,z),.115,.13,n=10)


def barracks_center():
    # Full-size fortress with a steep paneled combat-ready roof, rearward on site.
    cx,cz=0,2.21
    tapered_box('foundation',(cx,1.34,cz),(10.14,7.80),(9.78,7.43),.52,chamfer=.48)
    tapered_box('olive_dark',(cx,3.14,cz),(9.56,7.28),(9.32,7.13),3.12,chamfer=.42)
    # Visually separate top parapet from wall; roof slopes rise to memorable ridge.
    box('olive_light',(cx,4.75,cz),(9.45,.19,7.28))
    for z in (-1.42,5.82):
        box('steel_dark',(0,4.76,z),(9.54,.24,.18))
    for x in (-4.71,4.71):
        box('steel_dark',(x,3.34,cz),(.24,3.17,7.18))
    # Main roof: 2 armored slopes with 8 individually outlined ridge-to-gutter panels.
    ridge=6.14; edge=4.90
    for left in (True,False):
        x_start,x_end=(-4.93,0) if left else (0,4.93)
        y_start,y_end=(edge,ridge) if left else (ridge,edge)
        roof_panel(x_start,x_end,-1.68,6.07,y_start,y_end,'olive_dark',.24)
        for z in np.arange(-1.35,6.08,1.16):
            a0=x_start;a1=x_end
            roof_beam((a0,y_start+.078,z),(a1,y_end+.078,z),'steel',.068)
        for i in range(1,4):
            x=x_start+(x_end-x_start)*i/4
            y=y_start+(y_end-y_start)*i/4
            roof_beam((x,y+.076,-1.54),(x,y+.076,5.90),'steel_dark',.060)
    box('steel_light',(0,ridge+.06,2.2),(.20,.17,7.90))
    for z in (-1.53,5.92):
        box('steel_dark',(0,ridge+.10,z),(.47,.23,.32))
    # Front armor façade, windows on both sides of troop deployment hall.
    for sign in (-1,1):
        for x in (sign*3.53,sign*4.31):
            box('steel_dark',(x,4.16,-1.52),(.54,.73,.13))
            box('glass',(x,4.16,-1.61),(.40,.54,.048))
        for x in (sign*2.75,sign*3.95):
            box('steel',(x,2.20,-1.58),(.20,1.58,.19))
        box('steel_dark',(sign*3.50,1.75,-1.66),(2.12,.18,.15))
    # roof-lined front entrance canopy, stands beyond the building shell.
    box('olive_dark',(0,3.92,-2.32),(5.35,.55,2.35))
    box('olive_light',(0,4.27,-2.25),(5.56,.18,2.54))
    box('steel_dark',(0,4.43,-3.41),(5.78,.22,.30))
    for x in (-2.53,2.53):
        tapered_box('olive_dark',(x,2.60,-3.17),(.66,.72),(.56,.58),2.94,chamfer=.11)
        box('steel_light',(x,4.15,-3.22),(.79,.17,.78))
        for y in [1.45,2.55,3.65]:
            box('steel',(x,y,-3.57),(.55,.105,.07))
    # Large trooper entrance tunnel: emissive inner gate and separate sliding doors.
    box('steel_dark',(0,2.54,-3.47),(4.31,2.60,.19))
    box('recess',(0,2.51,-3.59),(3.88,2.33,.045))
    box('deck_light',(0,1.19,-3.63),(3.95,.14,1.93))
    box('recess',(0,2.64,-3.612),(3.37,2.06,.035))
    box('blue_glow',(0,3.70,-3.65),(3.80,.10,.08))
    for x in (-2.03,2.03):
        box('steel_light',(x,2.59,-3.65),(.19,2.46,.24))
        box('yellow',(x,1.32,-3.72),(.16,.22,.13))
        box('blue_glow',(x,3.72,-3.72),(.23,.13,.15))
    # Interior corridor floor allows gate to look OPEN, not just blue façade.
    box('recess',(0,1.35,-3.74),(3.75,.08,.90))
    for x in [-1.32,-.66,0,.66,1.32]:
        surface_line('steel',x,-4.08,x,-3.40,y=1.408,width=.048)
    # Unit production direction chevrons down forecourt.
    for z in (-4.59,-5.23,-5.87):
        surface_line('yellow',-0.55,z,0,z-.36,y=1.10,width=.11)
        surface_line('yellow',0,z-.36,0.55,z,y=1.10,width=.11)
    # Status insignia over gate, emblem is from primitive mesh, readable at distance.
    box('steel_dark',(0,4.15,-3.61),(2.58,.50,.15))
    for dx in (-.48,0,.48):
        box('white',(dx,4.14,-3.715),(.28,.13,.08))
    for x in (-2.14,2.14):
        cylinder('steel_dark',(x,4.65,-3.36),.20,.28,n=12)
        cylinder('blue_glow',(x,4.84,-3.36),.16,.10,n=12)
    # Panelled side wall with cooling ducts / military utility grilles.
    for x in (-4.81,4.81):
        for z in (-.2,1.48,3.16,4.84):
            box('steel_dark',(x,3.01,z),(.12,1.38,1.14))
            for y in (2.57,2.83,3.09,3.35):
                box('steel',(x+np.sign(x)*.085,y,z),(.07,.08,.97))
    # Rooftop armored air-conditioning stacks and exhaust cover housings.
    for z in (1.50,3.65):
        for x in (-2.32,2.32):
            y=5.48
            box('steel_dark',(x,y,z),(1.12,.20,1.25))
            box('olive',(x,y+.16,z),(1.03,.12,1.14))
            for xx in (-.32,0,.32):
                box('steel_light',(x+xx,y+.24,z),(.13,.04,.76))
    for z in (1.09,4.22):
        cylinder('steel_dark',(0,6.33,z),.29,.45,n=12)
        cylinder('steel',(0,6.66,z),.25,.22,n=12)
        cylinder('recess',(0,6.79,z),.22,.04,n=12)


def dormitory_wing():
    # Right and left are distinct from main pitched high roof, but same materials.
    for side in (-1,1):
        x=side*6.60; z=1.76
        tapered_box('foundation',(x,1.35,z),(5.26,8.54),(5.03,8.25),.52,chamfer=.34)
        tapered_box('olive_dark',(x,2.78,z),(4.87,8.16),(4.73,7.94),2.56,chamfer=.30)
        tapered_box('olive',(x,4.10,z),(5.05,8.29),(5.12,8.32),.23,chamfer=.34)
        # Slightly raised flat roof with armor band / seam pattern.
        box('steel_dark',(x,4.32,z),(5.19,.18,8.39))
        box('olive_light',(x,4.47,z),(4.85,.13,8.03))
        for zz in np.arange(-1.95,5.51,1.33):
            box('steel_dark',(x,4.57,zz),(4.65,.07,.083))
        for xx in (x-2.16,x+2.16):
            box('steel_dark',(xx,4.56,z),(.13,.24,7.67))
        # Side-facing gallery windows, protected vertical slats.
        for zz in (-1.18,.45,2.08,3.71):
            for yy in (2.44,3.42):
                box('steel_dark',(x+side*2.39,yy,zz),(.19,.58,1.12))
                box('glass_dark',(x+side*2.49,yy,zz),(.045,.41,.86))
                box('steel',(x+side*2.53,yy,zz),(.052,.44,.08))
        # Front face facing player, two windows, distinct gate for armory side.
        if side<0:
            for xx in (x-1.26,x+.12,x+1.45):
                windows_front(xx,3.00,-2.40,.82,.65)
            # side wing dormitory door.
            box('steel_dark',(x,1.96,-2.44),(1.65,1.25,.21))
            box('olive_light',(x,1.96,-2.58),(1.33,1.03,.055))
            box('steel',(x,1.96,-2.61),(.09,1.08,.08))
            box('blue_glow',(x-.57,2.44,-2.65),(.10,.20,.05))
            # Roof barracks ventilation vents / ducts.
            for zz in (-.85,1.12,3.05):
                box('steel_dark',(x,4.76,zz),(1.24,.55,1.33))
                box('steel_light',(x,5.07,zz),(1.36,.11,1.44))
                for dx in np.linspace(-.45,.45,5):
                    box('recess',(x+dx,5.139,zz),(.09,.022,.9))
        else:
            # Right side is weapons/gear armory wing with segmented locker doors.
            box('steel_dark',(x,2.51,-2.44),(3.72,2.16,.18))
            box('olive_light',(x,2.51,-2.55),(3.41,1.89,.068))
            for xx in np.linspace(x-1.60,x+1.60,9):
                box('steel_dark',(xx,2.53,-2.61),(.058,1.80,.067))
            box('yellow',(x,1.49,-2.63),(3.74,.12,.10))
            for xx in (x-1.79,x+1.79):
                box('blue_glow',(xx,3.40,-2.62),(.11,.16,.065))
            # Three robust roof turbine outlets.
            for zz in (-.76,1.42,3.60):
                cylinder('steel_dark',(x,4.92,zz),.75,.71,n=16)
                ring('steel_light',(x,5.27,zz),.60,.78,.10,n=16)
                cylinder('recess',(x,5.33,zz),.56,.05,n=16)
                for a in np.arange(0,math.pi*2,math.pi/5):
                    beam('steel',(x,5.38,zz),(x+.53*math.cos(a),5.38,zz+.53*math.sin(a)),.06,n=6)
        # Wall plates and tie rods for each wing.
        for xx in (x-1.94,x+1.94):
            box('steel',(xx,3.93,-2.48),(.16,.33,.13))
        for zz in (-1.71,-.61,.51,1.61,2.73,3.85,4.97):
            box('olive_light',(x+side*2.30,1.73,zz),(.23,.44,.18))
        for xx in (x-1.87,x+1.87):
            for zz in (-1.80,5.40):
                bolt(xx,4.60,zz,.057,'steel_light')


def training_yard(active=True):
    # Sandbag walls, actual firing range marker, ground-level soldier staging details.
    # Front left: obstacle/drill course within southern paved apron.
    for x in (-7.99,-7.34,-6.69,-6.04):
        for z in (-5.02,-5.91):
            # Distinct duffel/kit sacks with strap atop.
            tapered_box('dust',(x,1.24,z),(.58,.33),(.54,.28),.19,chamfer=.075)
            box('steel_dark',(x,1.35,z),(.09,.044,.31))
    for x in (-8.10,-7.23,-6.36,-5.49):
        box('olive_dark',(x,1.57,-3.93),(.73,.75,.20))
        box('steel_light',(x,1.80,-4.04),(.45,.30,.048))
        box('recess',(x,1.85,-4.083),(.11,.12,.024))
        # rifle range tripod rails
        for dx in (-.20,.20):
            beam('steel_dark',(x+dx,1.11,-4.00),(x+dx,1.32,-4.00),.035,n=6)
    # Front right: armory crates, supply lockers, visible equipment racks.
    for x,z,s in [(5.20,-5.10,.82),(6.45,-5.17,.93),(7.72,-5.14,.72),
                  (5.51,-6.51,.65),(7.25,-6.54,.84)]:
        box('olive_dark',(x,1.43,z),(s,.57,s*.75))
        box('olive_light',(x,1.73,z),(s+.06,.09,s*.78))
        for xx in (x-s*.40,x+s*.40):
            box('steel_dark',(xx,1.49,z),(.055,.63,s*.78))
        box('steel',(x,1.44,z-s*.387),(.25,.11,.06))
    # Vertical field antenna and little tactical terminal.
    x,z=7.95,-3.75
    box('steel_dark',(x,1.32,z),(.82,.48,.64))
    box('olive',(x,1.70,z),(.89,.33,.74))
    box('glass_dark',(x,1.71,z-.412),(.58,.18,.062))
    if active: box('blue_glow',(x,1.77,z-.458),(.34,.055,.03))
    # Front platform soldier deployment signage, horizontal LED gate lanes.
    for x in (-3.25,3.25):
        box('steel_dark',(x,1.52,-6.22),(.37,.93,.34))
        box('olive',(x,2.04,-6.22),(.51,.19,.43))
        box('blue_glow' if active else 'steel_dark',(x,2.15,-6.43),(.23,.075,.07))
    # Service-access colored caution at main gate.
    for x in np.arange(-1.88,1.89,.40):
        box('yellow' if int((x+2.0)*10)%2 else 'steel_dark',(x,1.12,-4.37),(.20,.022,.38),yaw=.40)


def tower_and_security(active=True):
    # Prominent four-legged watchtower in back-left corner with elevated glass room.
    x,z=-7.65,5.93
    for dx in (-.78,.78):
        for dz in (-.70,.70):
            beam('steel_dark',(x+dx,1.17,z+dz),(x+dx*.70,6.15,z+dz*.70),.12,n=8)
    for yy in (2.25,3.40,4.55,5.70):
        for side in (-1,1):
            beam('steel',(x-.78,yy-.40,z+side*.70),(x+.78,yy+.41,z+side*.70),.066,n=6)
            beam('steel',(x-.78,yy+.41,z+side*.70),(x+.78,yy-.40,z+side*.70),.066,n=6)
        box('olive_dark',(x,yy,z),(1.72,.10,1.55))
    tapered_box('steel_dark',(x,6.12,z),(2.38,2.30),(2.31,2.21),.27,chamfer=.16)
    box('olive_dark',(x,6.79,z),(2.13,1.12,2.06))
    for side in (-1,1):
        box('glass_dark',(x+side*1.075,6.92,z),(.082,.55,1.53))
        box('steel',(x+side*1.115,6.91,z),(.07,.52,.095))
    for zz in (-1.03,1.03):
        box('glass_dark',(x,6.92,z+zz),(1.57,.58,.10))
        for xx in (-.48,.48):
            box('steel',(x+xx,6.91,z+zz*1.04),(.075,.66,.076))
    tapered_box('olive',(x,7.50,z),(2.75,2.65),(2.65,2.57),.31,chamfer=.22)
    box('steel_dark',(x,7.68,z),(2.63,.11,2.53))
    # comms antenna on roof + flashing warning beacon.
    cylinder('steel_dark',(x,8.18,z),.12,.87,n=10)
    cylinder('steel_light',(x,8.77,z),.055,.37,n=8)
    cylinder('blue_glow' if active else 'red_glow',(x,8.99,z),.13,.13,n=10)
    for yy in (8.27,8.57):
        beam('steel',(x-.39,yy,z),(x+.39,yy,z),.035,n=8)
    # Searchlight aimed towards training courtyard from tower front.
    box('steel_dark',(x,7.24,z-1.25),(.43,.35,.64))
    cylinder('steel_light',(x,7.27,z-1.64),.24,.29,n=12,axis='z')
    cylinder('ice' if active else 'steel_dark',(x,7.27,z-1.82),.16,.040,n=12,axis='z')
    # Right rear antenna / signal mast.
    x2,z2=8.02,6.04
    box('olive_dark',(x2,4.47,z2),(1.01,.20,.98))
    cylinder('steel_dark',(x2,5.07,z2),.14,1.26,n=10)
    cylinder('steel',(x2,6.03,z2),.066,.86,n=10)
    cylinder('red_glow',(x2,6.56,z2),.11,.13,n=10)
    for zz in (-.31,.31):
        beam('steel_dark',(x2,4.53,z2+zz),(x2,5.71,z2),.05,n=6)
    # Team-blue rally flag with separate, user-recolorable material and pivot.
    flagx,flagz=3.62,6.30
    cylinder('steel_dark',(flagx,5.40,flagz),.08,3.05,n=10)
    cylinder('steel_light',(flagx,6.99,flagz),.15,.16,n=12)
    box('steel',(flagx,6.55,flagz),(.16,.14,.16))
    # Cloth back and front triangles wind across X, 1.47w x 0.86h.
    flag_vertices=[[flagx+.03,6.75,flagz],[flagx+1.55,6.61,flagz-.08],
                   [flagx+1.36,6.22,flagz-.18],[flagx+.03,5.96,flagz],
                   [flagx+.03,6.75,flagz+.025],[flagx+1.55,6.61,flagz-.055],
                   [flagx+1.36,6.22,flagz-.155],[flagx+.03,5.96,flagz+.025]]
    flag_faces=[[0,1,2],[0,2,3],[4,6,5],[4,7,6]]
    put(trimesh.Trimesh(vertices=flag_vertices,faces=flag_faces,process=False),'team_blue',group='TEAM_FLAG')
    # White diagonal trim near mast for instantly readable flag silhouette.
    for q in range(3):
        xq=flagx+.34+q*.29
        yq=6.37-q*.06
        beam('white',(xq,yq-.07,flagz-.091),(xq+.17,yq+.055,flagz-.09),.026,n=5,group='TEAM_FLAG')


def gate_slabs(active=True):
    # Sliding gate geometry is intentionally separate in scene nodes, for animation.
    # Active state = sliding panels retracted sideways, inactive = fully closed.
    for side, group in [(-1,'GATE_LEFT'),(1,'GATE_RIGHT')]:
        cx=side*(2.04 if active else .94)
        z=-3.725
        box('olive_light',(cx,2.50,z),(1.72,2.25,.14),group)
        box('steel_dark',(cx,2.48,z-.093),(1.61,2.12,.075),group)
        for dx in np.linspace(-.69,.69,6):
            box('steel',(cx+dx,2.50,z-.146),(.06,2.01,.068),group)
        for yy in (1.47,2.24,3.08,3.52):
            box('olive',(cx,yy,z-.151),(1.73,.095,.07),group)
        box('yellow',(cx,1.43,z-.175),(1.73,.12,.086),group)
        for xx in (cx-.66,cx+.66):
            box('steel_light',(xx,2.52,z-.178),(.11,1.96,.04),group)
        # Express hinges and stop pads, material batching still maintained.
        for yy in (1.61,2.84,3.46):
            cylinder('steel_light',(cx,yy,z-.205),.055,.042,n=8,axis='z',group=group)


def make_model(active=True):
    parts.clear()
    barracks_base()
    barracks_center()
    dormitory_wing()
    training_yard(active)
    tower_and_security(active)
    gate_slabs(active)
    scene=trimesh.Scene()
    pivots={'GATE_LEFT':(-.94,2.50,-3.725),
            'GATE_RIGHT':(.94,2.50,-3.725),
            'TEAM_FLAG':(3.62,6.35,6.30)}
    for group,center in pivots.items():
        scene.graph.update(frame_to=group+'_PIVOT',frame_from='world',matrix=trimesh.transformations.translation_matrix(center))
    for (group,mat),meshes in sorted(parts.items()):
        merged=trimesh.util.concatenate(meshes)
        merged.visual=trimesh.visual.TextureVisuals(material=materials[mat])
        if group in pivots:
            merged.apply_translation(-np.array(pivots[group]))
        scene.add_geometry(merged,
                           geom_name=f'{group}__{mat}',
                           node_name=f'{group}__{mat}',
                           parent_node_name=group+'_PIVOT' if group in pivots else 'world')
    fname='sandforge_kaserne_' + ('betriebsbereit' if active else 'geschlossen') + '.glb'
    path=OUT/fname
    path.write_bytes(trimesh.exchange.gltf.export_glb(scene))
    print('SAVED:',path,round(path.stat().st_size/1024),'KB',
          sum(len(m.faces) for m in scene.geometry.values()),'triangles',
          len(scene.geometry),'meshes',np.round(scene.bounds,2),flush=True)
    return scene,path


if __name__=='__main__':
    make_model(True)
    make_model(False)