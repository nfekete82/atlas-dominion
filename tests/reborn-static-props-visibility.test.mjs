import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {environmentPropVisible,propSiteClear} from '../dist/src/reborn/prop-placement.js';
import {BuildingDecor,buildingProps} from '../dist/src/reborn/building-decor.js';
import {PalmGrove} from '../dist/src/reborn/palm-grove.js';

function cleanGame() {
 const g=new Simulation(2026,11);
 g.world.blocked.fill(0);
 g.bases=[];g.territories=[];g.units=[];
 return g;
}
test('palms and desert skulls stay visible when soldiers, tanks or other vehicles stand directly on them',()=>{
 const g=cleanGame(),p={x:1350,y:1410};
 const palm={...p,kind:'palm',radius:30,variant:.4,rotation:0};
 const skull={...p,kind:'skull',radius:7,variant:.1,rotation:0};
 for(const kind of ['infantry','rover','tank','artillery','scout','bomber']){
  g.units=[];
  const unit=g.spawn(0,p,kind);
  const before=g.save();
  assert.equal(environmentPropVisible(palm,g),true,kind+' must not hide palm');
  assert.equal(environmentPropVisible(skull,g),true,kind+' must not hide skull');
  assert.deepEqual(g.save(),before,'visibility must not mutate game state');
  unit.x+=45;unit.y+=14;
  assert.equal(environmentPropVisible(palm,g),true,kind+' moving by must not hide palm');
  assert.equal(environmentPropVisible(skull,g),true,kind+' moving by must not hide skull');
 }
});
test('3D palms still draw their sprite when a ground unit arrives underneath the canopy',()=>{
 const g=cleanGame(),p={x:1350,y:1410};
 const palm={...p,kind:'palm',radius:30,variant:.5,rotation:0};
 const draws=[];
 const atlas={draw:(_c,kind,point,width,variant)=>draws.push({kind,point,width,variant})};
 const grove=new PalmGrove(atlas);
 const c={save(){},restore(){}},view={left:1100,right:1600,top:1100,bottom:1700};
 grove.reset([palm],g);
 grove.draw(c,0,view);
 assert.equal(draws.length,1);
 g.spawn(0,p,'rover');g.spawn(1,p,'infantry');
 grove.draw(c,.5,view);
 assert.equal(draws.length,2,'palm stays rendered when both teams enter its footprint');
 assert.equal(draws[1].kind,'palm-tree');
});
test('all building 3D props stay rendered while troops cross service yard',()=>{
 const g=cleanGame(),center={x:1400,y:1450},radius=80;
 const props=buildingProps('headquarters',center,radius,66,g.seed);
 const first=props[0];
 g.spawn(0,{x:first.x,y:first.y},'rover');
 g.spawn(1,{x:first.x+1,y:first.y+1},'infantry');
 assert.ok(props.every(p=>propSiteClear(p,p.size,g,{base:66})),
  'static crates and lamps stay visible despite units crossing their locations');
 const drawn=[];
 const atlas={draw:(_c,kind,point)=>drawn.push(kind),get spriteCount(){return 32;}};
 const decor=new BuildingDecor(atlas);
 const ctx={save(){},restore(){}};
 for(const layer of ['behind','front'])decor.draw(ctx,'headquarters',center,radius,66,g.seed,0,layer,0,false,1,0,
  prop=>propSiteClear(prop,prop.size,g,{base:66}));
 assert.equal(drawn.length,props.length,'all service-yard assets must be drawn');
});
test('static scenery still avoids actual building foundations, bastions and impassable terrain',()=>{
 const g=cleanGame(),p={x:1400,y:1400},palm={...p,kind:'palm',radius:30,variant:0,rotation:0};
 assert.equal(environmentPropVisible(palm,g),true);
 g.bases.push({id:800,kind:'factory',...p,radius:70,buildRemaining:20});
 assert.equal(environmentPropVisible(palm,g),false,'a newly built factory overrides the overlapping palm');
 g.bases=[];g.territories.push({id:120,point:p});
 assert.equal(environmentPropVisible(palm,g),false,'capture bastion still takes precedence');
 g.territories=[];g.world.blocked[g.world.index(p)]=1;
 assert.equal(environmentPropVisible(palm,g),false,'mesa terrain still takes precedence');
});
