import {test,expect} from '@playwright/test';

test('realtime left click on friendly land is inert even on a threatened border',async({page})=>{
  await page.goto('/?debug');
  await page.locator('[data-country="DE"]').click();
  const state=await page.evaluate(()=>{
    const g=window.__atlas.getGame(),r=window.__atlas.renderer;
    g.paused=true;
    const box=r.canvas.getBoundingClientRect();
    const pointToScreen=index=>({
      x:box.left+r.ox+(index%480+.5)*(1600/480)*r.scale,
      y:box.top+r.oy+(Math.floor(index/480)+.5)*(900/260)*r.scale,
    });
    // Turn a neutral neighbor into a hostile frontline without launching attacks.
    const own=g.owner.findIndex((owner,i)=>owner===0&&
      i%480>0&&i%480<479 &&
      [i-1,i+1,i-480,i+480].some(n=>g.owner[n]===-1));
    if(own<0)throw new Error('No owned border found');
    const neighbors=[own-1,own+1,own-480,own+480];
    const enemy=neighbors.find(n=>g.owner[n]===-1);
    g.owner[enemy]=1;
    const candidates=[own,g.cities[0].index];
    const visible=candidates.map(i=>({index:i,...pointToScreen(i)}))
      .find(p=>p.x>=box.left+5&&p.x<=box.right-5&&p.y>=box.top+5&&p.y<=box.bottom-5);
    if(!visible)throw new Error('Expected at least one visible owned cell');
    window.__atlas.refresh();
    return visible;
  });
  const before=await page.evaluate(()=>{
    const g=window.__atlas.getGame();
    return {reserve:g.factions[0].troops,
      orders:g.attackOrders.length,population:g.populationOf(0),
      deployed:g.frontline.reduce((total,n)=>total+n,0)};
  });
  await page.mouse.click(state.x,state.y);
  await expect.poll(()=>page.evaluate(()=>{
    const g=window.__atlas.getGame();
    return {reserve:g.factions[0].troops,
      orders:g.attackOrders.length,population:g.populationOf(0),
      deployed:g.frontline.reduce((total,n)=>total+n,0)};
  })).toEqual(before);
});
