import {test,expect} from '@playwright/test';
async function start(page){
 const errors=[],assets=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/src\/assets/.test(r.url()))assets.push(r.url());});
 await page.setViewportSize({width:1440,height:1000});await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{const api=window.__reborn;api.game.paused=true;api.game.aiClock=-1e8;api.game.credits=[10000,10000];api.refresh();});return {errors,assets};
}
async function advance(page,seconds){await page.evaluate(s=>{const api=window.__reborn,g=api.game;g.paused=false;for(let i=0;i<Math.round(s/.05);i++)g.step();g.paused=true;api.refresh();api.renderer.render(0);},seconds);}
async function clickWorld(page,p,button='left'){const q=await page.evaluate(p=>window.__reborn.renderer.screen(p),p);expect(await page.evaluate(q=>document.elementFromPoint(q.x,q.y)?.id,q)).toBe('world');await page.mouse.click(q.x,q.y,{button});}

test('overhaul: compact real turret heads track and fire from their registered muzzles in both factions; all faction/role atlases load',async({page})=>{
 const health=await start(page);
 const initial=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.units=[];
  for(const owner of [0,1]){
   const p={x:1900+owner*200,y:2100+owner*230};g.bases.push({...g.bases[owner],...p,id:1200+owner,kind:'turret',hp:650,radius:30,queue:[],queueTypes:[],turretAngle:Math.PI});
   const e=g.spawn(1-owner,{x:p.x+180,y:p.y});e.cooldown=100;g.stop([e.id],true);
  }
  g.updateVision();r.camera.x=2000;r.camera.y=2200;r.camera.zoom=1.35;r.render(0);
  const a=r.structures.asset('turret',0),hashFrame=i=>{const f=a.data.turret.frames[i],c=document.createElement('canvas');c.width=f.w;c.height=f.h;const x=c.getContext('2d');x.drawImage(a.turret,f.x,f.y,f.w,f.h,0,0,f.w,f.h);let hash=2166136261;for(const v of x.getImageData(0,0,f.w,f.h).data)hash=Math.imul(hash^v,16777619)>>>0;return hash;};
  return {views:a.data.turret.frames.length,unique:new Set(a.data.turret.frames.map((_,i)=>hashFrame(i))).size,positions:g.bases.filter(b=>b.kind==='turret').map(b=>({id:b.id,x:b.x,y:b.y})),angles:g.bases.filter(b=>b.kind==='turret').map(b=>b.turretAngle)};
 });
 expect(initial.views).toBe(64);expect(initial.unique).toBe(64);await advance(page,.05);
 expect(await page.evaluate(()=>window.__reborn.game.shots.filter(s=>s.source>=1200).length)).toBe(0);
 const fired=await page.evaluate(()=>{
  const api=window.__reborn,g=api.game,shots=[];g.paused=false;
  for(let i=0;i<26;i++){g.step();for(const s of g.shots)if(s.source>=1200&&!shots.some(v=>v.source===s.source))shots.push({...s});}
  g.paused=true;api.refresh();api.renderer.render(0);
  return {shots,positions:g.bases.filter(b=>b.kind==='turret').map(b=>({id:b.id,x:b.x,y:b.y})),angles:g.bases.filter(b=>b.kind==='turret').map(b=>b.turretAngle)};
 });
 expect(fired.shots.map(s=>s.source).sort()).toEqual([1200,1201]);expect(fired.positions).toEqual(initial.positions);expect(fired.angles).not.toEqual(initial.angles);
 const colors=await page.evaluate(()=>{
  const r=window.__reborn.renderer,result=[];
  for(const kind of ['infantry','heavy','medic','engineer','rover','tank','artillery','scout','bomber'])for(const owner of [0,1]){
   const a=r.units.asset(kind,owner),f=a.data.frames[a.data.clips.idle.frames[1][0]],c=document.createElement('canvas');c.width=f.w;c.height=f.h;const x=c.getContext('2d');x.drawImage(a.image,f.x,f.y,f.w,f.h,0,0,f.w,f.h);const data=x.getImageData(0,0,f.w,f.h).data;let total=0,color=0;
   for(let i=0;i<data.length;i+=4)if(data[i+3]>220){total++;const [red,green,blue]=data.slice(i,i+3);if(owner?red>green*1.25&&red>blue*1.3:blue>red*1.15&&blue>green*1.05)color++;}
   result.push({kind,owner,ratio:color/Math.max(1,total)});
  }
  return result;
 });
 for(const item of colors)expect(item.ratio,`${item.kind}/${item.owner} faction area`).toBeGreaterThan(.06);
 await page.screenshot({path:'artifacts/reborn/overhaul-turrets.png'});expect(health.errors).toEqual([]);expect(health.assets).toEqual([]);
});

