import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const evidence=new URL('../../docs/reborn/',import.meta.url).pathname;
async function start(page,width=1440,height=1000){
 await page.setViewportSize({width,height});await page.goto('/?debug&legacy');await page.locator('#loading').waitFor({state:'detached'});
 await page.evaluate(()=>{window.__reborn.game.paused=true;});
}
async function advance(page,seconds){return page.evaluate(seconds=>{
 const api=window.__reborn,g=api.game;g.paused=false;let fought=false;
 for(let i=0;i<Math.round(seconds/.05);i++){g.step();if(g.shots.some(s=>g.canSee(0,s.from)||g.canSee(0,s.to)))fought=true;}
 g.paused=true;api.refresh();api.renderer.render(0);return {fought,status:g.status,blue:g.count(0),red:g.count(1)};
},seconds);}
async function openMenu(page){if(!await page.locator('#pause-dialog').isVisible())await page.locator('#menu').click();}
async function newCampaign(page){await openMenu(page);await page.locator('#to-main').click();await page.locator('#new').click();}
async function screen(page,p){return page.evaluate(p=>window.__reborn.renderer.screen(p),p);}
async function focus(page,p){
 const box=await page.locator('#minimap').boundingBox();await page.mouse.click(box.x+p.x/3762*box.width,box.y+p.y/3762*box.height);
}
async function order(page,p,{attack=false,shift=false}={}){
 await focus(page,p);const at=await screen(page,p);if(attack)await page.keyboard.press('a');if(shift)await page.keyboard.down('Shift');
 await page.mouse.click(at.x,at.y,{button:'right'});if(shift)await page.keyboard.up('Shift');
}
async function selectArmy(page){
 await page.locator('#home').click();const positions=await page.evaluate(()=>window.__reborn.game.units.filter(u=>u.owner===0).map(u=>window.__reborn.renderer.screen(u)));
 const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y);await page.mouse.move(Math.min(...xs)-30,Math.min(...ys)-65);await page.mouse.down();await page.mouse.move(Math.max(...xs)+30,Math.max(...ys)+16,{steps:12});await page.mouse.up();
}

test('reborn: complete browser loop from one soldier through capture, production, multi-unit expansion, combat and durable resume',async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await mkdir(evidence,{recursive:true});
 await page.screenshot({path:evidence+'initial.png'});
 await expect(page.locator('#credits')).toHaveText('500');
 expect(await page.evaluate(()=>window.__reborn.game.count(0))).toBe(1);
 const initial=await page.evaluate(()=>({unit:{...window.__reborn.game.units[0]},base:{...window.__reborn.game.bases[0]},target:{...window.__reborn.game.territories[20].point},explored:window.__reborn.game.explored[0].reduce((a,b)=>a+b,0)}));
 const u=await screen(page,{x:initial.unit.x,y:initial.unit.y-18});await page.mouse.click(u.x,u.y);
 await expect(page.locator('#selection-title')).toHaveText('Infanteriesoldat');
 await order(page,initial.target);await advance(page,14);
 expect(await page.evaluate(()=>window.__reborn.game.territories[20].owner)).toBe(0);await expect(page.locator('#income')).toHaveText('+40');
 expect(await page.evaluate(()=>window.__reborn.game.explored[0].reduce((a,b)=>a+b,0))).toBeGreaterThan(initial.explored);
 await order(page,{x:initial.base.x+140,y:initial.base.y+100});await advance(page,7);
 await page.locator('#home').click();const b=await screen(page,{x:initial.base.x,y:initial.base.y-90});await page.mouse.click(b.x,b.y);
 await expect(page.locator('#production')).toBeVisible();
 for(let i=0;i<5;i++)await page.locator('#recruit').click();await expect(page.locator('#queue')).toContainText('5 IM AUFTRAG');
 await advance(page,25);expect(await page.evaluate(()=>window.__reborn.game.count(0))).toBe(6);
 await page.screenshot({path:evidence+'production.png'});
 await selectArmy(page);expect(await page.evaluate(()=>window.__reborn.renderer.selected.size)).toBe(6);
 let fought=false,enemyCapture=false;
 for(const id of [14,8,9,10,4]){
   const target=await page.evaluate(id=>({point:window.__reborn.game.territories[id].point,owner:window.__reborn.game.territories[id].owner}),id);
   await order(page,target.point,{attack:true});const result=await advance(page,23);fought||=result.fought;
   const owner=await page.evaluate(id=>window.__reborn.game.territories[id].owner,id);if(target.owner===1&&owner===0)enemyCapture=true;
   if(fought&&enemyCapture)break;
   if(result.blue===0)break;
 }
 expect(fought).toBe(true);expect(enemyCapture).toBe(true);
 await page.screenshot({path:evidence+'campaign.png'});
 await openMenu(page);await page.locator('#save').click();await expect(page.locator('#notices')).toContainText('Kampagne lokal gespeichert');
 const snapshot=await page.evaluate(()=>{const s=window.__reborn.game.save();return {credits:s.credits,owners:s.territories.map(t=>t.owner),units:s.units.map(u=>({id:u.id,hp:u.hp,x:u.x,y:u.y})),explored:s.explored,time:s.time};});
 await page.reload();await page.locator('#loading').waitFor({state:'detached'});await openMenu(page);await page.locator('#load').click();await expect(page.locator('#notices')).toContainText('Kampagne geladen');
 await page.evaluate(()=>{window.__reborn.game.paused=true;});
 const restored=await page.evaluate(()=>{const s=window.__reborn.game.save();return {credits:s.credits,owners:s.territories.map(t=>t.owner),ids:s.units.map(u=>u.id),explored:s.explored,time:s.time};});
 expect(restored.credits).toEqual(snapshot.credits);expect(restored.owners).toEqual(snapshot.owners);expect(restored.ids).toEqual(snapshot.units.map(u=>u.id));
 expect(restored.time).toBeGreaterThanOrEqual(snapshot.time);expect(restored.time-snapshot.time).toBeLessThan(.5);expect(restored.explored[0].reduce((a,b)=>a+b,0)).toBeGreaterThanOrEqual(snapshot.explored[0].reduce((a,b)=>a+b,0));
 expect(errors).toEqual([]);
});

