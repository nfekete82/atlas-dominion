#!/usr/bin/env python3
"""Original Sandforge field-command HQ. Uses the new barracks architectural
language as a base, but adds its own command deck, comms tower and radar.
Deterministic glTF 2.0 Binary: all geometry and PBR paint self-contained.
The -Z side faces the player (entrance). Gameplay footprint is unchanged.
"""
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'src/assets/reborn/buildings-3d'
BASE=ASSETS/'sandforge_kaserne_betriebsbereit.glb'
OUTPUT=ASSETS/'sandforge_feldkommando.glb'
COLORS={
 'olive':'#6f755d','olive_dark':'#474d43','olive_light':'#ab9872',
 'concrete_high':'#d4c2a2','foundation':'#b7a181','deck':'#474d43',
 'steel':'#6f755d','steel_dark':'#2f342f','steel_light':'#b4ab95',
 'blue_glow':'#338ab2','white':'#d4c2a2'
}
def rgba(s):
 return [int(s[i:i+2],16) for i in (1,3,5)]+[255]
MATERIALS={
 key:PBRMaterial(name='SF_'+key,baseColorFactor=np.array(rgba(value),dtype=np.uint8),
  metallicFactor=.06 if key in {'foundation','white','concrete_high'} else .20,
  roughnessFactor=.86)
 for key,value in COLORS.items()
}
def matmesh(scene,mesh,paint,name,group=None):
 mesh.visual=trimesh.visual.TextureVisuals(material=MATERIALS[paint])
 if group:
  pivot=np.array([ -5.8,13.7,3.8])
  mesh.apply_translation(-pivot)
 scene.add_geometry(mesh,geom_name=name,node_name=name,
  parent_node_name=group if group else 'world')
def box(scene,name,paint,center,size,group=None):
 mesh=trimesh.creation.box(extents=size)
 mesh.apply_translation(center)
 matmesh(scene,mesh,paint,name,group)
def pole(scene,name,paint,center,radius,height,sections=12,group=None):
 mesh=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
 mesh.apply_translation(center)
 matmesh(scene,mesh,paint,name,group)
def beam(scene,name,paint,a,b,radius=.04,group=None):
 a=np.asarray(a,float);b=np.asarray(b,float)
 direction=b-a
 m=trimesh.creation.cylinder(radius=radius,height=np.linalg.norm(direction),sections=8)
 m.apply_transform(trimesh.geometry.align_vectors([0,0,1],direction))
 m.apply_translation((a+b)*.5)
 matmesh(scene,m,paint,name,group)
def build():
 if not BASE.is_file():raise FileNotFoundError('Generate the Kaserne GLBs first: '+str(BASE))
 scene=trimesh.load(BASE,force='scene')
 # A larger HQ plinth visually distinguishes it from the smaller barracks.
 box(scene,'HQ_ExpandedFoundation','foundation',(0,-.26,0),(24,.40,23))
 box(scene,'HQ_ArmouredFrontApron','concrete_high',(0,.03,-8.65),(18,.20,4.3))
 for i,x in enumerate([-10.5,10.5]):
  box(scene,f'HQ_PlatformCorner_{i}','steel_dark',(x,.23,-10.0),(2.1,.6,2.1))
 # Operations room above the original roof, with compact, stacked armour.
 box(scene,'HQ_OperationsDeck','olive_dark',(0,7.45,-.3),(10.5,3.35,7.0))
 box(scene,'HQ_OperationsRoof','steel_dark',(0,9.31,-.3),(11.5,.52,7.8))
 for i,x in enumerate([-3.5,-1.15,1.15,3.5]):
  box(scene,f'HQ_CommandWindow_{i}','steel',(x,7.54,-3.85),(1.8,1.36,.12))
  box(scene,f'HQ_CommandGlazing_{i}','blue_glow',(x,7.54,-3.94),(1.45,1.10,.065))
 for i,z in enumerate([-2.6,1.2]):
  box(scene,f'HQ_CommandRoofRib_{i}','steel_light',(0,9.63,z),(10,.25,.38))
 # A substantial independent C2/communications tower behind the command deck.
 box(scene,'HQ_RadarShaft','steel_dark',(-5.8,10.4,3.8),(3.0,8.0,3.1))
 box(scene,'HQ_CommandTowerCab','olive_dark',(-5.8,14.55,3.8),(5.2,2.3,5.0))
 box(scene,'HQ_CommandTowerRoof','steel_dark',(-5.8,15.89,3.8),(5.7,.46,5.4))
 for i,d in enumerate([-1.6,1.6]):
  box(scene,f'HQ_TowerWindow_{i}','blue_glow',(-5.8+d,14.6,1.25),(1.25,.9,.1))
 for i,d in enumerate([-1.3,1.3]):
  box(scene,f'HQ_TowerSideWindow_{i}','blue_glow',(-8.48,14.6,3.8+d),(.1,.85,1.1))
 pole(scene,'HQ_CommsAntenna','steel_dark',(-5.8,18.1,3.8),.095,4.6)
 pole(scene,'HQ_Beacon','blue_glow',(-5.8,20.44,3.8),.26,.32)
 # Roof communications module and directional tracking radar.
 pivot=np.array([-5.8,13.7,3.8])
 scene.graph.update(frame_to='HQ_RADAR_PIVOT',frame_from='world',
  matrix=trimesh.transformations.translation_matrix(pivot))
 pole(scene,'HQ_RadarBearing','steel',(-5.8,13.8,3.8),.52,.9,group='HQ_RADAR_PIVOT')
 plate=trimesh.creation.annulus(r_min=.15,r_max=2.75,height=.12,sections=32)
 plate.apply_transform(trimesh.transformations.rotation_matrix(.6,[1,0,0]))
 plate.apply_translation([-5.8,14.4,3.8])
 matmesh(scene,plate,'steel_light','HQ_RadarReflector',group='HQ_RADAR_PIVOT')
 beam(scene,'HQ_RadarFeedStrut','steel_dark',[-5.8,14.5,3.7],[-5.8,16.15,3.0],.055,
  group='HQ_RADAR_PIVOT')
 pole(scene,'HQ_RadarTransceiver','blue_glow',(-5.8,16.2,3),.17,.45,
  group='HQ_RADAR_PIVOT')
 # Visible secondary signal arrays; separate from troop-production hardware.
 for i,x in enumerate([3.8,5.0,6.2]):
  pole(scene,f'HQ_CommRelay_{i}','steel', (x,8.0,4.8),.11,3.0+i*.65)
  box(scene,f'HQ_RelayHead_{i}','olive_light',(x,9.6+i*.33,4.8),(.7,.35,.7))
 OUTPUT.write_bytes(trimesh.exchange.gltf.export_glb(scene))
 print('Created',OUTPUT,OUTPUT.stat().st_size,'bytes, bounds',scene.bounds.tolist())
 if OUTPUT.stat().st_size<100_000:raise RuntimeError('GLB export unexpectedly small')
if __name__=='__main__':
 build()
