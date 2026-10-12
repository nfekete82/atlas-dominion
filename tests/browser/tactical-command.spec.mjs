import {test,expect} from '@playwright/test';

async function gameStart(page){
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  await page.evaluate(()=>{
    window.__atlas.getGame().paused=true;
    window.__atlas.refresh();
  });
}

test('hover previews actual sector risk and active army can be focused and withdrawn exactly once',async({page})=>{
  await gameStart(page);
  const position=await page.evaluate(async()=>{
    const {getGame,renderer:r,refresh}=window.__atlas,g=getGame();
    const {landNeighbors,NEUTRAL,cellToPoint}=await import('/src/engine/game.js');
    const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
    const target=landNeighbors(own).find(i=>g.owner[i]===NEUTRAL);
    g.owner[target]=1;g.factions[0].troops=1200;g.factions[1].troops=500;
    g.factions.forEach(f=>f.ai=false);
    g.recount();refresh();
    r.focusOnPoint(cellToPoint(target));
    const b=r.canvas.getBoundingClientRect();
    return {index:target,x:b.left+r.ox+(target%480+.5)*1600/480*r.scale,
      y:b.top+r.oy+(Math.floor(target/480)+.5)*900/260*r.scale,
      mobile:g.factions[0].troops};
  });
  await page.mouse.move(position.x,position.y);
  await expect(page.locator('#attackAssessment')).toBeVisible();
  await expect(page.locator('#attackAssessment')).toContainText('Erster Sektor');
  await expect(page.locator('#attackAssessment')).toContainText('Grenztruppen');
  await page.mouse.click(position.x,position.y);
  await expect(page.locator('[data-army-retreat]')).toHaveCount(1);
  await expect(page.locator('[data-army-focus]')).toHaveCount(1);
  await expect(page.locator('[data-army-reinforce]')).toHaveCount(1);
  const sent=await page.evaluate(()=>{
    const g=window.__atlas.getGame();
    return g.attackOrders.find(o=>o.factionId===0)?.remaining;
  });
  expect(sent).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__atlas.getGame().factions[0].troops)).toBe(position.mobile-sent);
  await page.locator('[data-army-reinforce]').click();
  const reinforced=await page.evaluate(()=>{
    const g=window.__atlas.getGame();return g.attackOrders.find(o=>o.factionId===0)?.remaining;
  });
  expect(reinforced).toBeGreaterThan(sent);
  expect(await page.evaluate(()=>window.__atlas.getGame().attackOrders.filter(o=>o.factionId===0).length)).toBe(1);
  await page.locator('[data-army-focus]').click();
  const center=await page.evaluate(()=>{
    const r=window.__atlas.renderer;
    return {x:(r.canvas.clientWidth/2-r.ox)/r.scale,y:(r.canvas.clientHeight/2-r.oy)/r.scale};
  });
  expect(center.x).toBeGreaterThan(0);
  await page.locator('[data-army-retreat]').click();
  expect(await page.evaluate(()=>window.__atlas.getGame().factions[0].troops)).toBe(position.mobile);
  await expect(page.locator('[data-army-retreat]')).toHaveCount(0);
  await expect(page.locator('#activeArmyCount')).toHaveText('0');
});

test('incoming enemy offensive raises a clickable map alert that focuses actual border',async({page})=>{
  await gameStart(page);
  const expected=await page.evaluate(async()=>{
    const g=window.__atlas.getGame();
    const {landNeighbors,NEUTRAL,cellToPoint}=await import('/src/engine/game.js');
    const own=g.owner.findIndex((v,i)=>v===0&&landNeighbors(i).some(n=>g.owner[n]===NEUTRAL));
    const target=landNeighbors(own).find(i=>g.owner[i]===NEUTRAL);
    g.owner[target]=1;g.recount();
    g.attackOrders.push({id:990001,factionId:1,targetOwner:0,anchor:cellToPoint(own),
      committed:200,remaining:180,fallen:20,conquered:0,effort:250,startedTick:g.tick});
    g.tick++;
    window.__atlas.refresh();
    return {x:own%480,y:Math.floor(own/480)};
  });
  await expect(page.locator('[data-war-focus]')).toHaveCount(1);
  await expect(page.locator('[data-war-focus]')).toContainText('Angriff auf dein Gebiet');
  await page.locator('[data-war-focus]').click();
  const at=await page.evaluate(()=>{
    const r=window.__atlas.renderer;
    return {x:(r.canvas.clientWidth/2-r.ox)/r.scale,
      y:(r.canvas.clientHeight/2-r.oy)/r.scale,
      zoom:r.zoom};
  });
  expect(at.zoom).toBeGreaterThanOrEqual(2.2);
  expect(at.x).toBeCloseTo((expected.x+.5)*1600/480,0);
  expect(at.y).toBeCloseTo((expected.y+.5)*900/260,0);
  await page.evaluate(()=>window.__atlas.refresh());
  await expect(page.locator('[data-war-focus]')).toHaveCount(1);
});

test('no tactical overlays or armed forces are shown before selecting a nation',async({page})=>{
  await page.goto('/?debug');
  await expect(page.locator('#countryPicker')).toBeVisible();
  await expect(page.locator('#warAlerts')).toBeHidden();
  await expect(page.locator('#attackAssessment')).toBeHidden();
});
