import { ASSETS, RULES, clamp, distance, type Point } from './config.js';
import { Simulation, type Base, type Unit } from './simulation.js';
import { type Territory } from './world.js';
import { BUILDINGS, UNITS, buildingSpec, unitSpec, type BuildingKind, type UnitKind } from './catalog.js';
import { UnitPresentation } from './unit-presentation.js';
import { BuildingPresentation } from './building-presentation.js';
import { TERRAIN_FRAMES, TERRAIN_PLACEMENTS } from './terrain-art.js';
import { paintGeneratedTerrain } from './terrain-presentation.js';

interface Sprite { image:HTMLImageElement; x:number; y:number; w:number; h:number; center?:number; foot?:number; bodyWidth?:number; bodyHeight?:number }
export class Renderer {
  readonly units=new UnitPresentation();
  readonly structures=new BuildingPresentation();
  private animationGame:Simulation|null=null;private seenImpacts=new WeakSet<object>();
  readonly context:CanvasRenderingContext2D;
  readonly mini:CanvasRenderingContext2D;
  camera={x:1200,y:2500,zoom:1};
  selected=new Set<number>(); selectedBase:number|null=null; overlay=false; attackMode=false;
  placement:BuildingKind|null=null;pointer:Point|null=null;
  box:{from:Point;to:Point}|null=null; marker:{point:Point;life:number;attack:boolean}|null=null;
  width=0;height=0;terrain!:HTMLImageElement; infantry!:Sprite; headquarters!:Sprite;
  private bastions!:Record<'blue'|'red'|'neutral',Sprite>;
  private readonly reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private buildings={} as Record<BuildingKind,Sprite>;private redBuildings={} as Record<BuildingKind,Sprite>;
  private cliffs:Sprite[]=[];private shadows=new Map<Sprite,Sprite>();private icons=new Map<string,string>();
  private terrainSurface=document.createElement('canvas');private interpolation=1;
  private sand=new Image();
  private fog=document.createElement('canvas');private fogRevision=-1;
  private miniTerrain=document.createElement('canvas');
  constructor(readonly canvas:HTMLCanvasElement,readonly miniCanvas:HTMLCanvasElement,public game:Simulation){
    this.context=canvas.getContext('2d',{alpha:false})!;this.mini=miniCanvas.getContext('2d',{alpha:false})!;
    this.fog.width=this.fog.height=RULES.grid;this.miniTerrain.width=this.miniTerrain.height=224;
    this.resize();
  }
  private async sprite(url:string,grounded=false):Promise<Sprite>{
    const image=new Image();image.src=url;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    let x=c.width,y=c.height,r=0,b=0;
    for(let j=0;j<c.height;j++)for(let i=0;i<c.width;i++)if(pixels[(j*c.width+i)*4+3]>32){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}
    const result:Sprite={image,x,y,w:r-x+1,h:b-y+1};
    if(grounded){
      let left=image.width,top=image.height,right=0,bottom=0;
      // Register solid armor, excluding the authored translucent ground shadow.
      for(let j=0;j<c.height;j++)for(let i=0;i<c.width;i++){
        const at=(j*c.width+i)*4;
        if(pixels[at+3]>200&&Math.max(pixels[at],pixels[at+1],pixels[at+2])>75){left=Math.min(left,i);top=Math.min(top,j);right=Math.max(right,i);bottom=Math.max(bottom,j);}
      }
      result.center=(left+right)/2-x;result.foot=bottom-y+1;result.bodyWidth=right-left+1;result.bodyHeight=bottom-top+1;
    }
    return result;
  }
  async load():Promise<void>{
    this.terrain=new Image();this.terrain.src=ASSETS.terrain;
    this.sand.src='/src/assets/reborn/sand-ripples-v2.png';
    const [cliffs]=await Promise.all([this.sprite(ASSETS.cliffs),this.terrain.decode(),this.units.load(),this.structures.load(),this.sand.decode()]);
    const infantry=this.units.asset('infantry'),frame=infantry.data.frames[0];
    this.infantry={image:infantry.image,x:frame.x,y:frame.y,w:frame.w,h:frame.h};
    for(const kind of Object.keys(BUILDINGS) as BuildingKind[]){this.buildings[kind]=this.structures.sprite(kind,0);this.redBuildings[kind]=this.structures.sprite(kind,1);}
    this.headquarters=this.buildings.headquarters;
    this.bastions={blue:this.structures.sprite('bastion',0),red:this.structures.sprite('bastion',1),neutral:this.structures.sprite('bastion',-1)};
    this.cliffs=TERRAIN_FRAMES.map(frame=>({...frame,image:cliffs.image}));
    await Promise.all(this.cliffs.map(async sprite=>{
      const c=document.createElement('canvas');c.width=sprite.w;c.height=sprite.h;const ctx=c.getContext('2d')!;
      ctx.drawImage(sprite.image,sprite.x,sprite.y,sprite.w,sprite.h,0,0,c.width,c.height);ctx.globalCompositeOperation='source-in';ctx.fillStyle='#191713';ctx.fillRect(0,0,c.width,c.height);
      const image=new Image();image.src=c.toDataURL();await image.decode();this.shadows.set(sprite,{image,x:0,y:0,w:c.width,h:c.height});
    }));
    this.prepareMap();this.home();
  }
  private prepareMap():void {
    this.prepareTerrain();
    const mini=this.miniTerrain.getContext('2d',{willReadFrequently:true})!;mini.drawImage(this.terrainSurface,0,0,224,224);mini.save();mini.scale(224/RULES.worldSize,224/RULES.worldSize);this.paintCliffs(mini);mini.restore();
  }
  private prepareTerrain():void{
    if(this.game.world.generated){paintGeneratedTerrain(this.terrainSurface,this.game.world,this.sand);return;}
    const surface=this.terrainSurface;surface.width=surface.height=RULES.worldSize;
    const ctx=surface.getContext('2d',{willReadFrequently:true})!,tile=document.createElement('canvas');tile.width=tile.height=190;
    const tc=tile.getContext('2d')!;tc.drawImage(this.terrain,445/1254*this.terrain.width,675/1254*this.terrain.height,190/1254*this.terrain.width,190/1254*this.terrain.height,0,0,190,190);
    const detail=tc.getImageData(0,0,190,190).data;tc.filter='blur(6px)';tc.drawImage(tile,0,0);const low=tc.getImageData(0,0,190,190).data;
    const pixels=ctx.createImageData(surface.width,surface.height);let seed=92531;
    const noise=new Float32Array(32*32);for(let i=0;i<noise.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=(seed/4294967296-.5)*18;}
    for(let y=0;y<surface.height;y++)for(let x=0;x<surface.width;x++){
      const gx=x/128,gy=y/128,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
      const n=(noise[iy*32+ix]*(1-fx)+noise[iy*32+ix+1]*fx)*(1-fy)+(noise[(iy+1)*32+ix]*(1-fx)+noise[(iy+1)*32+ix+1]*fx)*fy;
      const tx=(x+Math.floor(y/128)*73)%190,ty=(y+Math.floor(x/128)*59)%190,ti=(ty*190+tx)*4,i=(y*surface.width+x)*4;
      const grain=(detail[ti]+detail[ti+1]+detail[ti+2]-low[ti]-low[ti+1]-low[ti+2])/3*.95;
      pixels.data[i]=208+n+grain;pixels.data[i+1]=151+n*.86+grain;pixels.data[i+2]=88+n*.65+grain;pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
  }
  private paintCliffs(ctx:CanvasRenderingContext2D):void{
    if(this.game.world.generated)return;
    for(const p of TERRAIN_PLACEMENTS){const sprite=this.cliffs[p.frame],shadow=this.shadows.get(sprite);
      if(shadow){ctx.save();ctx.globalAlpha=.25;ctx.translate(p.x+p.w/2,p.y+p.h-2);ctx.transform(1,0,-.42,-.14,0,0);ctx.drawImage(shadow.image,shadow.x,shadow.y,shadow.w,shadow.h,-p.w/2,-p.h,p.w,p.h);ctx.restore();}
      ctx.drawImage(sprite.image,sprite.x,sprite.y,sprite.w,sprite.h,p.x,p.y,p.w,p.h);
    }
  }
  icon(type:'unit'|'building',kind:UnitKind|BuildingKind):string{
    const key=type+kind,cached=this.icons.get(key);if(cached)return cached;
    if(type==='building'){const result=this.structures.icon(kind as BuildingKind);this.icons.set(key,result);return result;}
    const c=document.createElement('canvas');c.width=c.height=160;const ctx=c.getContext('2d')!;
    {
      const {data,image}=this.units.asset(kind as UnitKind),frame=data.frames[data.clips.idle.frames[1][0]],tile=document.createElement('canvas');tile.width=frame.w;tile.height=frame.h;const tc=tile.getContext('2d')!;tc.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
      for(const tag of ['turret','barrel'])if(data.clips[tag]){const layer=data.frames[data.clips[tag].frames[1][0]];tc.drawImage(image,layer.x,layer.y,layer.w,layer.h,frame.pivot[0]-layer.pivot[0],frame.pivot[1]-layer.pivot[1],layer.w,layer.h);}
      const pixels=tc.getImageData(0,0,frame.w,frame.h).data;let left=frame.w,top=frame.h,right=0,bottom=0;
      for(let y=0;y<frame.h;y++)for(let x=0;x<frame.w;x++)if(pixels[(y*frame.w+x)*4+3]>180){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      const width=right-left+1,height=bottom-top+1,scale=Math.min(148/width,148/height);ctx.imageSmoothingEnabled=false;ctx.drawImage(tile,left,top,width,height,(160-width*scale)/2,156-height*scale,width*scale,height*scale);
    }
    if(kind==='engineer'||kind==='heavy'){ctx.fillStyle=kind==='engineer'?'#edbd61':'#86d4f6';ctx.fillRect(117,112,28,28);ctx.fillStyle='#10202a';ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText(kind==='engineer'?'+':'Ⅱ',131,135);}
    const result=c.toDataURL();this.icons.set(key,result);return result;
  }
  resize():void {
    const dpr=Math.min(2,window.devicePixelRatio||1);this.width=this.canvas.clientWidth;this.height=this.canvas.clientHeight;
    this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);
    this.context.setTransform(dpr,0,0,dpr,0,0);this.boundCamera();
  }
  home():void {const b=this.game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);if(b){const side=document.getElementById('sidebar')?.getBoundingClientRect().width??0;this.camera.x=b.x+this.width/2-(this.width-side-24)*.33;this.camera.y=b.y-Math.min(this.height*.63,this.height-300)+this.height/2;this.camera.zoom=1;this.boundCamera();}}
  invalidate():void{if(this.infantry)this.prepareMap();this.fogRevision=-1;this.units.clear();this.seenImpacts=new WeakSet();}
  boundCamera():void {
    const w=this.width/this.camera.zoom/2,h=this.height/this.camera.zoom/2,s=RULES.worldSize;
    this.camera.x=w>=s/2?s/2:clamp(this.camera.x,w,s-w);this.camera.y=h>=s/2?s/2:clamp(this.camera.y,h,s-h);
  }
  screen(p:Point):Point{return {x:(p.x-this.camera.x)*this.camera.zoom+this.width/2,y:(p.y-this.camera.y)*this.camera.zoom+this.height/2};}
  world(p:Point):Point{return {x:(p.x-this.width/2)/this.camera.zoom+this.camera.x,y:(p.y-this.height/2)/this.camera.zoom+this.camera.y};}
  zoom(delta:number,screen:Point={x:this.width/2,y:this.height/2}):void {
    const before=this.world(screen);this.camera.zoom=clamp(this.camera.zoom*Math.exp(-delta*.001),.38,1.9);
    const after=this.world(screen);this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;this.boundCamera();
  }
  private polygon(points:Point[]):void {const c=this.context;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}
  private spriteDraw(s:Sprite,p:Point,width:number,flip=false,alpha=1):void{
    const c=this.context,scale=width/(s.bodyWidth??s.w);c.save();c.globalAlpha=alpha;c.translate(p.x,p.y);if(flip)c.scale(-1,1);
    const center=s.bodyWidth===undefined?s.w/2:s.center??s.w/2;
    c.drawImage(s.image,s.x,s.y,s.w,s.h,-center*scale,-(s.foot??s.h)*scale,s.w*scale,s.h*scale);c.restore();
  }
  private bar(p:Point,width:number,ratio:number,color:string):void{
    const c=this.context;c.fillStyle='#0a0d10d9';c.fillRect(p.x-width/2-1,p.y-1,width+2,5);
    c.fillStyle=color;c.fillRect(p.x-width/2,p.y,width*clamp(ratio,0,1),3);
  }
  private drawUnit(u:Unit):void {
    const c=this.context,selected=this.selected.has(u.id),blue=u.owner===0,spec=unitSpec(u);
    const p={x:u.previousX+(u.x-u.previousX)*this.interpolation,y:u.previousY+(u.y-u.previousY)*this.interpolation};
    if(selected){c.strokeStyle='#88cffa';c.lineWidth=1/this.camera.zoom;c.beginPath();c.ellipse(p.x,p.y,15,6,0,0,Math.PI*2);c.stroke();}
    this.units.draw(c,u,p);
    if(selected||u.hp<spec.hp){const height=spec.group==='Infanterie'?56:spec.width*.68+(spec.flying?32:0);this.bar({x:p.x,y:p.y-height},spec.group==='Infanterie'?27:spec.width*.55,u.hp/spec.hp,blue?'#75c5e8':'#ed7866');}
  }