test('overhaul: a worker places in explored neutral fog, walks there and completes the barracks without taking the territory',async({page})=>{
 const health=await start(page);
 const state=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.explored[0].fill(1);g.visible[0].fill(0);g.revision++;
  const t=g.territories[20];let p;
  for(let y=2500;y<3100&&!p;y+=25)for(let x=1300;x<1800;x+=25)if(!g.buildError(0,'barracks',{x,y})&&g.territories.some(t=>t.id===20&&t.polygon.reduce((inside,a,i,poly)=>{const b=poly[(i+poly.length-1)%poly.length];return (a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x?!inside:inside;},false))&&g.territories.every(t=>Math.hypot(t.point.x-x,t.point.y-y)>220)){p={x,y};break;}
  if(!p)throw Error('No neutral build site');
  const u=g.units[0],w=g.spawn(0,{x:u.x+75,y:u.y+35},'engineer');r.selected=new Set([w.id]);r.selectedBase=null;r.camera.x=p.x;r.camera.y=p.y;r.camera.zoom=1;window.__reborn.refresh();r.render(0);
  return {p,worker:w.id,territory:t.id,owner:t.owner,credits:g.credits[0],visible:g.canSee(0,p)};
 });
 expect(state.owner).toBe(-1);expect(state.visible).toBe(false);
 await page.locator('#build-mode').click();await page.locator('[data-build="barracks"]').click();await clickWorld(page,state.p);
 const placed=await page.evaluate(()=>{const g=window.__reborn.game,b=g.bases.find(b=>b.kind==='barracks');return {owner:b.owner,remaining:b.buildRemaining,credits:g.credits[0]};});
 expect(placed).toEqual({owner:0,remaining:12,credits:state.credits-200});await advance(page,.5);
 expect(await page.evaluate(()=>window.__reborn.game.bases.find(b=>b.kind==='barracks').buildRemaining)).toBe(12);
 await advance(page,35);expect(await page.evaluate(()=>{const g=window.__reborn.game;return {remaining:g.bases.find(b=>b.kind==='barracks').buildRemaining,owner:g.territories[20].owner};})).toEqual({remaining:0,owner:-1});
 await clickWorld(page,{x:state.p.x,y:state.p.y-35});await expect(page.locator('#selection-title')).toHaveText('Kaserne');await expect(page.locator('[data-context-unit]')).toHaveCount(3);
 await page.screenshot({path:'artifacts/reborn/overhaul-barracks.png'});expect(health.errors).toEqual([]);expect(health.assets).toEqual([]);
});

test('overhaul: real group input keeps medics behind the front, heals during attack-move, and persists formation state',async({page})=>{
 const health=await start(page);
 const points=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.units=[];const h=g.spawn(0,{x:1900,y:2100},'heavy'),s=g.spawn(0,{x:1900,y:2140}),m=g.spawn(0,{x:1830,y:2100},'medic'),m2=g.spawn(0,{x:1830,y:2140},'medic'),enemy=g.spawn(1,{x:2180,y:2100},'heavy');h.hp=35;enemy.cooldown=100;g.stop([enemy.id],true);g.updateVision();r.camera.x=2020;r.camera.y=2120;r.camera.zoom=1.4;r.render(0);
  return g.units.filter(u=>u.owner===0).map(u=>r.screen({x:u.x,y:u.y-18}));
 });
 await page.mouse.move(Math.min(...points.map(p=>p.x))-30,Math.min(...points.map(p=>p.y))-35);await page.mouse.down();await page.mouse.move(Math.max(...points.map(p=>p.x))+30,Math.max(...points.map(p=>p.y))+45,{steps:6});await page.mouse.up();
 await expect(page.locator('#selection-title')).toHaveText('4 Einheiten');await page.keyboard.press('a');await clickWorld(page,{x:2350,y:2120});await advance(page,3);
 const result=await page.evaluate(()=>{const {game:g}=window.__reborn,front=g.units.filter(u=>u.owner===0&&u.kind!=='medic'),medics=g.units.filter(u=>u.kind==='medic');return {hp:front.find(u=>u.kind==='heavy').hp,front:Math.min(...front.map(u=>u.x)),medics:medics.map(u=>({x:u.x,formation:!!u.orders[0]?.formation,cooldown:u.cooldown}))};});
 expect(result.hp).toBeGreaterThan(35);for(const m of result.medics){expect(m.x).toBeLessThan(result.front-25);expect(m.formation).toBe(true);expect(m.cooldown).toBeLessThanOrEqual(0);}
 await page.evaluate(async()=>{const a=window.__reborn;await a.save();await a.load();a.game.paused=true;a.refresh();});expect(await page.evaluate(()=>window.__reborn.game.units.filter(u=>u.kind==='medic').every(u=>!!u.orders[0]?.formation))).toBe(true);
 await page.evaluate(()=>{const r=window.__reborn.renderer;r.camera.x=2020;r.camera.y=2120;r.camera.zoom=1.8;r.render(0);});await page.screenshot({path:'artifacts/reborn/overhaul-formation.png'});expect(health.errors).toEqual([]);expect(health.assets).toEqual([]);
});