test('reborn: minimap drag, anchored zoom, keyboard camera, shift orders, attack mode and stop use real input',async({page})=>{
 await start(page);await page.locator('#select-unit').click();
 const p1={x:1400,y:2600},p2={x:1650,y:2600};await order(page,p1);await order(page,p2,{shift:true});
 expect(await page.evaluate(()=>window.__reborn.game.units[0].orders.length)).toBe(2);
 await page.keyboard.press('s');expect(await page.evaluate(()=>window.__reborn.game.units[0].orders.length)).toBe(0);
 const beforeHold=await page.evaluate(()=>window.__reborn.renderer.camera.y);await page.keyboard.down('s');await page.waitForTimeout(350);await page.keyboard.up('s');
 expect(await page.evaluate(()=>window.__reborn.renderer.camera.y)).toBeGreaterThan(beforeHold);
 await page.keyboard.press('a');await expect(page.locator('#hint')).toContainText('ANGRIFFSBEWEGUNG');
 const point=await screen(page,{x:1500,y:2400});await page.mouse.click(point.x,point.y);expect(await page.evaluate(()=>window.__reborn.game.units[0].orders[0].kind)).toBe('attackMove');
 await page.mouse.click(340,400);expect(await page.evaluate(()=>window.__reborn.renderer.selected.size)).toBe(0);
 const before=await page.evaluate(()=>window.__reborn.renderer.camera.x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');expect(await page.evaluate(()=>window.__reborn.renderer.camera.x)).toBeGreaterThan(before);
 const mini=await page.locator('#minimap').boundingBox();await page.mouse.move(mini.x+mini.width*.3,mini.y+mini.height*.3);await page.mouse.down();await page.mouse.move(mini.x+mini.width*.65,mini.y+mini.height*.55,{steps:8});await page.mouse.up();
 const cam=await page.evaluate(()=>window.__reborn.renderer.camera);expect(cam.x).toBeCloseTo(3762*.65,-1);expect(cam.y).toBeCloseTo(3762*.55,-1);
 await page.mouse.move(700,450);const zoom=await page.evaluate(()=>({zoom:window.__reborn.renderer.camera.zoom,p:window.__reborn.renderer.world({x:700,y:450})}));await page.mouse.wheel(0,-250);
 await expect.poll(()=>page.evaluate(()=>window.__reborn.renderer.camera.zoom)).toBeGreaterThan(zoom.zoom);
 const after=await page.evaluate(()=>window.__reborn.renderer.world({x:700,y:450}));expect(after.x).toBeCloseTo(zoom.p.x,3);expect(after.y).toBeCloseTo(zoom.p.y,3);
 await page.locator('#overlay').click();expect(await page.evaluate(()=>window.__reborn.renderer.overlay)).toBe(true);
 await page.keyboard.press('Space');await expect(page.locator('#pause-label')).toBeHidden();await page.keyboard.press('Space');await expect(page.locator('#pause-label')).toBeVisible();
});

test('reborn: hidden enemies leave no main-map or minimap pixels, and terrain stays remembered',async({page})=>{
 await start(page);
 const hidden=await page.evaluate(()=>{
   const {game:g,renderer:r}=window.__reborn;const enemy=g.units.find(u=>u.owner===1),base=g.bases.find(b=>b.owner===1);
   r.camera.x=enemy.x;r.camera.y=enemy.y;r.boundCamera();r.render(0);
   const p=r.screen(enemy),d=window.devicePixelRatio||1,c=r.context;
   const pixel=Array.from(c.getImageData(Math.round(p.x*d),Math.round(p.y*d),1,1).data);
   const m=Array.from(r.mini.getImageData(Math.floor(enemy.x/3762*224),Math.floor(enemy.y/3762*224),1,1).data);
   return {canSee:g.canSee(0,enemy),explored:g.hasExplored(0,base),pixel,m};
 });
 expect(hidden.canSee).toBe(false);expect(hidden.explored).toBe(false);expect(hidden.pixel.slice(0,3).every(v=>v<12)).toBe(true);expect(hidden.m.slice(0,3).every(v=>v<12)).toBe(true);
 await page.locator('#home').click();await page.locator('#select-unit').click();await order(page,{x:1567.5,y:2633.4});await advance(page,14);await order(page,{x:940.5,y:1881});await advance(page,13);
 const known=await page.evaluate(()=>{const g=window.__reborn.game;return {known:g.hasExplored(0,g.territories[20].point),visible:g.canSee(0,g.territories[20].point),memory:g.explored[0].some((v,i)=>v&&!g.visible[0][i]&&!g.world.blocked[i])};});expect(known).toEqual({known:true,visible:true,memory:true});
});

test('reborn: compact viewport, instructions, pause and new campaign preserve a usable playfield',async({page})=>{
 await start(page,800,650);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(800);
 await openMenu(page);await page.locator('#help').click();await expect(page.locator('#help-dialog')).toBeVisible();expect(await page.evaluate(()=>window.__reborn.game.paused)).toBe(true);await page.getByRole('button',{name:'VERSTANDEN — INS FELD'}).click();await page.locator('#resume').click();await page.evaluate(()=>{window.__reborn.game.paused=true;});
 await page.locator('#select-unit').click();await expect(page.locator('#unit-commands')).toBeVisible();await page.screenshot({path:evidence+'compact.png'});
 await page.keyboard.press('Escape');await newCampaign(page);await page.locator('#new-dialog [value="new"]').click();
 await expect(page.locator('#credits')).toHaveText('500');expect(await page.evaluate(()=>window.__reborn.game.count(0))).toBe(1);
 await advance(page,10);const credits=await page.locator('#credits').textContent();await newCampaign(page);await page.keyboard.press('Escape');await expect(page.locator('#credits')).toHaveText(credits);
});

test('reborn: sound unlocks on interaction, produces an audio signal and preserves volume/mute settings',async({page})=>{
 await start(page);await page.locator('#sound').click();await expect(page.locator('#audio-panel')).toBeVisible();
 await page.locator('#audio-ambience').uncheck();await page.locator('#audio-test').click();
 await expect.poll(()=>page.evaluate(()=>window.__reborn.audio.context?.state)).toBe('running');
 const peak=await page.evaluate(async()=>{const analyser=window.__reborn.audio.analyser;let peak=0;const data=new Float32Array(analyser.fftSize);
  for(let i=0;i<8;i++){analyser.getFloatTimeDomainData(data);peak=Math.max(peak,...data.map(Math.abs));await new Promise(r=>setTimeout(r,8));}return peak;});
 expect(peak).toBeGreaterThan(.003);
 await page.locator('#audio-volume').fill('35');await expect(page.locator('#audio-level')).toHaveText('35 %');
 await page.locator('#audio-enabled').uncheck();await page.waitForTimeout(250);
 const muted=await page.evaluate(()=>{const a=window.__reborn.audio,values=new Float32Array(a.analyser.fftSize);a.analyser.getFloatTimeDomainData(values);return Math.max(...values.map(Math.abs));});
 expect(muted).toBeLessThan(.001);await page.reload();await page.locator('#loading').waitFor({state:'detached'});await page.locator('#sound').click();
 await expect(page.locator('#audio-volume')).toHaveValue('35');await expect(page.locator('#audio-enabled')).not.toBeChecked();
});

test('reborn: finer terrain, directional animation, grounded drawing and automatic retaliation render in the browser',async({page})=>{
 await start(page);const result=await page.evaluate(async()=>{
  const {game:g,renderer:r}=window.__reborn;
  const atlas=r.units.asset('infantry').image;const temp=document.createElement('canvas');temp.width=atlas.width;temp.height=atlas.height;const tc=temp.getContext('2d');tc.drawImage(atlas,0,0);
  const pixels=tc.getImageData(0,0,temp.width,temp.height).data;let clear=0,opaque=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>250)opaque++;}
  g.units=[];const blue=g.spawn(0,{x:1900,y:2100}),red=g.spawn(1,{x:2050,y:2100});g.command([blue.id],{x:2350,y:2100,kind:'move'});g.updateVision();g.paused=false;g.step();g.step();g.paused=true;
  r.camera.x=blue.x;r.camera.y=blue.y;r.boundCamera();r.selected=new Set([blue.id]);r.render(0);
  const sample=()=>{const p=r.screen(blue),d=Math.min(2,devicePixelRatio||1);return Array.from(r.context.getImageData(Math.floor((p.x-40)*d),Math.floor((p.y-66)*d),Math.ceil(80*d),Math.ceil(70*d)).data);};
  blue.fire=0;blue.hit=0;r.units.clear();blue.moving=true;blue.walkDistance=0;r.render(0);const first=sample();blue.walkDistance=36;r.render(0);const second=sample();
  let changed=0;for(let i=0;i<first.length;i++)if(first[i]!==second[i])changed++;
  let groundFills=0,groundShadows=0;const fill=r.context.fill,ellipse=r.context.ellipse,begin=r.context.beginPath;
  let oval=false;r.context.beginPath=function(){oval=false;return begin.call(this);};r.context.ellipse=function(...args){oval=true;return ellipse.apply(this,args);};r.context.fill=function(...args){if(oval)groundFills++;if(this.shadowBlur>0)groundShadows++;return fill.apply(this,args);};
  r.render(0);r.context.fill=fill;r.context.ellipse=ellipse;r.context.beginPath=begin;
  return {blueHp:blue.hp,redHp:red.hp,orders:blue.orders.length,angle:blue.angle,changed,groundFills,groundShadows,clear,opaque,pixels:atlas.width*atlas.height,terrain:r.terrain.src,grid:g.world.blocked.length};
 });
 expect(result.blueHp).toBeLessThan(100);expect(result.redHp).toBeLessThan(100);expect(result.orders).toBe(1);
 expect(result.changed).toBeGreaterThan(100);expect(result.groundFills).toBe(0);expect(result.groundShadows).toBe(0);
 expect(result.clear/result.pixels).toBeGreaterThan(.35);expect(result.opaque/result.pixels).toBeGreaterThan(.04);expect(result.terrain).toContain('desert-fine.png');expect(result.grid).toBe(240*240);
 await page.screenshot({path:evidence+'polish-combat.png'});
});

test('reborn: the headquarters black spot and the ground beneath infantry remain visible on both maps',async({page})=>{
 await start(page);
 const result=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn,p={x:960,y:2610};r.home();r.render(0);
  const sample=point=>{const at=r.screen(point),d=Math.min(2,devicePixelRatio||1);return Array.from(r.context.getImageData(Math.floor(at.x*d),Math.floor(at.y*d),1,1).data).slice(0,3);};
  const before=sample(p),mini=Array.from(r.mini.getImageData(Math.floor(p.x/3762*224),Math.floor(p.y/3762*224),1,1).data).slice(0,3);
  const u=g.units.find(u=>u.owner===0);Object.assign(u,{...p,previousX:p.x,previousY:p.y});g.updateVision();r.render(0);
  const ownVisible=g.canSee(0,u),underfoot=sample({x:p.x,y:p.y+14});
  return {before,mini,ownVisible,underfoot,cliffs:g.world.cliffCells.filter(cells=>cells.some(i=>g.visible[0][i])).map(cells=>cells.every(i=>g.explored[0][i]===1))};
 });
 expect(result.before.reduce((a,b)=>a+b,0)).toBeGreaterThan(90);expect(result.mini.reduce((a,b)=>a+b,0)).toBeGreaterThan(60);
 expect(result.ownVisible).toBe(true);expect(result.underfoot.reduce((a,b)=>a+b,0)).toBeGreaterThan(90);expect(result.cliffs.length).toBeGreaterThan(0);expect(result.cliffs.every(Boolean)).toBe(true);
 await page.screenshot({path:evidence+'visibility-fix.png'});
});

