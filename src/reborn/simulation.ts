import {VisionCache} from './vision-cache.js';
import { profiler } from './performance.js';
import { RULES, clamp, distance, type Faction, type Owner, type Point, type MapVersion, mapLayout } from './config.js';
import { World, inside, type Territory } from './world.js';
import { UNITS, BUILDINGS, canAttack, weaponDamage, unitSpec, buildingSpec, unitKinds, type UnitKind, type BuildingKind } from './catalog.js';
import {angleDifference,turnTowards} from './sprite-animator.js';
import {turretPivot,turretMuzzles} from './turret.js';
import {Transports,type TransportState} from './transports.js';
import {TacticalAI,type TacticalState,type TacticalOrder} from './tactical-ai.js';
import { MAP_VERSION, randomMapSeed } from './world-generation.js';

export interface Formation {front:number[];heading:Point;origin:Point;goal:Point;lane:number;rear:number}
export interface Order extends Point { kind:'move'|'attackMove'|'attack'|'heal'|'repair'|'build'|'board'; target?:number; approach?:Point; healOrigin?:Point; formation?:Formation; march?:number[]; rear?:number; tactical?:TacticalOrder }
export type Weapon='rifle'|'heavy'|'pistol'|'turret'|'cannon'|'rocket';
export interface Burst {target:number;remaining:number;at:number;index:number}
export interface WorkEffect {kind:'heal'|'repair'|'build'|'board';target:number;source:number;sources:number[];at:number;amount:number}
export const HEAL_RADIUS=70;
export interface Unit extends Point {
  id:number; owner:Faction; kind:UnitKind; hp:number; orders:Order[]; path:Point[];
  cooldown:number; facing:number; moving:boolean; hit:number; repath:number;
  angle:number; walkDistance:number; fire:number; previousX:number; previousY:number;
  lastAttacker:number|null; defendUntil:number;
  /** Optional motor state keeps version-2 saves compatible. */
  driveSpeed?:number; hullAngle?:number; combatTarget?:number|null;
  /** A real collision enabled complete clearance checks for future routes. */
  exactPath?:boolean;
  /** Where an autonomous pursuit began; persisted so guards do not chase indefinitely. */
  pursuitOrigin?:Point|null;
  hold?:boolean;
  workingTarget?:number|null;
  supportPaused?:boolean;
  burst?:Burst;
  carrier?:number;flightHeight?:number;transport?:TransportState;
}
export interface Base extends Point {
  id:number; owner:Faction; kind:BuildingKind; hp:number; territory:number; queue:number[]; queueTypes:UnitKind[]; production:number;
  buildRemaining:number; cooldown:number;
  rally:Point|null; radius:number;
  constructionActive?:boolean;
  burst?:Burst;
  queueCosts?:number[];
  turretAngle?:number; previousTurretAngle?:number; turretTarget?:number|null;
}
export interface Shot { from:Point; to:Point; owner:Faction; life:number; hit:boolean; projected?:boolean; source?:number; weapon?:Weapon; barrel?:number; at?:number; groundFrom?:Point; groundTo?:Point; armored?:boolean; kind?:UnitKind; angle?:number;flightHeight?:number }
export interface Missile {id:number;source:number;owner:Faction;from:Point;to:Point;angle:number;at:number;impactAt:number;damage:number}
export interface Blast extends Point {at:number;id:number}
export type CaptureReadiness='owned'|'no-unit'|'out-of-range'|'contested'|'enemy-hq'|'disconnected'|'capturing';
export interface Memory extends Point { id:number; owner:Faction; hp:number; territory:number; kind?:BuildingKind }
export interface Save {
  version:2; productionVersion?:1; supportVersion?:1;rosterVersion?:2;missiles?:Missile[]; seed:number; mapVersion?:MapVersion; time:number; nextId:number; credits:number[]; incomeClock:number;
  units:Unit[]; bases:Base[]; territories:Territory[]; explored:number[][];
  memories:Memory[][]; aiClock:number; ai?:TacticalState; status:'playing'|'victory'|'defeat';
}

/** Uniform buckets keep combat/vision queries independent of total army size. */
class SpatialIndex {
  private buckets=new Map<number,Unit[]>();
  private size=220;
  rebuild(units:Unit[]):void {this.buckets.clear();for(const u of units){if(u.carrier||u.hp<=0)continue;const k=Math.floor(u.y/this.size)*32+Math.floor(u.x/this.size);const b=this.buckets.get(k);if(b)b.push(u);else this.buckets.set(k,[u]);}}
  query(p:Point,r:number):Unit[]{const result:Unit[]=[];for(let y=Math.floor((p.y-r)/this.size);y<=Math.floor((p.y+r)/this.size);y++)for(let x=Math.floor((p.x-r)/this.size);x<=Math.floor((p.x+r)/this.size);x++){
    for(const u of this.buckets.get(y*32+x)??[])if(distance(p,u)<=r)result.push(u);
  }return result;}
}

