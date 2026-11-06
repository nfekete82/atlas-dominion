/** Independent BLUE benchmark actors. Normal paid APIs; own roster, live vision,
 * remembered visible buildings and public territory geometry are the entire input.
 * These are scripted adaptive opponents, not a second Campaign Commander. */
export const TITAN_PROFILES=['tower1','tower3','tower6','infantry','armor','expansion','fortress','combined','attrition'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const inc=(o,k,n=1)=>{o[k]=(o[k]??0)+n;};
export function adaptiveOpponent(profile,metrics,{UNITS,BUILDINGS}){
 if(!TITAN_PROFILES.includes(profile)||profile.startsWith('tower'))throw Error('Unknown independent opponent: '+profile);
 Object.assign(metrics,{profile,paidRecruitOrders:{},paidRecruitCredits:0,paidBuildings:{},paidBuildCredits:0,commands:0,retreats:0,missions:0,visibleContacts:0,peakIncome:0,peakArmy:0,peakTowers:0,blockedBuilds:0});
 let target=null,targetSince=-99,lastCommand=new Map();
 const recordRecruit=(g,b,kind)=>{const before=g.credits[0];if(g.recruit(b.id,kind)){inc(metrics.paidRecruitOrders,kind);metrics.paidRecruitCredits+=before-g.credits[0];return true;}return false;};
 return g=>{
  if(g.status!=='playing')return;
  const own=g.bases.filter(b=>b.owner===0&&b.hp>0),home=own.find(b=>b.kind==='headquarters');if(!home)return;
  const roster=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier),fighters=roster.filter(u=>!['engineer','medic','scout'].includes(u.kind));
  const seen=g.units.filter(u=>u.owner===1&&g.canSee(0,u)&&u.hp>0&&!u.carrier);
  const remembered=g.memories[0].filter(b=>b.owner===1&&b.hp>0);
  const ownSectors=g.territories.filter(t=>t.owner===0),hold=g.territories.find(t=>t.id===home.territory)?.point??home;
  const count=k=>roster.filter(u=>u.kind===k).length+own.reduce((n,b)=>n+b.queueTypes.filter(q=>q===k).length,0),has=k=>own.some(b=>b.kind===k);
  metrics.visibleContacts=Math.max(metrics.visibleContacts,seen.length);metrics.peakIncome=Math.max(metrics.peakIncome,g.income(0));metrics.peakArmy=Math.max(metrics.peakArmy,fighters.length);metrics.peakTowers=Math.max(metrics.peakTowers,own.filter(b=>b.kind==='turret'&&b.buildRemaining<=0).length);
  const worker=roster.find(u=>u.kind==='engineer');
  if(!worker&&!home.queueTypes.includes('engineer'))recordRecruit(g,home,'engineer');
  const threat=seen.filter(u=>own.some(b=>distance(u,b)<600));
  const generators=own.filter(b=>b.kind==='generator').length,towers=own.filter(b=>b.kind==='turret').length;
  let goal=null;
  if(profile==='combined'){if(!has('airfield'))goal='airfield';else if(generators<1)goal='generator';else if(count('bomber')<1)goal=null;else if(!has('barracks'))goal='barracks';else if(!has('factory'))goal='factory';else if(generators<5)goal='generator';}
  else if(!has('barracks'))goal='barracks';
  else if(profile==='infantry'){if(generators<2&&fighters.length>=4)goal='generator';}
  else if(profile==='armor'){if(!has('factory'))goal='factory';else if(generators<3&&count('tank')>=1)goal='generator';}
  else if(profile==='expansion'){if(generators<4)goal='generator';else if(!has('factory'))goal='factory';else if(towers<2)goal='turret';}
  else if(profile==='fortress'){if(towers<4)goal='turret';else if(generators<3)goal='generator';else if(!has('factory'))goal='factory';}
  else if(profile==='attrition'){if(towers<2)goal='turret';else if(generators<3)goal='generator';else if(!has('factory'))goal='factory';}
  if(worker&&goal&&!own.some(b=>b.buildRemaining>0)&&!worker.orders.some(o=>o.kind==='build')&&g.credits[0]>=BUILDINGS[goal].cost){
   const publicFront=g.territories.filter(t=>t.owner!==0).sort((a,b)=>distance(a.point,hold)-distance(b.point,hold))[0]?.point??hold;
   const candidates=[];
   for(const center of [home,...ownSectors.map(t=>t.point)])for(const radius of [160,230,300,380,460])for(let i=0;i<16;i++){
    const p={x:center.x+Math.cos(i*Math.PI/8)*radius,y:center.y+Math.sin(i*Math.PI/8)*radius};if(!g.buildError(0,goal,p))candidates.push(p);
   }
   candidates.sort((a,b)=>goal==='turret'?distance(a,publicFront)-distance(b,publicFront):distance(a,home)-distance(b,home));
   let built=false;for(const p of candidates.slice(0,8)){const before=g.credits[0];if(g.build(0,goal,p,[worker.id])){inc(metrics.paidBuildings,goal);metrics.paidBuildCredits+=before-g.credits[0];built=true;break;}}
   if(!built)metrics.blockedBuilds++;
  }
  // Finite explicit reserves keep technology investment real without starving
  // all early defense. Combined reserves one paid airframe before tank spending.
  const reserve=goal?BUILDINGS[goal].cost:0;
  for(const b of own.filter(b=>b.buildRemaining<=0&&b.queue.length<1)){
   let kind=null;
   if(b.kind==='barracks'){
    const limit=profile==='infantry'?18:profile==='expansion'?8:profile==='combined'?5:6;
    if(count('infantry')<Math.min(3,limit))kind='infantry';
    else if(profile==='infantry'&&count('heavy')<Math.floor(count('infantry')/4))kind='heavy';
    else if(count('infantry')<limit)kind='infantry';
    else if(count('medic')<1&&fighters.length>=5)kind='medic';
   }
   if(b.kind==='factory'){
    if(profile==='attrition'||profile==='fortress')kind=count('artillery')<2?'artillery':count('tank')<4?'tank':null;
    else kind=count('tank')<(profile==='armor'?10:5)?'tank':null;
    if(profile==='combined'&&has('airfield')&&count('bomber')<1)kind=null;
   }
   if(b.kind==='airfield')kind=count('bomber')<2?'bomber':count('scout')<1?'scout':null;
   if(profile==='combined'&&b.kind==='barracks'&&has('airfield')&&count('bomber')<1)kind=null;
   let technologyReserve=0;
   if(b.kind==='barracks'&&count('infantry')>=3){
    if(profile==='combined'&&has('airfield')&&count('bomber')<1)technologyReserve=UNITS.bomber.cost;
    else if(has('factory')&&count(profile==='fortress'||profile==='attrition'?'artillery':'tank')<2)technologyReserve=UNITS[profile==='fortress'||profile==='attrition'?'artillery':'tank'].cost;
   }
   if(kind&&g.count(0)+g.queued(0)<32&&g.credits[0]-Math.max(reserve,technologyReserve)>=UNITS[kind].cost)recordRecruit(g,b,kind);
  }
  const strong=profile==='armor'?count('tank')>=2:profile==='combined'?fighters.length>=5:profile==='infantry'?fighters.length>=3:fighters.length>=5;
  let desired=null;
  if(threat.length)desired={...threat.slice().sort((a,b)=>distance(a,hold)-distance(b,hold))[0],key:'defense'};
  else if(['fortress','attrition'].includes(profile)&&!strong)desired={...hold,key:'hold'};
  else if(strong){
   const known=remembered.slice().sort((a,b)=>distance(a,hold)-distance(b,hold))[0];
   const sector=g.territories.filter(t=>t.owner!==0).sort((a,b)=>distance(a.point,hold)-distance(b.point,hold))[0];
   if(known)desired={...known,key:'building:'+known.id};else if(sector)desired={...sector.point,key:'sector:'+sector.id};
  }else if(profile==='expansion'){
   const sector=g.territories.filter(t=>t.owner===-1).sort((a,b)=>distance(a.point,hold)-distance(b.point,hold))[0];if(sector)desired={...sector.point,key:'expand:'+sector.id};
  }else desired={...hold,key:'hold'};
  if(desired&&(!target||desired.key!==target.key&&(g.time-targetSince>15||desired.key==='defense'))){target=desired;targetSince=g.time;metrics.missions++;}
  for(const u of fighters){
   const near=seen.filter(e=>distance(e,u)<450),enemyPower=near.reduce((n,e)=>n+e.hp*(UNITS[e.kind].damage/Math.max(.2,UNITS[e.kind].cooldown)),0);
   const friendlyPower=fighters.filter(a=>distance(a,u)<450).reduce((n,a)=>n+a.hp*(UNITS[a.kind].damage/Math.max(.2,UNITS[a.kind].cooldown)),0);
   const retreat=(profile==='attrition'||profile==='combined')&&near.length&&u.hp<UNITS[u.kind].hp*.5&&enemyPower>friendlyPower*1.2;
   const destination=retreat?hold:target;if(!destination)continue;
   const key=retreat?'retreat':target.key,previous=lastCommand.get(u.id);
   if((!u.orders.length||previous?.key!==key)&&g.time-(previous?.at??-99)>=6){g.command([u.id],{x:destination.x,y:destination.y,kind:retreat?'move':'attackMove'});lastCommand.set(u.id,{key,at:g.time});metrics.commands++;if(retreat)metrics.retreats++;}
  }
 };
}