test('reborn: detailed cliff artwork and navigation occupy the same terrain',async({page})=>{
 await start(page);const result=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn,c=document.createElement('canvas');c.width=c.height=3762;const ctx=c.getContext('2d');r.paintCliffs(ctx);const rgba=ctx.getImageData(0,0,c.width,c.height).data;
  let solid=0,blocked=0;for(let i=0;i<g.world.blocked.length;i++){const p=g.world.center(i),alpha=rgba[(Math.floor(p.y)*c.width+Math.floor(p.x))*4+3];if(alpha>180){solid++;if(g.world.blocked[i])blocked++;}}
  return {solid,blocked,sourceWidths:r.cliffs.map(s=>s.w)};
 });
 expect(result.solid).toBeGreaterThan(3000);expect(result.blocked/result.solid).toBeGreaterThan(.99);expect(Math.min(...result.sourceWidths)).toBeGreaterThan(400);
});

test('reborn: capture beacons emit white when neutral and saturated team colors after ownership changes',async({page})=>{
 await start(page);
 const result=await page.evaluate(()=>{
   const r=window.__reborn.renderer,variants=r.bastions;
   const pixels=s=>{const c=document.createElement('canvas');c.width=s.image.width;c.height=s.image.height;const ctx=c.getContext('2d');ctx.drawImage(s.image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
   const blue=pixels(variants.blue),red=pixels(variants.red),neutral=pixels(variants.neutral);let count=0,white=0,redLight=0,unchangedMetal=0;
   for(let i=0;i<blue.length;i+=4)if(blue[i+3]>240){
     if(blue[i+2]>210&&blue[i+2]-blue[i]>80&&blue[i+2]>blue[i+1]*.9){
       count++;if(Math.min(neutral[i],neutral[i+1],neutral[i+2])>190&&Math.max(neutral[i],neutral[i+1],neutral[i+2])-Math.min(neutral[i],neutral[i+1],neutral[i+2])<24)white++;
       if(red[i]>180&&red[i]>red[i+1]*1.4&&red[i]>red[i+2]*1.5)redLight++;
     }else if(blue[i]>blue[i+2]*1.2&&blue[i]>100&&red[i]===blue[i]&&neutral[i]===blue[i])unchangedMetal++;
   }
   // Exercise the real owner lookup at the same world point, not just detached images.
   const t=window.__reborn.game.territories[19],owner=t.owner;
   const sample=[];for(const next of [-1,1,0]){t.owner=next;r.render(0);const p=r.screen(t.point),d=Math.min(2,devicePixelRatio||1);sample.push(Array.from(r.context.getImageData(Math.floor((p.x-40)*d),Math.floor((p.y-100)*d),Math.floor(80*d),Math.floor(116*d)).data));}
   t.owner=owner;const changed=(a,b)=>a.reduce((n,v,i)=>n+Number(v!==b[i]),0);
   return {count,white,redLight,unchangedMetal,neutralToRed:changed(sample[0],sample[1]),redToBlue:changed(sample[1],sample[2])};
 });
 expect(result.count).toBeGreaterThan(100);expect(result.white/result.count).toBeGreaterThan(.95);expect(result.redLight/result.count).toBeGreaterThan(.95);
 expect(result.unchangedMetal).toBeGreaterThan(500);expect(result.neutralToRed).toBeGreaterThan(150);expect(result.redToBlue).toBeGreaterThan(150);
});

test('reborn: infantry poses stay grounded without detached neighboring weapon fragments',async({page})=>{
 await start(page);
 const result=await page.evaluate(()=>{
   const {renderer:r,game:g}=window.__reborn,c=document.createElement('canvas');c.width=180;c.height=120;
   const ctx=c.getContext('2d'),old=r.context,selection=r.selected;r.context=ctx;r.selected=new Set();r.interpolation=1;
   let maxDetachedDistance=0,minHeight=Infinity,maxHeight=0;
   try{
     for(const angle of [0,.25*Math.PI,.5*Math.PI,.75*Math.PI,Math.PI,1.5*Math.PI,1.75*Math.PI,1.9*Math.PI])for(let frame=0;frame<8;frame++){
       ctx.clearRect(0,0,c.width,c.height);ctx.save();ctx.translate(90,105);ctx.scale(1.8,1.8);
       r.drawUnit({...g.units[0],x:0,y:0,previousX:0,previousY:0,angle,walkDistance:frame*9,moving:true,fire:0,hit:0,hp:100});ctx.restore();
       const pixels=ctx.getImageData(0,0,c.width,c.height).data;
       for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]<200||Math.floor(i/4/c.width)>105)pixels[i+3]=0;
       const seen=new Uint8Array(c.width*c.height),groups=[];
       for(let start=0;start<seen.length;start++){
         if(seen[start]||pixels[start*4+3]<100)continue;const queue=[start];seen[start]=1;let left=c.width,right=0,top=c.height,bottom=0;
         for(let at=0;at<queue.length;at++){
           const index=queue[at],x=index%c.width,y=Math.floor(index/c.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
           for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
             const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=c.width||ny>=c.height)continue;
             const next=ny*c.width+nx;if(!seen[next]&&pixels[next*4+3]>=100){seen[next]=1;queue.push(next);}
           }
         }
         groups.push({size:queue.length,left,right,top,bottom});
       }
       groups.sort((a,b)=>b.size-a.size);const body=groups[0];if(!body)throw Error(`Missing solid pose: angle ${angle}, frame ${frame}`);minHeight=Math.min(minHeight,body.bottom-body.top+1);maxHeight=Math.max(maxHeight,body.bottom-body.top+1);
       for(const part of groups.slice(1))if(part.size>=2)maxDetachedDistance=Math.max(maxDetachedDistance,body.left-part.right,part.left-body.right,body.top-part.bottom,part.top-body.bottom);
     }
   }finally{r.context=old;r.selected=selection;}
   return {maxDetachedDistance,minHeight,maxHeight};
 });
 expect(result.maxDetachedDistance).toBeLessThanOrEqual(3);expect(result.minHeight).toBeGreaterThan(70);expect(result.maxHeight).toBeLessThan(101);
});

test('reborn: captured bastion keeps both maps lit after infantry leaves and marching guards initiate combat',async({page})=>{
 await start(page);await page.locator('#select-unit').click();
 const target=await page.evaluate(()=>window.__reborn.game.territories[20].point);await order(page,target);await advance(page,14);
 const home=await page.evaluate(()=>({x:window.__reborn.game.bases[0].x+125,y:window.__reborn.game.bases[0].y+100}));await order(page,home);await advance(page,14);await focus(page,target);
 const result=await page.evaluate(()=>{
   const {game:g,renderer:r}=window.__reborn,t=g.territories[20],p={x:t.point.x+140,y:t.point.y};r.render(0);
   const s=r.screen(p),d=Math.min(2,devicePixelRatio||1);
   const main=Array.from(r.context.getImageData(Math.floor(s.x*d),Math.floor(s.y*d),1,1).data).slice(0,3);
   const mini=Array.from(r.mini.getImageData(Math.floor(p.x/3762*224),Math.floor(p.y/3762*224),1,1).data).slice(0,3);
   return {owner:t.owner,visible:g.canSee(0,p),soldierDistance:Math.hypot(g.units[0].x-t.point.x,g.units[0].y-t.point.y),main,mini};
 });
 expect(result.owner).toBe(0);expect(result.visible).toBe(true);expect(result.soldierDistance).toBeGreaterThan(310);
 expect(result.main.reduce((a,b)=>a+b,0)).toBeGreaterThan(240);expect(result.mini.reduce((a,b)=>a+b,0)).toBeGreaterThan(180);
 await page.screenshot({path:evidence+'bastion-sight.png'});
 const combat=await page.evaluate(()=>{
   const {game:g,renderer:r}=window.__reborn;g.units=[];
   const blue=g.spawn(0,{x:1900,y:2100}),red=g.spawn(1,{x:2050,y:2100});red.cooldown=100;
   g.command([blue.id],{x:2350,y:2100,kind:'move'});g.command([blue.id],{x:2400,y:2250,kind:'move'},true);g.updateVision();
   g.paused=false;g.step();g.paused=true;r.camera.x=blue.x;r.camera.y=blue.y;r.boundCamera();r.render(0);
   return {blueHp:blue.hp,redHp:red.hp,firstAttacker:blue.lastAttacker,orders:blue.orders.length,shots:g.shots.filter(s=>s.owner===0).length};
 });
 expect(combat).toEqual({blueHp:100,redHp:83,firstAttacker:null,orders:2,shots:1});
});


