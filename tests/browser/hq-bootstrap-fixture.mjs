/** Establish infrastructure through actual HQ construction for later-phase tests. */
export async function finishOpeningHQ(page){
 await page.evaluate(()=>{
  const a=window.__reborn,g=a.game,paused=g.paused;g.aiClock=-1e8;
  for(const owner of [0,1]){
   if(!g.needsHeadquarters(owner))continue;
   const w=g.units.find(u=>u.owner===owner&&u.kind==='engineer');let site=g.bases.find(b=>b.owner===owner&&b.kind==='headquarters'&&b.hp>0);
   if(!site)for(const p of g.headquartersCandidates(owner))if(!g.buildError(owner,'headquarters',p)){site=g.build(owner,'headquarters',p,[w.id]);if(site)break;}
   if(!site)throw Error('No HQ fixture site');g.paused=false;
   for(let i=0;i<1400&&site.buildRemaining>0;i++)g.step();
   if(site.buildRemaining>0)throw Error('HQ fixture did not complete');
  }
  g.paused=paused;g.notices=[];a.refresh();
 });
}
