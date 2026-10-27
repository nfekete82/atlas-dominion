"""Original, reference-inspired Leopard-style fictional Atlas Dominion MBT.
Generates two team variants as self-contained glTF 2.0 GLB files.
Coordinates: +Y up, +Z vehicle nose; independent named turret and gun pivots.
"""
from pathlib import Path
import math, random, os, numpy as np, trimesh
from trimesh.visual.material import PBRMaterial

OUT = Path(os.environ.get('ATLAS_TANK_OUT', '/mnt/data'))
PALETTE = {
 'tan':'#a8976e', 'tan_light':'#c6b28a','sand':'#b6a47b','olive':'#485342',
 'olive_dark':'#343f34','green':'#59694a','brown':'#6e4b3d',
 'rust':'#745240','rubber':'#1f2220','track':'#292b28','steel':'#3f4541',
 'metal':'#7e8278','dark':'#1c2726','glass':'#243e3b','lamp':'#e0d1a4',
 'wire':'#2a2f2c','bolt':'#b8a681', 'blue':'#1c60df','red':'#da2633',
 'flag_edge':'#e3dcbf'
}

def rgba(hex, a=255):
 h=hex.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]+[a]

class Tank:
 def __init__(self, team):
  self.scene=trimesh.Scene(); self.team=team; self.n=0
  self.materials={k:PBRMaterial(name=k,baseColorFactor=rgba(v), metallicFactor=.12 if k not in ('track','metal','steel') else .45, roughnessFactor=.84, doubleSided=(k in ('blue','red','flag_edge'))) for k,v in PALETTE.items()}
  self.scene.graph.update(frame_from='world',frame_to='Hull',matrix=np.eye(4))
  self.scene.graph.update(frame_from='world',frame_to='Tank_Turret',matrix=np.eye(4))
  self.scene.graph.update(frame_from='world',frame_to='Tank_Gun',matrix=np.eye(4))
  self.rng=random.Random(22)
 def add(self, mesh, name, mat, parent='Hull'):
  mesh.visual=trimesh.visual.TextureVisuals(material=self.materials[mat]);self.n+=1
  self.scene.add_geometry(mesh,geom_name=f'{name}_{self.n}',node_name=f'{name}_{self.n}',parent_node_name=parent)
 def cube(self,name,xyz,size,mat,parent='Hull',rz=0):
  m=trimesh.creation.box(extents=size)
  if rz:
   m.apply_transform(trimesh.transformations.rotation_matrix(rz,[1,0,0]))
  m.apply_translation(xyz);self.add(m,name,mat,parent)
 def cyl(self,name,start,end,r,mat,parent='Hull',sections=14,r2=None):
  p,q=np.array(start),np.array(end);vec=q-p;h=np.linalg.norm(vec)
  if r2 is None or r2==r:
   m=trimesh.creation.cylinder(radius=r,height=h,sections=sections)
  else:
   m=trimesh.creation.cone(radius=max(r,r2),height=h,sections=sections) # fallback tapered
  m.apply_transform(trimesh.geometry.align_vectors([0,0,1],vec/h));m.apply_translation((p+q)/2)
  self.add(m,name,mat,parent)
 def polygon_prism(self,name,bottom,top,mat,parent='Hull'):
  # Corresponding (x,y,z) vertices, n-sided planar rings
  n=len(bottom); verts=np.array(bottom+top,float);faces=[]
  for i in range(1,n-1):faces.append((0,i+1,i));faces.append((n,n+i,n+i+1))
  for i in range(n):
   j=(i+1)%n;faces.append((i,j,n+j));faces.append((i,n+j,n+i))
  m=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
  self.add(m,name,mat,parent)
 def segment(self,name,p0,p1,width,height,mat,parent='Hull'):
  a=np.array(p0,float);b=np.array(p1,float);d=b-a;length=np.linalg.norm(d);m=trimesh.creation.box(extents=(width,height,length))
  m.apply_transform(trimesh.geometry.align_vectors([0,0,1],d/length));m.apply_translation((a+b)*.5);self.add(m,name,mat,parent)
 def plates(self,teamcolor):
  # broad hull profile: lower armored hull, sloped upper glacis toward +Z
  lower=[(-1.05,.57,-2.07),(-1.08,.57,1.72),(-.83,.57,2.23),(.83,.57,2.23),(1.08,.57,1.72),(1.05,.57,-2.07)]
  upper=[(-1.02,1.13,-1.90),(-1.02,1.21,1.12),(-.79,.91,2.23),(.79,.91,2.23),(1.02,1.21,1.12),(1.02,1.13,-1.90)]
  self.polygon_prism('SlopedArmoredHull',lower,upper,'tan')
  self.cube('RearEngineDeck',(0,1.18,-1.43),(1.99,.14,1.33),'olive')
  self.cube('UpperSidePanelLeft',(-1.10,1.11,-.30),(.13,.28,3.35),'tan')
  self.cube('UpperSidePanelRight',(1.10,1.11,-.30),(.13,.28,3.35),'tan')
  # sloped nose camo shards
  for i,(x,z,w,l,c) in enumerate([(-.62,1.50,.60,.63,'brown'),(.40,1.53,.73,.42,'olive'),(-.18,2.02,.63,.23,'olive_dark'),(.70,.82,.37,.74,'green'),(-.6,.49,.43,.53,'brown')]):
   self.cube('HullCamoPatch',(x,1.235 if z<1.3 else 1.103,z),(w,.012,l),c)
  for x in [-1,1]:
   # fenders and segmented armoured skirts
   self.cube('Mudguard',(x*1.31,1.065,.06),(.52,.11,4.6),'tan')
   for i in range(6):
    z=-1.75+i*.69
    colors=['tan','olive','brown','tan','green','olive']
    self.cube('SideSkirt',(x*1.26,.91,z),(.13,.42,.63),colors[(i+(0 if x<0 else 3))%6])
    self.cube('SideSkirtSeam',(x*1.33,.87,z+.32),(.022,.37,.012),'dark')
   for i in range(5):
    z=-1.48+i*.72
    self.cube('SideArmorMount',(x*1.34,1.06,z),(.04,.06,.10),'metal')
  # engine louvers
  for i in range(13):
   z=-1.93+i*.075
   self.cube('EngineLouver',(0,1.272,z),(1.27,.018,.029),'dark')
  for x in [-.88,.88]:
   self.cube('EngineDeckGrabRail',(x,1.31,-1.43),(.04,.045,1.1),'steel')
   self.cube('FrontHeadlightGuard',(x,.98,2.125),(.27,.20,.11),'dark')
   self.cube('FrontHeadlight',(x,1.005,2.193),(.19,.13,.017),'lamp')
   self.cube('FrontTowHook',(x*.85,.53,2.25),(.13,.12,.15),'steel')
  self.cube('NoseLowerLip',(0,.64,2.30),(1.47,.11,.12),'dark')
  self.cube('RearTowPlate',(0,.66,-2.12),(1.71,.20,.11),'steel')
  # seven road wheels per side, sprockets, track links
  for side in (-1,1):
   x=side*1.21
   self.cube('TrackVoid',(x,.50,0),(.49,.56,4.15),'rubber')
   for i in range(7):
    z=-1.66+i*.55
    self.cyl('RoadWheelTire',(x-side*.16,.47,z),(x+side*.16,.47,z),.28,'rubber',sections=18)
    self.cyl('RoadWheelHub',(x+side*.19,.47,z),(x+side*.23,.47,z),.204,'tan',sections=18)
    self.cyl('WheelCentre',(x+side*.236,.47,z),(x+side*.253,.47,z),.067,'steel',sections=12)
    for j in range(6):
     a=j*math.tau/6
     self.cyl('WheelBolt',(x+side*.253,.47+.136*math.sin(a),z+.136*math.cos(a)),(x+side*.263,.47+.136*math.sin(a),z+.136*math.cos(a)),.013,'bolt',sections=7)
   for z in (-1.96,1.96):
    self.cyl('TrackEndSprocket',(x-side*.15,.51,z),(x+side*.18,.51,z),.337,'steel',sections=16)
    self.cyl('TrackSprocketRim',(x+side*.18,.51,z),(x+side*.21,.51,z),.23,'dark',sections=16)
   # individual tracked tread plates: top, bottom, two rounded ends
   positions=[]
   for i in range(18):positions.append((-1.96+3.92*(i+.5)/18,.883,0.0))
   for i in range(7):
    a=-math.pi/2+math.pi*(i+.5)/7
    positions.append((1.96+.365*math.cos(a),.513+.365*math.sin(a),a+math.pi/2))
   for i in range(18):positions.append((1.96-3.92*(i+.5)/18,.145,0.0))
   for i in range(7):
    a=math.pi/2+math.pi*(i+.5)/7
    positions.append((-1.96+.365*math.cos(a),.513+.365*math.sin(a),a+math.pi/2))
   for i,(z,y,angle) in enumerate(positions):
    self.cube('TrackTread',(x,y,z),(.44,.10,.20),'track',rz=angle)
    if i%2==0 and abs(angle)<.01:
     self.cube('TrackGrip',(x,y+.058,z),(.37,.012,.115),'steel')
  # turret composite wedge, 12 sided outline, front +Z
  outline=[(-.73,-1.18),(-1.08,-.80),(-1.16,-.22),(-1.07,.38),(-.78,.99),(-.36,1.27),(.36,1.27),(.78,.99),(1.07,.38),(1.16,-.22),(1.08,-.80),(.73,-1.18)]
  bottom=[(x,1.39,z-.24) for x,z in outline]
  top=[(x*.90,2.09,z-.24) for x,z in outline]
  self.cyl('TurretRotationRing',(0,1.25,-.23),(0,1.42,-.23),.69,'dark',sections=28)
  self.polygon_prism('WedgeTurret',bottom,top,'tan','Tank_Turret')
  self.cube('TurretTopArmor',(0,2.095,-.27),(1.58,.08,1.46),'olive','Tank_Turret')
  for side in [-1,1]:
   x=side
   # chamfered add-on armour blocks front
   self.cube('ForwardCheekArmor',(x*.81,1.77,.56),(.52,.46,.73),'tan','Tank_Turret')
   self.cube('CamoTurretSide',(x*.983,1.82,-.26),(.045,.39,.84),'olive' if side>0 else 'brown','Tank_Turret')
   self.cube('TurretCompositeSeam',(x*1.02,1.90,.28),(.04,.30,.018),'dark','Tank_Turret')
   self.cube('CheekLayer',(x*.74,1.81,1.03),(.36,.28,.15),'olive' if side<0 else 'brown','Tank_Turret')
   # smoke grenades forward outside turret edges
   for i in range(4):
    zz=.46-(i//2)*.19;yy=1.96-(i%2)*.15
    self.cyl('SmokeDischarger',(x*1.16,yy,zz),(x*1.25,yy+.08,zz+.25),.053,'steel','Tank_Turret',sections=9)
  self.cube('TurretRearBasket', (0,1.73,-1.62),(1.78,.09,.55),'steel','Tank_Turret')
  for x in [-.76,.76]:self.cube('TurretBasketRail',(x,1.96,-1.62),(.028,.38,.58),'steel','Tank_Turret')
  self.cube('TurretRearTopRail',(0,2.14,-1.87),(1.58,.035,.04),'steel','Tank_Turret')
  for i in range(6): self.cube('BasketMeshRail',(-.65+i*.26,1.77,-1.83),(.022,.23,.027),'dark','Tank_Turret')
  # two cupolas, optics and machine gun
  for x,z,r in [(-.46,-.40,.245),(.46,-.25,.185)]:
   self.cyl('HatchRim',(x,2.14,z),(x,2.23,z),r,'dark','Tank_Turret',sections=20)
   self.cyl('HatchPlate',(x,2.23,z),(x,2.27,z),r*.84,'tan','Tank_Turret',sections=20)
   for j in range(5):
    a=j*math.tau/5
    self.cube('Periscope',(x+math.sin(a)*r*.75,2.20,z+math.cos(a)*r*.75),(.072,.07,.055),'glass','Tank_Turret')
  self.cube('GunnerSight',(0.30,2.23,.60),(.23,.19,.29),'dark','Tank_Turret')
  self.cube('GunnerGlass',(.30,2.23,.762),(.15,.12,.020),'glass','Tank_Turret')
  self.cyl('MachineGunMount',(-.45,2.24,-.41),(-.45,2.50,-.41),.055,'steel','Tank_Turret')
  self.cube('RoofMachineGun',(-.45,2.52,-.25),(.13,.14,.45),'steel','Tank_Turret')
  self.cyl('MGbarrel',(-.45,2.52,-.01),(-.45,2.52,.55),.034,'dark','Tank_Turret',sections=10)
  # comms antennas
  self.cyl('RadioAntenna',(.77,2.15,-1.10),(.85,2.70,-1.25),.012,'wire','Tank_Turret',sections=8)
  # articulated gun (separate parent for atlas turret/barrel compositing)
  self.cube('GunMantlet',(0,1.74,1.01),(.60,.52,.43),'steel','Tank_Gun')
  self.cube('GunMantletCeramic',(0,1.75,1.21),(.49,.36,.24),'tan','Tank_Gun')
  for z0,z1,r,mat in [(1.27,1.60,.190,'tan'),(1.60,2.22,.140,'steel'),(2.22,2.95,.118,'tan'),(2.95,4.35,.112,'tan'),(4.35,4.47,.135,'olive')]:
   self.cyl('MainCannon',(0,1.76,z0),(0,1.76,z1),r,mat,'Tank_Gun',sections=20)
  for z in [1.57,2.21,2.92,4.33]:self.cyl('GunBand',(0,1.76,z-.035),(0,1.76,z+.035),.15,'olive_dark','Tank_Gun',sections=20)
  self.cyl('MuzzleOpening',(0,1.76,4.466),(0,1.76,4.481),.091,'dark','Tank_Gun',sections=18)
  # patchy woodland camouflage on cannon housing top and turret top
  for x,y,z,s,c in [(-.42,2.145,.22,(.33,.022,.42),'brown'),(.52,2.145,-.31,(.31,.021,.64),'brown'),(-.26,2.145,-.56,(.23,.02,.36),'tan_light'),(.11,2.145,.42,(.25,.02,.32),'green'),(-.67,2.15,-.15,(.15,.018,.24),'tan')]:
   self.cube('TurretCamouflage', (x,y,z),s,c,'Tank_Turret')
  # clear faction pennant, placed behind main optic so never intersects gun
  flag='blue' if self.team==0 else 'red'
  self.cyl('FlagPole',(.63,2.13,-.92),(.63,2.91,-.92),.022,'metal','Tank_Turret',sections=10)
  # waving pennant: triangulated 3D flag with folds, slight taper at trailing edge
  verts=[(.64,2.86,-.91),(.64,2.86,-1.28),(.69,2.76,-1.32),(.65,2.64,-1.29),(.64,2.64,-.91),(.645,2.76,-.91)]
  faces=[(0,1,5),(1,2,5),(2,3,5),(3,4,5)]
  vm=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
  self.add(vm,'FactionFlagCloth',flag,'Tank_Turret')
  self.cube('FlagClothHem',(.646,2.75,-1.304),(.018,.23,.015),'flag_edge','Tank_Turret')
 def build(self):
  self.plates('blue' if self.team==0 else 'red')
  # Keep minimal top-level metadata for offline import.
  self.scene.metadata={'asset':'Atlas Dominion Leopard-style MBT', 'team':self.team,'license':'original procedural geometry','front':'+Z','up':'+Y','pivotNames':['Tank_Turret','Tank_Gun']}
  return self.scene

def main():
 OUT.mkdir(parents=True, exist_ok=True)
 for team,name in [(0,'tank-0.glb'),(1,'tank-1.glb')]:
  t=Tank(team);scene=t.build()
  out=OUT/name;scene.export(out)
  check=trimesh.load(out,force='scene');print(name, out.stat().st_size, 'meshes',len(check.geometry),'bbox',np.round(check.bounds,2),'nodes',t.n)
  assert any('FactionFlagCloth' in g for g in check.geometry)
  assert all(np.isfinite(check.bounds.flatten()))

if __name__=='__main__':main()
