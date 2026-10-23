import { RULES, clamp, distance, type Faction, type Owner, type Point } from './config.js';
import { World, inside, type Territory } from './world.js';
import { UNITS, BUILDINGS, unitSpec, buildingSpec, type UnitKind, type BuildingKind } from './catalog.js';
import { MAP_VERSION, randomMapSeed } from './world-generation.js';

export interface Order extends Point { kind:'move'|'attackMove'|'attack'; target?:number }
export interface Unit extends Point {
  id:number; owner:Faction; kind:UnitKind; hp:number; orders:Order[]; path:Point[];
  cooldown:number; facing:number; moving:boolean; hit:number; repath:number;
  angle:number; walkDistance:number; fire:number; previousX:number; previousY:number;
  lastAttacker:number|null; defendUntil:number;
  /** Optional motor state keeps version-2 saves compatible. */
  driveSpeed?:number; hullAngle?:number; combatTarget?:number|null;
}
export interface Base extends Point {
  id:number; owner:Faction; kind:BuildingKind; hp:number; territory:number; queue:number[]; queueTypes:UnitKind[]; production:number;
  buildRemaining:number; cooldown:number;
  rally:Point|null; radius:number;
}
export interface Shot { from:Point; to:Point; owner:Faction; life:number; hit:boolean }
export interface Memory extends Point { id:number; owner:Faction; hp:number; territory:number; kind?:BuildingKind }
export interface Save {
  version:2; seed:number; mapVersion?:0|1; time:number; nextId:number; credits:number[]; incomeClock:number;
  units:Unit[]; bases:Base[]; territories:Territory[]; explored:number[][];
  memories:Memory[][]; aiClock:number; status:'playing'|'victory'|'defeat';
}

/** Uniform buckets keep combat/vision queries independent of total army size. */
class SpatialIndex {
  private buckets=new Map<number,Unit[]>();
  private size=220;
  rebuild(units:Unit[]):void {this.buckets.clear();for(const u of units){const k=Math.floor(u.y/this.size)*32+Math.floor(u.x/this.size);const b=this.buckets.get(k);if(b)b.push(u);else this.buckets.set(k,[u]);}}
  query(p:Point,r:number):Unit[]{const result:Unit[]=[];for(let y=Math.floor((p.y-r)/this.size);y<=Math.floor((p.y+r)/this.size);y++)for(let x=Math.floor((p.x-r)/this.size);x<=Math.floor((p.x+r)/this.size);x++){
    for(const u of this.buckets.get(y*32+x)??[])if(distance(p,u)<=r)result.push(u);
  }return result;}
}

