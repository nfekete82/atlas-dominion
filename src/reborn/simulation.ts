import { RULES, clamp, distance, type Faction, type Owner, type Point } from './config.js';
import { World, type Territory } from './world.js';

export interface Order extends Point { kind:'move'|'attackMove'|'attack'; target?:number }
export interface Unit extends Point {
  id:number; owner:Faction; hp:number; orders:Order[]; path:Point[];
  cooldown:number; facing:number; moving:boolean; hit:number; repath:number;
  angle:number; walkDistance:number; fire:number; previousX:number; previousY:number;
  lastAttacker:number|null; defendUntil:number;
}
export interface Base extends Point {
  id:number; owner:Faction; hp:number; territory:number; queue:number[]; production:number;
  rally:Point|null; radius:number;
}
export interface Shot { from:Point; to:Point; owner:Faction; life:number; hit:boolean }
export interface Memory extends Point { id:number; owner:Faction; hp:number; territory:number }
export interface Save {
  version:2; seed:number; time:number; nextId:number; credits:number[]; incomeClock:number;
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
  readonly world=new World();
  seed:number; time=0; nextId=1; credits=[RULES.initialCredits as number,RULES.initialCredits as number];
  incomeClock=0; aiClock=0; status:'playing'|'victory'|'defeat'='playing';
  units:Unit[]=[]; bases:Base[]=[]; territories:Territory[];
  visible=[new Uint8Array(RULES.grid**2),new Uint8Array(RULES.grid**2)];
  explored=[new Uint8Array(RULES.grid**2),new Uint8Array(RULES.grid**2)];
  memories:Memory[][]=[[],[]]; shots:Shot[]=[]; notices:string[]=[];
  paused=false; revision=0; private fogClock=0; private spatial=new SpatialIndex();
  constructor(seed=2026) {
    this.seed=seed;this.territories=this.world.territories(seed);
    for(const [owner,territory] of [[0,19],[1,5]] as const){
      const t=this.territories[territory], p=this.world.clearSite(t.point,RULES.headquarters.radius)!;
      this.bases.push({id:1000+owner,owner,...p,hp:RULES.headquarters.hp,territory,queue:[],production:0,rally:null,radius:RULES.headquarters.radius});
      t.point=this.world.nearest({x:p.x+165,y:p.y-45},this.obstacles())!;
      this.spawn(owner,this.world.nearest({x:p.x+140,y:p.y+100},this.obstacles())!);
    }
    this.spatial.rebuild(this.units);this.updateVision();
  }
  obstacles():Base[]{return this.bases.filter(b=>b.hp>0);}
  spawn(owner:Faction,p:Point):Unit {
    const u:Unit={id:this.nextId++,owner,...p,hp:RULES.infantry.hp,orders:[],path:[],cooldown:0,facing:1,moving:false,hit:0,repath:0,
      angle:Math.PI/4,walkDistance:0,fire:0,previousX:p.x,previousY:p.y,lastAttacker:null,defendUntil:0};
    this.units.push(u);return u;
  }
  income(owner:Faction):number {
    return this.bases.filter(b=>b.owner===owner&&b.hp>0).length*RULES.baseIncome+
      this.territories.filter(t=>t.owner===owner).reduce((n,t)=>n+t.income,0);
  }
  count(owner:Faction):number{return this.units.filter(u=>u.owner===owner&&u.hp>0).length;}
  queued(owner:Faction):number{return this.bases.filter(b=>b.owner===owner).reduce((n,b)=>n+b.queue.length,0);}
  recruit(baseId:number):boolean {
    const b=this.bases.find(b=>b.id===baseId);
    if(!b||b.hp<=0||this.status!=='playing'||b.queue.length>=8||this.credits[b.owner]<RULES.infantry.cost||this.count(b.owner)+this.queued(b.owner)>=RULES.capacity)return false;
    this.credits[b.owner]-=RULES.infantry.cost;b.queue.push(RULES.infantry.buildTime);return true;
  }
  cancel(baseId:number):void {
    const b=this.bases.find(b=>b.id===baseId);if(!b?.queue.length)return;
    b.queue.pop();this.credits[b.owner]+=RULES.infantry.cost;if(!b.queue.length)b.production=0;
  }
  command(ids:number[],order:Order,append=false):number {
    if(!Number.isFinite(order.x)||!Number.isFinite(order.y))return 0;
    const members=this.units.filter(u=>ids.includes(u.id)&&u.hp>0);
    const width=Math.ceil(Math.sqrt(members.length));let accepted=0;
    members.forEach((u,i)=>{
      const offset=members.length>1?{x:((i%width)-(width-1)/2)*27,y:(Math.floor(i/width)-(width-1)/2)*27}:{x:0,y:0};
      const target=this.world.nearest({x:order.x+offset.x,y:order.y+offset.y},this.obstacles(),[],u);if(!target)return;
      const next:Order={...order,...target};
      if(append){if(u.orders.length<32)u.orders.push(next);else return;}
      else {u.orders=[next];u.path=[];u.repath=0;}
      accepted++;
    });return accepted;
  }
  stop(ids:number[]):void {for(const u of this.units)if(ids.includes(u.id)){u.orders=[];u.path=[];u.moving=false;}}
  canSee(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.visible[owner][i]===1;}
  hasExplored(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.explored[owner][i]===1;}
  updateVision():void {
    for(const owner of [0,1] as const){
      const visible=this.visible[owner];visible.fill(0);
      const sources=[...this.units.filter(u=>u.owner===owner&&u.hp>0).map(u=>({...u,sight:RULES.infantry.sight})),
        ...this.bases.filter(b=>b.owner===owner&&b.hp>0).map(b=>({...b,sight:RULES.headquarters.sight}))];
      for(const s of sources){
        const gx=Math.floor(s.x/this.world.cell),gy=Math.floor(s.y/this.world.cell),r=Math.ceil(s.sight/this.world.cell);
        const close='queue' in s ? RULES.headquarters.radius+this.world.cell*2 : this.world.cell*2+RULES.infantry.radius;
        for(let y=Math.max(0,gy-r);y<=Math.min(RULES.grid-1,gy+r);y++)for(let x=Math.max(0,gx-r);x<=Math.min(RULES.grid-1,gx+r);x++){
          const i=y*RULES.grid+x,p=this.world.center(i);
          const d=distance(s,p);
          if(!visible[i]&&d<=s.sight&&(d<=close||this.world.sightLine(s,p)))visible[i]=1;
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
        const memory={id:b.id,owner:b.owner,x:b.x,y:b.y,hp:b.hp,territory:b.territory};
        const i=this.memories[owner].findIndex(m=>m.id===b.id);if(i<0)this.memories[owner].push(memory);else this.memories[owner][i]=memory;
      }
    }
    this.revision++;
  }
  private acquire(u:Unit):Unit|Base|undefined {
    const order=u.orders[0];
    // Even during a movement order, return fire at the actual visible attacker.
    // Keep the movement queue and path so it resumes when the threat is gone.
    if(u.lastAttacker!==null&&u.defendUntil>this.time){
      const attacker=this.units.find(e=>e.id===u.lastAttacker&&e.owner!==u.owner&&e.hp>0);
      if(attacker&&distance(u,attacker)<=RULES.infantry.range&&this.canSee(u.owner,attacker)&&this.world.line(u,attacker))return attacker;
    }
    if(order?.kind==='move')return undefined;
    if(order?.kind==='attack'&&order.target!==undefined){
      const manual=[...this.units,...this.bases].find(e=>e.id===order.target&&e.owner!==u.owner&&e.hp>0&&this.canSee(u.owner,e));
      if(manual)return manual;
    }
    let best:Unit|Base|undefined,range=RULES.infantry.range+1;
    for(const e of [...this.spatial.query(u,range),...this.bases]){
      const d=distance(u,e);
      if(e.hp>0&&e.owner!==u.owner&&d<range&&this.canSee(u.owner,e)&&this.world.line(u,e)) {best=e;range=d;}
    }
    return best;
  }
  private move(u:Unit,target:Point,dt:number):void {
    if(!u.path.length&&u.repath<=0){u.path=this.world.path(u,target,this.obstacles());u.repath=.7;}
    let next=u.path[0];if(!next)return;
    let d=distance(u,next);if(d<5){u.path.shift();next=u.path[0];if(!next)return;d=distance(u,next);}
    const speed=RULES.infantry.speed*dt,step=Math.min(speed,d),dx=(next.x-u.x)/d,dy=(next.y-u.y)/d;
    const p={x:u.x+dx*step,y:u.y+dy*step};
    if(this.world.walkable(p,this.obstacles())){u.x=p.x;u.y=p.y;u.walkDistance+=step;u.angle=Math.atan2(dy,dx);u.facing=dx<-.05?-1:dx>.05?1:u.facing;u.moving=true;}
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
      if(enemy&&distance(u,enemy)<=RULES.infantry.range&&this.world.line(u,enemy)){
        u.facing=enemy.x<u.x?-1:1;u.angle=Math.atan2(enemy.y-u.y,enemy.x-u.x);
        if(u.cooldown<=0){u.cooldown=RULES.infantry.cooldown;u.fire=.18;enemy.hp-=RULES.infantry.damage;
          if('hit' in enemy){enemy.hit=.18;enemy.lastAttacker=u.id;enemy.defendUntil=this.time+5;}
          this.shots.push({from:{x:u.x,y:u.y-18},to:{x:enemy.x,y:enemy.y-15},owner:u.owner,life:.14,hit:true});
          if(enemy.hp<=0&&'queue' in enemy){enemy.hp=0;enemy.queue=[];enemy.production=0;this.notices.push(enemy.owner===0?'Dein Hauptquartier wurde zerstört!':'Feindliches Hauptquartier ausgeschaltet. Kontrollpunkt sichern!');}
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
    // Symmetric separation: units can pass one another without permanent deadlocks.
    for(const u of this.units)if(u.hp>0)for(const v of this.spatial.query(u,23)){
      if(v.id<=u.id||v.hp<=0)continue;let d=distance(u,v);if(d>=21)continue;
      const dx=d>.01?(u.x-v.x)/d:(u.id%2?1:-1),dy=d>.01?(u.y-v.y)/d:.25,push=Math.min(3,(21-d)*.5);
      for(const [a,sign] of [[u,1],[v,-1]] as const){const p={x:a.x+dx*push*sign,y:a.y+dy*push*sign};if(this.world.walkable(p,this.obstacles())){a.x=p.x;a.y=p.y;}}
    }
    this.units=this.units.filter(u=>u.hp>0);
    for(const b of this.bases){
      if(b.hp<=0||!b.queue.length)continue;
      b.production=Math.min(RULES.infantry.buildTime,b.production+dt);
      if(b.production+1e-8>=b.queue[0]){
        const spawn=this.world.nearest({x:b.x+125,y:b.y+90},this.obstacles(),this.units);
        if(spawn&&this.count(b.owner)<RULES.capacity){const u=this.spawn(b.owner,spawn);b.queue.shift();b.production=0;if(b.rally)this.command([u.id],{...b.rally,kind:'attackMove'});}
      }
    }
    this.spatial.rebuild(this.units);
    for(const t of this.territories){
      const nearby=this.spatial.query(t.point,RULES.captureRadius).filter(u=>u.hp>0);
      const blue=nearby.some(u=>u.owner===0),red=nearby.some(u=>u.owner===1);
      if(blue&&red)continue;
      const owner:Owner=blue?0:red?1:-1;
      const defendedBase=this.bases.some(b=>b.territory===t.id&&b.owner!==owner&&b.hp>0);
      if(owner<0||owner===t.owner||defendedBase||!t.neighbors.some(i=>this.territories[i].owner===owner)){
        t.progress=Math.max(0,t.progress-dt*.5);if(t.progress===0)t.capturing=-1;continue;
      }
      if(t.capturing!==owner){t.capturing=owner;t.progress=0;}
      t.progress+=dt;
      if(t.progress+1e-8>=RULES.captureTime){
        t.owner=owner;t.progress=0;t.capturing=-1;
        for(const b of this.bases)if(b.territory===t.id&&b.hp<=0){b.owner=owner as Faction;b.hp=RULES.headquarters.hp*.5;b.queue=[];b.production=0;}
        if(owner===0)this.notices.push(`${t.name} gesichert · +${t.income} Credits / 10 s`);
        else if(this.canSee(0,t.point))this.notices.push(`${t.name} unter feindlicher Kontrolle.`);
        this.revision++;
      }
    }
    this.aiClock+=dt;
    if(this.time>=RULES.aiOpeningDelay&&this.aiClock>=RULES.aiInterval){this.aiClock=0;this.think();}
    if(this.fogClock>=.2){this.fogClock=0;this.updateVision();}
    if(this.bases.every(b=>b.owner===0&&b.hp>0)&&[4,5,11].every(i=>this.territories[i].owner===0))this.status='victory';
    if(!this.bases.some(b=>b.owner===0&&b.hp>0)&&this.count(0)===0)this.status='defeat';
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
    return structuredClone({version:2,seed:this.seed,time:this.time,nextId:this.nextId,credits:this.credits,incomeClock:this.incomeClock,
      units:this.units,bases:this.bases,territories:this.territories,explored:this.explored.map(a=>Array.from(a)),memories:this.memories,aiClock:this.aiClock,status:this.status});
  }
  static load(raw:unknown):Simulation {
    const s=raw as Save;
    const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
    const point=(p:Point)=>p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.y>=0&&p.x<=RULES.worldSize&&p.y<=RULES.worldSize;
    if(!s||s.version!==2||!finite(s.seed)||!finite(s.time)||s.time<0||!finite(s.incomeClock)||s.incomeClock<0||s.incomeClock>=10||
      !Array.isArray(s.units)||s.units.length>96||!Array.isArray(s.bases)||s.bases.length!==2||
      !Array.isArray(s.territories)||s.territories.length!==30||!Array.isArray(s.explored)||s.explored.length!==2||
      s.explored.some(a=>!Array.isArray(a)||![120**2,RULES.grid**2].includes(a.length)||a.some(v=>v!==0&&v!==1))||
      !Array.isArray(s.credits)||s.credits.length!==2||s.credits.some(v=>!finite(v)||v<0)||
      s.units.some(u=>!point(u)||![0,1].includes(u.owner)||!finite(u.hp)||u.hp<=0||u.hp>100||!Array.isArray(u.orders)||u.orders.length>32||u.orders.some(o=>!point(o)||!['move','attackMove','attack'].includes(o.kind)))||
      s.bases.some(b=>!point(b)||![0,1].includes(b.owner)||!finite(b.hp)||b.hp<0||b.hp>1200||!Array.isArray(b.queue)||b.queue.length>8||b.queue.some(v=>v!==5)||!finite(b.production)||b.production<0||b.production>5)||
      s.territories.some((t,i)=>t.id!==i||![-1,0,1].includes(t.owner)||!finite(t.progress)||t.progress<0||t.progress>8))throw new Error('Dieser Spielstand ist beschädigt oder gehört zu einer anderen Version.');
    const game=new Simulation(s.seed);
    game.time=s.time;game.nextId=Math.max(...s.units.map(u=>u.id),0)+1;game.credits=[...s.credits];game.incomeClock=s.incomeClock;
    game.bases=structuredClone(s.bases).map(b=>({...b,...game.world.clearSite(b,b.radius)}));
    game.units=structuredClone(s.units).map(u=>{
      const p=game.world.nearest(u,game.obstacles())??u;
      return {...u,...p,path:[],repath:0,hit:0,fire:0,previousX:p.x,previousY:p.y,
        angle:u.angle??(u.facing<0?Math.PI:0),walkDistance:u.walkDistance??0,lastAttacker:u.lastAttacker??null,defendUntil:u.defendUntil??0};
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