test('reborn: unit-focused HUD stays compact at bottom left and trains heavy infantry without construction',async({page})=>{
 await start(page,3434,1790);await page.locator('#select-unit').click();
 await expect(page.locator('[data-unit]')).toHaveCount(9);await expect(page.locator('.catalog-tabs button')).toHaveCount(2);
 await expect(page.locator('#tab-buildings, [data-building], #build-shortcut')).toHaveCount(0);
 await page.keyboard.press('b');expect(await page.evaluate(()=>window.__reborn.renderer.placement)).toBe(null);
 const panel=await page.locator('.command').boundingBox();expect(panel.x).toBeLessThanOrEqual(12);expect(panel.width).toBeLessThanOrEqual(700);expect(panel.height).toBeLessThanOrEqual(216);expect(1790-panel.y-panel.height).toBeLessThanOrEqual(12);
 await expect(page.locator('.command #production')).toHaveCount(0);await expect(page.locator('#sidebar #production')).toBeVisible();
 await expect(page.locator('[data-unit="heavy"]')).toBeEnabled();await page.locator('[data-unit="heavy"]').click();
 await expect(page.locator('#credits')).toHaveText('250');await expect(page.locator('#queue')).toContainText('1 IM AUFTRAG');
 await page.screenshot({path:evidence+'unit-focus-wide.png'});await advance(page,9);
 expect(await page.evaluate(()=>window.__reborn.game.units.some(u=>u.kind==='heavy'&&u.hp===190))).toBe(true);
 await page.setViewportSize({width:800,height:650});await page.locator('#select-unit').click();await expect(page.locator('#select-unit')).toBeInViewport();await expect(page.locator('#attack')).toBeInViewport();await expect(page.locator('#recruit')).toBeInViewport();
 const compact=await page.locator('.command').boundingBox(),sidebar=await page.locator('#sidebar').boundingBox();expect(compact.x+compact.width).toBeLessThan(sidebar.x);expect(compact.x).toBeLessThanOrEqual(10);expect(compact.height).toBeLessThanOrEqual(186);
 await page.screenshot({path:evidence+'unit-focus-compact.png'});
 await openMenu(page);await expect(page.locator('#pause-dialog .menu-button')).toHaveCount(6);
 await page.locator('#options').click();await expect(page.locator('#audio-panel')).toBeVisible();await page.locator('#audio-close').click();await expect(page.locator('#pause-dialog')).toBeVisible();expect(await page.evaluate(()=>window.__reborn.game.paused)).toBe(true);
 await page.locator('#save').click();await expect(page.locator('#notices')).toContainText('Kampagne lokal gespeichert');await page.reload();await page.locator('#loading').waitFor({state:'detached'});await openMenu(page);await page.locator('#load').click();await expect(page.locator('#notices')).toContainText('Kampagne geladen');await page.evaluate(()=>{window.__reborn.game.paused=true;});
 expect(await page.evaluate(()=>window.__reborn.game.bases.length)).toBe(2);expect(await page.evaluate(()=>window.__reborn.game.units.some(u=>u.kind==='heavy'))).toBe(true);
});

test('reborn: headquarters catalog produces all six vehicles and aircraft with distinct sprites and working movement',async({page})=>{
 test.setTimeout(60000);await start(page,1450,1090);
 // Fund the six production paths; the campaign test separately uses the real starting economy.
 await page.evaluate(()=>{const g=window.__reborn.game;g.credits[0]=5000;g.aiClock=-1e8;window.__reborn.refresh();});
 for(const kind of ['rover','tank','artillery','scout','gunship','bomber']){await page.locator('[data-unit="'+kind+'"]').scrollIntoViewIfNeeded();await expect(page.locator('[data-unit="'+kind+'"]')).toBeEnabled();await page.locator('[data-unit="'+kind+'"]').click();}
 await expect(page.locator('#queue')).toContainText('6 IM AUFTRAG');await expect(page.locator('#queue-slots button')).toHaveCount(8);
 await advance(page,2);const credits=await page.evaluate(()=>window.__reborn.game.credits[0]);await page.locator('#queue-slots button').nth(5).click();
 expect(await page.evaluate(()=>window.__reborn.game.credits[0])).toBe(credits+1000);await page.locator('[data-unit="bomber"]').click();
 await advance(page,98);const roster=await page.evaluate(()=>window.__reborn.game.units.filter(u=>u.owner===0).map(u=>u.kind));for(const kind of ['rover','tank','artillery','scout','gunship','bomber'])expect(roster).toContain(kind);
 expect(await page.evaluate(()=>window.__reborn.game.bases.length)).toBe(2);
 const moved=await page.evaluate(()=>{const {game:g}=window.__reborn,army=g.units.filter(u=>u.owner===0&&['rover','tank','artillery'].includes(u.kind));const before=army.map(u=>({id:u.id,x:u.x,y:u.y}));g.command(army.map(u=>u.id),{...g.territories[20].point,kind:'move'});return before;});await advance(page,14);
 for(const original of moved){const distance=await page.evaluate(original=>{const u=window.__reborn.game.units.find(u=>u.id===original.id);return Math.hypot(u.x-original.x,u.y-original.y);},original);expect(distance).toBeGreaterThan(45);}
 await page.locator('#home').click();await page.screenshot({path:evidence+'unit-roster.png'});
});


test('reborn: authored shadows, slow base activity and subtle sand drift stay grounded and pause with simulation time',async({page})=>{
 await start(page);await page.locator('#home').click();
 const result=await page.evaluate(()=>{
  const {renderer:r,game:g}=window.__reborn,original=r.context,selected=r.selectedBase,oldTime=g.time;
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=540;const c=canvas.getContext('2d');r.context=c;r.selectedBase=null;
  const changes=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;return n;};
  const snap=()=>Array.from(c.getImageData(0,0,640,540).data);
  const base={...g.bases[0],x:260,y:390,queue:[],hp:1200,buildRemaining:0};
  let projected=0;
  let baseChanged=0,pausedChanged=0,windChanged=0,shadowPixels=0;
  try{
   g.time=0;r.drawBase(base);const first=snap();c.clearRect(0,0,640,540);g.time=12;r.drawBase(base);baseChanged=changes(first,snap());
   c.clearRect(0,0,640,540);r.drawBase(base);const frozen=snap();c.clearRect(0,0,640,540);r.drawBase(base);pausedChanged=changes(frozen,snap());
   const asset=r.units.asset('infantry');for(const frame of asset.data.frames){
    const tile=document.createElement('canvas');tile.width=frame.w;tile.height=frame.h;const tc=tile.getContext('2d');tc.drawImage(asset.image,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);
    const d=tc.getImageData(0,0,frame.w,frame.h).data;for(let i=0;i<d.length;i+=4)if(d[i+3]>5&&d[i+3]<200&&Math.max(d[i],d[i+1],d[i+2])<85)shadowPixels++;
   }
   c.clearRect(0,0,640,540);const hq=g.bases[0];c.save();c.translate(320-hq.x,270-hq.y);r.paintSandWind(0);c.restore();const wind=snap();
   c.clearRect(0,0,640,540);c.save();c.translate(320-hq.x,270-hq.y);r.paintSandWind(3);c.restore();windChanged=changes(wind,snap());
  }finally{r.context=original;r.selectedBase=selected;g.time=oldTime;}
  const before=JSON.stringify(g.save());r.render(.016);r.render(.016);const renderPreservesSave=JSON.stringify(g.save())===before;
  return {baseChanged,pausedChanged,windChanged,projected,shadowPixels,frames:r.units.asset('infantry').data.frames.length,dishes:r.structures.asset('headquarters',0).data.activity.frames.length,renderPreservesSave};
 });
 expect(result.frames).toBe(296);expect(result.dishes).toBe(64);expect(result.shadowPixels).toBeGreaterThan(500);
 expect(result.projected).toBe(0);expect(result.baseChanged).toBeGreaterThan(40);expect(result.pausedChanged).toBe(0);expect(result.windChanged).toBeGreaterThan(50);expect(result.renderPreservesSave).toBe(true);
 await page.screenshot({path:evidence+'grounded-animation.png'});
});


