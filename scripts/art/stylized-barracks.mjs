import * as T from 'three';
import {kit,rootModel} from './stylized-kit.mjs';

export function buildBarracks(owner){
 const root=rootModel('barracks',owner),k=kit(owner),structure=new T.Group();structure.name='Structure';root.add(structure);
 const {box:b,cylinder:c,polygon:f,profile:p}=k;
 // 8.4 × 5.8 m roof, 2.45 m clear doorway. No exterior base plate.
 // Front is -Z. The front wall has an actual hole, not shader clipping.
 b(structure,'RearWall',[8.0,2.75,.28],[0,1.375,2.20],'sand',.045);
 for(const s of [-1,1]){
  b(structure,'SideWall',[.30,2.75,5.0],[s*3.85,1.375,-.30],'sand',.045);
  b(structure,'FrontPier',[2.85,2.75,.32],[s*2.375,1.375,-2.82],'sandLight',.045);
  b(structure,'DoorJamb',[.22,2.58,.48],[s*1.03,1.29,-2.94],'metal',.025);
  b(structure,'DoorRailHousing',[.27,2.68,.62],[s*1.24,1.34,-2.93],'olive',.03);
  for(const z of [-2.12,.10,2.0]){
   b(structure,'ButtressFoot',[.52,.32,.57],[s*3.86,.16,z],'sandShade',.035);
   b(structure,'WallButtress',[.44,2.72,.38],[s*3.87,1.38,z],'sandLight',.04);
  }
  for(const z of [-1.11,1.16]){
   b(structure,'WindowReveal',[.055,.86,1.43],[s*4.016,1.80,z],'recess',.015);
   b(structure,'WindowGlass',[.065,.66,1.22],[s*4.05,1.84,z],'glass',.012,[0,0,0],k.glass);
   b(structure,'WindowSill',[.16,.10,1.49],[s*4.055,1.34,z],'sandLight',.015);
   for(const dz of [-.37,.37])b(structure,'WindowMullion',[.075,.70,.045],[s*4.09,1.84,z+dz],'metal',.006);
   b(structure,'WindowBrow',[.21,.12,1.50],[s*4.07,2.29,z],'olive',.015);
  }
  // Deliberate diagonal camouflage on the large front planes.
  const pts=[[s*1.45,.24,-2.985],[s*3.58,.24,-2.985],[s*3.58,1.32,-2.985],[s*2.90,1.05,-2.985],[s*2.43,1.69,-2.985],[s*1.45,1.38,-2.985]];
  if(s>0)pts.reverse();f(structure,'FrontCamoFacet',pts,'olive');
  b(structure,'TeamFrontPanel',[1.34,.34,.04],[s*2.48,2.27,-3.005],'team',.012);
 }
 b(structure,'DoorLintel',[2.12,.32,.48],[0,2.61,-2.94],'metal',.025);
 // Shallow entrance floor only inside walls, flush with the actual terrain.
 b(structure,'InteriorFloor',[7.50,.025,4.95],[0,.0125,-.30],'sandShade',.004);
 b(structure,'InteriorPartition',[6.9,2.55,.18],[0,1.275,.65],'recess',.015);
 // Roof cross section: a broad, shallow pitch with real eaves and thick fascia.
 p(structure,'PitchedRoof',[[-3.17,2.78],[-3.17,2.99],[-.26,3.82],[2.65,2.99],[2.65,2.78],[-.26,3.59]],8.40,'roof');
 b(structure,'RidgeCap',[8.48,.16,.22],[0,3.80,-.26],'metal',.035);
 for(const s of [-1,1]){
  b(structure,'RoofFascia',[8.48,.19,.16],[0,2.94,s*2.87-.26],'metal',.025);
  // Roof seams follow the pitch, broad enough to survive RTS zoom.
  for(const x of [-3,-1.5,0,1.5,3])b(structure,'StandingRoofSeam',[.045,.045,3.02],[x,3.40,s*1.44-.26],'metal',.008,[s*.279,0,0]);
 }
 b(structure,'DoorCanopy',[2.92,.16,.83],[0,2.84,-3.09],'olive',.035);
 for(const s of [-1,1]){
  c(structure,'EntranceLampHousing',.13,.16,[s*.91,2.71,-3.55],'metal',[Math.PI/2,0,0]);
  c(structure,'EntranceAmberLamp',.09,.025,[s*.91,2.71,-3.65],'lamp',[Math.PI/2,0,0]);
 }
 // Custom geometric chevron insignia; no imported artwork or font dependency.
 f(structure,'EntryChevron',[[-.37,2.82,-3.522],[0,2.66,-3.522],[.37,2.82,-3.522],[.37,2.95,-3.522],[0,2.80,-3.522],[-.37,2.95,-3.522]],'team');
 // One restrained ventilator instead of a cluttered roof full of duplicate props.
 b(structure,'VentCurb',[1.28,.15,1.06],[2.45,3.65,.30],'metal',.035);
 b(structure,'VentHousing',[1.12,.47,.85],[2.45,3.93,.30],'olive',.045);
 b(structure,'VentCap',[1.32,.13,1.04],[2.45,4.20,.30],'sand',.03);
 for(let i=0;i<4;i++)b(structure,'VentLouvre',[.84,.045,.04],[2.45,3.78+i*.095,-.14],'recess',.004);
 // Compact attached supplies use the same bevels and palette as all equipment.
 b(structure,'RearUtilityCabinet',[.66,1.24,.48],[-2.82,.62,2.45],'olive',.035);
 for(let i=0;i<5;i++)b(structure,'CabinetLouvre',[.47,.045,.03],[-2.82,.54+i*.12,2.705],'recess',.005);
 for(const s of [-1,1]){
  const door=new T.Group();door.name=s<0?'GATE_LEFT_PIVOT':'GATE_RIGHT_PIVOT';door.position.set(s*.47,0,-2.96);root.add(door);
  b(door,'SlidingDoorArmor',[.93,2.41,.13],[0,1.23,0],'olive',.025);
  b(door,'DoorInset',[.72,1.13,.035],[0,1.41,-.085],'roof',.02);
  b(door,'DoorTeamBand',[.72,.19,.045],[0,1.54,-.107],'team',.01);
  b(door,'DoorKickPlate',[.73,.36,.045],[0,.30,-.085],'metal',.015);
  b(door,'DoorGrip',[.055,.26,.07],[-s*.29,1.09,-.13],'sandLight',.008);
 }
 k.batch(root);
 root.userData.portal={groundY:0,inside:[0,.025,-2.30],threshold:[0,.025,-3.10],outside:[0,0,-6.2],
  travel:1.04,clearWidth:1.88,clearHeight:2.43,lamp:[0,2.72,-3.57]};
 const tracks=[];
 for(const s of [-1,1])tracks.push(new T.VectorKeyframeTrack((s<0?'GATE_LEFT_PIVOT':'GATE_RIGHT_PIVOT')+'.position',
  [0,.85,2.25,3.1],[s*.47,0,-2.96,s*1.51,0,-2.96,s*1.51,0,-2.96,s*.47,0,-2.96]));
 root.animations=[new T.AnimationClip('ProductionDoor',3.1,tracks)];
 return root;
}
