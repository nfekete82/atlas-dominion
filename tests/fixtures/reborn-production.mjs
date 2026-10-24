import {BUILDINGS} from '../../dist/src/reborn/catalog.js';
import {distance} from '../../dist/src/reborn/config.js';

// Completed infrastructure for tests about combat/production rather than building.
// Progression tests create their buildings through workers and the real build API.
export function addProducer(g,kind,owner=0){
 const home=g.bases.find(b=>b.owner===owner&&b.kind==='headquarters'),spec=BUILDINGS[kind];
 for(let radius=200;radius<750;radius+=40)for(let i=0;i<24;i++){
  const p=g.world.clearSite({x:home.x+Math.cos(i*Math.PI/12)*radius,y:home.y+Math.sin(i*Math.PI/12)*radius},spec.radius);if(!p)continue;
  if(g.bases.some(b=>distance(b,p)<b.radius+spec.radius+24)||g.territories.some(t=>distance(t.point,p)<spec.radius+45))continue;
  let id=1700;while(g.bases.some(b=>b.id===id)||g.units.some(u=>u.id===id))id++;
  const b={...home,...p,id,kind,hp:spec.hp,radius:spec.radius,queue:[],queueTypes:[],queueCosts:[],production:0,buildRemaining:0,cooldown:0,rally:null};g.bases.push(b);return b;
 }throw Error('No fixture site for '+kind);
}
