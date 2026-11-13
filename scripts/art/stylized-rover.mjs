import * as T from 'three';
import {kit,rootModel,quaternionTrack} from './stylized-kit.mjs';

export function buildRover(owner){
 const root=rootModel('rover',owner),k=kit(owner),body=new T.Group();body.name='Chassis';root.add(body);
 const {box:b,cylinder:c,profile:p,polygon:f}=k;
 // Four-seat desert patrol car: raked glass, low hood, long wheelbase, angular arches.
 b(body,'LadderFrame',[1.62,.20,4.15],[0,.55,0],'recess',.04);
 p(body,'SculptedHull',[[-2.13,.71],[-2.13,1.12],[-1.4,1.24],[.8,1.22],[2.08,.99],[2.13,.70]],1.91);
 p(body,'Cabin',[[-1.30,1.13],[-1.22,1.94],[.48,1.94],[1.05,1.18]],1.73,'sandLight');
 b(body,'ArmoredRoof',[1.9,.12,1.87],[0,1.99,-.37],'sand',.035);
 f(body,'RearGlazing',[[-.70,1.49,-1.267],[.70,1.49,-1.267],[.70,1.81,-1.235],[-.70,1.81,-1.235]],'glass',k.glass);
 b(body,'Hood',[1.92,.15,1.08],[0,1.19,1.47],'sandLight',.045);
 // Window facets follow the actual cabin rake; dark rubber gaskets surround glazing.
 for(const s of [-1,1]){
  const x=s*.874;
  const poly=(name,zy,color)=>{
   const points=zy.map(([z,y])=>[x,y,z]);if(s<0)points.reverse();f(body,name,points,color,k.glass);
  };
  poly('RearSideGlazing',[[-1.15,1.44],[-1.12,1.84],[-.46,1.84],[-.46,1.44]],'glass');
  poly('FrontSideGlazing',[[-.33,1.44],[-.33,1.84],[.41,1.84],[.72,1.44]],'glass');
  b(body,'DoorSeam',[.025,.57,.028],[s*.962,1.08,-.39],'sandShade',.002);
  for(const z of [-.77,.19]){
   b(body,'DoorReinforcement',[.045,.32,.68],[s*.967,1.12,z],'sand',.015);
   b(body,'DoorHandle',[.07,.055,.21],[s*1.002,1.37,z-.20],'metal',.012);
  }
  b(body,'TeamDoorPanel',[.026,.21,.56],[s*.996,1.12,.19],'team',.008);
  b(body,'RunningBoard',[.23,.10,1.88],[s*1.01,.66,-.14],'metal',.02);
  b(body,'MirrorArm',[.24,.045,.045],[s*1.04,1.61,.59],'metal',.008);
  b(body,'Mirror',[.10,.20,.17],[s*1.17,1.65,.62],'metal',.025);
  for(const z of [-1.37,1.39]){
   // Raised polygon wheel arch, cut out underneath (not a slab hiding the tyre).
   p(body,'FlaredWheelArch',[[z-.65,.70],[z-.64,1.07],[z-.41,1.27],[z+.4,1.27],[z+.64,1.08],[z+.65,.70],[z+.48,.70],[z+.37,1.01],[z-.37,1.01],[z-.49,.70]],.25,'olive',[s*.99,0,0]);
  }
 }
 // Sloping split windshield with armoured centre bar.
 for(const s of [-1,1]){
  const pts=[[s*.055,1.40,.90],[s*.78,1.40,.90],[s*.78,1.84,.57],[s*.055,1.84,.57]];
  if(s<0)pts.reverse();f(body,'FrontWindshield',pts,'glass',k.glass);
  b(body,'WindshieldWiper',[.025,.025,.45],[s*.41,1.45,.87],'recess',.004,[-.70,0,s*.15]);
 }
 b(body,'GrilleSurround',[1.84,.35,.09],[0,.96,2.13],'sandShade',.03);
 b(body,'GrilleRecess',[1.02,.25,.08],[0,.96,2.19],'recess',.015);
 for(let x=-.4;x<=.41;x+=.16)b(body,'GrilleFin',[.045,.22,.035],[x,.96,2.242],'metal',.005);
 for(const s of [-1,1]){
  b(body,'HeadlampGasket',[.31,.25,.10],[s*.73,.99,2.20],'recess',.04);
  b(body,'AmberHeadlamp',[.23,.17,.035],[s*.73,.99,2.26],'lamp',.035);
  b(body,'TailLamp',[.17,.18,.035],[s*.73,1.04,-2.17],'red',.02);
  b(body,'TowHook',[.10,.13,.13],[s*.61,.62,2.34],'metal',.02);
 }
 for(const z of [-2.21,2.26])b(body,'ReinforcedBumper',[2.13,.20,.19],[0,.73,z],'metal',.025);
 // Broad deliberately drawn camouflage facets, no noisy procedural shader.
 f(body,'HoodOliveCamouflage',[[-.90,1.271,1.04],[-.12,1.271,1.04],[.25,1.271,1.49],[-.15,1.271,1.83],[-.91,1.271,1.72]],'olive');
 f(body,'HoodSandFacet',[[.12,1.272,1.07],[.82,1.272,1.07],[.90,1.272,1.84],[.51,1.272,1.66]],'sandShade');
 for(const x of [-.42,.42])b(body,'RoofTeamStripe',[.22,.012,1.63],[x,2.057,-.38],'team',.001);
 c(body,'TurretRing',.39,.10,[0,2.10,-.52],'metal',[0,0,0],12);
 const gun=new T.Group();gun.name='RoofGun';gun.position.set(0,2.17,-.52);body.add(gun);
 b(gun,'GunMount',[.16,.32,.17],[0,.14,0],'metal',.02);
 b(gun,'GunReceiver',[.18,.14,.62],[0,.36,.13],'recess',.02);
 c(gun,'GunBarrel',.037,.69,[0,.36,.73],'metal',[Math.PI/2,0,0],8,k.steel);
 b(gun,'AmmoBox',[.22,.22,.27],[.22,.34,.02],'olive',.02);
 const muzzle=new T.Object3D();muzzle.name='WeaponMuzzle';muzzle.position.set(0,.36,1.10);gun.add(muzzle);
 c(body,'Antenna',.013,.78,[-.77,2.25,-1.16],'recess',[0,0,-.10],6);
 for(const s of [-1,1])for(const z of [-1.37,1.39]){
  const wheel=new T.Group();wheel.name='Wheel_'+(s<0?'L':'R')+(z<0?'R':'F');wheel.position.set(s*1.01,.48,z);root.add(wheel);
  const profile=[[0,-.18],[.32,-.18],[.43,-.15],[.48,-.09],[.48,.09],[.43,.15],[.32,.18],[0,.18]].map(([r,y])=>new T.Vector2(r,y));
  k.part(wheel,'ShapedRubberTyre',new T.LatheGeometry(profile,16),'rubber',[0,0,0],[0,0,Math.PI/2]);
  for(let i=0;i<18;i++)for(const side of [-1,1]){
   const a=i*Math.PI*2/18,block=k.part(wheel,'ChevronTread',new T.BoxGeometry(.18,.075,.15),'tread',[side*.09,Math.cos(a)*.465,Math.sin(a)*.465],[a,side*.30,0]);
   block.rotation.x=a;
  }
  c(wheel,'RecessedHub',.275,.365,[0,0,0],'sandShade',[0,0,Math.PI/2],12,k.steel);
  c(wheel,'HubCap',.13,.39,[0,0,0],'metal',[0,0,Math.PI/2],8,k.steel);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c(wheel,'Lug',.026,.40,[0,Math.cos(a)*.19,Math.sin(a)*.19],'sandLight',[0,0,Math.PI/2],6);}
 }
 k.batch(root);
 const wheels=root.children.filter(n=>n.name.startsWith('Wheel_'));
 root.animations=[new T.AnimationClip('Idle',2,[quaternionTrack('RoofGun',[0,1,2],[[0,-.04,0],[0,.04,0],[0,-.04,0]])]),
  new T.AnimationClip('Drive',1,wheels.map(w=>quaternionTrack(w.name,[0,.25,.5,.75,1],[[0,0,0],[Math.PI/2,0,0],[Math.PI,0,0],[Math.PI*1.5,0,0],[Math.PI*2,0,0]]))),
  new T.AnimationClip('Shoot',.24,[new T.VectorKeyframeTrack('RoofGun.position',[0,.07,.24],[0,2.17,-.52,0,2.17,-.58,0,2.17,-.52])])];
 root.userData.wheelRadius=.48;
 return root;
}
