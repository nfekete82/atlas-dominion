import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {kit,rootModel,quaternionTrack} from './stylized-kit.mjs';

export function buildSoldier(owner){
 const root=rootModel('infantry',owner),k=kit(owner),bones=[],rig=new T.Group();rig.name='Rig';root.add(rig);
 const bone=(name,at,parent=rig)=>{const n=new T.Bone();n.name=name;n.position.set(...at);parent.add(n);bones.push(n);return n;};
 const hips=bone('Hips',[0,.94,0]),chest=bone('Chest',[0,.29,0],hips),head=bone('Head',[0,.36,0],chest);
 const {box:b,cylinder:c,part}=k;
 b(hips,'HipUniform',[.35,.25,.25],[0,-.04,0],'olive',.045);
 b(hips,'WebBelt',[.40,.075,.29],[0,.052,0],'leather',.018);
 b(hips,'BeltBuckle',[.095,.065,.035],[0,.05,.16],'sandLight',.008);
 // Tapered angular flak vest, shoulder silhouette and distinct front pouches.
 k.profile(chest,'TaperedTunic',[[-.13,-.14],[-.15,.20],[-.08,.28],[.12,.28],[.18,.15],[.13,-.14]],.43,'sand');
 b(chest,'PlateCarrier',[.40,.38,.12],[0,.045,.14],'olive',.045);
 b(chest,'BackArmor',[.37,.35,.10],[0,.05,-.15],'olive',.035);
 b(chest,'Backpack',[.30,.32,.15],[0,.04,-.25],'leather',.04);
 b(chest,'PackFlap',[.32,.11,.17],[0,.18,-.26],'oliveLight',.025);
 for(const s of [-1,1]){
  b(chest,'ShoulderStrap',[.075,.34,.05],[s*.145,.11,.21],'sandShade',.012);
  b(chest,'AmmoPouch',[.11,.15,.075],[s*.075,-.04,.23],'sandLight',.018);
  b(chest,'PouchFlap',[.12,.045,.082],[s*.075,.012,.235],'sandShade',.01);
  b(chest,'PackBuckle',[.035,.04,.025],[s*.08,.13,-.348],'sandLight',.004);
 }
 b(chest,'TeamChestTab',[.16,.065,.012],[0,.19,.211],'team',.004);
 c(head,'Neck',.067,.12,[0,-.05,0],'skin',[0,0,0],8);
 b(head,'AngularFace',[.25,.27,.235],[0,.11,.01],'skin',.045);
 b(head,'Jaw',[.19,.095,.20],[0,-.005,.035],'skinLight',.025);
 b(head,'Nose',[.055,.072,.065],[0,.105,.145],'skinLight',.012);
 b(head,'GogglesFrame',[.26,.095,.055],[0,.18,.126],'recess',.025);
 b(head,'BallisticGoggles',[.22,.057,.025],[0,.183,.16],'glassLight',.012);
 b(head,'GoggleBridge',[.025,.066,.029],[0,.18,.176],'metal',.004);
 // Faceted helmet dome with neck skirt and short visor; custom profile.
 const helmetProfile=[[.16,.255],[.18,.255],[.19,.29],[.185,.36],[.16,.43],[.10,.47],[0,.48]].map(v=>new T.Vector2(v[0],v[1]));
 part(head,'BallisticHelmet',new T.LatheGeometry(helmetProfile,10),'olive');
 b(head,'HelmetRim',[.40,.045,.36],[0,.267,.015],'oliveLight',.018);
 b(head,'HelmetVisor',[.34,.035,.15],[0,.276,.19],'olive',.02);
 b(head,'HelmetTeamPatch',[.13,.075,.025],[0,.345,.183],'team',.008);
 for(const s of [-1,1]){
  b(head,'EarProtection',[.055,.13,.10],[s*.145,.12,0],'leather',.015);
  b(head,'ChinStrap',[.028,.17,.033],[s*.102,.035,.105],'olive',.005,[0,0,-s*.25]);
  const thigh=bone(s<0?'Thigh_L':'Thigh_R',[s*.118,-.105,0],hips);
  const shin=bone(s<0?'Shin_L':'Shin_R',[0,-.36,0],thigh);
  const foot=bone(s<0?'Foot_L':'Foot_R',[0,-.35,0],shin);
  b(thigh,'ThighFatigues',[.185,.37,.22],[0,-.16,0],'sand',.035);
  k.polygon(thigh,'UniformCamouflage',[[-.065,-.055,.111],[.055,-.055,.111],[.075,-.16,.111],[.018,-.21,.111],[-.065,-.15,.111]],'olive');
  b(thigh,'CargoPocket',[.065,.16,.15],[s*.10,-.17,-.015],'olive',.015);
  b(shin,'TrousersShin',[.15,.31,.18],[0,-.145,0],'sandShade',.025);
  b(shin,'KneeArmor',[.16,.15,.075],[0,-.025,.108],'olive',.025);
  b(foot,'CombatBoot',[.18,.17,.29],[0,-.035,.04],'leather',.025);
  b(foot,'BootToe',[.185,.10,.15],[0,-.065,.13],'roof',.025);
  b(foot,'BootSole',[.19,.035,.30],[0,-.105,.04],'recess',.01);
  // Rest pose elbows forward and down; forearms reach the rifle handguard.
  const upper=bone(s<0?'UpperArm_L':'UpperArm_R',[s*.255,.18,0],chest);
  const fore=bone(s<0?'Forearm_L':'Forearm_R',s<0?[.12,-.20,.16]:[s*.015,-.22,.10],upper);
  b(upper,'Sleeve',[.18,.24,.19],[0,-.09,.015],'sand',.035,[-.36,0,-s*.12]);
  b(upper,'TeamShoulder',[.037,.11,.13],[s*.10,-.045,.02],'team',.008);
  if(s<0){
   const end=new T.Vector3(.265,-.10,.31),sleeve=b(fore,'SupportForearm',[.135,end.length()*.80,.145],end.clone().multiplyScalar(.42).toArray(),'sandShade',.025);
   sleeve.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().normalize());
   b(fore,'SupportGlove',[.12,.095,.12],end.toArray(),'leather',.02);
  }else{
   b(fore,'ForearmSleeve',[.135,.18,.145],[-s*.025,-.045,.068],'sandShade',.025,[-.95,0,s*.25]);
   b(fore,'Glove',[.12,.095,.12],[-s*.10,-.115,.19],'leather',.02);
  }
 }
 const weapon=bone('Weapon',[.13,-.105,.35],chest);
 b(weapon,'RifleReceiver',[.075,.10,.33],[0,0,.04],'recess',.012);
 b(weapon,'RifleStock',[.065,.13,.20],[0,-.005,-.21],'olive',.012);
 b(weapon,'RifleHandguard',[.08,.08,.24],[0,.01,.28],'olive',.012);
 c(weapon,'RifleBarrel',.019,.22,[0,.018,.49],'metal',[Math.PI/2,0,0],8);
 b(weapon,'RifleMagazine',[.055,.16,.09],[0,-.115,.04],'metal',.008,[-.20,0,0]);
 b(weapon,'RifleSight',[.025,.045,.07],[0,.073,.10],'metal',.005);
 b(weapon,'RifleGrip',[.05,.12,.06],[0,-.09,-.085],'leather',.01,[-.25,0,0]);
 const muzzle=bone('WeaponMuzzle',[0,.018,.61],weapon);
 // Bake all original components to one SkinnedMesh; actual GLTF skin/bones.
 // Segment overlaps hide seams during large joint rotations at low poly density.
 root.updateMatrixWorld(true);
 const geometries=[];
 for(const mesh of k.parts){
  mesh.updateWorldMatrix(true,false);const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  let parent=mesh.parent;while(parent&&!parent.isBone)parent=parent.parent;
  const index=bones.indexOf(parent);if(index<0)throw Error('Unbound soldier component '+mesh.name);
  const indices=[],weights=[];
  for(let i=0;i<g.attributes.position.count;i++){indices.push(index,0,0,0);weights.push(1,0,0,0);}
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  geometries.push(g);mesh.removeFromParent();
 }
 const mesh=new T.SkinnedMesh(mergeVertices(mergeGeometries(geometries),1e-5),k.surface);mesh.name='SFV1_SoldierSkin';
 mesh.add(rig);mesh.userData={...root.userData};
 mesh.bind(new T.Skeleton(bones));mesh.castShadow=mesh.receiveShadow=true;
 const clips=[];
 const gait=(name,duration,stride)=>{
  const times=[0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>t*duration),tracks=[];
  for(const side of ['L','R']){
   const phase=side==='L'?0:Math.PI;
   tracks.push(quaternionTrack('Thigh_'+side,times,times.map(t=>[Math.sin(t/duration*Math.PI*2+phase)*stride,0,0])));
   tracks.push(quaternionTrack('Shin_'+side,times,times.map(t=>[Math.max(0,Math.cos(t/duration*Math.PI*2+phase))*(stride*1.45),0,0])));
   tracks.push(quaternionTrack('Foot_'+side,times,times.map(t=>[Math.sin(t/duration*Math.PI*2+phase)*-.12,0,0])));
  }
  tracks.push(quaternionTrack('Chest',times,times.map(t=>[-.06,Math.sin(t/duration*Math.PI*2)*.045,0])));
  tracks.push(new T.VectorKeyframeTrack('Hips.position',times,times.flatMap(t=>[0,.94+Math.sin(t/duration*Math.PI*4)*.018,0])));
  clips.push(new T.AnimationClip(name,duration,tracks));
 };
 gait('Walk',1,.43);gait('Run',.64,.73);
 clips.push(new T.AnimationClip('Idle',2.4,[quaternionTrack('Chest',[0,1.2,2.4],[[.015,-.025,0],[-.015,.025,0],[.015,-.025,0]]),
  quaternionTrack('Head',[0,1.2,2.4],[[0,.04,0],[0,-.04,0],[0,.04,0]])]));
 clips.push(new T.AnimationClip('Shoot',.28,[quaternionTrack('Chest',[0,.055,.14,.28],[[0,0,0],[-.07,0,0],[-.025,0,0],[0,0,0]]),
  new T.VectorKeyframeTrack('Weapon.position',[0,.045,.14,.28],[.13,-.105,.35,.13,-.105,.315,.13,-.105,.34,.13,-.105,.35])]));
 clips.push(new T.AnimationClip('Death',.85,[new T.VectorKeyframeTrack('Hips.position',[0,.2,.6,.85],[0,.94,0,0,.83,-.08,0,.29,-.22,0,.19,-.26]),
  quaternionTrack('Hips',[0,.2,.6,.85],[[0,0,0],[-.15,0,.12],[-1.25,0,.14],[-1.53,0,.12]]),
  quaternionTrack('Thigh_L',[0,.4,.85],[[0,0,0],[.35,0,-.12],[.1,0,-.15]]),
  quaternionTrack('Thigh_R',[0,.4,.85],[[0,0,0],[-.2,0,.13],[.1,0,.16]])]));
 mesh.animations=clips;mesh.userData.rig={bones:bones.length,skin:'one skinned primitive; rigid segment weights',muzzle:muzzle.name};
 return mesh;
}
