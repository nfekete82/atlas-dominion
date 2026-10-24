// Identical seeded map and commands on both revisions; no reduced rendering settings.
export function setupScenario({name,fixed=false}){
 const a=window.__reborn,g=a.game,r=a.renderer;
 g.paused=true;g.credits=[20000,20000];g.aiClock=0;
 if(name!=='A-start'){
  g.units=[];
  const battle=name.startsWith('D')||name.startsWith('E'),count=name.startsWith('C')?50:name.startsWith('B')?20:battle?36:12;
  const point=g.territories[9].point;
  const kinds=name.startsWith('E')?['tank','heavy','artillery','gunship','bomber','medic','infantry']:['infantry','infantry','heavy','rover','engineer','medic'];
  for(let i=0;i<count;i++){
   const owner=battle&&i>=count/2?1:0,kind=kinds[i%kinds.length];
   const origin=battle?{x:point.x+(owner?250:-250),y:point.y}:{x:g.bases[0].x+180,y:g.bases[0].y-180};
   const p=g.world.nearest({x:origin.x+(i%6)*30,y:origin.y+Math.floor(i/6)*30},g.obstacles(),[],undefined,kind==='rover'||kind==='tank'?12:0);
   if(p)g.spawn(owner,p,kind);
  }
  if(battle){
   for(const owner of [0,1]){const p=g.world.clearSite({x:point.x+(owner?360:-360),y:point.y+170},30);if(p)g.bases.push({...g.bases[owner],...p,id:2000+owner,kind:'turret',radius:30,hp:650,queue:[],queueTypes:[],queueCosts:[],cooldown:0});}
   for(const owner of [0,1])g.command(g.units.filter(u=>u.owner===owner&&u.kind!=='engineer').map(u=>u.id),{...point,kind:'attackMove'});
   g.time=27;g.aiClock=2.95;r.camera.x=point.x;r.camera.y=point.y;
  }else if(name.startsWith('B')||name.startsWith('C')){
   const target=g.territories[6].point;g.command(g.units.map(u=>u.id),{...target,kind:'move'});
  }
  if(name.startsWith('H')){const b=g.bases[0];r.selectedBase=b.id;g.recruit(b.id,'engineer');g.recruit(b.id,'engineer');document.querySelector('#tab-territories').click();}
 }
 g.updateVision();a.refresh();r.boundCamera();r.render(0);a.profiler.reset();g.paused=false;
 if(fixed){a.profiler.reset();for(let i=0;i<120;i++)g.step();g.paused=true;return {stats:a.profiler.snapshot(),save:g.save()};}
 return {units:g.units.length,mapVersion:g.world.mapVersion,seed:g.seed};
}
