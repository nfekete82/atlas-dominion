import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {UNITS,BUILDINGS,unitKinds,buildingKinds,unitSpec,buildingSpec} from '/src/reborn/catalog.js';
import {RULES} from '/src/reborn/config.js';

// Runtime adapter: game state, movement, combat, production and AI are owned
// exclusively by the original Simulation. 3D nodes are presentation only.
const UP=new THREE.Vector3(0,1,0);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const colors={blue:'#62c6e9',red:'#f19b73',neutral:'#d3c09b'};
const title=(v)=>v.name||v.kind||'';
const format=(n)=>Math.round(n).toLocaleString('de-DE');
const plain=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export class SandforgeBattlefield {
 constructor({game,world,terrain,scene,renderer,camera,controls,loader,groundMeshes,heightAt,pos,lite=false}){
  Object.assign(this,{game,world,terrain,scene,renderer,camera,controls,loader,groundMeshes,heightAt,pos,lite});
  this.units=new Map();this.bases=new Map();this.bastions=new Map();
  this.models=new Map();this.pending=new Set();this.selected=new Set();
  this.selectedBase=null;this.buildKind=null;this.attackMode=false;
  this.miniLast=0;this.uiLast=0;this.fogLast=0;
  this.fogEnabled=true;this.selectedRings=new Map();this.animations=new Map();
  this.defaultFactions=[0,1];
  this.maxModels=80;this.loadingCount=0;this.modelQueue=[];
  this.clickStart=null;this.groups=new Map();
  this.tracer=new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.96,depthWrite:false}));
  this.tracer.frustumCulled=false;scene.add(this.tracer);
  this.buildInterface();this.addFog();this.createBastions();
  this.attachInput();this.sync(true);
 }
 entityPosition(p){return this.pos(p.x,p.y,this.heightAt(p.x,p.y)+(UNITS[p.kind]?.flying?75+100*(p.flightHeight??1):0));}
 createFallback(kind,owner,type){
  const group=new THREE.Group(),team=owner===0?'#397f9d':'#9f5541',metal=new THREE.MeshStandardMaterial({color:team,metalness:.55,roughness:.53}),
   dark=new THREE.MeshStandardMaterial({color:'#444743',metalness:.45,roughness:.7});
  const make=(geo,mat,x,y,z)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  if(type==='unit'){
   if(['tank','rover','artillery'].includes(kind)){
    const length=kind==='tank'?77:kind==='artillery'?84:57;
    make(new THREE.BoxGeometry(44,15,length),metal,0,16,0);
    make(new THREE.BoxGeometry(32,12,length*.45),dark,0,30,0);
    for(const x of [-22,22])for(const z of [-length*.33,length*.33])make(new THREE.CylinderGeometry(10,10,7,12),dark,x,9,z).rotation.z=Math.PI*.5;
   }else if(['scout','bomber'].includes(kind)){
    make(new THREE.CapsuleGeometry(13,36,4,8),metal,0,15,0).rotation.x=Math.PI*.5;
    make(new THREE.BoxGeometry(95,2,15),dark,0,18,0);
   }else{
    make(new THREE.CapsuleGeometry(8,13,4,10),metal,0,22,0);
    make(new THREE.SphereGeometry(9,10,8),dark,0,42,0);
    make(new THREE.BoxGeometry(4,4,27),dark,10,23,-9);
   }
  }else{
   const w=BUILDINGS[kind]?.width??150,depth=w*.65;
   make(new THREE.BoxGeometry(w,9,depth),dark,0,5,0);
   make(new THREE.BoxGeometry(w*.84,42,depth*.8),metal,0,30,0);
   make(new THREE.BoxGeometry(w*.9,7,depth*.83),dark,0,56,0);
   make(new THREE.CylinderGeometry(6,9,45,10),dark,w*.2,80,-depth*.18);
  }
  return group;
 }
 async getModel(url){
  if(!this.models.has(url))this.models.set(url,this.loader.loadAsync(url).catch(e=>{this.models.delete(url);throw e;}));
  return this.models.get(url);
 }
 asset(kind,owner,type){
  const prefix='/src/assets/reborn/';
  if(type==='building')return prefix+'buildings-3d/'+kind+'-'+owner+'.glb';
  return prefix+(['rover','tank','artillery','scout','bomber'].includes(kind)?'animation/':'prototype/')+kind+'-'+owner+'.glb';
 }
 // Do not download every 15–25 MB faction model on the first frame.
 scheduleDetail(entry,entity,type){
  if(this.lite||entry.requested||this.loadingCount+this.modelQueue.length>=this.maxModels)return;
  entry.requested=true;
  const url=this.asset(entity.kind,entity.owner,type);
  this.modelQueue.push({url,entry,type});
  this.pumpModelQueue();
 }
 pumpModelQueue(){
  while(this.loadingCount<2&&this.modelQueue.length){
   const task=this.modelQueue.shift();this.loadingCount++;
   this.getModel(task.url).then(data=>{
    const {entry,type}=task;
    if(!entry.node.parent)return;
    const model=cloneSkeleton(data.scene),box0=new THREE.Box3().setFromObject(model);
    const dims=box0.getSize(new THREE.Vector3());
    const desired=type==='unit'?UNITS[entry.kind].width:BUILDINGS[entry.kind].width;
    const extent=Math.max(dims.x,dims.z);
    if(extent>.0001){
     const scale=desired/extent;model.scale.multiplyScalar(scale);
     model.position.set(-box0.getCenter(new THREE.Vector3()).x*scale,
      -box0.min.y*scale,-box0.getCenter(new THREE.Vector3()).z*scale);
    }
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    entry.node.remove(entry.placeholder);entry.node.add(model);entry.detail=model;
    if(type==='unit'&&data.animations.length){
     const mixer=new THREE.AnimationMixer(model);
     const idle=data.animations.find(a=>/idle/i.test(a.name))||data.animations[0];
     const walk=data.animations.find(a=>/walk|move|drive|operation/i.test(a.name))||idle;
     entry.animation={mixer,idle,walk,playing:null};
     this.playClip(entry,idle);
    }
   }).catch(err=>console.warn('3D asset fallback:',task.url,err.message))
    .finally(()=>{this.loadingCount--;this.pumpModelQueue();});
  }
 }
 playClip(entry,clip){
  if(!entry.animation||entry.animation.playing===clip)return;
  entry.animation.mixer.stopAllAction();
  entry.animation.mixer.clipAction(clip).reset().play();
  entry.animation.playing=clip;
 }
 spawnNode(entity,type){
  const node=new THREE.Group();
  node.name=type+'-'+entity.kind+'-'+entity.id;
  node.userData={id:entity.id,type};
  const placeholder=this.createFallback(entity.kind,entity.owner,type);
  node.add(placeholder);node.position.copy(this.entityPosition(entity));
  this.scene.add(node);
  const entry={node,placeholder,kind:entity.kind,owner:entity.owner,requested:false};
  this.scheduleDetail(entry,entity,type);return entry;
 }
 sync(force=false,dt=0){
  const aliveUnits=new Set(),aliveBases=new Set();
  for(const u of this.game.units){
   if(u.hp<=0||u.carrier)continue;
   aliveUnits.add(u.id);
   let entry=this.units.get(u.id);
   if(!entry){entry=this.spawnNode(u,'unit');this.units.set(u.id,entry);}
   entry.node.position.copy(this.entityPosition(u));
   entry.node.rotation.y=Math.PI*.5-u.angle;
   entry.node.visible=u.owner===0||this.game.canSee(0,u);
   if(entry.animation){
    this.playClip(entry,u.moving?entry.animation.walk:entry.animation.idle);
    if(entry.node.visible)entry.animation.mixer.update(Math.min(.05,dt));
   }
  }
  for(const [id,e] of this.units)if(!aliveUnits.has(id)){this.scene.remove(e.node);this.units.delete(id);this.selected.delete(id);}
  for(const b of this.game.bases){
   if(b.hp<=0)continue;
   aliveBases.add(b.id);
   let entry=this.bases.get(b.id);
   if(!entry){entry=this.spawnNode(b,'building');this.bases.set(b.id,entry);}
   entry.node.position.copy(this.entityPosition(b));
   entry.node.visible=b.owner===0||this.game.canSee(0,b);
   entry.node.scale.y=b.buildRemaining>0?.58:1;
  }
  for(const [id,e] of this.bases)if(!aliveBases.has(id)){this.scene.remove(e.node);this.bases.delete(id);if(this.selectedBase===id)this.selectedBase=null;}
  const known=new Set(this.game.territories.map(t=>t.id));
  for(const [id,entry] of this.bastions)if(!known.has(id)){this.scene.remove(entry.node);this.bastions.delete(id);}
  for(const territory of this.game.territories){
   const entry=this.bastions.get(territory.id);
   if(entry&&entry.owner!==territory.owner){entry.owner=territory.owner;entry.core.material.color.set(territory.owner===0?colors.blue:territory.owner===1?colors.red:colors.neutral);entry.halo.material.color.set(territory.owner===0?colors.blue:territory.owner===1?colors.red:colors.neutral);
    if(!this.lite)this.loadBastionModel(entry,territory.owner);}
  }
  this.updateSelectionRings();
  this.updateShots();
  const now=performance.now();
  if(force||now-this.fogLast>350){this.updateFog();this.fogLast=now;}
  if(force||now-this.uiLast>280){this.drawInterface();this.uiLast=now;}
  if(force||now-this.miniLast>700){this.drawMinimap();this.miniLast=now;}
 }
 async loadBastionModel(entry,owner){
  const version=(entry.version??0)+1;entry.version=version;
  try{
   const modelPath='/src/assets/reborn/buildings-3d/bastion-'+owner+'.glb';
   const data=await this.getModel(modelPath);
   if(version!==entry.version||!entry.node.parent)return;
   const detail=cloneSkeleton(data.scene);
   const box=new THREE.Box3().setFromObject(detail),size=box.getSize(new THREE.Vector3());
   const factor=116/Math.max(.0001,size.x,size.z),center=box.getCenter(new THREE.Vector3());
   detail.scale.multiplyScalar(factor);
   detail.position.set(-center.x*factor,-box.min.y*factor,-center.z*factor);
   detail.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
   if(entry.detail)entry.node.remove(entry.detail);
   entry.detail=detail;entry.node.add(detail);
   entry.pad.visible=false;entry.core.visible=false;
  }catch(error){console.warn('Bastion 3D model fallback',error);}
 }
 createBastions(){
  const base=new THREE.CylinderGeometry(38,40,9,12),ob=new THREE.CylinderGeometry(11,18,45,12);
  const stone=new THREE.MeshStandardMaterial({color:'#c4a77d',roughness:1});
  for(const t of this.game.territories){
   const node=new THREE.Group();node.name='bastion-'+t.id;
   node.position.copy(this.pos(t.point.x,t.point.y));
   const pad=new THREE.Mesh(base,stone);pad.position.y=5;pad.receiveShadow=true;node.add(pad);
   const core=new THREE.Mesh(ob,new THREE.MeshStandardMaterial({color:t.owner===0?colors.blue:t.owner===1?colors.red:colors.neutral,metalness:.7,roughness:.35}));
   core.position.y=33;core.castShadow=true;node.add(core);
   const halo=new THREE.Mesh(new THREE.TorusGeometry(49,2,6,48),new THREE.MeshBasicMaterial({color:t.owner===0?colors.blue:t.owner===1?colors.red:colors.neutral,transparent:true,opacity:.75}));
   halo.rotation.x=-Math.PI/2;halo.position.y=5;node.add(halo);
   this.scene.add(node);
   const entry={node,core,pad,owner:t.owner,halo};
   this.bastions.set(t.id,entry);
   if(!this.lite)this.loadBastionModel(entry,t.owner);
  }
 }
 addFog(){
  const grid=RULES.grid,bytes=new Uint8Array(grid*grid*4);
  this.fogTexture=new THREE.DataTexture(bytes,grid,grid,THREE.RGBAFormat,THREE.UnsignedByteType);
  this.fogTexture.magFilter=THREE.LinearFilter;this.fogTexture.minFilter=THREE.LinearFilter;
  this.fogTexture.wrapS=this.fogTexture.wrapT=THREE.ClampToEdgeWrapping;
  const mat=new THREE.ShaderMaterial({
   uniforms:{fogTex:{value:this.fogTexture},mapSize:{value:this.world.size}},
   vertexShader:'uniform float mapSize; varying vec2 fogUv; void main(){fogUv=vec2(position.x/mapSize+.5,position.z/mapSize+.5);vec3 p=position;p.y+=2.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
   fragmentShader:'uniform sampler2D fogTex;varying vec2 fogUv;void main(){float a=texture2D(fogTex,fogUv).a;gl_FragColor=vec4(.048,.057,.060,a);}',
   transparent:true,depthWrite:false,side:THREE.DoubleSide
  });
  this.fogNodes=this.groundMeshes.map(mesh=>{
   const layer=new THREE.Mesh(mesh.geometry,mat);layer.frustumCulled=false;
   layer.renderOrder=5;this.scene.add(layer);return layer;
  });
 }
 updateFog(){
  const {visible,explored}=this.game;
  const data=this.fogTexture.image.data;
  for(let i=0;i<this.world.blocked.length;i++){
   const k=i*4;
   data[k]=24;data[k+1]=30;data[k+2]=31;
   data[k+3]=visible[0][i]?0:explored[0][i]?95:160;
  }
  this.fogTexture.needsUpdate=true;
  this.fogNodes.forEach(n=>n.visible=this.fogEnabled);
 }
 updateShots(){
  const lines=[],tints=[];
  for(const shot of this.game.shots.slice(-110)){
   if(!this.game.canSee(0,shot.from)&&!this.game.canSee(0,shot.to))continue;
   const a=this.pos(shot.from.x,shot.from.y,this.heightAt(shot.from.x,shot.from.y)+27);
   const b=this.pos(shot.to.x,shot.to.y,this.heightAt(shot.to.x,shot.to.y)+27);
   lines.push(a.x,a.y,a.z,b.x,b.y,b.z);
   const c=shot.weapon==='rocket'||shot.weapon==='cannon'?[1,.58,.17]:shot.owner===0?[.55,.89,1]:[1,.47,.25];
   tints.push(...c,...c);
  }
  const geometry=this.tracer.geometry;
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(tints,3));
  geometry.computeBoundingSphere();
 }
 updateSelectionRings(){
  for(const [id,ring] of this.selectedRings)if(!this.selected.has(id)||!this.units.has(id)){
   this.scene.remove(ring);this.selectedRings.delete(id);
  }
  for(const id of this.selected){
   const unit=this.game.units.find(u=>u.id===id);
   if(!unit||unit.hp<=0)continue;
   let ring=this.selectedRings.get(id);
   if(!ring){
    ring=new THREE.Mesh(new THREE.TorusGeometry((unitSpec(unit).radius||12)+11,1.8,5,40),new THREE.MeshBasicMaterial({color:colors.blue,depthWrite:false,transparent:true,opacity:.9}));
    ring.rotation.x=-Math.PI/2;ring.renderOrder=9;this.scene.add(ring);
    this.selectedRings.set(id,ring);
   }
   ring.position.copy(this.entityPosition(unit));ring.position.y+=3;
  }
 }
 buildInterface(){
  const css=document.createElement('style');
  css.textContent='.sf-rts{position:absolute;z-index:10;right:17px;top:88px;width:258px;background:#152325ed;border:1px solid #54706e99;box-shadow:0 14px 35px #0006;border-radius:10px;backdrop-filter:blur(10px);padding:12px;font:12px system-ui;color:#eae9db}.sf-rts h3{font-size:13px;margin:5px 0 8px;color:#f4d9ae}.sf-rts .sf-line{display:flex;justify-content:space-between;margin:5px 0;color:#cad7d2}.sf-rts .sf-buttons{display:flex;flex-wrap:wrap;gap:5px}.sf-rts button{font-size:11px;min-height:30px;padding:5px 7px;border-radius:4px}.sf-rts button:disabled{opacity:.38;cursor:not-allowed}.sf-rts .sf-section{border-top:1px solid #ffffff28;margin-top:8px;padding-top:8px}.sf-rts .sf-btn-active{background:#826036!important;border-color:#ebb26c!important}.sf-map{width:224px;height:224px;display:block;margin:8px auto 3px;border:1px solid #a88a5c;cursor:crosshair;background:#ad8d62}.sf-rts .sf-help{font-size:10px;line-height:1.4;color:#a9b4ab}.sf-rts .sf-notice{min-height:18px;margin-top:6px;font-size:11px;color:#efc786}.sf-rts .sf-menu-title{font-size:10px;letter-spacing:.11em;color:#d4a866}@media(max-width:900px){.sf-rts{top:108px;right:8px;width:215px;max-height:67vh;overflow:auto}.sf-map{width:180px;height:180px}}';
  document.head.append(css);
  this.panel=document.createElement('aside');this.panel.className='sf-rts';
  this.panel.innerHTML='<div class="sf-menu-title">SANDFORGE / ECHTES 3D-RTS</div><div id="sf-stats" class="sf-line"></div><div class="sf-section" id="sf-actions"></div><div id="sf-selection" class="sf-section"></div><div class="sf-section"><div class="sf-buttons"><button data-action="save">Speichern</button><button data-action="load">Laden</button><button data-action="fog">Nebel an/aus</button></div></div><canvas id="sf-map" class="sf-map" width="224" height="224"></canvas><div class="sf-help">Linksklick auswählen · Shift + Klick erweitern · Rechtsklick bewegen · Mittlere Maustaste verschieben · Q/E drehen · A Angriff · Ctrl+1..5 Gruppen</div><div class="sf-notice" id="sf-message"></div>';
  document.body.append(this.panel);
  this.mini=this.panel.querySelector('#sf-map');
  this.panel.addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   const kind=button.dataset.build,unit=button.dataset.unit,action=button.dataset.action;
   if(kind){this.buildKind=kind;this.attackMode=false;this.message('Bauplatz wählen: '+BUILDINGS[kind].name);this.drawInterface();}
   if(unit){
    const producer=this.game.producer(0,unit);
    if(this.game.recruit(producer?.id??-1,unit))this.message(UNITS[unit].name+' in Auftrag');
    else this.message('Nicht möglich: Gebäude, Kapazität oder Credits prüfen');
    this.drawInterface();
   }
   if(action==='fog'){this.fogEnabled=!this.fogEnabled;this.updateFog();this.message('Nebel des Krieges '+(this.fogEnabled?'aktiv':'deaktiviert'));}
   if(action==='save'){try{localStorage.setItem('sandforge:webgl:v1',JSON.stringify(this.game.save()));this.message('3D-Kampagne gespeichert');}catch(error){this.message('Speichern fehlgeschlagen: '+error.message);}}
   if(action==='load'){this.loadSave();}
   if(action==='cancel'){this.buildKind=null;this.drawInterface();}
   if(action==='select-all'){this.selected=new Set(this.game.units.filter(u=>u.hp>0&&u.owner===0&&!u.carrier).map(u=>u.id));this.selectedBase=null;this.drawInterface();}
  });
  this.mini.addEventListener('click',e=>{
   const rect=this.mini.getBoundingClientRect();
   const x=(e.clientX-rect.left)/rect.width*this.world.size,z=(e.clientY-rect.top)/rect.height*this.world.size;
   const dest=this.pos(x,z);
   const delta=dest.clone().sub(this.controls.target);
   this.controls.target.add(delta);this.camera.position.add(delta);this.controls.update();
  });
 }
 loadSave(){
  try{
   const raw=localStorage.getItem('sandforge:webgl:v1');
   if(!raw){this.message('Kein gespeicherter 3D-Spielstand');return;}
   const snapshot=JSON.parse(raw);
   if(snapshot.seed!==this.game.seed||snapshot.mapVersion!==this.game.world.mapVersion){
    location.href='/webgl-preview.html?bastions='+this.game.territories.length+'&seed='+snapshot.seed+'&resume=1';return;
   }
   location.href='/webgl-preview.html?bastions='+this.game.territories.length+'&seed='+this.game.seed+'&resume=1';
  }catch(error){this.message('Laden fehlgeschlagen: '+error.message);}
 }
 message(text){
  this.panel.querySelector('#sf-message').textContent=text;
 }
 drawInterface(){
  const g=this.game,s=this.panel.querySelector('#sf-stats'),a=this.panel.querySelector('#sf-actions'),el=this.panel.querySelector('#sf-selection');
  s.innerHTML='<span>Credits <b>'+format(g.credits[0])+'</b></span><span>+ '+format(g.income(0))+' / 10s</span><span>'+g.count(0)+'/'+RULES.capacity+'</span>';
  const button=(data,label,disabled=false,active=false)=>'<button '+data+(disabled?' disabled':'')+(active?' class="sf-btn-active"':'')+'>'+plain(label)+'</button>';
  const actionsMarkup='<h3>Gebäude & Produktion</h3><div class="sf-buttons">'+
   buildingKinds.map(kind=>button('data-build="'+kind+'"',BUILDINGS[kind].name+' '+BUILDINGS[kind].cost,
    g.credits[0]<BUILDINGS[kind].cost||!g.hasHeadquarters(0)&&kind!=='headquarters',this.buildKind===kind)).join('')+
   button('data-action="cancel"','Abbrechen',false,false)+'</div><div class="sf-section sf-buttons">'+
   unitKinds.map(kind=>button('data-unit="'+kind+'"',UNITS[kind].name+' '+UNITS[kind].cost,
    !g.producer(0,kind)||g.credits[0]<UNITS[kind].cost||g.count(0)+g.queued(0)>=RULES.capacity)).join('')+'</div>';
  if(this.previousActionsMarkup!==actionsMarkup){
   a.innerHTML=actionsMarkup;this.previousActionsMarkup=actionsMarkup;
  }
  const chosen=this.game.units.filter(u=>this.selected.has(u.id)&&u.hp>0);
  const base=this.game.bases.find(b=>b.id===this.selectedBase&&b.hp>0);
  const text=chosen.length?chosen.length===1?UNITS[chosen[0].kind].name+' · '+Math.ceil(chosen[0].hp)+' LP':chosen.length+' Einheiten ausgewählt'
   :base?BUILDINGS[base.kind].name+' · '+Math.ceil(base.hp)+' LP'+(base.queue.length?' · '+base.queue.length+' in Produktion':''):'Keine Auswahl';
  const selectionMarkup='<h3>Auswahl / Kommandos</h3><div>'+plain(text)+'</div><div class="sf-buttons">'+
   button('data-action="select-all"','Alle Truppen')+'</div>';
  if(this.previousSelectionMarkup!==selectionMarkup){
   el.innerHTML=selectionMarkup;this.previousSelectionMarkup=selectionMarkup;
  }
  if(g.status!=='playing')this.message(g.status==='victory'?'SIEG – alle Gegner besiegt':'NIEDERLAGE');
 }
 drawMinimap(){
  const ctx=this.mini.getContext('2d');if(!ctx)return;
  const width=this.mini.width,height=this.mini.height,map=this.world;
  ctx.fillStyle='#c9a576';ctx.fillRect(0,0,width,height);
  const cell=map.blocked.length?map.size/RULES.grid:20,scale=width/map.size;
  ctx.fillStyle='#705741';
  for(let iy=0;iy<RULES.grid;iy+=3)for(let ix=0;ix<RULES.grid;ix+=3){
   if(map.blocked[iy*RULES.grid+ix])ctx.fillRect(ix/ RULES.grid*width,iy/RULES.grid*height,3*width/RULES.grid,3*height/RULES.grid);
  }
  for(const t of this.game.territories){
   ctx.fillStyle=t.owner===0?colors.blue:t.owner===1?colors.red:'#eed3a0';
   ctx.beginPath();ctx.arc(t.point.x*scale,t.point.y*scale,3,0,Math.PI*2);ctx.fill();
  }
  for(const u of this.game.units)if(u.hp>0&&(u.owner===0||this.game.canSee(0,u))){
   ctx.fillStyle=u.owner===0?'#53f4e2':'#ff7151';
   ctx.fillRect(u.x*scale-1.3,u.y*scale-1.3,3,3);
  }
  if(this.fogEnabled){
   for(let iy=0;iy<RULES.grid;iy+=4)for(let ix=0;ix<RULES.grid;ix+=4){
    const index=iy*RULES.grid+ix,alpha=this.game.visible[0][index]?0:this.game.explored[0][index]?.25:.60;
    if(!alpha)continue;ctx.fillStyle='rgba(7,21,22,'+alpha+')';
    ctx.fillRect(ix/RULES.grid*width,iy/RULES.grid*height,width/RULES.grid*4,height/RULES.grid*4);
   }
  }
  const origin=this.controls.target;
  ctx.strokeStyle='#fff7d8';ctx.strokeRect((origin.x+map.size*.5)*scale-11,(origin.z+map.size*.5)*scale-11,22,22);
 }
 terrainPoint(event){
  const rect=this.renderer.domElement.getBoundingClientRect();
  const ndc=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,this.camera);
  const hits=ray.intersectObjects(this.groundMeshes,false);
  if(!hits.length)return null;
  const p=hits[0].point;return {x:p.x+this.world.size*.5,y:p.z+this.world.size*.5};
 }
 pointerUp(event){
  if(!this.clickStart||event.button!==this.clickStart.button)return;
  const moved=Math.hypot(event.clientX-this.clickStart.x,event.clientY-this.clickStart.y);
  this.clickStart=null;if(moved>7)return;
  const p=this.terrainPoint(event);if(!p)return;
  if(event.button===0){
   if(this.buildKind){
    const kind=this.buildKind,workerIds=this.game.units.filter(u=>this.selected.has(u.id)&&u.kind==='engineer'&&u.owner===0).map(u=>u.id);
    const blocked=this.game.buildError(0,kind,p);
    if(blocked){this.message(blocked);return;}
    const result=this.game.build(0,kind,p,workerIds.length?workerIds:undefined);
    if(result){this.message(BUILDINGS[kind].name+' beauftragt');this.buildKind=null;this.sync(true);}
    else this.message('Kein verfügbarer Pionier oder keine Route zum Bauplatz');
    return;
   }
   const near=this.game.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier).map(u=>({u,d:dist(u,p)})).sort((a,b)=>a.d-b.d)[0];
   if(near&&near.d<Math.max(45,unitSpec(near.u).radius+25)){
    if(!event.shiftKey)this.selected.clear();
    if(this.selected.has(near.u.id)&&event.shiftKey)this.selected.delete(near.u.id);
    else this.selected.add(near.u.id);
    this.selectedBase=null;this.drawInterface();return;
   }
   const base=this.game.bases.filter(b=>b.owner===0&&b.hp>0).map(b=>({b,d:dist(b,p)})).sort((a,b)=>a.d-b.d)[0];
   if(base&&base.d<base.b.radius+55){this.selectedBase=base.b.id;this.selected.clear();this.drawInterface();return;}
   if(!event.shiftKey){this.selected.clear();this.selectedBase=null;this.drawInterface();}
  }else if(event.button===2){
   if(!this.selected.size)return;
   const ids=[...this.selected],kind=this.attackMode?'attackMove':'move';
   const accepted=this.game.command(ids,{x:p.x,y:p.y,kind});
   this.message(accepted?accepted+' Einheit(en): '+(this.attackMode?'Angriff':'Marsch'):'Ziel nicht erreichbar');
   this.attackMode=false;
  }
 }
 attachInput(){
  // The left mouse button belongs to RTS selection; middle mouse pans and
  // right-drag rotates. A right *click* issues a command.
  this.controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};
  const canvas=this.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{this.clickStart={x:e.clientX,y:e.clientY,button:e.button};});
  canvas.addEventListener('pointerup',e=>this.pointerUp(e));
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('keydown',event=>{
   if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
   if(event.code==='Escape'){this.buildKind=null;this.attackMode=false;this.drawInterface();}
   if(event.code==='KeyA'){this.attackMode=true;this.message('Angriffsbewegung: Rechtsklick auf Ziel');}
   if(event.code==='KeyH'){this.selected=new Set(this.game.units.filter(u=>u.hp>0&&u.owner===0&&!u.carrier).map(u=>u.id));this.drawInterface();}
   const number=Number(event.code.replace('Digit',''));
   if(event.code.startsWith('Digit')&&number>=1&&number<=5){
    if(event.ctrlKey||event.metaKey){event.preventDefault();this.groups.set(number,new Set(this.selected));this.message('Gruppe '+number+' gespeichert');}
    else if(this.groups.has(number)){this.selected=new Set([...this.groups.get(number)].filter(id=>this.units.has(id)));this.drawInterface();}
   }
  });
 }
}