test('reborn: animation laboratory visibly exercises all six scenarios with real state transitions and optional particles',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:1600,height:1100},recordVideo:{dir:evidence+'../.animation-video',size:{width:1600,height:1100}}});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(baseURL+'/animation-lab.html');await page.locator('#loading').waitFor({state:'detached'});await expect(page.locator('.legend>div')).toHaveCount(6);
  await page.evaluate(()=>{const lab=window.__animationLab;lab.advance(.25);});await page.screenshot({path:evidence+'animation-lab-walk.png'});
  const before=await page.evaluate(()=>{const l=window.__animationLab,tank=l.actors.find(u=>u.kind==='tank'),view=l.presentation.inspect(tank.id);return {time:l.time,body:view.bodyAngle,turret:view.turretAngle,frame:l.presentation.inspect(l.actors[1].id).anim.frame().x};});
  await page.evaluate(()=>{const l=window.__animationLab;l.advance(Math.max(0,1.05-l.time));});
  const hit=await page.evaluate(()=>{const l=window.__animationLab;return l.presentation.inspect(l.actors.at(-1).id).anim.state;});expect(hit).toBe('hit');await page.screenshot({path:evidence+'animation-lab-hit.png'});
  await page.evaluate(()=>{const l=window.__animationLab;l.advance(Math.max(0,2.5-l.time));});await page.screenshot({path:evidence+'animation-lab-death.png'});
  const after=await page.evaluate(()=>{const l=window.__animationLab,tank=l.actors.find(u=>u.kind==='tank'),view=l.presentation.inspect(tank.id);return {body:view.bodyAngle,turret:view.turretAngle,dead:l.presentation.corpses.some(v=>v.anim.state==='death'),rotor:l.presentation.asset('scout').data.rotor};});
  expect(after.body).toBeCloseTo(before.body,5);expect(Math.abs(after.turret-before.turret)).toBeGreaterThan(.3);expect(after.dead).toBe(true);expect(after.rotor).toBe(true);
  await page.locator('#particles').uncheck();expect(await page.evaluate(()=>window.__animationLab.presentation.particles.count)).toBe(0);
  await page.locator('#pause').click();await page.waitForTimeout(2200);await page.locator('#pause').click();expect(errors).toEqual([]);
 }finally{const video=page.video();await context.close();await video.saveAs(evidence+'animation-lab.webm');}
});

test('model study: exported GLB loads real animated geometry, supports five clips, orbit controls and faction selection',async({browser,baseURL})=>{
 const dir=new URL('../../docs/detailed-models/',import.meta.url).pathname;await mkdir(dir,{recursive:true});
 const context=await browser.newContext({viewport:{width:1450,height:1100},recordVideo:{dir:dir+'.video',size:{width:1450,height:1100}}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(baseURL+'/model-3d.html');await page.waitForFunction(()=>!!window.__model3D?.data);await expect(page.locator('#error')).toHaveText('');
  const info=await page.evaluate(()=>{const v=window.__model3D;let meshes=0,triangles=0,design;v.current.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;}if(n.userData.atlasDesign)design=n.userData.atlasDesign;});return {meshes,triangles,design,clips:v.data.animations.map(c=>c.name)};});
  expect(info.meshes).toBe(info.design.parts);expect(info.triangles).toBe(info.design.triangles);expect(info.triangles).toBeGreaterThan(0);expect(info.design.maxGripError).toBeLessThan(.0001);expect(info.clips.sort()).toEqual(['Death','HitReact','Idle','Idle_Shoot','Run_Gun']);
  await page.evaluate(()=>{const v=window.__model3D;v.pause();v.play('Idle');v.mixer.setTime(.25);v.render();});await page.screenshot({path:dir+'infantry-3d.png',fullPage:true});
  const poses=await page.evaluate(()=>{const v=window.__model3D;v.play('Run_Gun');v.mixer.setTime(.10);const a=v.current.getObjectByName('LowerLegL').quaternion.toArray();v.mixer.setTime(.35);return {a,b:v.current.getObjectByName('LowerLegL').quaternion.toArray()};});expect(poses.a.reduce((n,v,i)=>n+Math.abs(v-poses.b[i]),0)).toBeGreaterThan(.1);
  const grip=await page.evaluate(()=>{const v=window.__model3D,errors=[];for(const clip of ['Idle','Run_Gun','Idle_Shoot']){v.play(clip);for(const t of [.05,.15,.3]){v.mixer.setTime(t);v.current.updateMatrixWorld(true);const rifle=v.current.getObjectByName('Atlas_Rifle');for(const side of ['L','R']){const target=rifle.getObjectByName('Atlas_Grip'+side).getWorldPosition(rifle.position.clone());const hand=v.current.getObjectByName('Index1'+side).getWorldPosition(target.clone());errors.push(hand.distanceTo(target));}}}return Math.max(...errors);});expect(grip).toBeLessThan(.015);
  for(const [label,clip] of [['Schießen','Idle_Shoot'],['Treffer','HitReact'],['Tod','Death']]){await page.getByRole('button',{name:label,exact:true}).click();expect(await page.evaluate(()=>window.__model3D.clip)).toBe(clip);await page.evaluate(()=>{const v=window.__model3D;v.mixer.setTime(.25);v.render();});await page.waitForTimeout(120);}
  await page.screenshot({path:dir+'infantry-3d-death.png',fullPage:true});await page.getByRole('button',{name:'Stehen',exact:true}).click();
  const before=await page.evaluate(()=>window.__model3D.camera.position.toArray()),box=await page.locator('#stage').boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:8});await page.mouse.up();await page.waitForTimeout(150);const after=await page.evaluate(()=>window.__model3D.camera.position.toArray());expect(after.some((v,i)=>Math.abs(v-before[i])>.1)).toBe(true);
  await page.getByRole('button',{name:'Rot',exact:true}).click();await expect(page.locator('#red')).toHaveAttribute('aria-pressed','true');await page.screenshot({path:dir+'infantry-3d-red.png',fullPage:true});
  const response=await page.request.get(baseURL+'/src/assets/reborn/prototype/infantry-1.glb');expect(response.ok()).toBe(true);expect((await response.body()).subarray(0,4).toString()).toBe('glTF');
  await page.getByRole('button',{name:'Laufen',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(1600);expect(errors).toEqual([]);
 }finally{const video=page.video();await context.close();await video.saveAs(dir+'infantry-3d.webm');}
});

test('model study: sprite comparison shows the adopted infantry in eight real directions and all five states',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1390,height:1180});await page.goto('/model-preview.html');await page.waitForFunction(()=>!!window.__modelPreview);
 const info=await page.evaluate(()=>window.__modelPreview.assets.map(a=>({directions:a.data.directions,cell:a.data.cell,frames:a.data.frames.length,walk:a.data.clips.walk.uniquePhases})));for(const a of info){expect(a.directions).toBe(8);expect(a.frames).toBe(296);expect(a.walk.every(n=>n===8)).toBe(true);}
 await page.evaluate(()=>{const p=window.__modelPreview;p.paused=true;p.time=.15;p.render();});await page.screenshot({path:new URL('../../docs/detailed-models/infantry-study.png',import.meta.url).pathname,fullPage:true});
 for(const label of ['Laufen','Schießen','Treffer','Tod','Stehen']){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.getByRole('button',{name:'Laufen',exact:true}).click();await page.evaluate(()=>{window.__modelPreview.time=.22;window.__modelPreview.render();});await page.screenshot({path:new URL('../../docs/detailed-models/infantry-walk.png',import.meta.url).pathname,fullPage:true});
 await page.getByRole('button',{name:'Rotes Team',exact:true}).click();await expect(page.locator('#download')).toHaveAttribute('href','/src/assets/reborn/prototype/infantry-1.glb');await page.getByRole('button',{name:'Blickrichtung drehen',exact:true}).click();expect(errors).toEqual([]);
});

test('atlas models: approved infantry and real building renders are active with fixed ground shadows',async({page})=>{
 await start(page,1600,1080);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const result=await page.evaluate(()=>{
  const {renderer:r,game:g}=window.__reborn,foot=['infantry','engineer','heavy'].map(kind=>r.units.asset(kind)),hq=r.structures.asset('headquarters',0),base={...g.bases[0],x:260,y:350,queue:[],hp:1200,buildRemaining:0};
  const canvas=document.createElement('canvas');canvas.width=620;canvas.height=530;const c=canvas.getContext('2d',{willReadFrequently:true}),original=r.context,selected=r.selectedBase,time=g.time;
  const capture=()=>Array.from(c.getImageData(0,0,620,530).data),ground=()=>Array.from(c.getImageData(30,350,530,150).data);let a,b,groundA,groundB;
  try{r.context=c;r.selectedBase=null;g.time=0;r.drawBase(base);a=capture();groundA=ground();c.clearRect(0,0,620,530);g.time=12;r.drawBase(base);b=capture();groundB=ground();}finally{r.context=original;r.selectedBase=selected;g.time=time;}
  const pixels=document.createElement('canvas');pixels.width=pixels.height=512;const p=pixels.getContext('2d');p.drawImage(hq.body,0,0);const rgba=p.getImageData(0,0,512,512).data;let baked=0;for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]>8&&rgba[i+3]<100&&Math.max(rgba[i],rgba[i+1],rgba[i+2])<90)baked++;
  return {sources:foot.map(a=>a.image.src),shared:foot.every(a=>a.image===foot[0].image),frames:foot.map(a=>a.data.frames.length),muzzles:foot.every(a=>a.data.frames.every(f=>f.muzzle?.every(Number.isFinite))),building:hq.body.src,groundSame:groundA.every((v,i)=>v===groundB[i]),changed:a.reduce((n,v,i)=>n+Number(v!==b[i]),0),baked};
 });
 expect(result.sources.every(s=>s.includes('/prototype/infantry-0.png'))).toBe(true);expect(result.shared).toBe(true);expect(result.frames).toEqual([296,296,296]);expect(result.muzzles).toBe(true);expect(result.building).toContain('/buildings-3d/headquarters-0.png');expect(result.groundSame).toBe(true);expect(result.changed).toBeGreaterThan(100);expect(result.baked).toBeGreaterThan(100);expect(errors).toEqual([]);
 await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn,b=g.bases[0];r.camera.zoom=1.5;r.camera.x=b.x+165;r.camera.y=b.y-115;r.render(0);});await page.screenshot({path:new URL('../../docs/buildings-3d/in-game.png',import.meta.url).pathname,fullPage:true});
});

