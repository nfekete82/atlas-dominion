import * as T from 'three';
import {kit,rootModel,quaternionTrack} from './stylized-kit.mjs';

// Original Feldkommando in the exact same Sandforge Stylized v1 design system.
// Metres / ground pivot / +Z personnel entrance; no external textures.
export function buildHeadquarters(owner){
 const root=rootModel('headquarters',owner),k=kit(owner),structure=new T.Group();
 structure.name='Structure';root.add(structure);
 const {box:b,cylinder:c,polygon:f}=k;
 // Broad, recognizable command bunker with readable upper operations deck.
 b(structure,'MainFloor',[9.1,.08,8.5],[0,.04,0],'sandShade',.025);
 b(structure,'RearWall',[9.0,3.05,.30],[0,1.53,-4.04],'sand',.06);
 for(const side of [-1,1]){
  b(structure,'SideWall',[.32,3.05,8.1],[side*4.35,1.54,0],'sand',.05);
  b(structure,'FrontWing',[3.2,3.05,.32],[side*2.91,1.54,4.03],'sandLight',.05);
  b(structure,'DoorJamb',[.22,2.64,.48],[side*1.15,1.32,4.08],'metal',.028);
  b(structure,'EntranceRail',[.22,2.69,.40],[side*1.33,1.36,4.05],'olive',.02);
  b(structure,'ArmorButtress',[.56,3.12,.66],[side*4.33,1.56,3.78],'sandShade',.06);
  b(structure,'FrontBanner',[1.12,.40,.055],[side*2.81,2.33,4.215],'team',.013);
  b(structure,'WindowRecess',[1.36,.64,.05],[side*2.83,1.78,4.21],'recess',.025);
  b(structure,'WindowGlazing',[1.11,.44,.055],[side*2.83,1.79,4.25],'glass',.012,[0,0,0],k.glass);
  b(structure,'WindowBrow',[1.56,.14,.28],[side*2.83,2.18,4.18],'olive',.015);
  b(structure,'WindowSill',[1.48,.12,.24],[side*2.83,1.38,4.18],'metal',.018);
  b(structure,'SideBand',[.07,.15,6.9],[side*4.53,2.47,-.04],'olive',.017);
  for(const z of [-2.4,0,2.35]){
   b(structure,'WallRib',[.26,2.72,.35],[side*4.48,1.36,z],'sandLight',.035);
   b(structure,'SideWindow',[.08,.70,.94],[side*4.53,1.79,z+.55],'glass',.013,[0,0,0],k.glass);
   b(structure,'SideMullion',[.09,.72,.065],[side*4.59,1.79,z+.55],'metal',.005);
  }
  f(structure,'FrontCamouflage',[
   [side*1.55,.45,4.204],[side*3.95,.45,4.204],
   [side*3.92,1.05,4.204],[side*3.05,1.45,4.204],
   [side*2.55,1.07,4.204],[side*1.55,1.34,4.204]
  ],'olive');
 }
 b(structure,'DoorLintel',[2.6,.40,.54],[0,2.87,4.05],'metal',.03);
 b(structure,'EntryCanopy',[3.35,.20,1.04],[0,3.14,4.30],'olive',.03);
 // Inner hall is real geometry, with open doorway for the pioneer.
 b(structure,'InteriorFloor',[8.55,.035,7.85],[0,.028,0],'sandShade',.009);
 b(structure,'InteriorBack',[8.2,2.5,.18],[0,1.25,1.85],'recess',.02);
 // Low roof trim echoes the barracks' dark architectural roof.
 b(structure,'RoofMain',[9.65,.28,8.95],[0,3.23,0],'roof',.06);
 b(structure,'RoofFascia',[9.75,.20,.24],[0,3.22,4.47],'metal',.02);
 for(const side of [-1,1])b(structure,'RoofEdge',[.21,.18,8.95],[side*4.80,3.28,0],'metal',.018);
 // Command tower is a compact, inset second storey rather than a tall block.
 b(structure,'TowerBase',[4.6,1.75,4.15],[.15,4.22,-.60],'sand',.07);
 b(structure,'TowerTop',[5.15,.24,4.6],[.15,5.20,-.60],'roof',.05);
 for(const side of [-1,1]){
  b(structure,'UpperWindows',[.07,.77,2.56],[side*2.23,4.39,-.63],'glass',.015,[0,0,0],k.glass);
  b(structure,'UpperMullion',[.08,.83,.09],[side*2.28,4.39,-.63],'metal',.004);
  b(structure,'RoofEquipment',[.72,.55,.75],[side*3.44,3.63,-2.5],'olive',.035);
 }
 b(structure,'TowerFrontGlass',[3.18,.80,.07],[.15,4.41,1.53],'glass',.015,[0,0,0],k.glass);
 for(const x of [-.91,.15,1.21])b(structure,'TowerMullion',[.085,.83,.09],[x,4.42,1.58],'metal',.012);
 b(structure,'TeamCommandPanel',[1.2,.27,.04],[.15,4.98,1.61],'team',.01);
 // Small stepped sand-coloured radio shelter.
 b(structure,'PowerBox',[1.3,1.20,1.2],[-3.1,3.85,-1.2],'olive',.04);
 for(let i=0;i<4;i++)b(structure,'PowerVent',[.86,.055,.04],[-3.1,3.55+i*.15,-.56],'recess',.005);
 for(const side of [-1,1]){
  const gate=new T.Group();gate.name=side<0?'HQ_GATE_LEFT':'HQ_GATE_RIGHT';
  gate.position.set(side*.53,0,4.07);root.add(gate);
  b(gate,'ArmoredSlidingGate',[1.08,2.47,.13],[0,1.26,0],'olive',.025);
  b(gate,'GateGlass',[.74,.70,.04],[0,1.54,.10],'recess',.009);
  b(gate,'GateTeamStripe',[.82,.15,.045],[0,1.82,.115],'team',.007);
  b(gate,'GateKickPlate',[.86,.25,.045],[0,.30,.118],'metal',.012);
  b(gate,'GateHandle',[.055,.22,.07],[-side*.36,1.19,.15],'sandLight',.012);
 }
 const rotor=new T.Group();rotor.name='HQ_RADAR_PIVOT';rotor.position.set(.26,5.46,-1.08);root.add(rotor);
 c(rotor,'DishStem',.12,.47,[0,.22,0],'metal',[0,0,0],10,k.steel);
 b(rotor,'DishYoke',[.69,.13,.19],[0,.48,0],'olive',.02);
 const dish=new T.Group();dish.rotation.x=-.22;dish.position.y=.61;rotor.add(dish);
 // Eight-facet dished plate, visible from an RTS camera; separate inner face.
 c(dish,'RadarFace',.84,.10,[0,0,.08],'sandLight',[Math.PI/2,0,0],8);
 c(dish,'RadarBacking',.89,.08,[0,0,-.02],'metal',[Math.PI/2,0,0],8,k.steel);
 c(dish,'RadarFeed',.035,.49,[0,0,.36],'recess',[Math.PI/2,0,0],8);
 b(dish,'RadarCap',[.16,.16,.10],[0,0,.59],'oliveLight',.015);
 c(structure,'AntennaBase',.11,.38,[-1.2,5.48,-1.32],'metal',[0,0,0],8);
 c(structure,'AntennaMast',.025,1.3,[-1.2,6.21,-1.32],'metal',[0,0,0],8);
 b(structure,'AntennaTip',[.16,.12,.16],[-1.2,6.9,-1.32],'team',.015);
 k.batch(root);
 root.userData.portal={groundY:0,inside:[0,.08,2.45],threshold:[0,.08,4.21],outside:[0,0,6.15],
  travel:1.25,clearWidth:2.26,clearHeight:2.64,lamp:[0,2.8,4.55]};
 const tracks=[
  new T.VectorKeyframeTrack('HQ_GATE_LEFT.position',[0,.75,2.5,3.3],[-.53,0,4.07,-1.78,0,4.07,-1.78,0,4.07,-.53,0,4.07]),
  new T.VectorKeyframeTrack('HQ_GATE_RIGHT.position',[0,.75,2.5,3.3],[.53,0,4.07,1.78,0,4.07,1.78,0,4.07,.53,0,4.07])
 ];
 root.animations=[new T.AnimationClip('RadarSpin',8,[quaternionTrack('HQ_RADAR_PIVOT',[0,2,4,6,8],[[0,0,0],[0,Math.PI/2,0],[0,Math.PI,0],[0,Math.PI*1.5,0],[0,Math.PI*2,0]])]),new T.AnimationClip('ProductionDoor',3.3,tracks)];
 return root;
}
