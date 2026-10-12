import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const evidence=new URL('./artifacts/screenshots/',import.meta.url).pathname;
async function start(page){
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?debug');await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{window.__atlas.getGame().paused=true;window.__atlas.refresh();});
}
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
for(const zoom of [1,1.5,2,4])test(`country names and outlined strength stay legible at zoom ${zoom}`,async({page})=>{
  await start(page);
  await page.evaluate(z=>{
    const r=window.__atlas.renderer;r.fit();r.zoomBy(z);
    const ctx=r.canvas.getContext('2d'),original=ctx.fillText.bind(ctx),stroke=ctx.strokeText.bind(ctx);
    window.__text=[];window.__outlines=[];
    ctx.fillText=function(text,...args){if(window.__text.length<500)window.__text.push({text,font:this.font,alpha:this.globalAlpha,shadow:this.shadowBlur,color:this.fillStyle});return original(text,...args);};
    ctx.strokeText=function(text,...args){if(window.__outlines.length<500)window.__outlines.push({text,width:this.lineWidth});return stroke(text,...args);};
  },zoom);
  await page.waitForTimeout(100);
  const state=await page.evaluate(()=>({labels:window.__atlas.renderer.visibleCountryLabels,text:window.__text,outlines:window.__outlines}));
  expect(state.labels.length).toBeGreaterThan(0);
  if(zoom===1)expect(state.labels.filter(l=>l.id!==0).length).toBeGreaterThan(3);
  for(const [i,label] of state.labels.entries()){
    expect(label.strength).toMatch(/^⚔ /);
    expect(label.mobile).toMatch(/^● [0-9,.KM]+ mobil$/);
    expect(label.fontSize).toBeGreaterThanOrEqual(14);
    expect(state.text.some(t=>t.text===label.name)).toBe(true);
    expect(state.text.some(t=>t.text===label.strength&&t.font.includes('14px')&&t.alpha===1&&t.shadow>=4)).toBe(true);
    expect(state.outlines.some(t=>t.text===label.strength&&t.width>=3)).toBe(true);
    expect(state.text.some(t=>t.text===label.mobile&&t.font.includes('12px')&&t.alpha===1)).toBe(true);
    expect(state.outlines.some(t=>t.text===label.mobile&&t.width>=2.5)).toBe(true);
    expect(label.bounds.height).toBeGreaterThanOrEqual(56);
    for(const other of state.labels.slice(i+1))expect(overlaps(label.bounds,other.bounds)).toBe(false);
  }
  if(zoom===1){await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}military-labels.png`});}
});

test('foreign country hover exposes the actual military ledger and relative strength',async({page})=>{
  await start(page);
  const target=await page.evaluate(()=>{
    const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();
    const city=g.cities.find(c=>g.owner[c.index]>0),id=g.owner[city.index];
    g.factions[id].troops=2300;g.frontline.fill(0);
    g.frontline[city.index]=700;g.attackOrders=[];g.recount();refresh();
    r.focusOnCapital(city);
    const b=r.canvas.getBoundingClientRect();
    return {name:g.factions[id].name,x:b.left+r.ox+(city.x+.5)*1600/480*r.scale,y:b.top+r.oy+(city.y+.5)*900/260*r.scale,
      summary:r.military[id],ratio:r.military[id].total/r.military[0].total};
  });
  await page.mouse.move(target.x,target.y);
  await expect(page.locator('#hoverOwner')).toHaveText(target.name);
  const details=page.locator('#hoverMilitary');await expect(details).toBeVisible();
  for(const text of ['GESAMTSTÄRKE / BEVÖLKERUNG','MOBILE TRUPPEN','GRENZTRUPPEN GESAMT','AKTIVE ANGRIFFSFRONTEN','STÄDTE','Ø STADTLEVEL','EINKOMMEN / TICK','WACHSTUM / TICK','STÄRKE VS. SPIELER'])await expect(details).toContainText(text);
  await expect.poll(()=>page.evaluate(()=>{const r=window.__atlas.renderer;return r.visibleCountryLabels.some(l=>l.name.includes(document.getElementById('hoverOwner').textContent)&&l.strength==='⚔ 3K');})).toBe(true);
  const values=await details.locator('b').allTextContents();
  expect(values.slice(0,4)).toEqual(['3K','2,3K','700','0']);
  expect(values[9]).toMatch(/% · STÄRKER$/);expect(values[9].split('%')[0]).not.toContain('K');
  await expect(details.locator('div').last()).toHaveCSS('color','rgb(255, 170, 164)');
  const box=await page.locator('#mapInfo').boundingBox(),canvas=await page.locator('#battleCanvas').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(canvas.x);expect(box.y).toBeGreaterThanOrEqual(canvas.y);
  expect(box.y+box.height).toBeLessThanOrEqual(canvas.y+canvas.height);
  await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}military-tooltip.png`});
  // The tooltip follows live ticks even when the pointer stays still.
  await page.evaluate(()=>{const g=window.__atlas.getGame(),id=g.factions.find(f=>f.name===document.getElementById('hoverOwner').textContent).id;g.factions[id].troops=4300;g.recount();window.__atlas.refresh();});
  await expect(details.locator('b').first()).toHaveText('5K');
});

test('moving reserves to the border changes only mobile badge, not total country strength',async({page})=>{
  await start(page);
  const before=await page.evaluate(()=>{
    const g=window.__atlas.getGame(),r=window.__atlas.renderer;
    r.fit();window.__atlas.refresh();
    const badge=r.visibleCountryLabels.find(l=>l.id===0)??r.visibleCountryLabels[0];
    if(!badge)throw Error('Expected a visible country badge');
    const id=badge.id;
    const index=g.owner.findIndex(owner=>owner===id);
    if(index<0)throw Error('Expected an owned sector');
    g.paused=true;
    return {id,index,strength:badge.strength,mobile:badge.mobile,amount:100};
  });
  const after=await page.evaluate(({id,index,amount})=>{
    const g=window.__atlas.getGame(),r=window.__atlas.renderer;
    if(g.factions[id].troops<amount)throw Error('Not enough uncommitted troops');
    g.factions[id].troops-=amount;
    g.frontline[index]+=amount;
    g.recount();window.__atlas.refresh();
    const badge=r.visibleCountryLabels.find(l=>l.id===id);
    return {badge,summary:r.military[id]};
  },before);
  expect(after.summary.mobile).toBeGreaterThanOrEqual(0);
  expect(after.badge).toBeTruthy();
  expect(after.badge.strength).toBe(before.strength);
  expect(after.badge.mobile).not.toBe(before.mobile);
  expect(after.badge.mobile).toContain('mobil');
});
