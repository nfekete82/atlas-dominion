/** Original M142/HIMARS-inspired 6x6. Metres, +Z forward, +Y up.
 * Offline geometry; the game uses baked chassis / turntable / launcher layers. */
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeDesertSurfaceMaps} from './desert-pbr.js';
import {loadRocketCamouflage} from './rocket-camouflage.js';
export async function buildRocketLauncher(team){
 const [,normal,orm]=makeDesertSurfaceMaps({uniform:true}),base=await loadRocketCamouflage();
 const root=new T.Group();root.name='Sandforge_RocketLauncher';
 const paint=new T.MeshStandardMaterial({name:'Woodland camouflage armor PBR',map:base,normalMap:normal,normalScale:new T.Vector2(.19,.19),metalnessMap:orm,roughnessMap:orm,aoMap:orm,aoMapIntensity:.65,metalness:.32,roughness:.93,vertexColors:true});
 const steel=new T.MeshStandardMaterial({name:'Machined steel and hydraulic chrome',color:'#8a8c84',metalness:.95,roughness:.48,normalMap:normal,normalScale:new T.Vector2(.12,.12),metalnessMap:orm,roughnessMap:orm});
 const dark=new T.MeshStandardMaterial({name:'Dark chassis steel and tube interiors',color:'#252b2b',metalness:.6,roughness:.77});
 const rubber=new T.MeshStandardMaterial({name:'Heavy all terrain rubber',color:'#151918',roughness:.95});
 const glass=new T.MeshPhysicalMaterial({name:'Armored blue glass',color:'#233d47',roughness:.16,metalness:.25,clearcoat:1,clearcoatRoughness:.08,side:T.DoubleSide});
 const enamel=new T.MeshStandardMaterial({name:team?'Red team enamel':'Blue team enamel',color:team?'#c63729':'#1678d0',roughness:.43,metalness:.4,normalMap:normal,normalScale:new T.Vector2(.12,.12)});
 const ivory=new T.MeshStandardMaterial({name:'Safety markings and sidewall lettering',color:'#ddd5b6',roughness:.8});
 const lamp=new T.MeshStandardMaterial({name:'Headlight glass',color:'#fff1bb',emissive:'#e0ba70',emissiveIntensity:.35,roughness:.18});
 const redLamp=new T.MeshStandardMaterial({name:'Rear lamp glass',color:'#9b2720',emissive:'#5b100a',emissiveIntensity:.2,roughness:.18});
 const buckets=new Map(),wheels=[],hydraulics=[];let parts=0;
 function batch(name,g,m,p=[0,0,0],r=null,parent=root){const mesh=new T.Mesh(g,m);mesh.position.fromArray(p);if(r)mesh.rotation.set(...r);mesh.updateMatrix();const geom=g.index?g.toNonIndexed():g.clone();geom.applyMatrix4(mesh.matrix);
  if(m===paint){
   // Match the tank's 0.42 repeats/metre face projection. Pattern scale is
   // stable across cab, doors and service panels instead of restarting per box.
   const pos=geom.attributes.position,uv=new Float32Array(pos.count*2),colors=new Float32Array(pos.count*3),a=new T.Vector3(),b=new T.Vector3(),v=new T.Vector3(),n=new T.Vector3();
   for(let i=0;i<pos.count;i+=3){a.fromBufferAttribute(pos,i);b.fromBufferAttribute(pos,i+1).sub(a);v.fromBufferAttribute(pos,i+2).sub(a);n.crossVectors(b,v);const axis=Math.abs(n.x)>Math.abs(n.y)&&Math.abs(n.x)>Math.abs(n.z)?0:Math.abs(n.y)>Math.abs(n.z)?1:2;
    for(let j=i;j<i+3;j++){v.fromBufferAttribute(pos,j);uv[j*2]=(axis===0?v.z:v.x)*.42;uv[j*2+1]=(axis===1?v.z:v.y)*.42;const grime=parent===root?Math.max(0,Math.min(1,(1.7-v.y)/1.05))*(.09+.025*Math.sin(v.z*9+v.x*13)):0;colors.set([1-grime*.65,1-grime*.80,1-grime],j*3);}
   }
   geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  }
  for(const key of Object.keys(geom.attributes))if(!['position','normal','uv','color'].includes(key))geom.deleteAttribute(key);if(!geom.attributes.uv)geom.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geom.attributes.position.count*2),2));if(!geom.attributes.normal)geom.computeVertexNormals();let mats=buckets.get(parent);if(!mats)buckets.set(parent,mats=new Map());if(!mats.has(m))mats.set(m,[]);mats.get(m).push(geom);g.dispose();parts++;}
 function box(n,p,s,m=paint,r=null,parent=root,bevel=0){batch(n,bevel?new RoundedBoxGeometry(...s,1,bevel):new T.BoxGeometry(...s),m,p,r,parent);}
 const cylinder=(n,p,r,h,m=steel,axis='y',parent=root,segments=16)=>batch(n,new T.CylinderGeometry(r,r,h,segments),m,p,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:null,parent);
 const torus=(n,p,r,t,m=steel,axis='z',parent=root)=>batch(n,new T.TorusGeometry(r,t,8,32),m,p,axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:null,parent);
 function rod(n,a,b,r=.035,m=steel,parent=root){const va=new T.Vector3(...a),vb=new T.Vector3(...b),dir=vb.clone().sub(va),g=new T.CylinderGeometry(r,r,dir.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));batch(n,g,m,va.add(vb).multiplyScalar(.5).toArray(),null,parent);}
 function panel(n,points,m=paint,parent=root){const pos=[],uv=[];for(let j=1;j<points.length-1;j++)for(const i of [0,j,j+1]){pos.push(...points[i]);uv.push(i===1||i===2?1:0,i>=2?1:0);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();batch(n,g,m,[0,0,0],null,parent);}
 const bolt=(p,axis='x',parent=root)=>cylinder('Hex fastener',p,.022,.018,steel,axis,parent,6);
 function vents(p,count,side=1){box('Vent recess',p,[.026,.48,.69],dark);for(let i=0;i<count;i++)box('Cooling grille',[p[0]+side*.018,p[1]-.21+i*.42/(count-1),p[2]],[.022,.019,.63],steel);}
 // Ladder frame, crossmembers, leaf-spring suspension, axles and driveline.
 for(const side of [-1,1]){box('Chassis rail',[side*.77,1.05,-.25],[.16,.28,7.20],dark);for(let i=0;i<25;i++)bolt([side*.86,1.08,-3.5+i*.27]);}
 for(const z of [-3.45,-2.85,-1.9,-.9,.25,1.4,2.55,3.1])box('Frame crossmember',[0,1.06,z],[1.62,.16,.12],steel);
 for(const z of [-2.9,-1.5,2.55]){
  cylinder('Axle',[0,.70,z],.12,2.6,dark,'x');batch('Differential',new T.SphereGeometry(.25,16,10),dark,[0,.70,z]);
  for(const side of [-1,1])for(let leaf=0;leaf<4;leaf++)box('Leaf spring',[side*.79,.78+leaf*.025,z],[.13,.018,.85-leaf*.10],steel);
 }
 rod('Drive shaft',[0,.74,-2.92],[0,.81,1.6],.055,steel);box('Transfer case',[0,.81,.65],[.5,.32,.58],dark);
 // Six independent wheels with beveled sidewalls, shoulder lugs and chevron tread.
 for(const side of [-1,1])for(const z of [-2.9,-1.5,2.55]){
  const wheel=new T.Group();wheel.name='Wheel_'+(side<0?'Port':'Starboard')+'_'+wheels.length;wheel.position.set(side*1.30,.67,z);root.add(wheel);wheels.push(wheel);
  torus('Rounded tire',[0,0,0],.48,.17,rubber,'x',wheel);cylinder('Tire carcass',[0,0,0],.59,.43,rubber,'x',wheel,32);
  for(let i=0;i<36;i++)for(const track of [-1,1]){const a=i*Math.PI*2/36,r=.628;box('Chevron tread',[track*.115,Math.cos(a)*r,Math.sin(a)*r],[.20,.065,.11],rubber,[a,track*.25,0],wheel);}
  for(const outer of [-1,1]){cylinder('Recessed wheel rim',[outer*.233,0,0],.345,.033,steel,'x',wheel,24);torus('Rim rolled edge',[outer*.254,0,0],.33,.023,steel,'x',wheel);cylinder('Hub bearing',[outer*.27,0,0],.14,.085,steel,'x',wheel);for(let i=0;i<10;i++){const a=i*Math.PI/5;bolt([outer*.278,Math.cos(a)*.245,Math.sin(a)*.245],'x',wheel);}box('Wheel rotation witness',[outer*.248,.40,.06],[.018,.12,.075],steel,null,wheel);}
  // Mudguards and flexible flaps stay on the chassis while the wheel rotates.
  box('Wheel arch roof',[side*1.22,1.43,z],[.62,.09,1.25],paint,null,root,.035);box('Mudflap',[side*1.29,.78,z-.72],[.52,.72,.045],rubber);
 }
 // Armored cab: sloped nose/windscreen, flat roof and reinforced door skins.
 box('Cab floor',[0,1.49,2.60],[2.37,.18,2.47],dark,null,root,.06);
 box('Cab lower armor',[0,1.91,2.60],[2.38,.77,2.37],paint,null,root,.055);
 for(const side of [-1,1]){
  panel('Cab upper side',[[side*1.2,2.18,3.76],[side*1.16,3.10,3.28],[side*1.16,3.12,1.48],[side*1.2,2.18,1.48]],paint);
  panel('Cab upper inner',[[side*1.19,2.18,1.48],[side*1.15,3.11,1.48],[side*1.15,3.09,3.28],[side*1.19,2.18,3.76]],paint);
  // Side window and door reveal have real thickness / external seals.
  panel('Door glass seal',[[side*1.215,2.24,3.45],[side*1.185,2.98,3.13],[side*1.185,2.99,1.77],[side*1.215,2.24,1.77]],dark);
  panel('Door armored glass',[[side*1.23,2.34,3.31],[side*1.20,2.87,3.08],[side*1.20,2.88,1.90],[side*1.23,2.34,1.90]],glass);
  for(const z of [1.68,3.54])rod('Door seam',[side*1.22,1.70,z],[side*1.22,2.21,z],.013,dark);
  box('Door handle',[side*1.235,2.15,2.0],[.035,.06,.23],steel);for(const z of [1.65,3.44]){box('Door hinge',[side*1.23,1.90,z],[.06,.16,.10],steel);bolt([side*1.27,1.9,z]);}
  box('Cab step',[side*1.26,1.12,2.15],[.38,.08,1.20],steel);box('Low step',[side*1.30,.82,2.20],[.37,.07,.80],dark);
  rod('Mirror support',[side*1.15,2.71,3.25],[side*1.53,2.84,3.25],.025,dark);box('Mirror shell',[side*1.55,2.78,3.25],[.13,.31,.19],dark,null,root,.035);box('Mirror surface',[side*1.55,2.78,3.145],[.10,.26,.02],steel);
  // Clearly visible team plates, without covering the reference's desert finish.
  box('Door faction plate',[side*1.25,1.95,2.75],[.025,.29,.47],enamel);box('Door unit stencil',[side*1.267,1.95,2.75],[.012,.065,.27],ivory);
  for(let i=0;i<9;i++)bolt([side*1.23,1.63,1.75+i*.21]);
 }
 box('Cab rear bulkhead',[0,2.55,1.48],[2.30,1.13,.08],paint);box('Cab roof',[0,3.16,2.38],[2.38,.12,1.99],paint,null,root,.045);
 panel('Windscreen armor',[[ -1.18,2.19,3.81],[1.18,2.19,3.81],[1.15,3.11,3.31],[-1.15,3.11,3.31]],paint);
 for(const side of [-1,1]){
  const points=[[side*.07,2.36,3.748],[side*1.01,2.36,3.748],[side*.99,2.94,3.433],[side*.07,2.94,3.433]];panel('Windscreen seal',points,dark);const q=points.map(([x,y,z])=>[x*.94,y>2.5?y-.05:y+.05,z+.02]);panel('Front armored glazing',q,glass);rod('Windshield wiper',[side*.18,2.40,3.76],[side*.73,2.75,3.58],.012,dark);
 }
 // Dashboard, seats and a steering wheel visible through the cab glazing.
 box('Dashboard',[0,2.27,3.25],[1.95,.18,.42],dark);for(const side of [-1,1]){box('Seat back',[side*.57,2.21,2.15],[.53,.68,.19],rubber,null,root,.05);box('Seat cushion',[side*.57,1.91,2.4],[.54,.16,.52],rubber,null,root,.04);}torus('Steering wheel',[-.57,2.30,2.94],.19,.018,dark,'z');rod('Steering column',[-.57,2.12,2.75],[-.57,2.30,2.94],.025,dark);
 // Bumper, tow eyes, headlamps, grille and radiator louvers.
 box('Front bumper',[0,1.33,3.95],[2.68,.19,.21],paint,null,root,.035);box('Front grille recess',[0,1.93,3.805],[.87,.43,.045],dark);
 for(let i=0;i<8;i++)box('Radiator fin',[-.36+i*.103,1.93,3.837],[.025,.36,.016],steel);
 for(const side of [-1,1]){box('Headlight armored surround',[side*.92,1.98,3.82],[.42,.31,.10],dark);cylinder('Headlamp',[side*.92,2.03,3.885],.105,.035,lamp,'z');cylinder('Blackout lamp',[side*.92,1.85,3.89],.055,.025,dark,'z');torus('Front towing eye',[side*.80,1.28,4.08],.10,.032,steel,'z');}
 // Behind-cab equipment pack, exhaust, fuel and pneumatic reservoirs.
 box('Engine service pack',[0,1.84,.64],[2.10,1.03,1.24],paint,null,root,.04);for(const side of [-1,1]){vents([side*1.067,1.90,.59],12,side);box('Service handle',[side*1.10,2.20,.98],[.06,.05,.22],steel);cylinder('Air tank',[side*.82,.79,.28],.16,.95,paint,'z');}
 cylinder('Fuel tank',[-1.02,.99,-.55],.25,.86,steel,'z');for(const z of [-.85,-.28])torus('Fuel retaining strap',[-1.02,.99,z],.258,.022,dark,'z');
 cylinder('Exhaust upright',[.86,2.27,1.22],.11,1.23,dark);cylinder('Heat shield',[.86,2.14,1.22],.14,.77,steel);for(let i=0;i<6;i++)torus('Heatshield collar',[.86,1.82+i*.12,1.22],.143,.008,dark,'y');
 // Dual whip antennas and a modeled loop aerial reproduce the reference outline.
 for(const [x,height] of [[-.88,2.0],[.87,1.65]]){cylinder('Antenna base',[x,3.24,1.76],.085,.16,dark);rod('Whip antenna',[x,3.32,1.76],[x,3.32+height,1.70],.008,dark);}
 torus('Loop antenna',[.76,3.34,1.52],.47,.012,dark,'z');
 // Rear lights, hitch, spare equipment and deck rails.
 box('Rear deck',[0,1.37,-1.82],[2.38,.12,3.42],paint);box('Rear bumper',[0,1.04,-3.77],[2.46,.22,.14],paint);
 for(const side of [-1,1]){box('Rear light bracket',[side*1.05,1.31,-3.63],[.40,.38,.14],paint);for(const y of [1.21,1.40])cylinder('Rear lamp',[side*1.05,y,-3.715],.068,.025,redLamp,'z');box('Rear mudflap',[side*1.23,.68,-3.67],[.58,.70,.05],rubber);rod('Deck side rail',[side*1.12,1.58,-3.53],[side*1.12,1.58,-.82],.033);}
 torus('Rear towing eye',[0,.90,-3.87],.11,.037,steel,'z');box('Trailer coupling',[0,1.13,-3.82],[.30,.26,.23],dark);for(const side of [-1,1]){box('Recovery stabilizer',[side*.85,1.00,-3.38],[.14,.72,.18],dark);box('Stabilizer foot',[side*.85,.62,-3.38],[.32,.07,.32],steel);}
 // Turntable pivot is on the chassis origin, matching independent sprite yaw.
 cylinder('Slew bearing',[0,1.53,0],.73,.18,dark);torus('Slew bearing ring',[0,1.62,0],.68,.045,steel,'y');
 const turret=new T.Group();turret.name='Tank_Turret';turret.position.y=1.75;root.add(turret);
 box('Slew platform',[0,.12,-1.38],[2.12,.22,3.25],paint,null,turret,.055);for(const side of [-1,1]){box('Trunnion cheek',[side*.87,.25,-2.95],[.21,.46,.65],paint,null,turret,.06);cylinder('Elevation bearing',[side*1.01,.20,-2.95],.19,.10,steel,'x',turret);}
 const gun=new T.Group();gun.name='Tank_Gun';gun.position.set(0,.20,-2.95);gun.rotation.x=-.36;turret.add(gun);
 // A single removable six-round pod, 3 columns x 2 rows, with true recessed bores.
 box('Pod floor',[0,-.43,-.58],[2.05,.13,4.10],paint,null,gun,.035);
 for(const side of [-1,1]){
  box('Pod side armor',[side*1.025,.10,-.58],[.09,1.02,4.10],paint,null,gun,.025);
  for(const z of [-1.72,-.40,.82]){box('Pod side service panel',[side*1.078,.11,z],[.025,.73,1.05],paint,null,gun,.012);for(const y of [-.17,.38])for(const dz of [-.39,.39])bolt([side*1.10,y,z+dz],'x',gun);}
  box('Launcher faction band',[side*1.105,.11,-.4],[.018,.23,.83],enamel,null,gun);box('Pod top rail',[side*.91,.71,-.58],[.10,.09,4.26],steel,null,gun);
  rod('Lift sling rail',[side*.94,.73,-2.57],[side*.94,.97,-2.57],.04,steel,gun);rod('Lift sling front',[side*.94,.73,1.46],[side*.94,.97,1.46],.04,steel,gun);
 }
 for(const z of [-2.57,1.46]){box('Pod transverse lifting bar',[0,.97,z],[2.02,.11,.10],steel,null,gun);box('Pod lower cross brace',[0,-.36,z],[1.98,.12,.11],steel,null,gun);}
 const muzzles=[];
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const x=(col-1)*.60,y=-.14+row*.53,z=-.57;
  cylinder('Launch tube body',[x,y,z],.245,3.90,paint,'z',gun,24);
  // Open cylinder has visible inner and outer walls; no flat picture substitutes.
  const g=new T.CylinderGeometry(.228,.228,.20,24,1,true);g.rotateX(Math.PI/2);batch('Tube inner wall',g,dark,[x,y,1.31],null,gun);
  cylinder('Recessed rocket cap',[x,y,1.235],.207,.035,dark,'z',gun,24);cylinder('Rocket protective cover',[x,y,1.265],.175,.025,paint,'z',gun,24);
  torus('Tube rolled lip',[x,y,1.42],.235,.025,steel,'z',gun);for(let i=0;i<4;i++){const a=i*Math.PI/2;bolt([x+Math.cos(a)*.23,y+Math.sin(a)*.23,1.45],'z',gun);}
  cylinder('Rear tube cap',[x,y,-2.55],.237,.07,paint,'z',gun,24);torus('Rear tube flange',[x,y,-2.59],.22,.018,steel,'z',gun);
  const muzzle=new T.Object3D();muzzle.name='RocketMuzzle_'+(row*3+col);muzzle.position.set(x,y+.43,4.13);gun.add(muzzle);muzzles.push(muzzle);
 }
 for(const z of [-2.1,-.7,.7])box('Pod roof crossmember',[0,.67,z],[1.94,.065,.14],paint,null,gun);box('Top service hatch',[0,.70,-.2],[.72,.06,.77],paint,null,gun,.025);
 // Telescoping elevation rams: barrel pivots and exposed rod extension follow the pod.
 for(const side of [-1,1]){
  const ram=new T.Group();ram.name='LiftRam_'+(side<0?'Port':'Starboard');ram.position.set(side*.83,.16,-1.47);turret.add(ram);
  cylinder('Hydraulic barrel',[0,.36,0],.080,.72,paint,'y',ram);cylinder('Cylinder gland',[0,.72,0],.097,.09,steel,'y',ram);
  const piston=new T.Group();piston.name=ram.name+'_Rod';piston.position.y=.72;ram.add(piston);cylinder('Hydraulic piston',[0,.5,0],.046,1,steel,'y',piston);hydraulics.push({ram,piston,side});
 }
 const poseHydraulics=angle=>{for(const {ram,piston,side} of hydraulics){const end=new T.Vector3(side*.83,.08,3.41).applyAxisAngle(new T.Vector3(1,0,0),angle).add(gun.position),d=end.sub(ram.position),length=d.length();ram.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());piston.scale.y=Math.max(.05,length-.72);}};poseHydraulics(gun.rotation.x);
 // Batch by material under each genuinely moving pivot, with UVs and tangent space.
 for(const [parent,materials] of buckets)for(const [m,list] of materials){const g=mergeVertices(mergeGeometries(list,false),1e-5);if(parent===gun)g.translate(0,.43,2.63);if(m.normalMap)g.computeTangents();g.computeBoundingBox();g.computeBoundingSphere();const mesh=new T.Mesh(g,m);mesh.name=parent.name+'_'+m.name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);for(const geometry of list)geometry.dispose();}
 const times=Array.from({length:33},(_,i)=>i/32),valuesFor=(axis,turns)=>times.flatMap(t=>new T.Quaternion().setFromAxisAngle(axis,t*Math.PI*2*turns).toArray());
 const rolling=new T.AnimationClip('Wheels_Roll',1,wheels.map(w=>new T.QuaternionKeyframeTrack(w.name+'.quaternion',times,valuesFor(new T.Vector3(1,0,0),1))));
 const opTimes=Array.from({length:65},(_,i)=>i*6/64),tracks=[],yaw=[],elevation=[],ramQ=hydraulics.map(()=>[]),rodScales=hydraulics.map(()=>[]);
 for(const t of opTimes){const a=-.36-(1-Math.cos(t/6*Math.PI*2))*.18;yaw.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.sin(t/6*Math.PI*2)*.30).toArray());elevation.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),a).toArray());poseHydraulics(a);hydraulics.forEach((h,i)=>{ramQ[i].push(...h.ram.quaternion.toArray());rodScales[i].push(...h.piston.scale.toArray());});}
 tracks.push(new T.QuaternionKeyframeTrack(turret.name+'.quaternion',opTimes,yaw),new T.QuaternionKeyframeTrack(gun.name+'.quaternion',opTimes,elevation));hydraulics.forEach((h,i)=>tracks.push(new T.QuaternionKeyframeTrack(h.ram.name+'.quaternion',opTimes,ramQ[i]),new T.VectorKeyframeTrack(h.piston.name+'.scale',opTimes,rodScales[i])));poseHydraulics(-.36);
 let triangles=0,drawCalls=0;root.traverse(n=>{if(n.isMesh){triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;drawCalls++;}});
 root.userData.atlasDesign={kind:'artillery',team,parts,triangles,drawCalls,source:'Sandforge authored original rocket launcher GLB',geometry:'Reference-inspired desert 6x6 armored truck, six-tube elevated pod, rotating turntable and telescoping hydraulics',tubes:6,wheels:6,layout:'3 x 2',textures:'2048² tank-matched camouflage / 1024² normal and packed ORM',camouflage:'Leopard woodland olive / earth brown / sand',paintSource:'tank-0.glb / tan baseColor',paintUvScale:.42,turretPivot:[0,1.75,0]};
 return {model:root,animations:[rolling,new T.AnimationClip('Launcher_Operation',6,tracks)],wheels,turret,gun,muzzle:muzzles[0],animate(tag,phase){for(const w of wheels){const direction=tag==='turnLeft'?Math.sign(w.position.x):tag==='turnRight'?-Math.sign(w.position.x):1;w.rotation.x=tag==='idle'?0:phase*Math.PI*2*direction;}turret.rotation.y=0;gun.rotation.x=-.36;poseHydraulics(-.36);}};
}
