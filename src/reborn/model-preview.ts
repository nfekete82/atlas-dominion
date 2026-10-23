import type {AnimationAtlas,AnimationFrame} from './sprite-animator.js';
interface Asset {image:HTMLImageElement;data:AnimationAtlas&{design?:{parts:number;triangles:number}}}
const canvas=document.getElementById('preview') as HTMLCanvasElement,ctx=canvas.getContext('2d')!;
let team=0,state='idle',time=0,paused=false,direction=0;
const assets:Asset[]=[],old:Asset[]=[];
async function load(prefix:string):Promise<Asset>{const response=await fetch(prefix+'.json');if(!response.ok)throw Error('Atlas fehlt: '+prefix);const data=await response.json(),image=new Image();image.src=prefix+'.png';await image.decode();return {image,data};}
function frame(asset:Asset,tag:string,dir:number,clock:number):AnimationFrame{const c=asset.data.clips[tag],row=c.frames[dir%8];const at=c.loop?clock%c.duration:Math.min(clock%(c.duration+.7),c.duration-1e-6);let age=0;for(const index of row){const f=asset.data.frames[index];age+=f.duration;if(at<age)return f;}return asset.data.frames[row.at(-1)!];}
function draw(asset:Asset,tag:string,dir:number,x:number,y:number,scale:number,clock=time):void{const f=frame(asset,tag,dir,clock);ctx.drawImage(asset.image,f.x,f.y,f.w,f.h,x-f.pivot[0]*scale,y-f.pivot[1]*scale,f.w*scale,f.h*scale);}
function text(s:string,x:number,y:number,size=14,color='#303332'):void{ctx.font=`${size>=18?'600 ':''}${size}px system-ui,sans-serif`;ctx.fillStyle=color;ctx.fillText(s,x,y);}
function render():void{
 if(!assets.length)return;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#bd8d55';ctx.fillRect(0,0,1260,790);
 for(let i=0;i<3;i++){const x=210+i*420;ctx.fillStyle=i%2?'#c89a62':'#c2935c';ctx.fillRect(i*420,0,420,415);ctx.strokeStyle='#ac7e4d';ctx.beginPath();ctx.moveTo(i*420,385);ctx.lineTo((i+1)*420,385);ctx.stroke();text(['SEITE','DREIVIERTEL','FRONTAL'][i],i*420+22,32,14);draw(assets[team],state,(direction+i)%8,x,362,2.6);}
 ctx.fillStyle='#19272c';ctx.fillRect(0,415,1260,45);text('ACHT BLICKRICHTUNGEN · EIN ZUSAMMENHÄNGENDER LAUFZYKLUS',22,444,15,'#e3ddcf');
 for(let dir=0;dir<8;dir++){const x=79+dir*157;draw(assets[team],'walk',dir,x,607,.82);text(['E','SE','S','SW','W','NW','N','NE'][dir],x-10,632,13);}
 ctx.fillStyle='#19272c';ctx.fillRect(0,655,1260,135);text('VERGLEICH BEI SPIELGRÖSSE',22,680,13,'#d8c5a2');
 ctx.fillStyle='#bf935e';ctx.fillRect(260,665,150,112);ctx.fillRect(550,665,150,112);draw(old[team],'walk',1,334,757,1);draw(assets[team],'walk',1,624,757,.5);
 text('BISHER',430,724,13,'#e3ddcf');text('NEUE MODELLSTUDIE',720,724,13,'#e3ddcf');
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-state]'))button.onclick=()=>{state=button.dataset.state!;time=0;for(const b of document.querySelectorAll('[data-state]'))b.setAttribute('aria-pressed',String(b===button));render();};
function faction(value:number):void{team=value;for(const [id,v] of [['blue',0],['red',1]] as const)document.getElementById(id)!.setAttribute('aria-pressed',String(team===v));(document.getElementById('download') as HTMLAnchorElement).href='/src/assets/reborn/prototype/infantry-'+team+'.glb';render();}
document.getElementById('blue')!.onclick=()=>faction(0);document.getElementById('red')!.onclick=()=>faction(1);document.getElementById('rotate')!.onclick=()=>{direction=(direction+1)%8;render();};
document.getElementById('pause')!.onclick=()=>{paused=!paused;document.getElementById('pause')!.textContent=paused?'Fortsetzen':'Pause';};
try{const loaded=await Promise.all([0,1].map(t=>load('/src/assets/reborn/prototype/infantry-'+t))),previous=await Promise.all([0,1].map(t=>load('/src/assets/reborn/animation/infantry-'+t)));assets.push(...loaded);old.push(...previous);const d=assets[0].data.design!;document.getElementById('status')!.textContent=`${d.parts} modellierte Teile · ${d.triangles.toLocaleString('de-DE')} Dreiecke · 8 Richtungen · 5 Zustände · ${assets[0].data.frames.length} gerenderte Frames je Team`;
 let last=performance.now();function tick(now:number):void{if(!paused)time+=Math.min(.05,(now-last)/1000);last=now;render();requestAnimationFrame(tick);}requestAnimationFrame(tick);
 (window as unknown as {__modelPreview:unknown}).__modelPreview={assets,old,get time(){return time;},set time(v:number){time=v;},set paused(v:boolean){paused=v;},render};
}catch(error){document.getElementById('error')!.textContent='Die Modellstudie konnte nicht geladen werden: '+String(error);}
