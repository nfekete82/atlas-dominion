/**
 * Budget-constrained scripted BLUE defense for fair RED AI benchmarks.
 * Uses only ordinary Simulation build/recruit/command APIs.
 * Creates no free units, buildings, resources or map knowledge.
 */
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

function freeBuildingSite(g,owner,kind,home){
 for(const radius of [190,240,290,345])for(let i=0;i<16;i++){
  const angle=i*Math.PI/8;
  const p={x:home.x+Math.cos(angle)*radius,y:home.y+Math.sin(angle)*radius};
  if(!g.buildError(owner,kind,p))return p;
 }
 return null;
}
export function blueDefense(g){
 if(g.status!=='playing')return;
 const owner=0,own=g.bases.filter(b=>b.owner===owner&&b.hp>0),
  home=own.find(b=>b.kind==='headquarters'),worker=g.units.find(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0);
 if(!home)return;
 const has=k=>own.some(b=>b.kind===k);
 const unfinished=own.some(b=>b.buildRemaining>0);
 if(worker&&!unfinished&&!worker.orders.some(o=>o.kind==='build')){
  const kind=!has('barracks')?'barracks':
   g.time>=40&&!has('turret')?'turret':null;
  if(kind&&g.credits[owner]>=BUILDINGS[kind].cost){
   const site=freeBuildingSite(g,owner,kind,home);
   if(site)g.build(owner,kind,site,[worker.id]);
  }
 }
 const barracks=own.find(b=>b.kind==='barracks'&&b.buildRemaining<=0&&b.queue.length<2);
 if(!barracks)return;
 const roster=g.units.filter(u=>u.owner===owner&&u.hp>0),
  count=k=>roster.filter(u=>u.kind===k).length+own.reduce((n,b)=>n+b.queueTypes.filter(v=>v===k).length,0);
 // Stand and defend: no scripted omniscient target selection.
 const kind=count('infantry')<5?'infantry':count('heavy')<1?'heavy':null;
 if(kind&&g.credits[owner]>=UNITS[kind].cost)g.recruit(barracks.id,kind);
}
