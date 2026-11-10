import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {availableEngineers,chooseConstructionCrew,nearestEngineer}
 from '../scripts/webgl-builder-input.js';

/** Reproduce the actual click path:
 * create the full building with a real pioneer, advance its construction
 * through 20 Hz ticks, then request a second building with the same crew.
 * Previous tests only inserted a pre-completed base into game.bases!
 */
const candidates=(game,kind,anchor)=>{
 const points=[];
 for(let r=270;r<=1050;r+=100)
  for(let i=0;i<32;i++){
   const angle=2*Math.PI*i/32;
   const p={x:Math.round(anchor.x+r*Math.cos(angle)),
    y:Math.round(anchor.y+r*Math.sin(angle))};
   if(!game.buildError(0,kind,p,0))points.push(p);
  }
 return points;
};
for(const kind of ['airfield','factory']){
 test('REAL consecutive build: '+kind+' then generator with same pioneer',()=>{
  const g=new Simulation(2074,19);
  g.aiClock=1e9;g.tactical.plan=()=>{};
  g.credits[0]=25000;g.explored[0].fill(1);
  const pioneer=g.units.find(u=>u.owner===0&&u.kind==='engineer');
  const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
  assert.ok(pioneer&&hq);
  let site=null;
  for(const p of candidates(g,kind,hq)){
   const b=g.build(0,kind,p,[pioneer.id],0,false);
   if(b){site=b;break;}
  }
  assert.ok(site,'initial '+kind+' build must succeed with real pioneer: '+g.notices.slice(-3));
  for(let tick=0;site.buildRemaining>0&&tick<3200&&g.status==='playing';tick++)
   g.step(.05);
  assert.equal(site.buildRemaining,0,
   kind+' must actually finish; pioneer='+JSON.stringify({
    x:pioneer.x,y:pioneer.y,orders:pioneer.orders,workingTarget:pioneer.workingTarget,
    hp:pioneer.hp,status:g.status,buildRemaining:site.buildRemaining
   }));
  assert.ok(pioneer.hp>0);
  // The second order must ACTUALLY CREATE A NEW SITE; buildError==null
  // alone does not test supportApproach or command()/append behaviour.
  const selection=new Set([pioneer.id]);
  let valid=0,started=null,failures=[];
  for(const p of candidates(g,'generator',hq)){
   const crew=chooseConstructionCrew(availableEngineers(g.units,selection),false);
   const before=g.buildError(0,'generator',p,0);
   if(before)continue;
   valid++;
   const second=g.build(0,'generator',p,crew.workers.map(u=>u.id),0,crew.append);
   if(second){started=second;break;}
   failures.push({p,crew:crew.workers.map(u=>({id:u.id,orders:u.orders})),
    notices:g.notices.slice(-2)});
  }
  assert.ok(started,
   'generator after '+kind+' must ACTUALLY be constructible: '+JSON.stringify({
    validSites:valid,failed:failures.slice(0,4),
    pioneer:{x:pioneer.x,y:pioneer.y,orders:pioneer.orders},site:{x:site.x,y:site.y},
    credits:g.credits[0],status:g.status
   }));
  assert.equal(started.kind,'generator');
  assert.ok(started.buildRemaining>0);
  assert.ok(pioneer.orders.some(o=>o.kind==='build'&&o.target===started.id),
   'second real construction must be assigned to the same pioneer');
 });
}

test('reselect an idle engineer when selected builder is still assigned to completed factory',()=>{
 const chosen={id:17,owner:0,kind:'engineer',hp:110,orders:[{kind:'build',target:5}]};
 const idle={id:18,owner:0,kind:'engineer',hp:110,orders:[]};
 const selection=new Set([chosen.id]);
 assert.deepEqual(chooseConstructionCrew(availableEngineers([chosen,idle],selection)),
  {workers:[chosen],append:true});
 assert.equal(nearestEngineer([chosen,idle],{x:0,y:0}).id,17);
});
