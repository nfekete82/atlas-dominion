import { ASSETS, RULES, clamp, distance, type Point } from './config.js';
import { Simulation, type Base, type Unit } from './simulation.js';
import { type Territory } from './world.js';

interface Sprite { image:HTMLImageElement; x:number; y:number; w:number; h:number }
interface Pose extends Sprite { foot:number; bodyHeight:number; center:number }
export class Renderer {
  readonly context:CanvasRenderingContext2D;
  readonly mini:CanvasRenderingContext2D;
  camera={x:1200,y:2500,zoom:1};
  selected=new Set<number>(); selectedBase:number|null=null; overlay=false; attackMode=false;
  box:{from:Point;to:Point}|null=null; marker:{point:Point;life:number;attack:boolean}|null=null;
  width=0;height=0;terrain!:HTMLImageElement; infantry!:Sprite; headquarters!:Sprite;
  private rockDetail!:HTMLImageElement;
  private redInfantry!:Sprite;private redBase!:Sprite;
  private bastions!:Record<'blue'|'red'|'neutral',Sprite>;
  private walks:Pose[][]=[];private redWalks:Pose[][]=[];
  private terrainSurface=document.createElement('canvas');private interpolation=1;
  private fog=document.createElement('canvas');private fogRevision=-1;
  private miniTerrain=document.createElement('canvas');
  constructor(readonly canvas:HTMLCanvasElement,readonly miniCanvas:HTMLCanvasElement,public game:Simulation){
    this.context=canvas.getContext('2d',{alpha:false})!;this.mini=miniCanvas.getContext('2d',{alpha:false})!;
    this.fog.width=this.fog.height=RULES.grid;this.miniTerrain.width=this.miniTerrain.height=224;
    this.resize();
  }
  private async sprite(url:string):Promise<Sprite>{
    const image=new Image();image.src=url;await image.decode();
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data;
    let x=c.width,y=c.height,r=0,b=0;
    for(let j=0;j<c.height;j++)for(let i=0;i<c.width;i++)if(pixels[(j*c.width+i)*4+3]>32){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}
    return {image,x,y,w:r-x+1,h:b-y+1};
  }
  private async recolor(sprite:Sprite,neutral=false):Promise<Sprite>{
    const c=document.createElement('canvas');c.width=sprite.image.width;c.height=sprite.image.height;
    const ctx=c.getContext('2d')!;ctx.drawImage(sprite.image,0,0);const data=ctx.getImageData(0,0,c.width,c.height);
    for(let i=0;i<data.data.length;i+=4){const r=data.data[i],g=data.data[i+1],b=data.data[i+2];
      if(b>r*1.18&&b>g*.9&&b-r>16){
        // Keep the brightness of the emissive blue tubes in every faction state.
        // Neutral is luminous white, rather than a dark, desaturated blue.
        const light=Math.min(255,Math.round((b*.86+g*.14)*1.08));
        data.data[i]=neutral?light:b;
        data.data[i+1]=neutral?light:Math.round(g*.24);
        data.data[i+2]=neutral?light:Math.round(r*.35);}}
    ctx.putImageData(data,0,0);const image=new Image();image.src=c.toDataURL();await image.decode();return {...sprite,image};
  }
  async load():Promise<void>{
    this.terrain=new Image();this.terrain.src=ASSETS.terrain;
    this.rockDetail=new Image();this.rockDetail.src=ASSETS.rockDetail;
    const [infantry,base,bastion,walk]=await Promise.all([this.sprite(ASSETS.infantry),this.sprite(ASSETS.headquarters),this.sprite(ASSETS.bastion),this.sprite(ASSETS.infantryWalk),this.terrain.decode(),this.rockDetail.decode()]);
    this.infantry=infantry;this.headquarters=base;
    [this.redInfantry,this.redBase]=await Promise.all([this.recolor(infantry),this.recolor(base)]);
    const [redBastion,neutralBastion,redWalk]=await Promise.all([this.recolor(bastion),this.recolor(bastion,true),this.recolor(walk)]);
    this.bastions={blue:bastion,red:redBastion,neutral:neutralBastion};
    this.walks=this.atlas(walk.image);this.redWalks=this.atlas(redWalk.image);
    this.prepareTerrain();
    this.miniTerrain.getContext('2d')!.drawImage(this.terrain,0,0,224,224);
    this.home();
  }
  private atlas(image:HTMLImageElement):Pose[][]{
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,c.width,c.height).data;
    const rows:Pose[][]=[];
    for(let row=0;row<4;row++){
      const poses:Pose[]=[];
      for(let col=0;col<4;col++){
        const cellX=Math.floor(col*image.width/4),cellY=Math.floor(row*image.height/4);
        const cellW=Math.floor((col+1)*image.width/4)-cellX,cellH=Math.floor((row+1)*image.height/4)-cellY;
        // Generated atlases have approximate gutters: a barrel may cross the
        // nominal cell edge. Find the complete connected figure in an expanded
        // cell, excluding isolated fragments from its neighbor.
        const x0=Math.max(0,cellX-32),y0=Math.max(0,cellY-12);
        const width=Math.min(image.width,cellX+cellW+32)-x0,height=Math.min(image.height,cellY+cellH+12)-y0;
        const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);
        let largest=0,bounds={left:0,top:0,right:width-1,bottom:height-1};
        for(let start=0;start<seen.length;start++){
          if(seen[start])continue;seen[start]=1;
          if(rgba[((y0+Math.floor(start/width))*c.width+x0+start%width)*4+3]<32)continue;
          let head=0,tail=1,left=width,top=height,right=0,bottom=0;queue[0]=start;
          while(head<tail){
            const at=queue[head++],x=at%width,y=Math.floor(at/width);
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
              const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
              const next=ny*width+nx;if(seen[next])continue;seen[next]=1;
              if(rgba[((y0+ny)*c.width+x0+nx)*4+3]>=32)queue[tail++]=next;
            }
          }
          if(tail>largest){largest=tail;bounds={left,top,right,bottom};}
        }
        const sx=x0+bounds.left,sy=y0+bounds.top,w=bounds.right-bounds.left+1,h=bounds.bottom-bounds.top+1;
        let bodyX=0,bodyWeight=0;
        // Register the helmet, not the gun or an outstretched boot. This avoids
        // lateral jitter as the silhouette changes through the stride.
        for(let y=0;y<h*.2;y++)for(let x=0;x<w;x++){
          const alpha=rgba[((sy+y)*c.width+sx+x)*4+3];
          if(alpha>128){bodyX+=x;bodyWeight++;}
        }
        poses.push({image,x:sx,y:sy,w,h,foot:h,bodyHeight:h,center:bodyX/Math.max(1,bodyWeight)});
      }rows.push(poses);
    }
    return rows;
  }
  private prepareTerrain():void{
    const surface=this.terrainSurface;surface.width=surface.height=RULES.worldSize;
    const c=surface.getContext('2d')!;c.imageSmoothingQuality='high';c.drawImage(this.terrain,0,0,surface.width,surface.height);
    // Relief keeps its map coordinates. Soil uses a separate, native-scale material:
    // soften magnified gravel, then recover fine grain from the supplied sand art.
    const soft=document.createElement('canvas');soft.width=soft.height=surface.width;
    const sc=soft.getContext('2d')!;sc.filter='blur(9px)';sc.drawImage(surface,0,0);
    const pixels=c.getImageData(0,0,surface.width,surface.height),macro=sc.getImageData(0,0,soft.width,soft.height).data;
    // A short-radius, bounded unsharp pass restores rock edges and cast-shadow
    // boundaries after enlargement. Unlike the soil blur it never softens relief.
    sc.clearRect(0,0,surface.width,surface.height);sc.filter='blur(3px)';sc.drawImage(surface,0,0);
    const edgeLow=sc.getImageData(0,0,surface.width,surface.height).data;
    const tile=document.createElement('canvas');tile.width=tile.height=190;const tc=tile.getContext('2d')!;
    tc.drawImage(this.terrain,445/1254*this.terrain.width,675/1254*this.terrain.height,190/1254*this.terrain.width,190/1254*this.terrain.height,0,0,190,190);
    const detail=tc.getImageData(0,0,190,190).data;
    tc.filter='blur(4px)';tc.drawImage(tile,0,0);const detailLow=tc.getImageData(0,0,190,190).data;
    const rock=document.createElement('canvas');rock.width=rock.height=512;const rc=rock.getContext('2d')!;
    rc.drawImage(this.rockDetail,0,0,512,512);const rockPixels=rc.getImageData(0,0,512,512).data;
    rc.filter='blur(6px)';rc.drawImage(rock,0,0);const rockLow=rc.getImageData(0,0,512,512).data;
    const grid=RULES.grid,dist=Float32Array.from(this.game.world.opaque,v=>v?0:1e5);
    for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){const i=y*grid+x;if(x)dist[i]=Math.min(dist[i],dist[i-1]+1);if(y)dist[i]=Math.min(dist[i],dist[i-grid]+1);}
    for(let y=grid-1;y>=0;y--)for(let x=grid-1;x>=0;x--){const i=y*grid+x;if(x<grid-1)dist[i]=Math.min(dist[i],dist[i+1]+1);if(y<grid-1)dist[i]=Math.min(dist[i],dist[i+grid]+1);}
    const size=surface.width;let seed=92531;
    for(let y=0;y<size;y++){
      const gy=Math.min(grid-1,y/size*grid),iy=Math.floor(gy),fy=gy-iy,ny=Math.min(iy+1,grid-1);
      for(let x=0;x<size;x++){
        const gx=Math.min(grid-1,x/size*grid),ix=Math.floor(gx),fx=gx-ix,nx=Math.min(ix+1,grid-1);
        const d=(dist[iy*grid+ix]*(1-fx)+dist[iy*grid+nx]*fx)*(1-fy)+(dist[ny*grid+ix]*(1-fx)+dist[ny*grid+nx]*fx)*fy;
        // Preserve the complete rock face and its cast relief, including outside
        // the collision contour. The old narrow mask blurred mountain edges.
        const blend=clamp((d-8)/6,0,1),i=(y*size+x)*4;
        const ri=((y%512)*512+x%512)*4;
        const rockGrain=clamp((rockPixels[ri]+rockPixels[ri+1]+rockPixels[ri+2]-rockLow[ri]-rockLow[ri+1]-rockLow[ri+2])/3,-32,32);
        const relief=this.game.world.blocked[iy*grid+ix]===1?1:0;
        const tx=(x+Math.floor(y/128)*73)%190,ty=(y+Math.floor(x/128)*59)%190,ti=(ty*190+tx)*4;
        const material=((detail[ti]+detail[ti+1]+detail[ti+2]-detailLow[ti]-detailLow[ti+1]-detailLow[ti+2])/3)*.8;
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;const grain=(seed>>>29)*.45-1.5;
        for(let channel=0;channel<3;channel++){
          const original=pixels.data[i+channel];
          const edge=clamp((original-edgeLow[i+channel])*1.5,-30,30);
          // Detail modulates existing illumination; shadowed rock stays shadowed.
          // This adds native-resolution fissures without moving any collision edge.
          const stone=rockGrain*.5*relief*(original/255);
          pixels.data[i+channel]=(original+edge+stone)*(1-blend)+(macro[i+channel]+material)*blend+grain;
        }
      }
    }
    c.putImageData(pixels,0,0);
  }
  resize():void {
    const dpr=Math.min(2,window.devicePixelRatio||1);this.width=this.canvas.clientWidth;this.height=this.canvas.clientHeight;
    this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);
    this.context.setTransform(dpr,0,0,dpr,0,0);this.boundCamera();
  }
  home():void {const b=this.game.bases.find(b=>b.owner===0);if(b){this.camera.x=b.x+160;this.camera.y=b.y-90;this.camera.zoom=1;this.boundCamera();}}
  invalidate():void{this.fogRevision=-1;}
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
    const c=this.context,height=width*s.h/s.w;c.save();c.globalAlpha=alpha;c.translate(p.x,p.y);if(flip)c.scale(-1,1);
    c.drawImage(s.image,s.x,s.y,s.w,s.h,-width/2,-height,width,height);c.restore();
  }
  private bar(p:Point,width:number,ratio:number,color:string):void{
    const c=this.context;c.fillStyle='#0a0d10d9';c.fillRect(p.x-width/2-1,p.y-1,width+2,5);
    c.fillStyle=color;c.fillRect(p.x-width/2,p.y,width*clamp(ratio,0,1),3);
  }
  private drawUnit(u:Unit):void {
    const c=this.context,selected=this.selected.has(u.id),blue=u.owner===0;
    const p={x:u.previousX+(u.x-u.previousX)*this.interpolation,y:u.previousY+(u.y-u.previousY)*this.interpolation};
    if(selected){c.strokeStyle='#88cffa';c.lineWidth=1/this.camera.zoom;c.beginPath();c.ellipse(p.x,p.y,15,6,0,0,Math.PI*2);c.stroke();}
    let angle=((u.angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2),row:number,flip=false;
    if(angle>Math.PI*1.15&&angle<Math.PI*1.85){row=3;flip=angle<Math.PI*1.5;}
    else if(angle>Math.PI*.35&&angle<Math.PI*.65)row=2;
    else if(angle>Math.PI*.1&&angle<Math.PI*.9){row=1;flip=angle>Math.PI*.5;}
    else {row=0;flip=angle>Math.PI*.5&&angle<Math.PI*1.5;}
    const stride=u.walkDistance-distance({x:u.x,y:u.y},{x:u.previousX,y:u.previousY})*(1-this.interpolation);
    const frame=u.moving?Math.max(0,Math.floor(stride/18))%4:0,pose=(blue?this.walks:this.redWalks)[row][frame],scale=48/pose.bodyHeight;
    const recoil=u.fire>0?Math.sin(u.fire/.18*Math.PI)*1.4:0;
    c.save();c.translate(p.x,p.y);if(flip)c.scale(-1,1);
    // Draw a complete authored pose. Slicing a rifleman into rotating rectangles
    // bent the armor and separated the legs from the torso in the previous cycle.
    c.translate(-Math.cos(u.angle)*recoil,-Math.sin(u.angle)*recoil*.35);
    c.drawImage(pose.image,pose.x,pose.y,pose.w,pose.h,-pose.center*scale,-pose.foot*scale,pose.w*scale,pose.h*scale);c.restore();
    if(selected||u.hp<100)this.bar({x:p.x,y:p.y-56},27,u.hp/100,blue?'#75c5e8':'#ed7866');
    if(u.fire>.1){const muzzle={x:p.x+Math.cos(u.angle)*21,y:p.y-25+Math.sin(u.angle)*9};
      c.save();c.translate(muzzle.x,muzzle.y);c.rotate(u.angle);c.fillStyle='#fff1bd';c.beginPath();c.moveTo(-2,-2);c.lineTo(9,0);c.lineTo(-2,2);c.fill();c.restore();}
    if(u.hit>0){c.strokeStyle='#ffdf9b';c.lineWidth=1;c.beginPath();c.arc(p.x,p.y-21,11,0,Math.PI*2);c.stroke();}
  }
  private drawBase(b:Base,alpha=1):void {
    const c=this.context,selected=this.selectedBase===b.id;
    const anchor={x:b.x,y:b.y+38};
    if(b.hp<=0){this.spriteDraw(b.owner===0?this.headquarters:this.redBase,anchor,225,false,.28);return;}
    if(selected){c.strokeStyle='#78c8f1';c.lineWidth=1.5;c.setLineDash([9,5]);c.beginPath();c.ellipse(b.x,b.y-8,113,51,0,0,Math.PI*2);c.stroke();c.setLineDash([]);}
    this.spriteDraw(b.owner===0?this.headquarters:this.redBase,anchor,225,false,alpha);
    if(selected||b.hp<RULES.headquarters.hp)this.bar({x:b.x,y:b.y-214},86,b.hp/RULES.headquarters.hp,b.owner===0?'#75c5e8':'#ed7866');
    if(b.queue.length&&b.owner===0)this.bar({x:b.x,y:b.y+24},75,b.production/RULES.infantry.buildTime,'#dfb278');
    if(selected&&b.rally){c.strokeStyle='#94d9f399';c.setLineDash([5,6]);c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.rally.x,b.rally.y);c.stroke();c.setLineDash([]);
      c.fillStyle='#9dddff';c.fillRect(b.rally.x-1,b.rally.y-30,2,30);c.beginPath();c.moveTo(b.rally.x,b.rally.y-30);c.lineTo(b.rally.x+17,b.rally.y-24);c.lineTo(b.rally.x,b.rally.y-18);c.fill();}
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
    this.spriteDraw(this.bastions[t.owner===0?'blue':t.owner===1?'red':'neutral'],{x:p.x,y:p.y+17},67,false,dim?.32:1);
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
    this.interpolation=g.paused?1:clamp(interpolation,0,1);
    c.fillStyle='#030507';c.fillRect(0,0,this.width,this.height);c.save();
    c.translate(this.width/2,this.height/2);c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);
    c.drawImage(this.terrainSurface,0,0);
    for(const t of g.territories){
      if(t.owner>=0){this.polygon(t.polygon);c.fillStyle=t.owner===0?'#53b4ee0b':'#e257490b';c.fill();}
      if(this.overlay){this.polygon(t.polygon);c.strokeStyle=t.owner===0?'#83d3ff8c':t.owner===1?'#e2766c8c':'#ead2ac55';c.lineWidth=1.2/this.camera.zoom;c.stroke();}
    }
    // Fog shades terrain; entities use visibility at their ground position.
    // Drawing it over sprites clipped tall masts against unrelated terrain cells.
    c.imageSmoothingEnabled=true;c.drawImage(this.fog,0,0,s,s);
    const entities:({y:number;unit:Unit}|{y:number;base:Base}|{y:number;territory:Territory})[]=[];
    for(const t of g.territories)if(g.canSee(0,t.point))entities.push({y:t.point.y,territory:t});else if(g.hasExplored(0,t.point))this.drawBastion(t,true);
    for(const b of g.bases)if(b.owner===0||g.canSee(0,b))entities.push({y:b.y,base:b});
    for(const m of g.memories[0])if(m.owner!==0&&!g.canSee(0,m)){
      this.spriteDraw(this.redBase,{x:m.x,y:m.y+38},225,false,m.hp>0?.22:.07);
    }
    for(const u of g.units)if(u.owner===0||g.canSee(0,u))entities.push({y:u.y,unit:u});
    entities.sort((a,b)=>a.y-b.y);for(const e of entities)if('unit' in e)this.drawUnit(e.unit);else if('base' in e)this.drawBase(e.base);else this.drawBastion(e.territory);
    for(const shot of g.shots)if(g.canSee(0,shot.from)||g.canSee(0,shot.to)){
      c.strokeStyle=shot.owner===0?'#b3e5ff':'#ffb48e';c.lineWidth=1.5;c.globalAlpha=shot.life/.14;c.beginPath();c.moveTo(shot.from.x,shot.from.y);c.lineTo(shot.to.x,shot.to.y);c.stroke();c.globalAlpha=1;}
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
