import {UNITS,canAttack,type UnitKind} from './catalog.js';
import {preferredRole} from './ai-director.js';
import type {Simulation,Unit,Base} from './simulation.js';
import type {TacticalState} from './tactical-ai.js';

interface ProductionContext {
 own:Base[]; army:Unit[]; seen:Unit[]; income:number; underAttack:boolean;
 knownTurrets:number; knownEnemyHQ:boolean; reserve:number; maxArmy:number;
 scores:Record<UnitKind,number>;
}
/** Purchase priorities are persistent composition deficits, not affordable-unit scores.
 * Counts include paid queues, so one factory never reserves money for a unit it
 * has already ordered. Every purchase still goes through Simulation.recruit. */
export function produceCombinedArmy(g:Simulation,s:TacticalState,c:ProductionContext):void {
 const e=s.economy!;
 const count=(kind:UnitKind)=>c.army.filter(u=>u.kind===kind).length+
  c.own.reduce((n,b)=>n+b.queueTypes.filter(k=>k===kind).length,0);
 const available=(kind:UnitKind)=>c.own.some(b=>b.buildRemaining<=0&&b.queue.length<2&&UNITS[kind].producers.includes(b.kind));
 const counts=()=>Object.fromEntries((Object.keys(UNITS) as UnitKind[]).map(k=>[k,count(k)])) as Record<UnitKind,number>;
 const ground=()=>count('rover')+count('tank')+count('artillery');
 const enemyAir=c.seen.find(u=>UNITS[u.kind].flying);
 const fighters=c.army.filter(u=>!['engineer','medic','scout'].includes(u.kind)).length;
 const planned=():UnitKind|null=>{
  if(count('engineer')===0&&available('engineer'))return 'engineer';
  if(c.underAttack)return null;
  if(!enemyAir&&available('artillery')&&count('artillery')===0&&(c.knownEnemyHQ||c.knownTurrets>0))return 'artillery';
  if(available('tank')){
   if(ground()===0)return g.credits[1]-c.reserve>=UNITS.tank.cost?'tank':'rover';
   if(count('rover')>=1&&count('tank')===0)return 'tank';
   if(!enemyAir&&count('rover')>=1&&count('tank')>=1&&count('artillery')===0&&c.income>=35&&fighters>=5)return 'artillery';
  }
  // Rebuild a minimal escort before replacing expensive aircraft. An army
  // reduced to recovering armor must not spend every future payment on air.
  if(ground()>=2&&available('infantry')&&count('infantry')<2)return 'infantry';
  if(ground()>=2&&available('heavy')&&count('heavy')===0&&(e.produced.gunship??0)>0)return 'heavy';
  // Finish the recon role even if the first gunship was lost in combat;
  // otherwise repeated gunship replacements can starve reconnaissance forever.
  if(available('scout')&&(count('gunship')>0||(e.produced.gunship??0)>0)&&count('scout')===0)return 'scout';
  // An operational airfield must get an aircraft before endless ground
  // replacements consume its budget. Queued ground armor also protects it.
  if(available('gunship')&&count('gunship')===0&&(ground()>=2||!available('tank')))return 'gunship';
  if(available('rover')&&ground()<3&&fighters>=5)return 'rover';
  // Protect support purchases too: repeatedly falling back to a 100-credit
  // soldier can otherwise starve heavy infantry and healing for an entire war.
  if(ground()>=2&&fighters>=3&&available('heavy')&&count('heavy')<Math.min(2,Math.ceil(count('infantry')/3)))return 'heavy';
  if(available('medic')&&count('infantry')+count('heavy')>=4&&count('heavy')>0&&count('medic')===0)return 'medic';
  return null;
 };
 const ceiling=(kind:UnitKind):number=>({
  infantry:8,heavy:c.income>=65?4:3,medic:Math.min(2,Math.ceil((count('infantry')+count('heavy'))/5)),
  engineer:c.own.length>=4&&(s.recovering?.length??0)>0?2:1,rover:1,tank:c.income>=65?4:2,
  artillery:c.knownTurrets>1?3:c.knownEnemyHQ||c.knownTurrets?2:1,
  scout:1,gunship:c.income>=55?2:1,bomber:c.income>=65?1:0,
 })[kind];
 const ranks=(producer:Base):UnitKind[]=>{
  const n=counts();
  let result=preferredRole(producer.kind,n,c.knownTurrets+(c.knownEnemyHQ?1:0),c.seen.filter(u=>UNITS[u.kind].flying).length) as UnitKind[];
  // A second worker is useful once repairs and construction can overlap.
  if(producer.kind==='headquarters')result=['engineer'];
  if(producer.kind==='barracks'&&n.infantry+n.heavy>=5&&n.heavy>=1&&n.medic<ceiling('medic'))result=['medic',...result.filter(k=>k!=='medic')];
  return result.filter(k=>n[k]<ceiling(k));
 };
 const producers=c.own.filter(b=>b.buildRemaining<=0&&b.queue.length<2);
 const initial=planned();
 const priority=(b:Base)=>(initial&&UNITS[initial].producers.includes(b.kind)?-1:({factory:0,airfield:1,barracks:2,headquarters:3} as Record<string,number>)[b.kind]??4);
 producers.sort((a,b)=>priority(a)-priority(b)||a.id-b.id);
 for(const producer of producers){
  const workerLost=count('engineer')===0&&producer.kind==='headquarters';
  if(g.count(1)+g.queued(1)>=c.maxArmy&&!workerLost)continue;
  const need=planned(),isPlanned=need!==null&&UNITS[need].producers.includes(producer.kind);
  const protection=need&&!isPlanned?UNITS[need].cost:0;
  const budget=g.credits[1]-(workerLost?0:c.reserve)-protection;
  let choices=isPlanned?[need!,...ranks(producer).filter(k=>k!==need)]:ranks(producer);
  // Saving for tank/artillery/aircraft must not quietly turn into a cheap
  // substitute on the next AI pulse. The first affordable rover is deliberate.
  if(isPlanned)choices=[need!];
  const kind=choices.find(k=>UNITS[k].producers.includes(producer.kind)&&
   (c.scores[k]>0||workerLost||isPlanned)&&UNITS[k].cost<=budget&&
   (!enemyAir||canAttack({kind:k},enemyAir)||['engineer','medic','scout'].includes(k)));
  if(!kind)continue;
  if(g.recruit(producer.id,kind)){
   e.produced[kind]=(e.produced[kind]??0)+1;s.productionSerial++;
  }
 }
 const need=planned();
 if(need){if(s.savingFor!==need)s.savingSince=g.time;s.savingFor=need;}
 else{s.savingFor=null;s.savingSince=null;}
}
