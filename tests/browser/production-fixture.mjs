// Infrastructure for presentation tests; worker-driven construction is exercised
// end-to-end in reborn-production.spec.mjs.
export async function provideFacilities(page,kinds){
 return page.evaluate(async kinds=>{
  const a=window.__reborn,g=a.game,{BUILDINGS}=await import('/src/reborn/catalog.js'),home=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'),ids={};
  for(const kind of kinds){
   const existing=g.bases.find(b=>b.owner===0&&b.kind===kind&&b.hp>0&&b.buildRemaining<=0);if(existing){ids[kind]=existing.id;continue;}
   const spec=BUILDINGS[kind];let at;
   for(let radius=200;radius<750&&!at;radius+=40)for(let i=0;i<24;i++){
    const p=g.world.clearSite({x:home.x+Math.cos(i*Math.PI/12)*radius,y:home.y+Math.sin(i*Math.PI/12)*radius},spec.radius);
    if(p&&g.bases.every(b=>Math.hypot(b.x-p.x,b.y-p.y)>=b.radius+spec.radius+24)&&g.territories.every(t=>Math.hypot(t.point.x-p.x,t.point.y-p.y)>=spec.radius+45)){at=p;break;}
   }
   if(!at)throw Error('No presentation fixture site for '+kind);let id=1800;while(g.bases.some(b=>b.id===id)||g.units.some(u=>u.id===id))id++;
   g.bases.push({...home,...at,id,kind,hp:spec.hp,radius:spec.radius,queue:[],queueTypes:[],queueCosts:[],production:0,buildRemaining:0,cooldown:0,rally:null});ids[kind]=id;
  }
  a.refresh();return ids;
 },kinds);
}
