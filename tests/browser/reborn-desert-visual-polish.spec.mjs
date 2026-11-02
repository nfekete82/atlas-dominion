import {test,expect} from '@playwright/test';

test('visual polish: mixed palm grove, open production shutters and grounded vehicles render in the live canvas',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/?debug&perfTest&legacy');
 await page.locator('#loading').waitFor({state:'detached'});
 const result=await page.evaluate(async()=>{
  const {BUILDINGS}=await import('/src/reborn/catalog.js');
  const {ProductionGates}=await import('/src/reborn/production-gates.js');
  const a=window.__reborn,g=a.game,r=a.renderer,prototype=g.bases.find(b=>b.owner===0);
  g.paused=true;g.aiClock=-1e8;g.visible[0].fill(1);g.explored[0].fill(1);g.revision++;
  g.world.blocked.fill(0);
  g.units=[];
  const make=(kind,id,x,y,duration)=>({...prototype,kind,id,x,y,
    hp:BUILDINGS[kind].hp,radius:BUILDINGS[kind].radius,buildRemaining:0,
    queue:[duration],queueTypes:[kind==='factory'?'tank':'infantry'],queueCosts:[350],
    production:duration*.95,facing:0});
  g.bases=[make('factory',7010,1290,1510,18),make('barracks',7011,1790,1470,5)];
  g.territories=[];
  r.groundDetails=[
   {kind:'palm',x:1060,y:1370,radius:38,rotation:.2,variant:.2},
   {kind:'palm',x:1540,y:1710,radius:34,rotation:0,variant:.6},
   {kind:'palm',x:1970,y:1650,radius:28,rotation:.8,variant:.7},
  ];
  r.palms.reset(r.groundDetails,g);
  const grove=r.palms.visibleTrees(),count=grove.length;
  g.spawn(0,{x:1530,y:1460},'tank');
  g.spawn(0,{x:1570,y:1580},'rover');
  r.productionGates.clear();
  r.camera={x:1540,y:1520,zoom:.9};r.boundCamera();
  let gateCalls=0;const old=r.structures.drawProductionGate.bind(r.structures);
  r.structures.drawProductionGate=(...args)=>{gateCalls++;old(...args);};
  r.render(0);
  r.structures.drawProductionGate=old;
  const stateBefore=JSON.stringify(g.save());
  r.render(0);
  return {count,gateCalls,shapes:grove.map(p=>({x:p.x,y:p.y,radius:p.radius,mirror:p.mirrored})),
    vehicles:g.units.filter(u=>u.kind==='tank'||u.kind==='rover').length,
    unchanged:stateBefore===JSON.stringify(g.save()),
    gateProgress:ProductionGates?true:false};
 });
 expect(result.gateCalls).toBeGreaterThanOrEqual(2);
 expect(result.vehicles).toBe(2);
 expect(result.count).toBeGreaterThanOrEqual(3);
 expect(result.unchanged).toBe(true);
 expect(result.gateProgress).toBe(true);
 await page.screenshot({path:'artifacts/reborn/desert-visual-polish.png'});
 expect(errors).toEqual([]);
});