test('atlas models: refined headquarters preserves the edited surfaces and moves its added radar details in both factions',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});await page.goto('/model-3d.html?model=headquarters');await page.waitForFunction(()=>window.__model3D?.current?.getObjectByName('AtlasRefined_trim_radar'));
 for(const team of [0,1]){
  if(team===1){await page.locator('#red').click();await page.waitForFunction(()=>window.__model3D?.team===1&&window.__model3D.current.getObjectByName('Atlas_refined_headquarters')?.userData.atlasDesign.team===1);}
  const result=await page.evaluate(()=>{
   const v=window.__model3D;v.pause();v.play('Operation');v.mixer.setTime(0);v.current.updateMatrixWorld(true);
   const detail=v.current.getObjectByName('AtlasRefined_trim_radar'),panel=v.current.getObjectByName('AtlasRefined_panel_radar'),fixed=v.current.getObjectByName('AtlasRefined_caution'),light=v.current.getObjectByName('AtlasRefined_blue_beacon'),before=detail.matrixWorld.toArray(),ground=fixed.matrixWorld.toArray(),local=detail.matrix.toArray();
   v.mixer.setTime(12);v.current.updateMatrixWorld(true);v.render();return {before,after:detail.matrixWorld.toArray(),local,localAfter:detail.matrix.toArray(),ground,groundAfter:fixed.matrixWorld.toArray(),radar:detail.parent.name,panel:panel.parent.name,light:light.parent.name};
  });expect(result.after).not.toEqual(result.before);expect(result.localAfter).toEqual(result.local);expect(result.groundAfter).toEqual(result.ground);expect(result.radar).toBe('RadarDish');expect(result.panel).toBe('RadarDish');expect(result.light).toBe('Beacon');
  await expect(page.locator('#status')).toContainText('115 Bauteile');await page.screenshot({path:new URL('../../docs/buildings-3d/headquarters-refined-'+team+'.png',import.meta.url).pathname,fullPage:true});
 }
 await start(page,1440,1000);await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn,b=g.bases[0];r.camera.zoom=1.7;r.camera.x=b.x+165;r.camera.y=b.y-115;r.render(0);});
 await page.screenshot({path:new URL('../../docs/buildings-3d/headquarters-refined-game.png',import.meta.url).pathname,fullPage:true});expect(errors).toEqual([]);
});

test('atlas models: all seven building models load in the gallery and radar motion keeps the foundation fixed',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1600,height:1080});await page.goto('/model-3d.html?model=headquarters');await page.waitForFunction(()=>window.__model3D?.current?.getObjectByName('Atlas_headquarters'));
 for(const kind of ['headquarters','bastion','barracks','factory','airfield','generator','turret']){
  await page.locator('#model').selectOption(kind);await page.waitForFunction(kind=>window.__model3D?.current?.getObjectByName('Atlas_'+kind),kind);await expect(page.locator('#error')).toHaveText('');await expect(page.locator('#download')).toHaveAttribute('href','/src/assets/reborn/buildings-3d/'+kind+'-0.glb');
  const info=await page.evaluate(()=>{const v=window.__model3D;return {clips:v.data.animations.map(c=>c.name),parts:(()=>{let n=0;v.current.traverse(p=>{if(p.isMesh)n++;});return n;})()};});expect(info.parts).toBeGreaterThanOrEqual(14);expect(info.clips).toContain('BeaconPulse');
  if(['headquarters','bastion'].includes(kind)){
   const motion=await page.evaluate(()=>{const v=window.__model3D;v.pause();v.play('Operation');v.mixer.setTime(0);v.current.updateMatrixWorld(true);const radar=v.current.getObjectByName('RadarDish'),fixed=v.current.getObjectByName('Atlas_'+v.kind),before=fixed.matrixWorld.toArray(),angle=radar.quaternion.toArray();v.mixer.setTime(12);v.current.updateMatrixWorld(true);v.render();return {before,after:fixed.matrixWorld.toArray(),angle,next:radar.quaternion.toArray()};});expect(motion.after).toEqual(motion.before);expect(motion.next).not.toEqual(motion.angle);
   if(kind==='bastion'){await page.locator('#neutral').click();await expect(page.locator('#neutral')).toHaveAttribute('aria-pressed','true');const emission=await page.evaluate(()=>{const colors=[];window.__model3D.current.traverse(n=>{if(n.isMesh&&n.material.name==='Atlas faction emission')colors.push(n.material.emissive.toArray());});return colors;});expect(emission.length).toBeGreaterThan(0);expect(emission.every(c=>Math.abs(c[0]-c[1])<.001&&Math.abs(c[0]-c[2])<.001)).toBe(true);}
   await page.screenshot({path:new URL('../../docs/buildings-3d/'+kind+'.png',import.meta.url).pathname,fullPage:true});
  }
 }
 expect(errors).toEqual([]);
});

test('campaign: real new-game input generates a different reachable map and save/load restores the previous terrain and minimap',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1500,height:1000});await page.goto('/?debug');await page.locator('#loading').waitFor({state:'detached'});
 const snapshot=()=>page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.paused=true;r.render(0);
  const digest=c=>{const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;let n=2166136261;for(let i=0;i<d.length;i+=113)n=Math.imul(n^d[i],16777619)>>>0;return n;};
  return {seed:g.seed,map:g.world.mapVersion,sites:g.territories.map(t=>t.point),terrain:digest(r.terrainSurface),mini:digest(r.miniTerrain),mesas:g.world.generated.mesas.length,reachable:g.territories.every(t=>g.world.path(g.units[0],t.point,g.obstacles()).length>0),spaced:g.territories.every(t=>g.territories.every(o=>o.id===t.id||Math.hypot(t.point.x-o.point.x,t.point.y-o.point.y)>=440))};
 });
 const before=await snapshot();expect(before.map).toBe(1);expect(before.mesas).toBeGreaterThanOrEqual(20);expect(before.reachable).toBe(true);expect(before.spaced).toBe(true);
 await openMenu(page);await page.locator('#save').click();await expect(page.locator('#notices')).toContainText('Kampagne lokal gespeichert');
 await newCampaign(page);await page.locator('#new-dialog [value="new"]').click();await expect.poll(()=>page.evaluate(()=>window.__reborn.game.seed)).not.toBe(before.seed);const after=await snapshot();
 expect(after.seed).not.toBe(before.seed);expect(after.sites).not.toEqual(before.sites);expect(after.terrain).not.toBe(before.terrain);expect(after.mini).not.toBe(before.mini);expect(after.reachable).toBe(true);expect(after.spaced).toBe(true);
 await openMenu(page);await page.locator('#load').click();await expect(page.locator('#notices')).toContainText('Kampagne geladen');const restored=await snapshot();expect(restored).toEqual(before);
 await page.screenshot({path:evidence+'random-campaign.png'});expect(errors).toEqual([]);
});

test('combat: approaching enemies receive immediate fire and a second attacker does not steal the first target',async({page})=>{
 await page.setViewportSize({width:1500,height:1000});await page.goto('/?debug&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const first=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.paused=false;g.aiClock=-1e8;g.units=[];
  const p=g.territories[19].point,blue=g.spawn(0,p,'heavy'),a=g.spawn(1,{x:p.x+120,y:p.y}),b=g.spawn(1,{x:p.x+155,y:p.y});
  g.command([blue.id],{x:p.x+300,y:p.y,kind:'move'});g.command([blue.id],{x:p.x+400,y:p.y+50,kind:'move'},true);
  g.visible[0].fill(0);g.step();g.paused=true;r.selected.add(blue.id);r.camera.x=p.x+100;r.camera.y=p.y-60;r.camera.zoom=1.5;g.updateVision();r.render(.05);
  return {blue:blue.id,first:a.id,second:b.id,target:blue.combatTarget,attacker:blue.lastAttacker,hp:[a.hp,b.hp]};
 });
 expect(first.target).toBe(first.first);expect(first.attacker).toBe(first.second);expect(first.hp).toEqual([66,100]);
 await advance(page,2.65);
 const next=await page.evaluate(()=>{const g=window.__reborn.game;return {survivors:g.units.filter(u=>u.owner===1).map(u=>u.id),hp:g.units.find(u=>u.owner===1).hp,blue:g.units.find(u=>u.owner===0).hp,orders:g.units.find(u=>u.owner===0).orders.length};});
 expect(next.survivors).toEqual([first.second]);expect(next.hp).toBe(100);expect(next.blue).toBeGreaterThan(0);expect(next.orders).toBe(2);
 await advance(page,1.4);expect(await page.evaluate(()=>window.__reborn.game.units.find(u=>u.owner===1).hp)).toBeLessThan(100);
 await page.screenshot({path:evidence+'target-focus.png'});
});