  private drawBase(b:Base,alpha=1):void {
    const c=this.context,selected=this.selectedBase===b.id,spec=buildingSpec(b),sprite=(b.owner===0?this.buildings:this.redBuildings)[b.kind];
    const anchor={x:b.x,y:b.y},height=spec.width*(sprite.bodyHeight??sprite.h)/(sprite.bodyWidth??sprite.w);
    if(b.hp<=0){this.spriteDraw(sprite,anchor,spec.width,false,.18);return;}
    if(selected){c.strokeStyle='#78c8f1';c.lineWidth=1.1;c.setLineDash([8,5]);c.beginPath();c.ellipse(b.x,b.y-8,spec.radius+17,(spec.radius+17)*.47,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
    this.spriteDraw(sprite,anchor,spec.width,false,alpha*(b.buildRemaining>0?.5:1));
    if(b.buildRemaining<=0)this.structures.drawActivity(c,b.kind,b.owner,anchor,spec.width,this.game.time,this.reducedMotion,alpha);
    if(b.buildRemaining>0){
      const progress=1-b.buildRemaining/spec.buildTime;c.save();c.beginPath();c.rect(b.x-spec.width/2,anchor.y-height*progress,spec.width,height*progress);c.clip();this.spriteDraw(sprite,anchor,spec.width);c.restore();
      this.bar({x:b.x,y:b.y+spec.radius*.46+6},spec.width*.6,progress,'#e9bb61');c.fillStyle='#f1d48e';c.font='10px monospace';c.textAlign='center';c.fillText(`BAU ${Math.ceil(b.buildRemaining)} S`,b.x,b.y+spec.radius*.46+24);
    }
    if(selected||b.hp<spec.hp)this.bar({x:b.x,y:anchor.y-height-8},86,b.hp/spec.hp,b.owner===0?'#75c5e8':'#ed7866');
    if(b.queue.length&&b.owner===0)this.bar({x:b.x,y:b.y+24},75,b.production/b.queue[0],'#dfb278');
    if(selected&&b.rally){c.strokeStyle='#94d9f399';c.setLineDash([5,6]);c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.rally.x,b.rally.y);c.stroke();c.setLineDash([]);
      c.fillStyle='#9dddff';c.fillRect(b.rally.x-1,b.rally.y-30,2,30);c.beginPath();c.moveTo(b.rally.x,b.rally.y-30);c.lineTo(b.rally.x+17,b.rally.y-24);c.lineTo(b.rally.x,b.rally.y-18);c.fill();}
  }
  private paintSandWind(time:number):void {
    if(this.reducedMotion)return;
    const c=this.context,step=155,size=RULES.worldSize,halfW=this.width/this.camera.zoom/2,halfH=this.height/this.camera.zoom/2;
    const left=Math.max(0,Math.floor((this.camera.x-halfW-140)/step)),right=Math.min(Math.ceil(size/step),Math.ceil((this.camera.x+halfW+140)/step));
    const top=Math.max(0,Math.floor((this.camera.y-halfH-60)/step)),bottom=Math.min(Math.ceil(size/step),Math.ceil((this.camera.y+halfH+60)/step));
    c.save();c.lineCap='round';
    for(let gy=top;gy<=bottom;gy++)for(let gx=left;gx<=right;gx++){
      const seed=((Math.imul(gx+1,73856093)^Math.imul(gy+1,19349663))>>>0)/4294967296;
      const phase=(time*.085+seed*7)%1,envelope=Math.sin(phase*Math.PI)**2;
      const x=gx*step+seed*90+phase*65,y=gy*step+seed*125+Math.sin(time*.3+seed*20)*2;
      if(x<0||y<0||x>=size||y>=size||!this.game.canSee(0,{x,y}))continue;
      const cell=Math.floor(y/this.game.world.cell)*RULES.grid+Math.floor(x/this.game.world.cell);
      if(this.game.world.blocked[cell])continue;
      const length=34+seed*75,gradient=c.createLinearGradient(x,y,x+length,y+12);
      gradient.addColorStop(0,'#efd5a800');gradient.addColorStop(.45,`rgba(255,227,174,${.07*envelope})`);gradient.addColorStop(1,'#efd5a800');
      c.strokeStyle=gradient;
      for(let strand=0;strand<3;strand++){
        const offset=strand*2.4;c.lineWidth=strand===1?2.2:.6;
        c.beginPath();c.moveTo(x,y+offset);c.bezierCurveTo(x+length*.35,y-4+offset,x+length*.72,y+14+offset,x+length,y+10+offset);c.stroke();
      }
    }
    c.restore();
  }
  private updateFog():void {
    if(this.fogRevision===this.game.revision)return;this.fogRevision=this.game.revision;
    const c=this.fog.getContext('2d')!,data=c.createImageData(RULES.grid,RULES.grid),v=this.game.visible[0],e=this.game.explored[0];
    for(let i=0;i<v.length;i++){data.data[i*4]=3;data.data[i*4+1]=5;data.data[i*4+2]=7;data.data[i*4+3]=v[i]?0:e[i]?177:255;}
    c.putImageData(data,0,0);
  }
  private drawBastion(t:Territory,dim=false):void{
    const c=this.context,g=this.game,p=t.point,color=t.owner===0?'#72cfff':t.owner===1?'#ff7869':'#f4f5f4';
    c.save();if(dim)c.globalAlpha=.32;
    this.spriteDraw(this.bastions[t.owner===0?'blue':t.owner===1?'red':'neutral'],p,67,false,dim?.32:1);
    this.structures.drawActivity(c,'bastion',t.owner,p,67,g.time,this.reducedMotion,dim?.32:1);
    c.font='500 10px system-ui';c.textAlign='center';c.fillStyle='#100e0b99';c.fillRect(p.x-53,p.y+19,106,30);
    c.fillStyle='#e1d2b7';c.fillText(t.name.toLocaleUpperCase('de-DE'),p.x,p.y+31);c.fillStyle=color;c.font='10px monospace';c.fillText(`+${t.income} / 10 s`,p.x,p.y+43);
    if(!dim&&t.progress>0){const contested=g.units.some(u=>u.owner!==t.capturing&&distance(u,p)<RULES.captureRadius);
      this.bar({x:p.x,y:p.y-99},65,t.progress/RULES.captureTime,contested?'#e6b475':t.capturing===0?'#71c5f4':'#ed7f6d');
      c.fillStyle='#f0dfbe';c.font='10px monospace';c.fillText(contested?'UMKÄMPFT':`SICHERN ${Math.round(t.progress/RULES.captureTime*100)} %`,p.x,p.y-106);}
    c.restore();
  }
  render(dt:number,interpolation=1):void {
    if(!this.terrain?.complete||!this.infantry)return;
    const c=this.context,g=this.game,s=RULES.worldSize;this.updateFog();
    if(this.animationGame!==g){this.units.clear();this.seenImpacts=new WeakSet();this.animationGame=g;}
    this.units.update(g.units,g.paused?0:dt,p=>g.canSee(0,p));
    for(const shot of g.shots)if(!this.seenImpacts.has(shot)){this.seenImpacts.add(shot);if(g.canSee(0,shot.to))this.units.particles.emit('impact',shot.to);}
    this.interpolation=g.paused?1:clamp(interpolation,0,1);
    c.fillStyle='#030507';c.fillRect(0,0,this.width,this.height);c.save();
    c.translate(this.width/2,this.height/2);c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);
    c.drawImage(this.terrainSurface,0,0);
    this.paintSandWind(g.time);
    this.paintCliffs(c);
    for(const t of g.territories){
      if(t.owner>=0){this.polygon(t.polygon);c.fillStyle=t.owner===0?'#53b4ee0b':'#e257490b';c.fill();}
      if(this.overlay){this.polygon(t.polygon);c.strokeStyle=t.owner===0?'#83d3ff8c':t.owner===1?'#e2766c8c':'#ead2ac55';c.lineWidth=1.2/this.camera.zoom;c.stroke();}
    }
    // Fog shades terrain; entities use visibility at their ground position.
    // Drawing it over sprites clipped tall masts against unrelated terrain cells.
    c.imageSmoothingEnabled=true;c.drawImage(this.fog,0,0,s,s);
    this.units.drawCorpses(c,p=>g.canSee(0,p));
    const entities:({y:number;unit:Unit}|{y:number;base:Base}|{y:number;territory:Territory})[]=[];
    for(const t of g.territories)if(g.canSee(0,t.point))entities.push({y:t.point.y,territory:t});else if(g.hasExplored(0,t.point))this.drawBastion(t,true);
    for(const b of g.bases)if(b.owner===0||g.canSee(0,b))entities.push({y:b.y,base:b});
    for(const m of g.memories[0])if(m.owner!==0&&!g.canSee(0,m)){
      const kind=m.kind??'headquarters';this.spriteDraw(this.redBuildings[kind],{x:m.x,y:m.y+BUILDINGS[kind].radius*.46},BUILDINGS[kind].width,false,m.hp>0?.22:.07);
    }
    for(const u of g.units)if(u.owner===0||g.canSee(0,u))entities.push({y:u.y,unit:u});
    entities.sort((a,b)=>a.y-b.y);for(const e of entities)if('unit' in e)this.drawUnit(e.unit);else if('base' in e)this.drawBase(e.base);else this.drawBastion(e.territory);
    if(this.placement&&this.pointer){
      const spec=BUILDINGS[this.placement],p=this.pointer,valid=!g.buildError(0,this.placement,p);
      c.save();c.strokeStyle=valid?'#96e0b8':'#f27e67';c.fillStyle=valid?'#6bcda52a':'#e66a552a';c.lineWidth=1.5;
      c.beginPath();c.moveTo(p.x-spec.radius,p.y);c.lineTo(p.x,p.y-spec.radius*.5);c.lineTo(p.x+spec.radius,p.y);c.lineTo(p.x,p.y+spec.radius*.5);c.closePath();c.fill();c.stroke();
      this.spriteDraw(this.buildings[this.placement],{x:p.x,y:p.y+spec.radius*.46},spec.width,false,.65);c.restore();
    }
    for(const shot of g.shots)if(g.canSee(0,shot.from)||g.canSee(0,shot.to)){
      const shooter=g.units.find(u=>u.owner===shot.owner&&Math.hypot(u.x-shot.from.x,u.y-18-shot.from.y)<5),from=shooter?this.units.muzzleFor(shooter):shot.from;
      c.strokeStyle=shot.owner===0?'#b3e5ff':'#ffb48e';c.lineWidth=1.5;c.globalAlpha=shot.life/.14;c.beginPath();c.moveTo(from.x,from.y);c.lineTo(shot.to.x,shot.to.y-8);c.stroke();c.globalAlpha=1;}
    this.units.particles.draw(c,p=>g.canSee(0,p));
    if(this.marker){this.marker.life-=dt;if(this.marker.life<=0)this.marker=null;else{
      const p=this.marker.point,r=12+(1-this.marker.life)*13;c.strokeStyle=this.marker.attack?'#ed8a78':'#9ad9f5';c.lineWidth=1.5/this.camera.zoom;c.globalAlpha=Math.min(1,this.marker.life*2);
      c.beginPath();c.ellipse(p.x,p.y,r,r*.55,0,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(p.x-6,p.y);c.lineTo(p.x+6,p.y);c.moveTo(p.x,p.y-4);c.lineTo(p.x,p.y+4);c.stroke();c.globalAlpha=1;}}
    // Selected routes are commander orders and may extend into unexplored ground.
    if(this.selected.size)for(const u of g.units)if(this.selected.has(u.id)&&u.orders.length){
      c.strokeStyle='#a5dcf03d';c.lineWidth=1/this.camera.zoom;c.setLineDash([4,8]);c.beginPath();c.moveTo(u.x,u.y);for(const o of u.orders)c.lineTo(o.x,o.y);c.stroke();c.setLineDash([]);}
    c.restore();
    if(this.box){const {from,to}=this.box;c.fillStyle='#71c5f414';c.strokeStyle='#88d5fa';c.lineWidth=1;c.fillRect(from.x,from.y,to.x-from.x,to.y-from.y);c.strokeRect(from.x,from.y,to.x-from.x,to.y-from.y);}
    this.renderMini();
  }
  private renderMini():void {
    const c=this.mini,g=this.game,n=this.miniCanvas.width,k=n/RULES.worldSize;
    c.drawImage(this.miniTerrain,0,0,n,n);
    for(const t of g.territories)if(t.owner>=0){c.beginPath();t.polygon.forEach((p,i)=>i?c.lineTo(p.x*k,p.y*k):c.moveTo(p.x*k,p.y*k));c.closePath();c.fillStyle=t.owner===0?'#429fe33d':'#d84b493d';c.fill();}
    c.imageSmoothingEnabled=false;c.drawImage(this.fog,0,0,n,n);c.imageSmoothingEnabled=true;
    for(const t of g.territories)if(g.hasExplored(0,t.point)){c.fillStyle=t.owner===0?'#81d2ff':t.owner===1?'#e6786a':'#f4f5f4';c.fillRect(t.point.x*k-1,t.point.y*k-1,2,2);}
    for(const b of g.bases)if(b.owner===0||g.canSee(0,b)){c.fillStyle=b.owner===0?'#82d5ff':'#f77f6b';c.fillRect(b.x*k-3,b.y*k-3,6,6);}
    for(const u of g.units)if(u.owner===0||g.canSee(0,u)){c.fillStyle=u.owner===0?'#9bdcff':'#ff8170';c.fillRect(u.x*k-1.5,u.y*k-1.5,3,3);}
    const w=this.width/this.camera.zoom,h=this.height/this.camera.zoom;
    c.strokeStyle='#e8d7b5';c.lineWidth=1;c.strokeRect((this.camera.x-w/2)*k,(this.camera.y-h/2)*k,w*k,h*k);
  }
}