export class Simulation {
  readonly world:World;
  readonly tactical=new TacticalAI(this);
  readonly transports=new Transports(this,(u,p,dt)=>this.move(u,p,dt));
  missiles:Missile[]=[];blasts:Blast[]=[];
  seed:number; time=0; nextId=1; credits=[RULES.initialCredits as number,RULES.initialCredits as number];
  incomeClock=0; aiClock=0; status:'playing'|'victory'|'defeat'='playing';
  units:Unit[]=[]; bases:Base[]=[]; territories:Territory[];
  visible=[new Uint8Array(RULES.grid**2),new Uint8Array(RULES.grid**2)];
  explored=[new Uint8Array(RULES.grid**2),new Uint8Array(RULES.grid**2)];
  memories:Memory[][]=[[],[]]; shots:Shot[]=[]; notices:string[]=[];
  workEffects:WorkEffect[]=[];
  paused=false; revision=0; private fogClock=0; private visionCache=new VisionCache(); private spatial=new SpatialIndex();
  /** The original constructor remains a deterministic legacy fixture/save reader. */
  constructor(seed=2026,mapVersion:MapVersion=0) {
    this.seed=seed;this.world=new World(seed,mapVersion);this.territories=this.world.territories(seed);
    if(mapVersion>=3)this.credits=[950,950];
    const layout=mapLayout(mapVersion);
    for(const owner of [0,1] as const){
      const territory=layout.headquarters[owner];
      const t=this.territories[territory],site=mapVersion>=2?{x:t.point.x+(owner===0?-260:260),y:t.point.y+(owner===0?165:-165)}:mapVersion===1?{x:t.point.x-165,y:t.point.y+45}:t.point,p=this.world.clearSite(site,RULES.headquarters.radius)!;
      this.bases.push({id:1000+owner,owner,kind:'headquarters',...p,hp:RULES.headquarters.hp,territory,queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null,radius:RULES.headquarters.radius});
      if(mapVersion===0)t.point=this.world.nearest({x:p.x+165,y:p.y-45},this.obstacles())!;
      const sign=mapVersion>=2&&owner===1?-1:1;
      this.spawn(owner,this.world.nearest({x:p.x+140*sign,y:p.y+100*sign},this.obstacles())!);
    }
    // Keep the two original soldiers/IDs, then give each faction one builder.
    for(const owner of [0,1] as const){
      const soldier=this.units.find(u=>u.owner===owner)!,sign=mapVersion>=2&&owner===1?-1:1;
      const p=this.world.nearest({x:soldier.x+45*sign,y:soldier.y},this.obstacles(),this.units,soldier)!;
      this.spawn(owner,p,'engineer');
    }
    this.spatial.rebuild(this.units);this.updateVision();
  }
  static campaign(seed=randomMapSeed(),version:MapVersion=MAP_VERSION):Simulation {return new Simulation(seed,version);}
  obstacles():Base[]{return this.bases.filter(b=>b.hp>0);}
  spawn(owner:Faction,p:Point,kind:UnitKind='infantry'):Unit {
    while(this.bases.some(b=>b.id===this.nextId))this.nextId++;
    const u:Unit={id:this.nextId++,owner,kind,x:p.x,y:p.y,hp:UNITS[kind].hp,orders:[],path:[],cooldown:0,facing:1,moving:false,hit:0,repath:0,
      angle:Math.PI/4,walkDistance:0,fire:0,previousX:p.x,previousY:p.y,lastAttacker:null,defendUntil:0};
    this.units.push(u);return u;
  }
  income(owner:Faction):number {
    return this.bases.filter(b=>b.owner===owner&&b.hp>0&&b.buildRemaining<=0).reduce((n,b)=>n+buildingSpec(b).income,0)+
      this.territories.filter(t=>t.owner===owner).reduce((n,t)=>n+t.income,0);
  }
  count(owner:Faction):number{return this.units.filter(u=>u.owner===owner&&u.hp>0).length;}
  queued(owner:Faction):number{return this.bases.filter(b=>b.owner===owner).reduce((n,b)=>n+b.queue.length,0);}
  producer(owner:Faction,kind:UnitKind):Base|undefined {
    return this.bases.filter(b=>b.owner===owner&&b.hp>0&&b.buildRemaining<=0&&UNITS[kind].producers.includes(b.kind)&&b.queue.length<8).sort((a,b)=>a.queue.length-b.queue.length||a.id-b.id)[0];
  }
  recruit(baseId:number,kind?:UnitKind):boolean {
    const b=this.bases.find(b=>b.id===baseId);if(!b)return false;
    kind??=unitKinds.find(k=>UNITS[k].producers.includes(b.kind));const spec=kind?UNITS[kind]:undefined;
    if(!kind||!spec||b.hp<=0||b.buildRemaining>0||!spec.producers.includes(b.kind)||this.status!=='playing'||b.queue.length>=8||this.credits[b.owner]<spec.cost||this.count(b.owner)+this.queued(b.owner)>=RULES.capacity)return false;
    b.queueCosts??=b.queueTypes.map(k=>UNITS[k].cost);b.queueCosts.push(spec.cost);this.credits[b.owner]-=spec.cost;b.queue.push(spec.buildTime);b.queueTypes.push(kind);return true;
  }
  cancel(baseId:number,index?:number):void {
    const b=this.bases.find(b=>b.id===baseId);if(!b?.queue.length)return;
    const at=index===undefined?b.queue.length-1:index;if(at<0||at>=b.queue.length)return;
    b.queue.splice(at,1);const kind=b.queueTypes.splice(at,1)[0]??'infantry';this.credits[b.owner]+=b.queueCosts?.splice(at,1)[0]??UNITS[kind].cost;if(at===0||!b.queue.length)b.production=0;
  }
  buildError(owner:Faction,kind:BuildingKind,p:Point):string|null {
    const spec=BUILDINGS[kind];
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return 'Ungültiger Kartenbereich.';
    if(!spec||kind==='headquarters'||this.status!=='playing')return 'Dieses Gebäude kann hier nicht errichtet werden.';
    if(this.bases.filter(b=>b.hp>0).length>=40)return 'Gebäudelimit erreicht.';
    if(['barracks','factory','airfield'].includes(kind)&&this.bases.some(b=>b.owner===owner&&b.kind===kind&&b.hp>0))return 'Dieses Produktionsgebäude existiert bereits.';
    if(!this.bases.some(b=>b.owner===owner&&b.kind==='headquarters'&&b.hp>0))return 'Ein Hauptquartier ist erforderlich.';
    if(this.credits[owner]<spec.cost)return 'Zu wenig Credits.';
    if(!this.hasExplored(owner,p))return 'Dieser Bauplatz ist noch nicht erforscht.';
    if(!this.world.walkable(p))return 'Felsen blockieren die Baustelle.';
    // Every terrain tile intersecting the circular footprint must have been explored.
    const cell=this.world.cell;
    for(let y=Math.floor((p.y-spec.radius)/cell);y<=Math.floor((p.y+spec.radius)/cell);y++)for(let x=Math.floor((p.x-spec.radius)/cell);x<=Math.floor((p.x+spec.radius)/cell);x++){
      const nearest={x:clamp(p.x,x*cell,(x+1)*cell),y:clamp(p.y,y*cell,(y+1)*cell)};
      if(distance(nearest,p)>spec.radius)continue;
      const q={x:(x+.5)*cell,y:(y+.5)*cell};
      if(!this.hasExplored(owner,q))return 'Die gesamte Grundfläche muss erforscht sein.';
      if(!this.world.walkable(q))return 'Felsen oder Kartenrand blockieren die Grundfläche.';
    }
    for(let i=0;i<32;i++)if(!this.world.walkable({x:p.x+Math.cos(i*Math.PI/16)*spec.radius,y:p.y+Math.sin(i*Math.PI/16)*spec.radius}))return 'Die gesamte Grundfläche muss frei sein.';
    if(this.obstacles().some(b=>distance(b,p)<b.radius+spec.radius+24))return 'Zu nah an einem anderen Gebäude.';
    if(this.territories.some(t=>distance(t.point,p)<spec.radius+45))return 'Bastion und Kontrollpunkt müssen frei bleiben.';
    if(this.units.some(u=>u.hp>0&&!u.carrier&&!unitSpec(u).flying&&distance(u,p)<spec.radius+unitSpec(u).radius))return 'Einheiten blockieren die Baustelle.';
    return null;
  }
  build(owner:Faction,kind:BuildingKind,p:Point,workerIds?:number[]):Base|null {
    if(this.buildError(owner,kind,p))return null;
    const workers=this.units.filter(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0&&!u.carrier&&(!workerIds||workerIds.includes(u.id)));
    if(!workers.length)return null;
    const spec=BUILDINGS[kind],territory=this.territories.find(t=>inside(p,t.polygon))!;
    let id=1000;while(this.bases.some(b=>b.id===id)||this.units.some(u=>u.id===id))id++;
    const b:Base={id,owner,kind,...p,hp:spec.hp*.25,territory:territory.id,radius:spec.radius,queue:[],queueTypes:[],production:0,buildRemaining:spec.buildTime,cooldown:0,rally:null};
    this.bases.push(b);
    if(!this.command(workers.map(u=>u.id),{...p,kind:'build',target:id})){this.bases.pop();this.notices.push('Kein ausgewählter Bauarbeiter kann diese Baustelle erreichen.');return null;}
    this.credits[owner]-=spec.cost;this.updateVision();return b;
  }
  cancelConstruction(id:number):boolean {
    const b=this.bases.find(b=>b.id===id);if(!b||b.buildRemaining<=0||b.hp<=0)return false;
    this.credits[b.owner]+=Math.floor(buildingSpec(b).cost*.75);this.bases=this.bases.filter(b=>b.id!==id);
    for(const u of this.units){const active=u.orders[0]?.target===id;u.orders=u.orders.filter(o=>o.target!==id);if(active||u.workingTarget===id){u.workingTarget=null;u.path=[];u.repath=0;}}
    this.updateVision();return true;
  }
  command(ids:number[],order:Order,append=false):number {
    if(order.kind==='board')return this.transports.board(order.target??-1,ids);
    if(!Number.isFinite(order.x)||!Number.isFinite(order.y))return 0;
    const members=this.units.filter(u=>ids.includes(u.id)&&u.hp>0&&!u.carrier);
    const front=members.filter(u=>u.kind!=='medic'&&u.kind!=='engineer'&&!unitSpec(u).flying),medics=members.filter(u=>u.kind==='medic');
    const mixed=front.length>0&&medics.length>0&&['move','attackMove','attack'].includes(order.kind);
    const origin={x:front.reduce((n,u)=>n+u.x,0)/Math.max(1,front.length),y:front.reduce((n,u)=>n+u.y,0)/Math.max(1,front.length)},length=distance(origin,order)||1;
    const heading={x:(order.x-origin.x)/length,y:(order.y-origin.y)/length};
    if(mixed)members.sort((a,b)=>(a.kind==='medic'?2:a.kind==='heavy'?0:1)-(b.kind==='medic'?2:b.kind==='heavy'?0:1)||a.id-b.id);
    const width=Math.ceil(Math.sqrt(members.length)),slots=members.map((_,i)=>({x:i%width*27,y:Math.floor(i/width)*27}));
    // Centre the actual occupied slots, including a short last row. Using the
    // column count for both axes shifted a two-unit group north of its target.
    const center={x:slots.reduce((n,p)=>n+p.x,0)/Math.max(1,members.length),y:slots.reduce((n,p)=>n+p.y,0)/Math.max(1,members.length)};
    let accepted=0;
    members.forEach((u,i)=>{
      if(['heal','repair','build'].includes(order.kind)){
        const entity=order.kind==='heal'?this.units.find(t=>t.id===order.target):order.kind==='repair'?this.bases.find(t=>t.id===order.target)??this.units.find(t=>t.id===order.target):this.bases.find(t=>t.id===order.target);
        if(!entity||!this.supportEligible(u,entity,order.kind))return;
        const approach=this.supportApproach(u,entity);if(!approach)return;
        if('queue' in entity){const path=this.world.path(u,approach,this.obstacles());if(distance(u,entity)>entity.radius+55&&(!path.length||distance(path[path.length-1],entity)>entity.radius+55))return;}
        const next:Order={...order,x:entity.x,y:entity.y,...('queue' in entity?{approach}:{healOrigin:{x:entity.x,y:entity.y}})};
        if(append){if(u.orders.length>=32)return;u.orders.push(next);}else{u.orders=[next];u.path=[];u.repath=0;delete u.burst;}
        u.hold=false;u.supportPaused=false;u.combatTarget=null;u.pursuitOrigin=null;accepted++;return;
      }
      let offset={x:slots[i].x-center.x,y:slots[i].y-center.y};
      let formation:Formation|undefined;
      if(mixed){
        if(u.kind==='medic'){
          const index=medics.indexOf(u),columns=Math.min(3,medics.length),lane=(index%columns-(columns-1)/2)*34,rear=72+Math.floor(index/columns)*32;
          formation={front:front.map(v=>v.id),heading,origin,goal:{x:order.x,y:order.y},lane,rear};
          offset={x:-heading.x*rear-heading.y*lane,y:-heading.y*rear+heading.x*lane};
        }else{const index=members.filter(v=>v.kind!=='medic').indexOf(u),columns=Math.ceil(Math.sqrt(members.length-medics.length)),lane=(index%columns-(columns-1)/2)*29,depth=-Math.floor(index/columns)*29;offset={x:heading.x*depth-heading.y*lane,y:heading.y*depth+heading.x*lane};}
      }
      // Bastion right-clicks are capture orders: even a 48-unit formation must
      // stop INSIDE the capture circle, not in decorative slots beyond it.
      const captureSite=this.territories.some(t=>distance(t.point,order)<1);
      if(captureSite){const length=Math.hypot(offset.x,offset.y),limit=RULES.captureRadius-30;
        if(length>limit){offset={x:offset.x*limit/length,y:offset.y*limit/length};}}
      const spec=unitSpec(u),p={x:order.x+offset.x,y:order.y+offset.y};
      const target=spec.flying?{x:clamp(p.x,8,this.world.size-8),y:clamp(p.y,8,this.world.size-8)}:this.world.nearest(p,this.obstacles(),[],u,Math.max(0,spec.radius-10));if(!target)return;
      const next:Order={...order,...target,...(mixed&&u.kind!=='medic'?{march:front.map(v=>v.id)}:{}),...(formation?{formation,kind:order.kind==='attack'?'attackMove':order.kind,target:undefined}:{})};u.hold=false;u.supportPaused=false;u.workingTarget=null;
      if(append){if(u.orders.length<32)u.orders.push(next);else return;}
      else {this.transports.cancel(u);delete u.burst;u.orders=formation&&u.orders[0]?.kind==='heal'?[u.orders[0],next]:[next];u.path=[];u.repath=0;u.combatTarget=null;u.pursuitOrigin=null;}
      if(u.transport&&u.transport.phase!=='cruise'){u.transport.resume=structuredClone(u.orders);u.orders=[];}
      accepted++;
    });return accepted;
  }
  /** Explain capture gating without altering the fixed-tick capture rules. The
   * same centre, radius, adjacency and enemy-HQ conditions govern ownership. */
  captureReadiness(t:Territory,owner:Faction=0):CaptureReadiness {
    if(t.owner===owner)return 'owned';
    const friendly=this.units.filter(u=>u.owner===owner&&u.hp>0&&!u.carrier);
    if(!friendly.length)return 'no-unit';
    const inside=friendly.some(u=>distance(u,t.point)<=RULES.captureRadius);
    if(!inside)return friendly.some(u=>distance(u,t.point)<=RULES.captureRadius+120)?'out-of-range':'no-unit';
    if(this.units.some(u=>u.owner!==owner&&u.hp>0&&!u.carrier&&distance(u,t.point)<=RULES.captureRadius))return 'contested';
    if(this.bases.some(b=>b.kind==='headquarters'&&b.territory===t.id&&b.owner!==owner&&b.hp>0))return 'enemy-hq';
    if(!t.neighbors.some(i=>this.territories[i].owner===owner))return 'disconnected';
    return 'capturing';
  }
  stop(ids:number[],hold=false):void {for(const u of this.units)if(ids.includes(u.id)){this.transports.cancel(u);u.orders=[];u.path=[];u.repath=0;u.moving=false;u.pursuitOrigin=null;u.combatTarget=null;u.hold=hold;u.supportPaused=false;u.workingTarget=null;delete u.burst;}}
  private supportEligible(u:Unit,target:Unit|Base,kind:string):boolean {
    if(target.hp<=0||('orders' in target&&target.carrier)||target.owner!==u.owner)return false;
    if(kind==='heal')return u.kind==='medic'&&'orders' in target&&unitSpec(target).group==='Infanterie'&&target.hp<unitSpec(target).hp;
    if(kind==='repair'&&u.kind==='engineer'&&'orders' in target)
      return target.id!==u.id&&!unitSpec(target).flying&&unitSpec(target).group==='Fahrzeuge'&&target.hp<unitSpec(target).hp;
    return u.kind==='engineer'&&'queue' in target&&(kind==='build'?target.buildRemaining>0:target.buildRemaining<=0&&target.hp<buildingSpec(target).hp);
  }
  private supportApproach(u:Unit,target:Unit|Base):Point|null {
    const radius='queue' in target?target.radius+32:35,angle=Math.atan2(u.y-target.y,u.x-target.x),range='queue' in target?target.radius+55:HEAL_RADIUS;
    for(let i=0;i<16;i++){
      const turn=angle+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/8;
      const p=this.world.nearest({x:target.x+Math.cos(turn)*radius,y:target.y+Math.sin(turn)*radius},this.obstacles(),[],u);
      if(p&&distance(p,target)<=range&&this.world.line(p,target))return p;
    }
    return null;
  }
  /** Rear support follows the slowest surviving front rank, rather than racing to the destination. */
  private escort(u:Unit,dt:number):boolean {
    const order=u.orders[0],formation=order?.formation;if(u.kind!=='medic'||!formation)return false;
    const recovering=u.owner===1&&this.world.mapVersion>=3&&this.tactical.mode==='director'
      ?this.tactical.state.recovering:undefined;
    const front=this.units.filter(v=>formation.front.includes(v.id)&&v.owner===u.owner&&v.hp>0&&!recovering?.includes(v.id));
    if(!front.length){u.orders.shift();u.path=[];u.repath=0;u.workingTarget=null;return true;}
    const h=formation.heading,project=(p:Point)=>(p.x-formation.origin.x)*h.x+(p.y-formation.origin.y)*h.y;
    const progress=Math.min(...front.map(project)),lateral=front.reduce((n,v)=>n+(v.x-formation.origin.x)*-h.y+(v.y-formation.origin.y)*h.x,0)/front.length;
    const rear={x:formation.origin.x+h.x*(progress-formation.rear)-h.y*(lateral+formation.lane),y:formation.origin.y+h.y*(progress-formation.rear)+h.x*(lateral+formation.lane)};
    u.workingTarget=null;u.combatTarget=null;u.pursuitOrigin=null;
    const safe=(p:Point)=>project(p)<=progress-32&&this.units.every(enemy=>enemy.hp<=0||enemy.carrier||enemy.owner===u.owner||!this.canSee(u.owner,enemy)||distance(p,enemy)>Math.min(unitSpec(enemy).range+12,distance(u,enemy)+2));
    const patient=this.spatial.query(u,115).filter(v=>v.id!==u.id&&this.supportEligible(u,v,'heal')&&project(v)<=progress+35).sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp||a.id-b.id)[0];
    if(!patient)this.healNearby(u,dt);
    if(!patient&&u.defendUntil>this.time&&this.acquire(u))return false;
    let destination=rear;
    if(patient){
      if(distance(u,patient)<=HEAL_RADIUS&&this.world.line(u,patient)){this.healNearby(u,dt);u.workingTarget=patient.id;u.path=[];u.angle=Math.atan2(patient.y-u.y,patient.x-u.x);return true;}
      const approach={x:patient.x-h.x*45,y:patient.y-h.y*45};if(safe(approach))destination=approach;
    }
    if(distance(u,destination)>12){
      if(u.repath<=0)u.path=[];
      const target=this.world.nearest(destination,this.obstacles(),[],u);
      if(target){const before={x:u.x,y:u.y},walk=u.walkDistance;this.move(u,target,dt,patient?unitSpec(u).speed:Math.min(...front.map(v=>unitSpec(v).speed)));
        if(project(u)>progress-32&&project(u)>project(before)){u.x=before.x;u.y=before.y;u.walkDistance=walk;u.moving=false;u.path=[];}
      }
    }else{u.path=[];if(front.every(v=>!v.orders.length)&&distance(u,rear)<18)u.orders.shift();}
    return true;
  }

  /** Work uses simulated time and target IDs; idle support never pursues distant targets. */
  private support(u:Unit,dt:number):boolean {
    u.workingTarget=null;u.supportPaused=false;
    if(u.kind!=='medic'&&u.kind!=='engineer')return false;
    const order=u.orders[0],explicit=order&&['heal','repair','build'].includes(order.kind);
    if(order&&!explicit)return false;
    let target:Unit|Base|undefined;
    if(explicit){
      target=order.kind==='heal'?this.units.find(t=>t.id===order.target):order.kind==='repair'?this.bases.find(t=>t.id===order.target)??this.units.find(t=>t.id===order.target):this.bases.find(t=>t.id===order.target);
      if(!target||!this.supportEligible(u,target,order.kind)){u.orders.shift();u.path=[];u.repath=0;return true;}
      if(order.kind==='heal'){order.healOrigin??={x:order.x,y:order.y};if(distance(target,order.healOrigin)>160&&distance(u,target)>HEAL_RADIUS){u.path=[];u.supportPaused=true;return false;}}
      order.x=target.x;order.y=target.y;
    }else if(u.kind==='medic'){
      target=this.spatial.query(u,HEAL_RADIUS).filter(t=>this.supportEligible(u,t,'heal')&&(t.id!==u.id||u.defendUntil<=this.time)).sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp||a.id-b.id)[0];
    }else{
      const damagedVehicles=this.spatial.query(u,80).filter(v=>this.supportEligible(u,v,'repair')&&distance(u,v)<=80);
      const damagedBuildings=this.bases.filter(b=>this.supportEligible(u,b,'repair')&&distance(u,b)<=b.radius+55);
      target=[...damagedVehicles,...damagedBuildings].sort((a,b)=>
        a.hp/('orders' in a?unitSpec(a).hp:buildingSpec(a).hp)-b.hp/('orders' in b?unitSpec(b).hp:buildingSpec(b).hp)||a.id-b.id)[0];
    }
    if(!target)return false;
    // A recently attacked worker pauses construction/repair to defend itself.
    if(u.kind==='engineer'&&u.defendUntil>this.time)return false;
    const range='queue' in target?target.radius+55:HEAL_RADIUS;
    if(distance(u,target)>range||!this.world.line(u,target)){
      if(explicit&&!u.hold){if(u.repath<=0)u.path=[];const p=order?.approach&&this.world.walkable(order.approach,this.obstacles())?order.approach:this.supportApproach(u,target);if(p)this.move(u,p,dt);}
      return true;
    }
    u.path=[];u.combatTarget=null;u.pursuitOrigin=null;u.workingTarget=target.id;
    u.angle=Math.atan2(target.y-u.y,target.x-u.x);u.facing=target.x<u.x?-1:1;
    if('orders' in target){
      if(u.kind==='medic'){if(!this.healNearby(u,dt)){u.workingTarget=null;return false;}}
      else {const before=target.hp;target.hp=Math.min(unitSpec(target).hp,target.hp+18*dt);this.work('repair',u.id,target.id,target.hp-before);}
    }
    else if(target.buildRemaining<=0){const before=target.hp;target.hp=Math.min(buildingSpec(target).hp,target.hp+12*dt);this.work('repair',u.id,target.id,target.hp-before);}
    return true;
  }
  /** A shared 12 HP/s budget; self care is capped at 3 HP/s and waits after damage. */
  private healNearby(u:Unit,dt:number):boolean {
    const patients=this.spatial.query(u,HEAL_RADIUS).filter(t=>this.supportEligible(u,t,'heal')&&this.world.line(u,t)&&(t.id!==u.id||u.defendUntil<=this.time));
    const others=patients.filter(t=>t.id!==u.id),urgent=others.some(t=>t.hp/unitSpec(t).hp<.5);
    const targets=patients.filter(t=>t.id!==u.id||!urgent);
    if(!targets.length)return false;
    // Weighted sharing treats the wounded together, with the most urgent receiving more.
    const weight=(t:Unit)=>t.id===u.id?.25:t.hp/unitSpec(t).hp<.5?2:1;
    const sum=targets.reduce((n,t)=>n+weight(t),0);let healed=false;
    for(const target of targets){const before=target.hp,rate=target.id===u.id?Math.min(3,12*weight(target)/sum):12*weight(target)/sum;
      target.hp=Math.min(unitSpec(target).hp,target.hp+rate*dt);
      if(target.hp>before){this.work('heal',u.id,target.id,target.hp-before);healed=true;u.workingTarget??=target.id;}
    }
    return healed;
  }
  private work(kind:WorkEffect['kind'],source:number,target:number,amount:number):void {
    if(amount<=0)return;
    const effect=this.workEffects.find(e=>e.kind===kind&&e.target===target);
    if(effect){if(effect.at!==this.time)effect.sources.length=0;if(!effect.sources.includes(source))effect.sources.push(source);effect.at=this.time;effect.amount=amount;effect.source=source;}
    else this.workEffects.push({kind,source,sources:[source],target,amount,at:this.time});
  }
  private damage(source:Unit|Base,target:Unit|Base,damage:number,weapon:Weapon,from:Point,barrel?:number):void {
    this.strike(source.id,target,damage);
    if(weapon==='turret'&&'orders' in target&&target.hp>0)this.tactical.underTowerFire(target);
    const flying='orders' in target&&unitSpec(target).flying;
    this.shots.push({from,to:{x:target.x,y:target.y-(flying?(target.kind==='scout'?34+77*((target as Unit).flightHeight??1):111):23)},owner:source.owner,life:.65,hit:true,projected:'queue' in source,source:source.id,weapon,barrel,at:this.time,
      ...('orders' in source?{kind:source.kind,angle:source.angle,flightHeight:source.flightHeight}:{}),groundFrom:{x:source.x,y:source.y},groundTo:{x:target.x,y:target.y},armored:'queue' in target||unitSpec(target as Unit).group!=='Infanterie'});
  }
  private strike(source:number,target:Unit|Base,amount:number):void{
    const alive=target.hp>0;target.hp-=amount;
    if(alive&&target.hp<=0&&'orders' in target)this.tactical.loss(target);
    // Fast damage-driven retreat: the tactical planner runs only every 3 s,
    // longer than the time a low-HP rover can survive under enemy fire.
    if(alive&&target.hp>0&&'orders' in target)this.tactical.evacuateVehicle(target);
    if('hit' in target){
      target.hit=.18;target.lastAttacker=source;target.defendUntil=this.time+5;
      // Player infantry under fire stop for a defensive stand. Plain moves,
      // attack-moves and moving explicit attacks lose their entire queued route.
      // Hold still permits return fire in weapon range, but suppresses pursuit.
      // Only a new player command clears hold and resumes movement.
      const marching=target.orders[0]&&(
        target.orders[0].kind==='move'||target.orders[0].kind==='attackMove'||
        (target.orders[0].kind==='attack'&&target.moving));
      if(target.hp>0&&target.owner===0&&!target.carrier&&
        (target.kind==='infantry'||target.kind==='heavy')&&marching){
        target.orders=[];target.path=[];target.repath=0;target.moving=false;
        target.pursuitOrigin=null;target.combatTarget=null;target.hold=true;
        delete target.burst;
      }
    }
    if(target.hp<=0&&'queue' in target){target.hp=0;target.queue=[];target.queueTypes=[];target.queueCosts=[];target.production=0;this.notices.push(`${buildingSpec(target).name} ${target.owner===0?'verloren':'ausgeschaltet'}!`);}
  }
  private launch(u:Unit,target:Unit|Base):void{
    const from={x:u.x,y:u.y},to={x:target.x,y:target.y},duration=Math.max(.3,distance(from,to)/400);
    this.missiles.push({id:this.nextId++,source:u.id,owner:u.owner,from,to,angle:u.angle,at:this.time,impactAt:this.time+duration,damage:unitSpec(u).damage});
    this.shots.push({from:{x:u.x,y:u.y-18},to:{x:target.x,y:target.y-23},owner:u.owner,life:.65,hit:false,weapon:'rocket',source:u.id,kind:'artillery',angle:u.angle,at:this.time,groundFrom:from,groundTo:to});
  }
  canSee(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.visible[owner][i]===1;}
  hasExplored(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.explored[owner][i]===1;}
  updateVision():void {
    if(!profiler)return this.updateVisionMeasured();const at=performance.now();try{this.updateVisionMeasured();}finally{profiler.record('vision',performance.now()-at);}
  }
  private updateVisionMeasured():void {
    for(const owner of [0,1] as const){
      const visible=this.visible[owner];visible.fill(0);
      const sources=[...this.units.filter(u=>u.owner===owner&&u.hp>0&&!u.carrier).map(u=>({key:`u${u.id}`,x:u.x,y:u.y,sight:unitSpec(u).sight,close:unitSpec(u).radius+this.world.cell*2,air:unitSpec(u).flying})),
        ...this.bases.filter(b=>b.owner===owner&&b.hp>0).map(b=>({key:`b${b.id}`,x:b.x,y:b.y,sight:b.buildRemaining>0?110:buildingSpec(b).sight,close:b.radius+this.world.cell*2,air:false})),
        ...this.territories.filter(t=>t.owner===owner).map(t=>({key:`t${t.id}`,...t.point,sight:RULES.bastion.sight,close:RULES.bastion.radius+this.world.cell*2,air:false}))];
      this.visionCache.update(this.world,owner,sources,visible);
      const discovered=new Set<number>();
      for(let i=0;i<visible.length;i++)if(visible[i]){this.explored[owner][i]=1;const cliff=this.world.cliffIds[i];if(cliff>=0)discovered.add(cliff);}
      // Seeing a cliff identifies its complete terrain surface. Its inaccessible
      // interior stays remembered terrain, rather than an impossible black hole.
      // This never grants current visibility to enemies behind the cliff.
      for(const id of discovered)for(const cell of this.world.cliffCells[id])this.explored[owner][cell]=1;
      for(const b of this.bases)if(this.canSee(owner,b)){
        const memory={id:b.id,owner:b.owner,x:b.x,y:b.y,hp:b.hp,territory:b.territory,kind:b.kind};
        const i=this.memories[owner].findIndex(m=>m.id===b.id);if(i<0)this.memories[owner].push(memory);else this.memories[owner][i]=memory;
      }
      this.memories[owner]=this.memories[owner].filter(m=>!this.canSee(owner,m)||this.bases.some(b=>b.id===m.id));
    }
    this.tactical.observe();this.revision++;
  }
  private acquire(u:Unit):Unit|Base|undefined {
    const order=u.orders[0],spec=unitSpec(u),entities=[...this.units,...this.bases];
    // A plain move is a strict order. Idle combat units and attack-move squads
    // can respond within sight, starting their approach before weapon range.
    // Engineers on guard duty stay near their work instead of abandoning repairs.
    const support=u.kind==='engineer'||u.kind==='medic'||u.kind==='scout'||(u.kind==='rover'&&!!u.transport?.cargo.length);
    const proactive=!u.hold&&order?.kind!=='move'&&!support;
    const engageRadius=proactive?Math.max(spec.range,Math.min(spec.sight,spec.range+120)):spec.range;
    const visible=(e:Unit|Base)=>this.canSee(u.owner,e)||(distance(u,e)<=spec.sight&&(spec.flying||this.world.sightLine(u,e)));
    const eligible=(e:Unit|Base)=>{
      if(e.hp<=0||('orders' in e&&e.carrier)||e.owner===u.owner||!canAttack(u,e))return false;
      const d=distance(u,e);
      if(d>engageRadius||!visible(e))return false;
      return spec.flying||('orders' in e&&unitSpec(e).flying)||
        (d<=spec.range?this.world.line(u,e):this.world.sightLine(u,e));
    };
    // Keep explicit attack targets and current combat locks stable.
    if(order?.kind==='attack'&&order.target!==undefined){
      const manual=entities.find(e=>e.id===order.target&&e.owner!==u.owner&&e.hp>0&&!('orders' in e&&e.carrier)&&canAttack(u,e)&&visible(e));
      if(manual){u.combatTarget=manual.id;return manual;}
    }
    const locked=entities.find(e=>e.id===u.combatTarget);
    if(!support&&locked&&eligible(locked))return locked;
    u.combatTarget=null;
    if(u.lastAttacker!==null&&u.defendUntil>this.time){
      const attacker=entities.find(e=>e.id===u.lastAttacker);
      if(attacker&&eligible(attacker)){u.combatTarget=attacker.id;return attacker;}
    }
    if(support)return undefined;
    // Direct sight runs every fixed tick rather than waiting for fog updates.
    let best:Unit|Base|undefined,bestScore=Infinity;
    for(const e of [...this.spatial.query(u,engageRadius),...this.bases]){
      const d=distance(u,e);
      if(!eligible(e))continue;
      // Red AI prioritizes exposed enemy rocket artillery and medics over
      // slightly closer riflemen, but never over a previously locked target.
      // Player units retain the original closest-target behavior.
      const priority=u.owner===1&&'orders' in e
        ?(e.kind==='artillery'?-95:e.kind==='medic'?-65:e.kind==='bomber'?-45:0):0;
      const score=d+priority;
      if(score<bestScore){best=e;bestScore=score;}
    }
    u.combatTarget=best?.id??null;
    return best;
  }
  private move(u:Unit,target:Point,dt:number,speedLimit=Infinity):void {
    const spec=unitSpec(u),clearance=Math.max(0,spec.radius-10);
    if(!u.path.length&&u.repath<=0){u.path=spec.flying&&!this.tactical.costs(u)?[target]:this.world.path(u,target,u.owner===1&&u.orders[0]?.tactical?this.tactical.navigationObstacles():this.obstacles(),clearance,this.tactical.costs(u),spec.flying,u.exactPath);u.repath=.7;}
    let next=u.path[0];if(!next)return;
    let d=distance(u,next);if(d<(spec.group==='Infanterie'?5:.4)){u.path.shift();next=u.path[0];if(!next)return;d=distance(u,next);}
    const dx=(next.x-u.x)/d,dy=(next.y-u.y)/d;
    const cohort=u.orders[0]?.march;
    if(cohort){const allies=this.units.filter(v=>cohort.includes(v.id)&&v.owner===u.owner&&v.hp>0);if(allies.length){speedLimit=Math.min(speedLimit,...allies.map(v=>unitSpec(v).speed));
      if(u.orders[0]?.rear&&!u.orders[0].target&&distance(u,target)<Math.max(...allies.map(v=>distance(v,v.orders[0]??target)))+u.orders[0].rear)speedLimit=0;
      // A straight-line distance cannot compare progress on opposite sides of
      // a rock. Let the column pass bends before enforcing its open-ground lead.
      if(u.orders[0]?.tactical&&distance(u,target)>spec.range+30&&allies.every(v=>v.path.length===1)){const remaining=(v:Unit)=>Math.max(0,distance(v,v.orders[0]??target)-(v.orders[0]?.tactical?.mode==='assault'?unitSpec(v).range:0));const lead=Math.max(...allies.map(remaining))-remaining(u);if(lead>110)speedLimit=0;}
    }}
    let velocity=Math.min(spec.speed,speedLimit);
    if(spec.group!=='Infanterie'){
      const desired=Math.atan2(dy,dx),current=u.hullAngle??u.angle,error=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
      u.hullAngle=current+clamp(error,-(spec.flying?1.8:2.5)*dt,(spec.flying?1.8:2.5)*dt);
      const remaining=Math.max(0,distance(u,target)-14),braking=spec.speed*2.8;
      // Aircraft can translate while banking/turning during a direct move.
      // Otherwise a helicopter ordered to retreat in the opposite direction
      // stays virtually motionless until its hull has turned ~90 degrees.
      // Preserve the existing turning/braking model for ground vehicles.
      const traction=spec.flying&&u.orders[0]?.kind==='move'
        ?Math.max(.45,Math.cos(error)):Math.max(0,Math.cos(error));
      const targetSpeed=Math.min(spec.speed,Math.sqrt(2*braking*remaining))*traction;
      u.driveSpeed=(u.driveSpeed??0)+clamp(targetSpeed-(u.driveSpeed??0),-braking*dt,spec.speed*1.9*dt);
      velocity=Math.min(u.driveSpeed,speedLimit);
    }
    const speed=velocity*dt,step=Math.min(speed,d);
    const p={x:u.x+dx*step,y:u.y+dy*step};
    if(spec.flying||this.world.walkable(p,this.obstacles(),clearance)){u.x=p.x;u.y=p.y;u.walkDistance+=step;u.angle=Math.atan2(dy,dx);u.facing=dx<-.05?-1:dx>.05?1:u.facing;u.moving=step>.001;}
    else {u.path=[];u.repath=0;if(this.world.mapVersion>=3&&clearance>0)u.exactPath=true;}
  }
  step(dt=RULES.tick):void {
    if(!profiler)return this.stepMeasured(dt);const at=performance.now();try{this.stepMeasured(dt);}finally{profiler.record('simulation',performance.now()-at);}
  }
  private stepMeasured(dt=RULES.tick):void {
    if(this.paused||this.status!=='playing'||dt<=0)return;
    // One fixed tick only: callers accumulate elapsed time; no wall-clock economy.
    dt=Math.min(dt,.1);this.time+=dt;this.incomeClock+=dt;this.fogClock+=dt;
    if(this.incomeClock+1e-8>=RULES.incomeInterval){this.incomeClock=Math.max(0,this.incomeClock-RULES.incomeInterval);for(const owner of [0,1] as const)this.credits[owner]+=this.income(owner);}
    this.blasts=this.blasts.filter(b=>this.time-b.at<.5);
    for(const missile of this.missiles)if(missile.impactAt<=this.time){
      for(const target of [...this.units,...this.bases])if(target.owner!==missile.owner&&target.hp>0&&!('orders' in target&&(target.carrier||unitSpec(target).flying))&&distance(target,missile.to)<=60)this.strike(missile.source,target,missile.damage*(1-.5*distance(target,missile.to)/60));
      this.blasts.push({...missile.to,id:missile.id,at:this.time});
    }
    this.missiles=this.missiles.filter(m=>m.impactAt>this.time);
    this.shots=this.shots.filter(s=>(s.life-=dt)>0);
    this.workEffects=this.workEffects.filter(e=>this.time-e.at<.45);
    this.spatial.rebuild(this.units);
    for(const u of this.units){
      if(u.hp<=0||u.carrier)continue;u.previousX=u.x;u.previousY=u.y;u.cooldown-=dt;u.repath-=dt;u.hit=Math.max(0,u.hit-dt);u.fire=Math.max(0,u.fire-dt);u.moving=false;
      const transportBusy=this.transports.step(u,dt);
      if(this.transports.boarding(u,dt))continue;
      if(this.escort(u,dt)||this.support(u,dt)){delete u.burst;continue;}
      const order=u.orders[0];
      // A player retreat / tactical reposition is authoritative. Do not let
      // defensive reaction fire or an old attack lock stall the movement.
      // Boarding/takeoff animations finish before movement resumes.
      if(transportBusy){delete u.burst;continue;}
      if(order?.kind==='move'&&(u.owner===0||this.world.mapVersion>=3&&this.tactical.mode==='director'||this.tactical.state.phase!=='attack')){
        delete u.burst;u.combatTarget=null;u.pursuitOrigin=null;
        if(distance(u,order)<18){u.orders.shift();u.path=[];u.repath=0;}
        else this.move(u,order,dt);
        continue;
      }
      const enemy=this.acquire(u);
      const spec=unitSpec(u);
      if(enemy&&distance(u,enemy)<=spec.range&&(spec.flying||('orders' in enemy&&unitSpec(enemy).flying)||this.world.line(u,enemy,this.obstacles().filter(b=>b.id!==enemy.id)))){
        u.facing=enemy.x<u.x?-1:1;u.angle=Math.atan2(enemy.y-u.y,enemy.x-u.x);
        const rounds=u.kind==='infantry'||u.kind==='heavy'||u.kind==='scout'||u.kind==='rover'?3:1;
        const weapon:Weapon=u.kind==='infantry'||u.kind==='scout'||u.kind==='rover'?'rifle':u.kind==='heavy'?'heavy':u.kind==='medic'||u.kind==='engineer'?'pistol':'cannon';
        if(u.burst?.target!==enemy.id)delete u.burst;
        if(!u.burst&&u.cooldown<=1e-8){u.cooldown=spec.cooldown;u.burst={target:enemy.id,remaining:rounds,at:this.time,index:0};}
        while(u.burst&&u.burst.at<=this.time+1e-8&&enemy.hp>0){
          u.fire=.18;if(u.kind==='artillery')this.launch(u,enemy);else this.damage(u,enemy,weaponDamage(u,enemy)/rounds,weapon,{x:u.x,y:u.y-18});
          u.burst.remaining--;u.burst.index++;u.burst.at+=u.kind==='heavy'?.1:.075;
          if(!u.burst.remaining)delete u.burst;
        }
      } else if(enemy&&order?.kind==='attack'){
        delete u.burst;
        // A direct attack command is authoritative and can pursue beyond the guard leash.
        // Empty failed paths retain move()'s existing retry timer. Clearing it
        // here used to repeat an unreachable search on every fixed tick.
        if(u.repath<=0)u.path=[];
        this.move(u,enemy,dt);
      } else if(enemy&&!u.hold&&u.kind!=='medic'&&u.kind!=='engineer'&&u.kind!=='scout'&&!(u.kind==='rover'&&u.transport?.cargo.length)){
        delete u.burst;
        // Idle guards and attack-move squads close the gap, but never chase
        // farther than a short distance from where contact began.
        if(!u.pursuitOrigin){u.pursuitOrigin={x:u.x,y:u.y};u.path=[];u.repath=0;}
        if(distance(u,u.pursuitOrigin)<160){
          if(u.repath<=0)u.path=[];
          this.move(u,enemy,dt);
        } else if(order?.kind==='attackMove'&&u.owner===1&&this.world.mapVersion>=3&&this.tactical.mode==='director'){
          // The leash limits a diversion, not progress towards the mission.
          // Keep its origin until contact ends so the same fleeing opponent
          // cannot immediately start another pursuit on the following tick.
          if(u.path.length&&distance(u.path[u.path.length-1],order)>55){u.path=[];u.repath=0;}
          if(distance(u,order)<18){u.orders.shift();u.path=[];u.repath=0;}
          else this.move(u,order,dt);
        } else {u.path=[];u.repath=0;}
      } else {
        delete u.burst;
        if(u.pursuitOrigin){
          const home=u.pursuitOrigin;
          if(order||distance(u,home)<18){u.pursuitOrigin=null;u.path=[];u.repath=0;}
          else {
            if(u.repath<=0)u.path=[];
            this.move(u,home,dt);
            continue;
          }
        }
        if(order&&!['heal','repair','build'].includes(order.kind)){
          if(order.kind==='attack'&&!enemy){
            // A remembered building is a destination to investigate, never a
            // license to acquire or fire at its hidden live simulation entity.
            const remembered=u.owner===1&&this.world.mapVersion>=3&&this.tactical.mode==='director'&&order.tactical
              ?this.memories[u.owner].find(m=>m.id===order.target&&m.owner!==u.owner&&m.hp>0):undefined;
            if(!remembered){order.kind='attackMove';delete order.target;}
          }
          if(distance(u,order)<18){u.orders.shift();u.path=[];u.repath=0;}
          else this.move(u,order,dt);
        }
      }
    }
    for(const u of this.units)if(!u.moving&&u.driveSpeed!==undefined)u.driveSpeed=Math.max(0,u.driveSpeed-unitSpec(u).speed*2.8*dt);
    // Symmetric separation: units can pass one another without permanent deadlocks.
    for(const u of this.units)if(u.hp>0&&!u.carrier)for(const v of this.spatial.query(u,unitSpec(u).radius+26)){
      if(v.id<=u.id||v.hp<=0||unitSpec(u).flying!==unitSpec(v).flying)continue;const gap=unitSpec(u).radius+unitSpec(v).radius+1;let d=distance(u,v);if(d>=gap)continue;
      const dx=d>.01?(u.x-v.x)/d:(u.id%2?1:-1),dy=d>.01?(u.y-v.y)/d:.25,push=Math.min(3,(gap-d)*.5);
      for(const [a,sign] of [[u,1],[v,-1]] as const){const p={x:a.x+dx*push*sign,y:a.y+dy*push*sign};if(unitSpec(a).flying||this.world.walkable(p,this.obstacles(),Math.max(0,unitSpec(a).radius-10))){a.x=p.x;a.y=p.y;}}
    }
    this.transports.cleanup();
    for(const u of this.units)if(u.hp<=0)this.tactical.loss(u);
    this.units=this.units.filter(u=>u.hp>0);
    for(const b of this.bases){
      if(b.hp<=0)continue;
      if(b.buildRemaining>0){
        const workers=this.units.filter(u=>u.hp>0&&u.owner===b.owner&&u.kind==='engineer'&&u.workingTarget===b.id&&u.orders[0]?.kind==='build'&&u.defendUntil<=this.time&&distance(u,b)<=b.radius+55);
        b.constructionActive=workers.length>0;
        const work=Math.min(b.buildRemaining,dt*Math.min(1.5,workers.length));
        if(work>0)this.work('build',workers[0].id,b.id,work);
        b.buildRemaining=Math.max(0,b.buildRemaining-work);if(b.buildRemaining<1e-8)b.buildRemaining=0;
        b.hp=Math.min(buildingSpec(b).hp,b.hp+buildingSpec(b).hp*.75*work/buildingSpec(b).buildTime);
        if(b.buildRemaining===0&&b.owner===0)this.notices.push(`${buildingSpec(b).name} einsatzbereit.`);continue;
      }
      b.cooldown-=dt;
      if(b.kind==='turret'){
        const weapon=RULES.turret,blockers=this.obstacles().filter(o=>o.id!==b.id);
        const eligible=(u:Unit)=>u.hp>0&&u.owner!==b.owner&&distance(b,u)<=weapon.range&&
          (this.canSee(b.owner,u)||(distance(b,u)<=buildingSpec(b).sight&&this.world.sightLine(b,u)))&&this.world.line(b,u,blockers);
        const target=this.units.find(u=>u.id===b.turretTarget&&eligible(u))??this.spatial.query(b,weapon.range).filter(eligible).sort((a,c)=>distance(b,a)-distance(b,c)||a.id-c.id)[0];
        b.previousTurretAngle=b.turretAngle??0;b.turretTarget=target?.id??null;
        const pivot=turretPivot(b),to=target?{x:target.x,y:target.y-(unitSpec(target).flying?(target.kind==='scout'?34+77*(target.flightHeight??1):111):23)}:null,desired=to?Math.atan2(to.y-pivot.y,to.x-pivot.x):b.previousTurretAngle+.14*dt;
        b.turretAngle=turnTowards(b.previousTurretAngle,desired,target?weapon.turnSpeed:.14,dt);
        if(b.burst?.target!==target?.id)delete b.burst;
        if(b.burst&&Math.abs(angleDifference(b.turretAngle,desired))>=.045)b.burst.at=this.time;
        if(target&&to&&Math.abs(angleDifference(b.turretAngle,desired))<.045){
          if(!b.burst&&b.cooldown<=1e-8){b.cooldown=weapon.cooldown;b.burst={target:target.id,remaining:4,at:this.time,index:0};}
          while(b.burst&&b.burst.at<=this.time+1e-8&&target.hp>0){
            const barrel=b.burst.index%2;
            this.damage(b,target,weapon.damage/4,'turret',turretMuzzles(b,b.turretAngle)[barrel],barrel);
            b.burst.remaining--;b.burst.index++;b.burst.at+=.07;
            if(!b.burst.remaining)delete b.burst;
          }
        }

      }
      if(!b.queue.length)continue;
      b.production=Math.min(b.queue[0],b.production+dt);
      if(b.production+1e-8>=b.queue[0]){
        const kind=b.queueTypes[0]??'infantry',spec=UNITS[kind],sign=this.world.mapVersion>=2&&b.kind==='headquarters'&&b.owner===1?-1:1,exit={x:b.x+(b.radius+42)*sign,y:b.y+(b.radius+12)*sign};
        const spawn=spec.flying?exit:this.world.nearest(exit,this.obstacles(),this.units,undefined,Math.max(0,spec.radius-10));
        if(spawn&&this.count(b.owner)<RULES.capacity){const u=this.spawn(b.owner,spawn,kind);b.queue.shift();b.queueTypes.shift();b.queueCosts?.shift();b.production=0;if(b.rally)this.command([u.id],{...b.rally,kind:'attackMove'});}
      }
    }
    this.spatial.rebuild(this.units);
    this.bases=this.bases.filter(b=>b.hp>0||b.kind==='headquarters');
    let ownershipChanged=false;
    for(const t of this.territories){
      const nearby=this.spatial.query(t.point,RULES.captureRadius).filter(u=>u.hp>0);
      const blue=nearby.some(u=>u.owner===0),red=nearby.some(u=>u.owner===1);
      if(blue&&red)continue;
      const owner:Owner=blue?0:red?1:-1;
      const defendedBase=this.bases.some(b=>b.kind==='headquarters'&&b.territory===t.id&&b.owner!==owner&&b.hp>0);
      if(owner<0||owner===t.owner||defendedBase||!t.neighbors.some(i=>this.territories[i].owner===owner)){
        t.progress=Math.max(0,t.progress-dt*.5);if(t.progress===0)t.capturing=-1;continue;
      }
      if(t.capturing!==owner){t.capturing=owner;t.progress=0;}
      t.progress+=dt;
      if(t.progress+1e-8>=RULES.captureTime){
        t.owner=owner;t.progress=0;t.capturing=-1;ownershipChanged=true;
        for(const b of this.bases)if(b.kind==='headquarters'&&b.territory===t.id&&b.hp<=0){b.owner=owner as Faction;b.hp=RULES.headquarters.hp*.5;b.queue=[];b.queueTypes=[];b.queueCosts=[];b.production=0;}
        if(owner===0)this.notices.push(`${t.name} gesichert · +${t.income} Credits / 10 s`);
        else if(this.canSee(0,t.point))this.notices.push(`${t.name} unter feindlicher Kontrolle.`);
        this.revision++;
      }
    }
    this.aiClock+=dt;
    if(this.time>=RULES.aiOpeningDelay&&this.aiClock>=RULES.aiInterval){this.aiClock=0;this.think();}
    if(this.fogClock>=.2||ownershipChanged){this.fogClock=0;this.updateVision();}
    if(this.bases.filter(b=>b.kind==='headquarters').every(b=>b.owner===0&&b.hp>0)&&mapLayout(this.world.mapVersion).starts[1].every(i=>this.territories[i].owner===0))this.status='victory';
    if(!this.bases.some(b=>b.owner===0&&b.hp>0&&['headquarters','barracks','factory','airfield'].includes(b.kind))&&this.count(0)===0)this.status='defeat';
  }
  private think():void {this.tactical.plan();}
  save():Save {
    return structuredClone({version:2,productionVersion:1,supportVersion:1,rosterVersion:2,missiles:this.missiles,seed:this.seed,mapVersion:this.world.mapVersion,time:this.time,nextId:this.nextId,credits:this.credits,incomeClock:this.incomeClock,
      units:this.units,bases:this.bases,territories:this.territories,explored:this.explored.map(a=>Array.from(a)),memories:this.memories,aiClock:this.aiClock,ai:this.tactical.state,status:this.status});
  }
  static load(raw:unknown):Simulation {
    const s=raw as Save;
    const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
    const point=(p:Point)=>p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.y>=0&&p.x<=RULES.worldSize&&p.y<=RULES.worldSize;
    const burst=(b:Burst|undefined,rounds:number)=>b===undefined||(b!==null&&Number.isInteger(b.target)&&Number.isInteger(b.remaining)&&b.remaining>0&&b.remaining<=rounds&&b.remaining+b.index===rounds&&Number.isInteger(b.index)&&b.index>=0&&b.index<4&&finite(b.at)&&b.at>=s.time-.11&&b.at<=s.time+.11);
    if(!s||s.version!==2||(s.productionVersion!==undefined&&s.productionVersion!==1)||(s.mapVersion!==undefined&&![0,1,2,3,4,5].includes(s.mapVersion))||!TacticalAI.valid(s.ai,s.time,point,mapLayout(s.mapVersion??0).columns*mapLayout(s.mapVersion??0).rows)||!finite(s.seed)||!finite(s.time)||s.time<0||!finite(s.incomeClock)||s.incomeClock<0||s.incomeClock>=10||
      !Array.isArray(s.units)||s.units.length>96||!Array.isArray(s.bases)||s.bases.length<2||s.bases.length>64||
      s.units.some(u=>u.exactPath!==undefined&&typeof u.exactPath!=='boolean')||
      !Array.isArray(s.territories)||s.territories.length!==mapLayout(s.mapVersion??0).columns*mapLayout(s.mapVersion??0).rows||!Array.isArray(s.explored)||s.explored.length!==2||
      s.explored.some(a=>!Array.isArray(a)||![120**2,RULES.grid**2].includes(a.length)||a.some(v=>v!==0&&v!==1))||
      !Array.isArray(s.credits)||s.credits.length!==2||s.credits.some(v=>!finite(v)||v<0)||
      s.units.some(u=>!burst(u.burst,u.kind==='infantry'||u.kind==='heavy'||u.kind==='scout'||u.kind===undefined?3:1)||!point(u)||![0,1].includes(u.owner)||(u.kind!==undefined&&!Object.hasOwn(UNITS,u.kind))||(u.driveSpeed!==undefined&&(!finite(u.driveSpeed)||u.driveSpeed<0||u.driveSpeed>unitSpec(u).speed))||(u.hullAngle!==undefined&&!finite(u.hullAngle))||(u.pursuitOrigin!==undefined&&u.pursuitOrigin!==null&&!point(u.pursuitOrigin))||!finite(u.hp)||u.hp<=0||u.hp>(UNITS[u.kind??'infantry']?.hp??0)||!Array.isArray(u.orders)||u.orders.length>32||u.orders.some(o=>!point(o)||(o.rear!==undefined&&(!finite(o.rear)||o.rear<0||o.rear>400))||(o.tactical!==undefined&&((o.tactical.goal!==undefined&&!point(o.tactical.goal))||!Number.isInteger(o.tactical.group)||!['safe','assault','defend'].includes(o.tactical.mode)))||(o.march!==undefined&&(!Array.isArray(o.march)||o.march.length>96||o.march.some(id=>!Number.isInteger(id))))||(o.approach!==undefined&&!point(o.approach))||(o.healOrigin!==undefined&&!point(o.healOrigin))||(o.formation!==undefined&&(!Array.isArray(o.formation.front)||o.formation.front.length>96||o.formation.front.some(id=>!Number.isInteger(id))||!point(o.formation.origin)||!point(o.formation.goal)||!finite(o.formation.heading?.x)||!finite(o.formation.heading?.y)||Math.hypot(o.formation.heading.x,o.formation.heading.y)>1.001||!finite(o.formation.lane)||!finite(o.formation.rear)))||!['move','attackMove','attack','heal','repair','build','board'].includes(o.kind)||(['heal','repair','build','board'].includes(o.kind)&&!Number.isInteger(o.target))))||
      s.bases.some(b=>!burst(b.burst,b.kind==='turret'?4:1)||!point(b)||![0,1].includes(b.owner)||(b.kind!==undefined&&!Object.hasOwn(BUILDINGS,b.kind))||(b.turretAngle!==undefined&&!finite(b.turretAngle))||!finite(b.hp)||b.hp<0||b.hp>(BUILDINGS[b.kind??'headquarters']?.hp??0)||!Array.isArray(b.queue)||b.queue.length>8||b.queue.some((v,i)=>!finite(v)||v!==UNITS[b.queueTypes?.[i]??'infantry']?.buildTime)||
        (b.queueTypes!==undefined&&(!Array.isArray(b.queueTypes)||b.queueTypes.length!==b.queue.length||b.queueTypes.some(k=>!Object.hasOwn(UNITS,k))))||
        (s.productionVersion===1&&b.queue.some((_,i)=>!UNITS[b.queueTypes?.[i]??'infantry']?.producers.includes(b.kind??'headquarters')))||
        (b.queueCosts!==undefined&&(!Array.isArray(b.queueCosts)||b.queueCosts.length!==b.queue.length||b.queueCosts.some(v=>!finite(v)||v<0)))||
        (b.buildRemaining!==undefined&&(!finite(b.buildRemaining)||b.buildRemaining<0||b.buildRemaining>(BUILDINGS[b.kind??'headquarters']?.buildTime??0)))||!finite(b.production)||b.production<0||b.production>(b.queue[0]??0))||
      s.territories.some((t,i)=>t.id!==i||![-1,0,1].includes(t.owner)||!finite(t.progress)||t.progress<0||t.progress>8))throw new Error('Dieser Spielstand ist beschädigt oder gehört zu einer anderen Version.');
    const game=new Simulation(s.seed,s.mapVersion??0);
    game.time=s.time;game.nextId=Math.max(1,Number.isSafeInteger(s.nextId)?s.nextId:1,...s.units.map(u=>u.id+1),...(s.ai?.losses??[]).map(l=>l.id+1));game.credits=[...s.credits];game.incomeClock=s.incomeClock;
    game.bases=structuredClone(s.bases).map(b=>({...b,kind:b.kind??'headquarters',...game.world.clearSite(b,buildingSpec(b).radius),radius:buildingSpec(b).radius,...(b.queueCosts?{}:b.queue.length?{queueCosts:b.queue.map((_,i)=>{const k=b.queueTypes?.[i]??'infantry';return !s.supportVersion&&k==='engineer'?150:UNITS[k].cost;})}:{}),queueTypes:b.queueTypes??b.queue.map(()=>'infantry'),buildRemaining:b.buildRemaining??0,cooldown:b.cooldown??0}));
    // Old HQs could queue the entire roster. Refund now-incompatible paid
    // orders once, while preserving valid orders and their active progress.
    let playerRefund=0;
    if(s.productionVersion!==1)for(const b of game.bases){
      const queue:number[]=[],types:UnitKind[]=[],costs:number[]=[];let keptActive=false;
      b.queue.forEach((duration,i)=>{const kind=b.queueTypes[i],paid=b.queueCosts?.[i]??UNITS[kind].cost;
        if(UNITS[kind].producers.includes(b.kind)){queue.push(duration);types.push(kind);costs.push(paid);if(i===0)keptActive=true;}
        else {game.credits[b.owner]+=paid;if(b.owner===0)playerRefund+=paid;}
      });
      b.queue=queue;b.queueTypes=types;b.queueCosts=costs;if(!keptActive)b.production=0;
    }
    if(playerRefund>0)game.notices.push(`Nicht mehr passende Produktionsaufträge erstattet · ${playerRefund.toLocaleString('de-DE')} Credits.`);
    game.units=structuredClone(s.units).map(u=>{
      const p=u.carrier||unitSpec(u).flying?{x:u.x,y:u.y}:game.world.nearest({x:u.x,y:u.y},game.obstacles(),[],undefined,Math.max(0,unitSpec(u).radius-10))??u;
      return {...u,kind:u.kind??'infantry',...(!s.rosterVersion&&u.kind==='heavy'?{hp:u.hp/190*UNITS.heavy.hp}:!s.rosterVersion&&u.kind==='scout'?{hp:u.hp/160*UNITS.scout.hp}:{}),...p,path:[],repath:0,hit:0,fire:0,previousX:p.x,previousY:p.y,
        angle:u.angle??(u.facing<0?Math.PI:0),walkDistance:u.walkDistance??0,lastAttacker:u.lastAttacker??null,defendUntil:u.defendUntil??0,
        combatTarget:Number.isInteger(u.combatTarget)?u.combatTarget:null,
        pursuitOrigin:u.pursuitOrigin??null};
    });
    // Geometry, income and neighbors are regenerated from the seed, never trusted from storage.
    game.territories.forEach((t,i)=>{t.owner=s.territories[i].owner;t.capturing=s.territories[i].capturing;t.progress=s.territories[i].progress;});
    game.explored=s.explored.map(a=>{
      if(a.length===RULES.grid**2)return Uint8Array.from(a);
      const oldGrid=Math.sqrt(a.length);
      return Uint8Array.from({length:RULES.grid**2},(_,i)=>a[Math.floor(Math.floor(i/RULES.grid)*oldGrid/RULES.grid)*oldGrid+Math.floor((i%RULES.grid)*oldGrid/RULES.grid)]);
    });game.memories=structuredClone(s.memories??[[],[]]);game.aiClock=clamp(s.aiClock||0,0,RULES.aiInterval);
    if(!Transports.valid(game))throw Error('Ungültiger Transportzustand im Spielstand.');
    if(s.missiles!==undefined&&(!Array.isArray(s.missiles)||s.missiles.length>96||s.missiles.some(m=>!Number.isSafeInteger(m.id)||!Number.isSafeInteger(m.source)||![0,1].includes(m.owner)||!point(m.from)||!point(m.to)||!finite(m.at)||m.at>s.time||!finite(m.impactAt)||m.impactAt<=s.time||m.impactAt>s.time+12||!finite(m.damage)||m.damage<=0||m.damage>UNITS.artillery.damage||!finite(m.angle))))throw Error('Ungültige Raketen im Spielstand.');
    game.missiles=structuredClone(s.missiles??[]);game.nextId=Math.max(game.nextId,...game.missiles.map(m=>m.id+1));
    game.tactical.restore(s.ai);
    game.status=['playing','victory','defeat'].includes(s.status)?s.status:'playing';game.spatial.rebuild(game.units);game.updateVision();return game;
  }
}