test('vehicle art: the full roster has real faction materials, baked shadows, animated running gear and visible turret/barrel layers',async({page})=>{
 await start(page);const result=await page.evaluate(async()=>{
  const r=window.__reborn.renderer,c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d',{willReadFrequently:true}),rows=[];
  for(const kind of ['rover','tank','artillery','scout','gunship','bomber']){
   const asset=r.units.asset(kind),data=asset.data;
   const count=frame=>{ctx.clearRect(0,0,96,96);ctx.drawImage(asset.image,frame.x,frame.y,96,96,0,0,96,96);const p=ctx.getImageData(0,0,96,96).data;let solid=0,shadow=0,groundShadow=0;for(let i=0;i<p.length;i+=4){if(p[i+3]>200)solid++;if(p[i+3]>5&&p[i+3]<150&&Math.max(p[i],p[i+1],p[i+2])<85){shadow++;if(Math.floor(i/4/96)>=70)groundShadow++;}}return {solid,shadow,groundShadow};};
   const base=count(data.frames[data.clips.idle.frames[0][0]]),turret=data.clips.turret?count(data.frames[data.clips.turret.frames[0][0]]):null,barrel=data.clips.barrel?count(data.frames[data.clips.barrel.frames[0][0]]):null;
   rows.push({kind,parts:data.design.parts,source:data.source,base,turret,barrel,phases:data.clips.walk.uniquePhases,model:(await fetch('/src/assets/reborn/animation/'+kind+'-0.glb')).ok});
  }
  return rows;
 });
 for(const row of result){expect(row.parts).toBeGreaterThan(20);expect(row.source).toBe('Atlas original vehicle geometry');expect(row.model).toBe(true);expect(row.base.solid).toBeGreaterThan(60);expect(row.base.shadow).toBeGreaterThan(10);if(row.kind!=='bomber')expect(row.phases.every(n=>n>=4)).toBe(true);if(row.turret){expect(row.turret.solid).toBeGreaterThan(15);expect(row.barrel.solid).toBeGreaterThan(3);expect(row.barrel.groundShadow).toBe(0);}}
});

test('visual polish: fine sand relief and a quiet HUD preserve usable production and compact selection',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1500,height:1000});await page.goto('/?debug&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const art=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.paused=true;r.home();r.render(0);const p=g.territories[19].point,ctx=r.terrainSurface.getContext('2d',{willReadFrequently:true}),data=ctx.getImageData(p.x-100,p.y-100,200,200).data;let sum=0,squares=0;
  for(let i=0;i<data.length;i+=4){const l=data[i]*.299+data[i+1]*.587+data[i+2]*.114;sum+=l;squares+=l*l;}
  const n=data.length/4,panels=Array.from(document.querySelectorAll('.hud')).map(e=>getComputedStyle(e).backgroundImage);
  const bar=document.querySelector('.production-track').getBoundingClientRect(),clock=document.querySelector('#production-time').getBoundingClientRect();
  return {texture:r.sand.complete&&r.sand.naturalWidth>=1024,deviation:Math.sqrt(squares/n-(sum/n)**2),noSteel:panels.every(s=>!s.includes('steel.png')),separateClock:clock.left>=bar.right};
 });
 expect(art.texture).toBe(true);expect(art.deviation).toBeGreaterThan(7);expect(art.noSteel).toBe(true);expect(art.separateClock).toBe(true);
 await page.screenshot({path:evidence+'sand-hud-v2.png'});await openMenu(page);await page.screenshot({path:evidence+'simple-menu-v2.png'});await page.locator('#resume').click();
 await page.setViewportSize({width:800,height:650});await page.locator('#select-unit').click();await expect(page.locator('#attack')).toBeInViewport();await expect(page.locator('#recruit')).toBeInViewport();expect(errors).toEqual([]);
});

test('combat presentation: simultaneous hits never hide return-fire poses or delay the real weapon cadence',async({page})=>{
 await page.setViewportSize({width:1500,height:1000});await page.goto('/?debug&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(()=>{
  const {game:g,renderer:r}=window.__reborn;g.units=[];g.aiClock=-1e8;g.paused=false;const site=g.territories[19].point,p={x:site.x+50,y:site.y+95},blue=g.spawn(0,p,'heavy');
  g.spawn(1,{x:p.x+120,y:p.y});g.spawn(1,{x:p.x+155,y:p.y});g.updateVision();r.units.clear();r.selected.add(blue.id);r.camera.x=p.x+80;r.camera.y=p.y-45;r.camera.zoom=1.65;
  const shots=[];let previous=0;
  for(let i=0;i<82;i++){
   g.step();r.render(.05);const view=r.units.inspect(blue.id);
   if(blue.fire>previous+.01)shots.push({time:g.time,state:view.anim.state,hit:blue.hit});
   previous=blue.fire;
  }
  g.paused=true;window.__reborn.refresh();r.render(0);return {shots,hp:blue.hp};
 });
 expect(result.shots.length).toBe(4);expect(result.shots.every(s=>s.state==='attack')).toBe(true);expect(result.shots[0].hit).toBeGreaterThan(0);expect(result.hp).toBeGreaterThan(0);
 for(let i=1;i<result.shots.length;i++)expect(result.shots[i].time-result.shots[i-1].time).toBeCloseTo(1.3,4);
 await page.screenshot({path:evidence+'return-fire-v2.png'});
});

test('capture: a real two-unit drag selection captures after clicking the mast, body or label at different zoom levels',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1500,height:1000});await page.goto('/?debug&seed=2026');await page.locator('#loading').waitFor({state:'detached'});
 for(const [zoom,dy] of [[1,-100],[1.65,-65],[.7,35]]){
  const setup=await page.evaluate(({zoom,dy})=>{
   const {game:g,renderer:r}=window.__reborn;g.paused=true;g.aiClock=-1e8;g.units=[];const t=g.territories[20];t.owner=-1;t.capturing=-1;t.progress=0;
   for(let i=0;i<2;i++)g.spawn(0,g.world.nearest({x:t.point.x,y:t.point.y+240},g.obstacles(),g.units));
   g.updateVision();r.selected.clear();r.selectedBase=null;r.camera={x:t.point.x+180,y:t.point.y+100,zoom};r.boundCamera();r.render(0);
   return {units:g.units.map(u=>r.screen(u)),click:r.screen({x:t.point.x,y:t.point.y+dy}),visible:g.canSee(0,t.point)};
  },{zoom,dy});
  expect(setup.visible).toBe(true);const xs=setup.units.map(p=>p.x),ys=setup.units.map(p=>p.y);
  await page.mouse.move(Math.min(...xs)-25,Math.min(...ys)-60*zoom);await page.mouse.down();await page.mouse.move(Math.max(...xs)+25,Math.max(...ys)+15,{steps:8});await page.mouse.up();
  expect(await page.evaluate(()=>window.__reborn.renderer.selected.size)).toBe(2);
  await page.mouse.click(setup.click.x,setup.click.y,{button:'right'});
  const order=await page.evaluate(()=>{const {game:g,renderer:r}=window.__reborn,t=g.territories[20];return {targets:g.units.map(u=>u.orders[0]),point:t.point,marker:r.marker.point};});
  expect(order.targets).toHaveLength(2);expect(order.targets.every(p=>Math.hypot(p.x-order.point.x,p.y-order.point.y)<25)).toBe(true);expect(order.marker).toEqual(order.point);
  await advance(page,3);const progress=await page.evaluate(()=>window.__reborn.game.territories[20].progress);expect(progress).toBeGreaterThan(1);expect(progress).toBeLessThan(4);
  await advance(page,9);expect(await page.evaluate(()=>window.__reborn.game.territories[20].owner)).toBe(0);
 }
 expect(errors).toEqual([]);
 await page.screenshot({path:evidence+'group-capture.png'});
});

