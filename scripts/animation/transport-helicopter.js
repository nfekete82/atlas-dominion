/** Authored Mi-8/17-inspired transport. Metres, +Z nose, +Y up.
 * Offline only: generated meshes share four embedded PBR maps and are batched
 * by material under static airframe and two independently animated rotor pivots. */
import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
function surfaceMaps(){
 const size=1024,canvases=Array.from({length:3},()=>Object.assign(document.createElement('canvas'),{width:size,height:size}));
 const contexts=canvases.map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(size,size));let seed=17317;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,noise=rand(),wave=Math.sin(x*.018+Math.sin(y*.012)*3)+Math.cos(y*.023+Math.cos(x*.011)*2),cam=wave>.65?[142,134,99]:wave<-.8?[107,110,81]:[183,163,121];
  const seam=x%256<2||y%256<2,scratch=noise>.998||((x+y*13)%397===0&&noise>.55),wear=seam?-.3:scratch?.28:(noise-.5)*.11;
  for(let c=0;c<3;c++)images[0].data[i+c]=cam[c]*(1+wear);images[0].data[i+3]=255;
  images[1].data.set([126+(noise-.5)*18,128+(rand()-.5)*18,253,255],i);
  images[2].data.set([seam?155:245,Math.round(175+noise*55),Math.round(95+noise*30),255],i);
 }
 const textures=canvases.map((canvas,i)=>{contexts[i].putImageData(images[i],0,0);const t=new T.CanvasTexture(canvas);t.name=['Desert camouflage / scratches','Sandblasted metal normal','Packed occlusion roughness metallic'][i];t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;return t;});return textures;
}
export function buildTransportHelicopter(team){
 const [base,normal,orm]=surfaceMaps(),root=new T.Group();root.name='Sandforge_TransportHelicopter';
 const paint=new T.MeshStandardMaterial({name:'Weathered desert camouflage PBR',map:base,normalMap:normal,normalScale:new T.Vector2(.23,.23),metalnessMap:orm,roughnessMap:orm,aoMap:orm,aoMapIntensity:.55,metalness:.65,roughness:.95});
 const steel=new T.MeshStandardMaterial({name:'Brushed titanium / joints',color:'#6c7475',metalness:.95,roughness:.42,metalnessMap:orm,side:T.DoubleSide,normalMap:normal,normalScale:new T.Vector2(.12,.12),roughnessMap:orm});
 const dark=new T.MeshStandardMaterial({name:'Exhaust interiors / seals',color:'#182127',metalness:.5,roughness:.8});
 const rubber=new T.MeshStandardMaterial({name:'Tires',color:'#11181b',roughness:.93});
 const glass=new T.MeshPhysicalMaterial({name:'Smoked blue cockpit glass',color:'#244354',metalness:.3,roughness:.16,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.88,side:T.DoubleSide});
 const faction=new T.MeshStandardMaterial({name:team?'Red team enamel':'Blue team enamel',color:team?'#cb3d30':'#197bd1',roughness:.42,metalness:.38,normalMap:normal,normalScale:new T.Vector2(.1,.1)});
 const ivory=new T.MeshStandardMaterial({name:'Rotor warning tips / stencils',color:'#e7d9a7',roughness:.6,metalness:.3});
 const lights=new T.MeshStandardMaterial({name:'Navigation lamps',color:team?'#ff4834':'#63c8ff',emissive:team?'#ff2910':'#279aff',emissiveIntensity:1.8});
 const buckets=new Map();let parts=0;
 function add(name,g,mat,pos=[0,0,0],rotation=null,group=root){const mesh=new T.Mesh(g,mat);mesh.name=name;mesh.position.fromArray(pos);if(rotation)mesh.rotation.set(...rotation);mesh.updateMatrix();const geom=g.index?g.toNonIndexed():g.clone();geom.applyMatrix4(mesh.matrix);if(!geom.attributes.uv)geom.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geom.attributes.position.count*2),2));if(!geom.attributes.normal)geom.computeVertexNormals();for(const attr of Object.keys(geom.attributes))if(!['position','normal','uv'].includes(attr))geom.deleteAttribute(attr);let list=buckets.get(group);if(!list)buckets.set(group,list=new Map());if(!list.has(mat))list.set(mat,[]);list.get(mat).push(geom);g.dispose();parts++;return mesh;}
 const sphere=(n,p,s,m=paint,group=root)=>{const g=new T.SphereGeometry(1,Math.max(...s)<.15?10:32,Math.max(...s)<.15?6:16);g.scale(...s);return add(n,g,m,p,null,group);};
 const box=(n,p,s,m=paint,r=null,group=root)=>add(n,new T.BoxGeometry(...s),m,p,r,group);
 const cyl=(n,p,r,h,m=steel,axis='y',group=root)=>add(n,new T.CylinderGeometry(r,r,h,16),m,p,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:null,group);
 function rod(n,a,b,r=.035,m=steel,group=root){const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va),g=new T.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));return add(n,g,m,va.add(vb).multiplyScalar(.5).toArray(),null,group);}
 function torus(n,p,r,t,m=steel,axis='z',group=root){return add(n,new T.TorusGeometry(r,t,8,32),m,p,axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:null,group);}
 function panel(n,points,m=glass,group=root){const vertices=[],uv=[];for(let j=1;j<points.length-1;j++)for(const k of [0,j,j+1]){vertices.push(...points[k]);uv.push(k===1||k===2?1:0,k>=2?1:0);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();add(n,g,m,[0,0,0],null,group);}
 // Continuous ring loft: broad cargo cabin, bulbous cockpit and tapering rear.
 const rings=[[-4,2.23,.38,.47],[-3.35,2.12,.94,.94],[-2.6,2.05,1.25,1.22],[-1.7,2.04,1.39,1.34],[0,2.04,1.4,1.34],[1.65,2.02,1.38,1.31],[2.5,1.96,1.24,1.21],[3.15,1.78,1.02,.96],[3.65,1.63,.64,.64],[3.88,1.57,.12,.24]];
 function loft(n,rs,m=paint){const vertices=[],uv=[],indices=[],count=48;rs.forEach(([z,y,rx,ry],j)=>{for(let i=0;i<=count;i++){const a=i/count*Math.PI*2;vertices.push(Math.cos(a)*rx,y+Math.sin(a)*ry,z);uv.push(i/count,j/(rs.length-1));if(j&&i){const b=j*(count+1)+i;if(rs[rs.length-1][0]>rs[0][0])indices.push(b,b-1,b-count-2,b,b-count-2,b-count-1);else indices.push(b,b-count-2,b-1,b,b-count-1,b-count-2);}}});const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();add(n,g,m);}
 loft('Rounded cargo fuselage',rings);
 loft('Raised tapered tail boom',[[-3.1,2.65,.65,.6],[-4,2.95,.52,.49],[-5.4,3.37,.36,.36],[-7,3.81,.23,.26],[-8.25,4.2,.17,.21]]);
 // Cockpit glazing conforms to the nose, with structural mullions and wipers.
 for(const side of [-1,1]){
  // Glass follows the actual loft surface, so the opaque nose never hides it.
  const skin=(z,a)=>{let j=0;while(j<rings.length-2&&rings[j+1][0]<z)j++;const r=rings[j],v=rings[j+1],t=(z-r[0])/(v[0]-r[0]);return [side*Math.cos(a)*(T.MathUtils.lerp(r[2],v[2],t)+.035),T.MathUtils.lerp(r[1],v[1],t)+Math.sin(a)*(T.MathUtils.lerp(r[3],v[3],t)+.035),z];};
  for(const [lo,hi] of [[.28,.74],[.80,1.22],[1.28,1.53]]){
   const near=2.6,far=3.62;
   for(let j=0;j<8;j++)for(let i=0;i<5;i++){const z0=T.MathUtils.lerp(near,far,j/8),z1=T.MathUtils.lerp(near,far,(j+1)/8),a0=T.MathUtils.lerp(lo,hi,i/5),a1=T.MathUtils.lerp(lo,hi,(i+1)/5);panel('Curved cockpit glass',[skin(z0,a0),skin(z1,a0),skin(z1,a1),skin(z0,a1)]);}
   for(const a of [lo,hi])for(let j=0;j<12;j++)rod('Windshield longitudinal frame',skin(T.MathUtils.lerp(near,far,j/12),a),skin(T.MathUtils.lerp(near,far,(j+1)/12),a),.027,paint);
   for(const z of [near,far])for(let i=0;i<8;i++)rod('Windshield transverse frame',skin(z,T.MathUtils.lerp(lo,hi,i/8)),skin(z,T.MathUtils.lerp(lo,hi,(i+1)/8)),.027,paint);
  }
  const points=[[side*1.19,2.68,2.45],[side*1.35,2.66,1.74],[side*1.40,1.77,1.83],[side*1.30,1.81,2.78]];panel('Pilot side glass',points);points.forEach((p,j)=>rod('Cockpit mullion',p,points[(j+1)%4],.045,paint));
  rod('Windscreen wiper',[side*.15,2.01,3.66],[side*.52,2.44,3.25],.017,dark);
  // Cabin round windows, thick seals and metallic porthole rims.
  for(const z of [.85,-.35,-1.65,-2.62]){const x=side*(z< -2?1.23:1.406);cyl('Window gasket',[x,2.26,z],.245,.032,dark,'x');cyl('Cabin glass',[x+side*.025,2.26,z],.202,.038,glass,'x');torus('Porthole rim',[x+side*.047,2.26,z],.226,.019,steel,'x');}
  // Sliding transport door, runners and recessed handle.
  box('Transport door',[side*1.405,1.94,-.36],[.032,1.82,1.67]);
  for(const y of [1.02,2.87])rod('Door rail',[side*1.45,y,-1.27],[side*1.45,y,.56],.025,dark);
  for(const z of [-1.22,.5])rod('Door seam',[side*1.43,1.04,z],[side*1.43,2.84,z],.014,steel);
  box('Door handle',[side*1.46,1.9,.3],[.05,.06,.24],steel);
  // Restore door window forward of the overlapping panel.
  cyl('Door window seal',[side*1.434,2.26,-.35],.245,.027,dark,'x');cyl('Door window',[side*1.458,2.26,-.35],.203,.018,glass,'x');
  sphere('External fuel tank',[side*1.29,.93,-.65],[.36,.38,2.24]);
  for(const z of [-2.1,-.8,.55])box('Fuel tank strap',[side*1.30,.98,z],[.74,.065,.095],steel);
  // Mi-8 twin turbine fairings: forward intakes and rear lateral exhausts.
  sphere('Turbine housing',[side*.59,3.34,1.02],[.52,.57,1.81]);
  cyl('Intake lip',[side*.59,3.36,2.59],.407,.15,steel,'z');cyl('Intake shadow',[side*.59,3.36,2.68],.345,.025,dark,'z');
  cyl('Intake bullet',[side*.59,3.36,2.705],.10,.05,steel,'z');
  for(let i=0;i<12;i++){const a=i*Math.PI/6;rod('Compressor vane',[side*.59+Math.cos(a)*.12,3.36+Math.sin(a)*.12,2.72],[side*.59+Math.cos(a+.19)*.32,3.36+Math.sin(a+.19)*.32,2.715],.018,steel);}
  cyl('Exhaust metal',[side*1.12,3.23,-.84],.29,.62,steel,'x');cyl('Exhaust soot',[side*1.44,3.23,-.84],.235,.025,dark,'x');torus('Exhaust rolled rim',[side*1.45,3.23,-.84],.258,.028,steel,'x');
  for(let i=0;i<12;i++)box('Cooling louver',[side*1.02,3.33,.06-i*.065],[.042,.27,.025],dark,[0,0,side*.25]);
  // Main gear triangulation, shock struts and tires.
  const wheel=[side*2.02,.42,-1.23];rod('Gear main leg',[side*1.15,1.72,-.81],wheel,.085);rod('Gear diagonal',[side*1.12,1.1,.15],wheel,.055);rod('Gear rear brace',[side*1.1,1.55,-2.2],wheel,.047);
  cyl('Main tire',wheel,.42,.28,rubber,'x');cyl('Wheel hub',[side*2.18,.42,-1.23],.22,.035,steel,'x');cyl('Hub cap',[side*2.21,.42,-1.23],.11,.046,dark,'x');
  torus('Tire sidewall',[side*2.17,.42,-1.23],.3,.024,dark,'x');
  for(const z of [-2.8,1.3]){box('Service hatch',[side*1.25,1.53,z],[.035,.38,.49]);for(let i=0;i<4;i++)sphere('Hatch fastener',[side*1.279,1.4+(i%2)*.26,z-.17+Math.floor(i/2)*.34],[.017,.017,.017],steel);}
  // Team roundels on the cargo shell and broad tail identification band.
  cyl('Faction roundel',[side*1.36,2.04,-2.05],.38,.035,faction,'x');cyl('Roundel center',[side*1.385,2.04,-2.05],.21,.02,ivory,'x');
  for(let i=0;i<3;i++)box('Team stripe',[side*1.413,1.54+i*.12,.97],[.025,.065,.42],faction);
  sphere('Navigation lamp',[side*1.42,2.5,-2.92],[.065,.07,.09],lights);
  for(let i=0;i<27;i++)sphere('Fuselage rivet',[side*1.35,1.66,-2.4+i*.18],[.014,.014,.014],steel);
 }
 rod('Nose oleo',[0,1.18,2.81],[0,.34,2.98],.073);rod('Nose brace',[0,1.02,2.1],[0,.45,2.95],.044);
 for(const s of [-1,1]){cyl('Nose tire',[s*.17,.28,3.0],.28,.15,rubber,'x');cyl('Nose wheel hub',[s*.25,.28,3],.13,.02,steel,'x');}
 sphere('Nose radar',[0,1.14,3.49],[.36,.24,.25],dark);sphere('Landing spotlight',[.5,1.25,3.41],[.13,.13,.07],ivory);
 // Tail fin swept outline and horizontal stabilizers.
 panel('Vertical tail fin',[[-.09,4,-7.25],[-.09,6.18,-8.12],[-.09,6.29,-8.63],[-.09,4.03,-8.44]],paint);
 panel('Fin other side',[[.09,4.03,-8.44],[.09,6.29,-8.63],[.09,6.18,-8.12],[.09,4,-7.25]],paint);
 for(const s of [-1,1]){panel('Tailplane',[[s*.1,3.62,-6.2],[s*1.82,3.64,-6.46],[s*1.83,3.59,-7.02],[s*.1,3.56,-6.79]],paint);rod('Tailplane edge',[s*.12,3.62,-6.2],[s*1.82,3.64,-6.46],.035,steel);}
 cyl('Tail team band',[0,3.94,-7.45],.247,.39,faction,'z');
 rod('Tail skid',[0,4.02,-8.27],[0,3.19,-8.53],.032);rod('HF antenna',[0,3.09,-3.3],[0,3.96,-4.8],.014,dark);rod('Nose pitot',[.72,1.52,3.62],[.85,1.43,4.24],.018);rod('Roof antenna',[0,3.55,2.17],[0,4.18,2.14],.023,dark);
 // Gearbox, swashplate, stationary links and rotating five-blade head.
 sphere('Main gearbox',[0,3.54,-.48],[.65,.46,.65],steel);
 cyl('Rotor mast',[0,4.13,-.48],.13,.95);cyl('Stationary swashplate',[0,4.08,-.48],.43,.08);torus('Swashplate bearing',[0,4.14,-.48],.35,.047,steel,'y');
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod('Swashplate linkage',[Math.cos(a)*.4,3.74,-.48+Math.sin(a)*.4],[Math.cos(a)*.34,4.26,-.48+Math.sin(a)*.34],.022);}
 const main=new T.Group();main.name='MainRotor_Spin';main.position.set(0,4.52,-.48);root.add(main);
 cyl('Rotor hub',[0,0,0],.31,.2,steel,'y',main);sphere('Hub cap',[0,.15,0],[.24,.10,.24],dark,main);
 for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5,dir=new T.Vector3(Math.cos(a),0,Math.sin(a)),side=new T.Vector3(-Math.sin(a),0,Math.cos(a));
  const p=(r,w,y)=>dir.clone().multiplyScalar(r).addScaledVector(side,w).setY(y).toArray();
  rod('Blade grip',p(.18,0,0),p(1.2,0,0),.065,steel,main);rod('Pitch control',p(.35,-.15,-.2),p(.86,.12,.015),.023,steel,main);
  panel('Main rotor blade',[p(.97,-.15,0),p(7.2,-.17,-.13),p(7.28,.14,-.13),p(1.03,.28,.035)],steel,main);
  panel('Rotor blade underside',[p(1.03,.28,.02),p(7.28,.14,-.145),p(7.2,-.17,-.145),p(.97,-.15,-.015)],dark,main);
  panel('Blade warning tip',[p(6.94,-.168,-.12),p(7.2,-.17,-.125),p(7.28,.14,-.125),p(6.94,.15,-.12)],ivory,main);
 }
 const tail=new T.Group();tail.name='TailRotor_Spin';tail.position.set(-.33,5.52,-8.21);root.add(tail);
 cyl('Tail rotor axle',[0,0,0],.095,.45,steel,'x',tail);sphere('Tail rotor hub',[-.25,0,0],[.13,.15,.15],steel,tail);
 for(let i=0;i<3;i++){const a=i*Math.PI*2/3,p=(r,w)=>[-.25,Math.cos(a)*r-Math.sin(a)*w,Math.sin(a)*r+Math.cos(a)*w];rod('Tail blade root',p(.06,0),p(.31,0),.04,steel,tail);panel('Tail blade',[p(.24,-.09),p(1.28,-.09),p(1.34,.095),p(.24,.13)],steel,tail);panel('Tail tip',[p(1.12,-.09),p(1.28,-.09),p(1.34,.095),p(1.12,.10)],faction,tail);}
 // Merge each material separately; preserve rotor-local geometry and pivots.
 for(const [group,materials] of buckets)for(const [mat,list] of materials){const g=mergeVertices(mergeGeometries(list,false),1e-5);if(mat.normalMap)g.computeTangents();g.computeBoundingBox();g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.name=(group===root?'Airframe':group.name)+'_'+mat.name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);for(const part of list)part.dispose();}
 const times=Array.from({length:65},(_,i)=>i*.64/64);
 const spin=(node,axis,turns)=>{const q=[];for(let i=0;i<times.length;i++){const v=new T.Quaternion().setFromAxisAngle(axis,i/64*Math.PI*2*turns);q.push(v.x,v.y,v.z,v.w);}return new T.QuaternionKeyframeTrack(node.name+'.quaternion',times,q);};
 const animations=[new T.AnimationClip('Rotors_Continuous',.64,[spin(main,new T.Vector3(0,1,0),1),spin(tail,new T.Vector3(1,0,0),-5)])];
 let triangles=0,drawCalls=0;root.traverse(n=>{if(n.isMesh){drawCalls++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;}});
 root.userData.atlasDesign={kind:'scout',team,seats:10,parts,triangles,drawCalls,source:'Sandforge authored original transport helicopter GLB',geometry:'Mi-8/17-inspired rounded transport, twin turbines, five-blade main rotor and three-blade tail rotor',textures:'1024² embedded base color, normal, packed ORM',mainBlades:5,tailBlades:3};
 return {model:root,animations};
}