export class Simulation {
  readonly world:World;
  seed:number; time=0; nextId=1; credits=[RULES.initialCredits as number,RULES.initialCredits as number];
  incomeClock=0; aiClock=0; status:'playing'|'victory'|'defeat'='playing';
  units:Unit[]=[]; bases:Base[]=[]; territories:Territory[];
  visible=[new Uint8Array(RULES.grid**2),new Uint8Array(RULES.grid**2)];
  explored=[new Uint8Array(RULES.grid**2),new Uint8Array(RULES.grid**2)];
  memories:Memory[][]=[[],[]]; shots:Shot[]=[]; notices:string[]=[];
  paused=false; revision=0; private fogClock=0; private spatial=new SpatialIndex();
  /** The original constructor remains a deterministic legacy fixture/save reader. */
  constructor(seed=2026,mapVersion:0|1=0) {
    this.seed=seed;this.world=new World(seed,mapVersion);this.territories=this.world.territories(seed);
    for(const [owner,territory] of [[0,19],[1,5]] as const){
      const t=this.territories[territory],site=mapVersion===1?{x:t.point.x-165,y:t.point.y+45}:t.point,p=this.world.clearSite(site,RULES.headquarters.radius)!;
      this.bases.push({id:1000+owner,owner,kind:'headquarters',...p,hp:RULES.headquarters.hp,territory,queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null,radius:RULES.headquarters.radius});
      if(mapVersion===0)t.point=this.world.nearest({x:p.x+165,y:p.y-45},this.obstacles())!;
      this.spawn(owner,this.world.nearest({x:p.x+140,y:p.y+100},this.obstacles())!);
    }
    this.spatial.rebuild(this.units);this.updateVision();
  }
  static campaign(seed=randomMapSeed()):Simulation {return new Simulation(seed,MAP_VERSION);}
  obstacles():Base[]{return this.bases.filter(b=>b.hp>0);}
  spawn(owner:Faction,p:Point,kind:UnitKind='infantry'):Unit {
    while(this.bases.some(b=>b.id===this.nextId))this.nextId++;
    const u:Unit={id:this.nextId++,owner,kind,...p,hp:UNITS[kind].hp,orders:[],path:[],cooldown:0,facing:1,moving:false,hit:0,repath:0,
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
  recruit(baseId:number,kind:UnitKind='infantry'):boolean {
    const b=this.bases.find(b=>b.id===baseId),spec=UNITS[kind];
    if(!b||!spec||b.hp<=0||b.buildRemaining>0||!spec.producers.includes(b.kind)||this.status!=='playing'||b.queue.length>=8||this.credits[b.owner]<spec.cost||this.count(b.owner)+this.queued(b.owner)>=RULES.capacity)return false;
    this.credits[b.owner]-=spec.cost;b.queue.push(spec.buildTime);b.queueTypes.push(kind);return true;
  }
  cancel(baseId:number,index?:number):void {
    const b=this.bases.find(b=>b.id===baseId);if(!b?.queue.length)return;
    const at=index===undefined?b.queue.length-1:index;if(at<0||at>=b.queue.length)return;
    b.queue.splice(at,1);this.credits[b.owner]+=UNITS[b.queueTypes.splice(at,1)[0]??'infantry'].cost;if(at===0||!b.queue.length)b.production=0;
  }
  buildError(owner:Faction,kind:BuildingKind,p:Point):string|null {
    const spec=BUILDINGS[kind];
    if(!spec||kind==='headquarters'||this.status!=='playing')return 'Dieses Gebäude kann hier nicht errichtet werden.';
    if(this.bases.filter(b=>b.hp>0).length>=40)return 'Gebäudelimit erreicht.';
    if(!this.bases.some(b=>b.owner===owner&&b.kind==='headquarters'&&b.hp>0))return 'Ein Hauptquartier ist erforderlich.';
    if(this.credits[owner]<spec.cost)return 'Zu wenig Credits.';
    const territory=this.territories.find(t=>inside(p,t.polygon));
    if(!territory||territory.owner!==owner||!this.canSee(owner,p))return 'Nur in sichtbarem eigenem Territorium bauen.';
    if(!this.world.walkable(p))return 'Felsen blockieren die Baustelle.';
    for(let i=0;i<16;i++){
      const q={x:p.x+Math.cos(i*Math.PI/8)*spec.radius,y:p.y+Math.sin(i*Math.PI/8)*spec.radius};
      if(!this.world.walkable(q)||!inside(q,territory.polygon))return 'Die gesamte Grundfläche muss frei und im eigenen Gebiet liegen.';
    }
    if(this.obstacles().some(b=>distance(b,p)<b.radius+spec.radius+24))return 'Zu nah an einem anderen Gebäude.';
    if(this.territories.some(t=>distance(t.point,p)<spec.radius+45))return 'Bastion und Kontrollpunkt müssen frei bleiben.';
    if(this.units.some(u=>u.hp>0&&!unitSpec(u).flying&&distance(u,p)<spec.radius+unitSpec(u).radius))return 'Einheiten blockieren die Baustelle.';
    return null;
  }
  build(owner:Faction,kind:BuildingKind,p:Point):Base|null {
    if(this.buildError(owner,kind,p))return null;
    const spec=BUILDINGS[kind],territory=this.territories.find(t=>inside(p,t.polygon))!;
    let id=1000;while(this.bases.some(b=>b.id===id)||this.units.some(u=>u.id===id))id++;
    const b:Base={id,owner,kind,...p,hp:spec.hp*.25,territory:territory.id,radius:spec.radius,queue:[],queueTypes:[],production:0,buildRemaining:spec.buildTime,cooldown:0,rally:null};
    this.credits[owner]-=spec.cost;this.bases.push(b);this.updateVision();return b;
  }
  cancelConstruction(id:number):boolean {
    const b=this.bases.find(b=>b.id===id);if(!b||b.buildRemaining<=0||b.hp<=0)return false;
    this.credits[b.owner]+=Math.floor(buildingSpec(b).cost*.75);this.bases=this.bases.filter(b=>b.id!==id);this.updateVision();return true;
  }
  command(ids:number[],order:Order,append=false):number {
    if(!Number.isFinite(order.x)||!Number.isFinite(order.y))return 0;
    const members=this.units.filter(u=>ids.includes(u.id)&&u.hp>0);
    const width=Math.ceil(Math.sqrt(members.length)),slots=members.map((_,i)=>({x:i%width*27,y:Math.floor(i/width)*27}));
    // Centre the actual occupied slots, including a short last row. Using the
    // column count for both axes shifted a two-unit group north of its target.
    const center={x:slots.reduce((n,p)=>n+p.x,0)/Math.max(1,members.length),y:slots.reduce((n,p)=>n+p.y,0)/Math.max(1,members.length)};
    let accepted=0;
    members.forEach((u,i)=>{
      const offset={x:slots[i].x-center.x,y:slots[i].y-center.y};
      const spec=unitSpec(u),p={x:order.x+offset.x,y:order.y+offset.y};
      const target=spec.flying?{x:clamp(p.x,8,RULES.worldSize-8),y:clamp(p.y,8,RULES.worldSize-8)}:this.world.nearest(p,this.obstacles(),[],u,Math.max(0,spec.radius-10));if(!target)return;
      const next:Order={...order,...target};
      if(append){if(u.orders.length<32)u.orders.push(next);else return;}
      else {u.orders=[next];u.path=[];u.repath=0;u.combatTarget=null;}
      accepted++;
    });return accepted;
  }
  stop(ids:number[]):void {for(const u of this.units)if(ids.includes(u.id)){u.orders=[];u.path=[];u.moving=false;}}
  canSee(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.visible[owner][i]===1;}
  hasExplored(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.explored[owner][i]===1;}
  updateVision():void {
    for(const owner of [0,1] as const){
      const visible=this.visible[owner];visible.fill(0);
      const sources=[...this.units.filter(u=>u.owner===owner&&u.hp>0).map(u=>({x:u.x,y:u.y,sight:unitSpec(u).sight,close:unitSpec(u).radius+this.world.cell*2,air:unitSpec(u).flying})),
        ...this.bases.filter(b=>b.owner===owner&&b.hp>0).map(b=>({x:b.x,y:b.y,sight:b.buildRemaining>0?110:buildingSpec(b).sight,close:b.radius+this.world.cell*2,air:false})),
        ...this.territories.filter(t=>t.owner===owner).map(t=>({...t.point,sight:RULES.bastion.sight,close:RULES.bastion.radius+this.world.cell*2,air:false}))];
      for(const s of sources){
        const gx=Math.floor(s.x/this.world.cell),gy=Math.floor(s.y/this.world.cell),r=Math.ceil(s.sight/this.world.cell);
        for(let y=Math.max(0,gy-r);y<=Math.min(RULES.grid-1,gy+r);y++)for(let x=Math.max(0,gx-r);x<=Math.min(RULES.grid-1,gx+r);x++){
          const i=y*RULES.grid+x,p=this.world.center(i);
          const d=distance(s,p);
          if(!visible[i]&&d<=s.sight&&(s.air||d<=s.close||this.world.sightLine(s,p)))visible[i]=1;
        }
        // A source always reveals its exact tile, including after save migration.
        const ownCell=this.world.index(s);if(ownCell>=0)visible[ownCell]=1;
      }
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
    this.revision++;
  }
  private acquire(u:Unit):Unit|Base|undefined {
    const order=u.orders[0],spec=unitSpec(u),entities=[...this.units,...this.bases];
    const visible=(e:Unit|Base)=>this.canSee(u.owner,e)||(distance(u,e)<=spec.sight&&(spec.flying||this.world.sightLine(u,e)));
    const eligible=(e:Unit|Base)=>e.hp>0&&e.owner!==u.owner&&distance(u,e)<=spec.range&&visible(e)&&
      (spec.flying||('orders' in e&&unitSpec(e).flying)||this.world.line(u,e));
    // Explicit orders take priority; otherwise finish a valid opponent before
    // switching, even if another attacker deals the most recent hit.
    if(order?.kind==='attack'&&order.target!==undefined){
      const manual=entities.find(e=>e.id===order.target&&e.owner!==u.owner&&e.hp>0&&visible(e));
      if(manual){u.combatTarget=manual.id;return manual;}
    }
    const locked=entities.find(e=>e.id===u.combatTarget);
    if(locked&&eligible(locked))return locked;
    u.combatTarget=null;
    if(u.lastAttacker!==null&&u.defendUntil>this.time){
      const attacker=entities.find(e=>e.id===u.lastAttacker);
      if(attacker&&eligible(attacker)){u.combatTarget=attacker.id;return attacker;}
    }
    // Direct sight is checked every fixed tick, independently of the fog raster.
    let best:Unit|Base|undefined,range=spec.range+1;
    for(const e of [...this.spatial.query(u,range),...this.bases]){
      const d=distance(u,e);
      if(d<range&&eligible(e)) {best=e;range=d;}
    }
    u.combatTarget=best?.id??null;
    return best;
  }
  private move(u:Unit,target:Point,dt:number):void {
    const spec=unitSpec(u),clearance=Math.max(0,spec.radius-10);
    if(!u.path.length&&u.repath<=0){u.path=spec.flying?[target]:this.world.path(u,target,this.obstacles(),clearance);u.repath=.7;}
    let next=u.path[0];if(!next)return;
    let d=distance(u,next);if(d<(spec.group==='Infanterie'?5:.4)){u.path.shift();next=u.path[0];if(!next)return;d=distance(u,next);}
    const dx=(next.x-u.x)/d,dy=(next.y-u.y)/d;
    let velocity=spec.speed;
    if(spec.group!=='Infanterie'){
      const desired=Math.atan2(dy,dx),current=u.hullAngle??u.angle,error=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
      u.hullAngle=current+clamp(error,-(spec.flying?1.8:2.5)*dt,(spec.flying?1.8:2.5)*dt);
      const remaining=Math.max(0,distance(u,target)-14),braking=spec.speed*2.8;
      const targetSpeed=Math.min(spec.speed,Math.sqrt(2*braking*remaining))*Math.max(0,Math.cos(error));
      u.driveSpeed=(u.driveSpeed??0)+clamp(targetSpeed-(u.driveSpeed??0),-braking*dt,spec.speed*1.9*dt);
      velocity=u.driveSpeed;
    }
    const speed=velocity*dt,step=Math.min(speed,d);
    const p={x:u.x+dx*step,y:u.y+dy*step};
    if(spec.flying||this.world.walkable(p,this.obstacles(),clearance)){u.x=p.x;u.y=p.y;u.walkDistance+=step;u.angle=Math.atan2(dy,dx);u.facing=dx<-.05?-1:dx>.05?1:u.facing;u.moving=step>.001;}
    else {u.path=[];u.repath=0;}
  }
  step(dt=RULES.tick):void {
    if(this.paused||this.status!=='playing'||dt<=0)return;
    // One fixed tick only: callers accumulate elapsed time; no wall-clock economy.
    dt=Math.min(dt,.1);this.time+=dt;this.incomeClock+=dt;this.fogClock+=dt;
    if(this.incomeClock+1e-8>=RULES.incomeInterval){this.incomeClock=Math.max(0,this.incomeClock-RULES.incomeInterval);for(const owner of [0,1] as const)this.credits[owner]+=this.income(owner);}
    this.shots=this.shots.filter(s=>(s.life-=dt)>0);
    this.spatial.rebuild(this.units);
    for(const u of this.units){
      if(u.hp<=0)continue;u.previousX=u.x;u.previousY=u.y;u.cooldown-=dt;u.repath-=dt;u.hit=Math.max(0,u.hit-dt);u.fire=Math.max(0,u.fire-dt);u.moving=false;
      const enemy=this.acquire(u),order=u.orders[0];
      const spec=unitSpec(u);
      if(enemy&&distance(u,enemy)<=spec.range&&(spec.flying||('orders' in enemy&&unitSpec(enemy).flying)||this.world.line(u,enemy))){
        u.facing=enemy.x<u.x?-1:1;u.angle=Math.atan2(enemy.y-u.y,enemy.x-u.x);
        if(u.cooldown<=0){u.cooldown=spec.cooldown;u.fire=.18;enemy.hp-=spec.damage;
          if('hit' in enemy){enemy.hit=.18;enemy.lastAttacker=u.id;enemy.defendUntil=this.time+5;}
          this.shots.push({from:{x:u.x,y:u.y-18},to:{x:enemy.x,y:enemy.y-15},owner:u.owner,life:.14,hit:true});
          if(enemy.hp<=0&&'queue' in enemy){enemy.hp=0;enemy.queue=[];enemy.queueTypes=[];enemy.production=0;this.notices.push(`${buildingSpec(enemy).name} ${enemy.owner===0?'verloren':'ausgeschaltet'}!`);}
        }
      } else if(enemy&&order?.kind==='attack'){
        // Visible manual targets are pursued; hidden ones leave a last-known-position order.
        if(!u.path.length||u.repath<=0){u.path=[];u.repath=0;this.move(u,enemy,dt);}else this.move(u,enemy,dt);
      } else if(order){
        if(order.kind==='attack'&&!enemy){order.kind='attackMove';delete order.target;}
        if(distance(u,order)<18){u.orders.shift();u.path=[];u.repath=0;}
        else this.move(u,order,dt);
      }
    }
    for(const u of this.units)if(!u.moving&&u.driveSpeed!==undefined)u.driveSpeed=Math.max(0,u.driveSpeed-unitSpec(u).speed*2.8*dt);
    // Symmetric separation: units can pass one another without permanent deadlocks.
    for(const u of this.units)if(u.hp>0)for(const v of this.spatial.query(u,unitSpec(u).radius+26)){
      if(v.id<=u.id||v.hp<=0||unitSpec(u).flying!==unitSpec(v).flying)continue;const gap=unitSpec(u).radius+unitSpec(v).radius+1;let d=distance(u,v);if(d>=gap)continue;
      const dx=d>.01?(u.x-v.x)/d:(u.id%2?1:-1),dy=d>.01?(u.y-v.y)/d:.25,push=Math.min(3,(gap-d)*.5);
      for(const [a,sign] of [[u,1],[v,-1]] as const){const p={x:a.x+dx*push*sign,y:a.y+dy*push*sign};if(unitSpec(a).flying||this.world.walkable(p,this.obstacles(),Math.max(0,unitSpec(a).radius-10))){a.x=p.x;a.y=p.y;}}
    }
    this.units=this.units.filter(u=>u.hp>0);
    for(const b of this.bases){
      if(b.hp<=0)continue;
      if(b.buildRemaining>0){b.buildRemaining=Math.max(0,b.buildRemaining-dt);b.hp=Math.min(buildingSpec(b).hp,b.hp+buildingSpec(b).hp*.75*dt/buildingSpec(b).buildTime);if(b.buildRemaining===0&&b.owner===0)this.notices.push(`${buildingSpec(b).name} einsatzbereit.`);continue;}
      b.cooldown-=dt;
      if(b.kind==='turret'&&b.cooldown<=0){
        const target=this.spatial.query(b,300).filter(u=>u.hp>0&&u.owner!==b.owner&&this.canSee(b.owner,u)&&(unitSpec(u).flying||this.world.line(b,u))).sort((a,c)=>distance(b,a)-distance(b,c))[0];
        if(target){target.hp-=24;target.hit=.18;b.cooldown=.8;this.shots.push({from:{x:b.x,y:b.y-32},to:{x:target.x,y:target.y-18},owner:b.owner,life:.14,hit:true});}
      }
      for(const engineer of this.spatial.query(b,b.radius+55))if(engineer.kind==='engineer'&&engineer.owner===b.owner&&!engineer.moving&&engineer.fire<=0)b.hp=Math.min(buildingSpec(b).hp,b.hp+8*dt);
      if(!b.queue.length)continue;
      b.production=Math.min(b.queue[0],b.production+dt);
      if(b.production+1e-8>=b.queue[0]){
        const kind=b.queueTypes[0]??'infantry',spec=UNITS[kind],exit={x:b.x+b.radius+42,y:b.y+b.radius+12};
        const spawn=spec.flying?exit:this.world.nearest(exit,this.obstacles(),this.units,undefined,Math.max(0,spec.radius-10));
        if(spawn&&this.count(b.owner)<RULES.capacity){const u=this.spawn(b.owner,spawn,kind);b.queue.shift();b.queueTypes.shift();b.production=0;if(b.rally)this.command([u.id],{...b.rally,kind:'attackMove'});}
      }
    }
    this.spatial.rebuild(this.units);
    this.bases=this.bases.filter(b=>b.hp>0||b.kind==='headquarters');
    let ownershipChanged=false;
    for(const t of this.territories){
      const nearby=this.spatial.query(t.point,RULES.captureRadius).filter(u=>u.hp>0&&!unitSpec(u).flying);
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
        for(const b of this.bases)if(b.kind==='headquarters'&&b.territory===t.id&&b.hp<=0){b.owner=owner as Faction;b.hp=RULES.headquarters.hp*.5;b.queue=[];b.queueTypes=[];b.production=0;}
        if(owner===0)this.notices.push(`${t.name} gesichert · +${t.income} Credits / 10 s`);
        else if(this.canSee(0,t.point))this.notices.push(`${t.name} unter feindlicher Kontrolle.`);
        this.revision++;
      }
    }
    this.aiClock+=dt;
    if(this.time>=RULES.aiOpeningDelay&&this.aiClock>=RULES.aiInterval){this.aiClock=0;this.think();}
    if(this.fogClock>=.2||ownershipChanged){this.fogClock=0;this.updateVision();}
    if(this.bases.filter(b=>b.kind==='headquarters').every(b=>b.owner===0&&b.hp>0)&&[4,5,11].every(i=>this.territories[i].owner===0))this.status='victory';
    if(!this.bases.some(b=>b.owner===0&&b.hp>0&&['headquarters','barracks','factory','airfield'].includes(b.kind))&&this.count(0)===0)this.status='defeat';
  }
  private think():void {
    for(const b of this.bases)if(b.owner===1&&b.hp>0&&b.queue.length<2&&this.count(1)+this.queued(1)<18)this.recruit(b.id);
    const army=this.units.filter(u=>u.owner===1),targets=this.territories.filter(t=>t.owner!==1&&t.neighbors.some(i=>this.territories[i].owner===1));
    // Only units revealed by red vision can trigger defensive reactions.
    const threats=this.units.filter(u=>u.owner===0&&this.canSee(1,u)&&this.territories.some(t=>t.owner===1&&distance(t.point,u)<650));
    const exposedBase=this.bases.find(b=>b.owner===0&&b.hp>0&&this.canSee(1,b));
    const assignments=new Map<number,number>();
    for(const u of army){
      if(threats.length){const target=threats.reduce((a,b)=>distance(u,a)<distance(u,b)?a:b);
        if(distance(u,target)<650){this.command([u.id],{...target,kind:'attack',target:target.id});continue;}}
      if(exposedBase&&army.length>=4&&u.id%3===0){this.command([u.id],{...exposedBase,kind:'attack',target:exposedBase.id});continue;}
      if(u.orders.length)continue;
      const current=this.territories.find(t=>t.owner!==1&&distance(u,t.point)<RULES.captureRadius&&t.neighbors.some(i=>this.territories[i].owner===1));
      if(current)continue;
      const target=[...targets].sort((a,b)=>(distance(u,a.point)+(assignments.get(a.id)??0)*260-a.value*60)-(distance(u,b.point)+(assignments.get(b.id)??0)*260-b.value*60))[0];
      if(target){assignments.set(target.id,(assignments.get(target.id)??0)+1);this.command([u.id],{...target.point,kind:'attackMove'});}
    }
  }
  save():Save {
    return structuredClone({version:2,seed:this.seed,mapVersion:this.world.mapVersion,time:this.time,nextId:this.nextId,credits:this.credits,incomeClock:this.incomeClock,
      units:this.units,bases:this.bases,territories:this.territories,explored:this.explored.map(a=>Array.from(a)),memories:this.memories,aiClock:this.aiClock,status:this.status});
  }
  static load(raw:unknown):Simulation {
    const s=raw as Save;
    const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
    const point=(p:Point)=>p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.y>=0&&p.x<=RULES.worldSize&&p.y<=RULES.worldSize;
    if(!s||s.version!==2||(s.mapVersion!==undefined&&s.mapVersion!==0&&s.mapVersion!==1)||!finite(s.seed)||!finite(s.time)||s.time<0||!finite(s.incomeClock)||s.incomeClock<0||s.incomeClock>=10||
      !Array.isArray(s.units)||s.units.length>96||!Array.isArray(s.bases)||s.bases.length<2||s.bases.length>64||
      !Array.isArray(s.territories)||s.territories.length!==30||!Array.isArray(s.explored)||s.explored.length!==2||
      s.explored.some(a=>!Array.isArray(a)||![120**2,RULES.grid**2].includes(a.length)||a.some(v=>v!==0&&v!==1))||
      !Array.isArray(s.credits)||s.credits.length!==2||s.credits.some(v=>!finite(v)||v<0)||
      s.units.some(u=>!point(u)||![0,1].includes(u.owner)||(u.kind!==undefined&&!Object.hasOwn(UNITS,u.kind))||(u.driveSpeed!==undefined&&(!finite(u.driveSpeed)||u.driveSpeed<0||u.driveSpeed>unitSpec(u).speed))||(u.hullAngle!==undefined&&!finite(u.hullAngle))||!finite(u.hp)||u.hp<=0||u.hp>(UNITS[u.kind??'infantry']?.hp??0)||!Array.isArray(u.orders)||u.orders.length>32||u.orders.some(o=>!point(o)||!['move','attackMove','attack'].includes(o.kind)))||
      s.bases.some(b=>!point(b)||![0,1].includes(b.owner)||(b.kind!==undefined&&!Object.hasOwn(BUILDINGS,b.kind))||!finite(b.hp)||b.hp<0||b.hp>(BUILDINGS[b.kind??'headquarters']?.hp??0)||!Array.isArray(b.queue)||b.queue.length>8||b.queue.some((v,i)=>!finite(v)||v!==UNITS[b.queueTypes?.[i]??'infantry']?.buildTime)||
        (b.queueTypes!==undefined&&(!Array.isArray(b.queueTypes)||b.queueTypes.length!==b.queue.length||b.queueTypes.some(k=>!Object.hasOwn(UNITS,k))))||
        (b.buildRemaining!==undefined&&(!finite(b.buildRemaining)||b.buildRemaining<0||b.buildRemaining>(BUILDINGS[b.kind??'headquarters']?.buildTime??0)))||!finite(b.production)||b.production<0||b.production>(b.queue[0]??0))||
      s.territories.some((t,i)=>t.id!==i||![-1,0,1].includes(t.owner)||!finite(t.progress)||t.progress<0||t.progress>8))throw new Error('Dieser Spielstand ist beschädigt oder gehört zu einer anderen Version.');
    const game=new Simulation(s.seed,s.mapVersion??0);
    game.time=s.time;game.nextId=Math.max(...s.units.map(u=>u.id),0)+1;game.credits=[...s.credits];game.incomeClock=s.incomeClock;
    game.bases=structuredClone(s.bases).map(b=>({...b,kind:b.kind??'headquarters',...game.world.clearSite(b,buildingSpec(b).radius),radius:buildingSpec(b).radius,queueTypes:b.queueTypes??b.queue.map(()=>'infantry'),buildRemaining:b.buildRemaining??0,cooldown:b.cooldown??0}));
    game.units=structuredClone(s.units).map(u=>{
      const p=unitSpec(u).flying?u:game.world.nearest(u,game.obstacles(),[],undefined,Math.max(0,unitSpec(u).radius-10))??u;
      return {...u,kind:u.kind??'infantry',...p,path:[],repath:0,hit:0,fire:0,previousX:p.x,previousY:p.y,
        angle:u.angle??(u.facing<0?Math.PI:0),walkDistance:u.walkDistance??0,lastAttacker:u.lastAttacker??null,defendUntil:u.defendUntil??0,
        combatTarget:Number.isInteger(u.combatTarget)?u.combatTarget:null};
    });
    // Geometry, income and neighbors are regenerated from the seed, never trusted from storage.
    game.territories.forEach((t,i)=>{t.owner=s.territories[i].owner;t.capturing=s.territories[i].capturing;t.progress=s.territories[i].progress;});
    game.explored=s.explored.map(a=>{
      if(a.length===RULES.grid**2)return Uint8Array.from(a);
      const oldGrid=Math.sqrt(a.length);
      return Uint8Array.from({length:RULES.grid**2},(_,i)=>a[Math.floor(Math.floor(i/RULES.grid)*oldGrid/RULES.grid)*oldGrid+Math.floor((i%RULES.grid)*oldGrid/RULES.grid)]);
    });game.memories=structuredClone(s.memories??[[],[]]);game.aiClock=clamp(s.aiClock||0,0,RULES.aiInterval);
    game.status=['playing','victory','defeat'].includes(s.status)?s.status:'playing';game.spatial.rebuild(game.units);game.updateVision();return game;
  }
}