test('reborn: readable translucent HUD at the standard desktop viewport',async({page})=>{
 await start(page,1200,900);
 const values=await page.evaluate(()=>{
  const size=selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
  const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  return {
   sidebar:rect('#sidebar'),command:rect('.command'),catalog:rect('.catalog'),
   tabs:size('.catalog-tabs button'),heading:size('.catalog h2'),cost:size('.card-cost'),
   description:size('#catalog-detail'),selection:size('#selection-title'),selectionDetail:size('#selection-detail'),
   queue:size('#queue'),radar:size('.radar-caption'),background:getComputedStyle(document.querySelector('.catalog')).backgroundImage
  };
 });
 expect(values.sidebar.width).toBeGreaterThanOrEqual(335);
 expect(values.command.width).toBeGreaterThanOrEqual(690);
 expect(values.command.height).toBeGreaterThanOrEqual(210);
 expect(values.command.right).toBeLessThan(values.sidebar.x);
 expect(values.command.bottom).toBeLessThanOrEqual(900);
 expect(values.tabs).toBeGreaterThanOrEqual(15);
 expect(values.heading).toBeGreaterThanOrEqual(16);
 expect(values.cost).toBeGreaterThanOrEqual(14);
 expect(values.description).toBeGreaterThanOrEqual(12);
 expect(values.selection).toBeGreaterThanOrEqual(26);
 expect(values.selectionDetail).toBeGreaterThanOrEqual(15);
 expect(values.queue).toBeGreaterThanOrEqual(11);
 expect(values.radar).toBeGreaterThanOrEqual(10);
 expect(values.background).toContain('rgba(');
 expect(values.background).toContain('0.69');
 const visuals=await page.evaluate(()=>{
  const css=selector=>getComputedStyle(document.querySelector(selector));
  const cards=[...document.querySelectorAll('#catalog-units .catalog-card')];
  const grid=css('#catalog-units .catalog-grid');
  return {commandBackground:css('.command').backgroundImage,
   catalogBackground:css('.catalog').backgroundImage,
   cardBackground:css('.catalog-card').backgroundImage,
   gridColumns:grid.gridTemplateColumns.split(' ').length,
   labels:cards.map(card=>({kind:card.dataset.unit,name:card.querySelector('.card-name')?.textContent?.trim()}))};
 });
 expect(visuals.commandBackground).toContain('0.69');
 expect(visuals.catalogBackground).toContain('0.66');
 expect(visuals.cardBackground).toContain('rgba(');
 expect(visuals.gridColumns).toBe(2);
 expect(visuals.labels).toHaveLength(9);
 expect(visuals.labels.every(({name})=>Boolean(name))).toBe(true);
 expect(visuals.labels.find(({kind})=>kind==='rover')?.name).toBeTruthy();
 await expect(page.locator('#tab-units')).toBeVisible();
 await expect(page.locator('#recruit')).toBeVisible();
 await expect(page.locator('#menu')).toBeVisible();
});

test('model gallery: vehicles and aircraft are selectable as real 3D GLBs',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1280,height:850});
 await page.goto('/model-3d.html?model=rover');
 const models={rover:'Spähwagen',tank:'Panzer',artillery:'Artillerie',scout:'Spähheli',gunship:'Kampfheli',bomber:'Bomber'};
 for(const [kind,label] of Object.entries(models)){
  await page.locator('#model').selectOption(kind);
  await page.waitForFunction(k=>window.__model3D?.kind===k&&window.__model3D?.current?.getObjectByName('Atlas_'+k),kind);
  await expect(page.locator('#error')).toHaveText('');
  await expect(page.locator('#model-title')).toContainText(label);
  await expect(page.locator('#download')).toHaveAttribute('href','/src/assets/reborn/animation/'+kind+'-0.glb');
  await expect(page.locator('[data-clip="Operation"]')).toBeHidden();
  const info=await page.evaluate(()=>{
   const v=window.__model3D;let meshes=0;v.current.traverse(n=>{if(n.isMesh)meshes++;});
   return {meshes,animations:v.data.animations.length,position:v.camera.position.toArray()};
  });
  expect(info.meshes).toBeGreaterThan(10);
  expect(info.animations).toBe(0); // Vehicle movement is authored in the sprite atlases, not GLB clips.
  expect(info.position.every(Number.isFinite)).toBe(true);
 }
 await page.locator('#red').click();
 await page.waitForFunction(()=>window.__model3D?.team===1&&window.__model3D?.current?.getObjectByName('Atlas_bomber'));
 await expect(page.locator('#download')).toHaveAttribute('href','/src/assets/reborn/animation/bomber-1.glb');
 await page.locator('#model').selectOption('infantry');
 await page.waitForFunction(()=>window.__model3D?.kind==='infantry'&&window.__model3D?.data?.animations?.length===5);
 await expect(page.locator('[data-clip="Idle"]')).toBeVisible();
 await expect(page.locator('#download')).toHaveAttribute('href','/src/assets/reborn/prototype/infantry-1.glb');
 expect(errors).toEqual([]);
});

test('infantry: exported wrist sockets retain both grips through every clip and intermediate pose for both factions',async({page})=>{
 await page.goto('/model-3d.html');await page.waitForFunction(()=>!!window.__model3D?.data);await page.evaluate(()=>window.__model3D.pause());
 for(const team of [0,1]){
  if(team===1){await page.locator('#red').click();await page.waitForFunction(()=>window.__model3D?.current?.getObjectByName('Atlas_GripL')&&window.__model3D.current.getObjectByName('Atlas_WeaponSocket')?.parent.name==='Index1R'&&window.__model3D.current.getObjectByName('Atlas_WeaponMark').material.color.r>window.__model3D.current.getObjectByName('Atlas_WeaponMark').material.color.b);}
  const audit=await page.evaluate(async()=>{
   const T=await import('three'),v=window.__model3D,m=v.current,rifle=m.getObjectByName('Atlas_Rifle'),chest=m.getObjectByName('Atlas_Breastplate');
   const result={binding:[rifle.parent.name,rifle.parent.parent.name],gripError:0,wristAngle:0,chestPenetrations:0,elbowMin:180,elbowMax:0,deathTravel:0,clips:[],texturedCloth:false,ceramicNormal:false};
   m.traverse(n=>{if(n.isMesh&&n.material.name==='Atlas three-tone desert fabric')result.texturedCloth=!!n.material.map&&!!n.material.normalMap&&!!n.material.roughnessMap;if(n.isMesh&&n.material.name==='Atlas sand ceramic')result.ceramicNormal=!!n.material.normalMap;});
   const world=n=>n.getWorldPosition(new T.Vector3());
   for(const clip of v.data.animations){
    v.play(clip.name);const action=v.mixer.existingAction(clip);action.setLoop(T.LoopOnce,1);result.clips.push(clip.name);let start;
    for(let i=0;i<=100;i++){
     v.mixer.setTime(clip.duration*i/100);m.updateMatrixWorld(true);
     if(i===0)start=world(chest);if(clip.name==='Death'&&i===100)result.deathTravel=start.distanceTo(world(chest));
     for(const side of ['L','R']){
      const hand=m.getObjectByName('Index1'+side),grip=rifle.getObjectByName('Atlas_Grip'+side);
      result.gripError=Math.max(result.gripError,world(hand).distanceTo(world(grip)));
      result.wristAngle=Math.max(result.wristAngle,hand.getWorldQuaternion(new T.Quaternion()).angleTo(rifle.getWorldQuaternion(new T.Quaternion())));
      const elbow=world(m.getObjectByName('LowerArm'+side)),angle=world(m.getObjectByName('UpperArm'+side)).sub(elbow).angleTo(world(hand).sub(elbow))*180/Math.PI;
      result.elbowMin=Math.min(result.elbowMin,angle);result.elbowMax=Math.max(result.elbowMax,angle);
     }
     // Test all weapon vertices in chest space against the solid breastplate core.
     // This remains valid when the torso turns, recoils, flinches or falls.
     rifle.traverse(n=>{if(!n.isMesh)return;const positions=n.geometry.attributes.position,transform=new T.Matrix4().copy(chest.matrixWorld).invert().multiply(n.matrixWorld);
      for(let k=0;k<positions.count;k++){const p=new T.Vector3().fromBufferAttribute(positions,k).applyMatrix4(transform);if(Math.abs(p.x)<.25&&Math.abs(p.y)<.175&&p.z>-.15&&p.z<.21)result.chestPenetrations++;}
     });
    }
   }
   return result;
  });
  expect(audit.binding).toEqual(['Atlas_WeaponSocket','Index1R']);expect(audit.clips.sort()).toEqual(['Death','HitReact','Idle','Idle_Shoot','Run_Gun']);
  expect(audit.gripError).toBeLessThan(.001);expect(audit.wristAngle).toBeLessThan(.002);expect(audit.chestPenetrations).toBe(0);
  expect(audit.elbowMin).toBeGreaterThan(30);expect(audit.elbowMax).toBeLessThan(165);expect(audit.deathTravel).toBeGreaterThan(.5);
  expect(audit.texturedCloth).toBe(true);expect(audit.ceramicNormal).toBe(true);
 }
});
