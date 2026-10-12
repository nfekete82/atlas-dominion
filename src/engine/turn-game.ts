import {COUNTRY_STARTS} from '../data/countries.js';
import {GEO_BOUNDS,LAND_ROWS,MAP_WIDTH,MAP_HEIGHT} from '../data/europe.js';

/** Independent, turn-based Risk-hybrid engine. Does not alter the realtime Game. */
export interface Province {
  id:number; center:number; cells:number; neighbors:number[];
  owner:number; troops:number; cityLevel:number; capital:boolean;
}
export interface TurnFaction {id:number;code:string;name:string;gold:number;reserve:number;}
export type TurnPhase='reinforce'|'develop'|'attack'|'fortify';
export interface TurnResult {ok:boolean;reason:string;attackerLoss?:number;defenderLoss?:number;captured?:boolean;}
export interface TurnSnapshot {
  version:1;seed:number;round:number;active:number;phase:TurnPhase;
  rngState:number; provinces:Province[];factions:TurnFaction[];
}
const W=MAP_WIDTH,H=MAP_HEIGHT,SIZE=W*H;
const valid=(i:number):boolean=>i>=0&&i<SIZE&&LAND_ROWS[Math.floor(i/W)]?.[i%W]==='1';
const four=(i:number):number[]=>{
  const x=i%W,y=Math.floor(i/W),n:number[]=[];
  if(x>0)n.push(i-1);if(x+1<W)n.push(i+1);
  if(y>0)n.push(i-W);if(y+1<H)n.push(i+W);return n;
};
const geo=(lon:number,lat:number):number=>{
  const x=Math.max(0,Math.min(W-1,Math.floor((lon-GEO_BOUNDS.west)/(GEO_BOUNDS.east-GEO_BOUNDS.west)*W)));
  const y=Math.max(0,Math.min(H-1,Math.floor((GEO_BOUNDS.north-lat)/(GEO_BOUNDS.north-GEO_BOUNDS.south)*H)));
  return y*W+x;
};
function closestLand(origin:number,used:Set<number>):number {
  if(valid(origin)&&!used.has(origin))return origin;
  const ox=origin%W,oy=Math.floor(origin/W);
  for(let radius=1;radius<Math.max(W,H);radius++){
    let winner=-1,best=Infinity;
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
      const x=ox+dx,y=oy+dy;if(x<0||x>=W||y<0||y>=H)continue;
      const i=y*W+x,d=dx*dx+dy*dy;
      if(valid(i)&&!used.has(i)&&(d<best||d===best&&i<winner)){winner=i;best=d;}
    }
    if(winner>=0)return winner;
  }
  throw new Error('No free land seed');
}
/** Multi-source flood assigns every contiguous cell to one province.
 * Fixed seeds: capital provinces plus evenly spaced geographical samples.
 * Extra seeds are added for islands otherwise missing a starting point.
 */
export function generateProvinces(desired=200):{provinces:Province[];cellProvince:Int16Array}{
  if(!Number.isInteger(desired)||desired<COUNTRY_STARTS.length||desired>1000)throw new RangeError('Invalid province count');
  const used=new Set<number>();
  const seeds:number[]=[];
  for(const country of COUNTRY_STARTS){const i=closestLand(geo(country.lon,country.lat),used);used.add(i);seeds.push(i);}
  const land:number[]=[];
  for(let i=0;i<SIZE;i++)if(valid(i))land.push(i);
  // Deterministic farthest-point sampling on a coarse grid distributes the remaining centers.
  for(let y=4;y<H&&seeds.length<desired;y+=12)for(let x=4;x<W&&seeds.length<desired;x+=12){
    const i=y*W+x;if(!valid(i)||used.has(i))continue;
    const d=seeds.reduce((min,s)=>Math.min(min,(s%W-x)**2+(Math.floor(s/W)-y)**2),Infinity);
    if(d<75)continue;used.add(i);seeds.push(i);
  }
  // Guarantee disconnected islands and the requested minimum number of provinces.
  for(const i of land){
    if(seeds.length>=desired)break;
    if(used.has(i))continue;
    const x=i%W,y=Math.floor(i/W);
    const d=seeds.reduce((min,s)=>Math.min(min,(s%W-x)**2+(Math.floor(s/W)-y)**2),Infinity);
    if(d>=75){used.add(i);seeds.push(i);}
  }
  const cellProvince=new Int16Array(SIZE).fill(-1);
  const queue:number[]=[];
  seeds.forEach((s,id)=>{cellProvince[s]=id;queue.push(s);});
  for(let head=0;head<queue.length;head++){
    const at=queue[head],id=cellProvince[at];
    for(const n of four(at))if(valid(n)&&cellProvince[n]===-1){
      cellProvince[n]=id;queue.push(n);
    }
  }
  // Unseeded islands require their own province; the flood cannot cross water.
  for(const i of land){
    if(cellProvince[i]>=0)continue;
    const id=seeds.length;seeds.push(i);cellProvince[i]=id;
    const local=[i];
    for(let head=0;head<local.length;head++)for(const n of four(local[head])){
      if(valid(n)&&cellProvince[n]===-1){cellProvince[n]=id;local.push(n);}
    }
  }
  const neighborSets=seeds.map(()=>new Set<number>());
  const counts=new Int32Array(seeds.length);
  for(const i of land){
    const id=cellProvince[i];counts[id]++;
    for(const n of four(i)){const other=cellProvince[n];if(other>=0&&other!==id)neighborSets[id].add(other);}
  }
  const provinces=seeds.map((center,id):Province=>({
    id,center,cells:counts[id],neighbors:[...neighborSets[id]].sort((a,b)=>a-b),
    owner:id<COUNTRY_STARTS.length?id:-1,troops:id<COUNTRY_STARTS.length?8:2,
    cityLevel:id<COUNTRY_STARTS.length?1:0,capital:id<COUNTRY_STARTS.length,
  }));
  return {provinces,cellProvince};
}

export class TurnGame {
  readonly provinces:Province[];
  readonly cellProvince:Int16Array;
  readonly factions:TurnFaction[];
  readonly seed:number;
  round=1;active=0;phase:TurnPhase='reinforce';
  private rngState:number;
  constructor(seed=1,desiredProvinces=200){
    this.seed=seed>>>0;this.rngState=this.seed||1;
    const map=generateProvinces(desiredProvinces);
    this.provinces=map.provinces;this.cellProvince=map.cellProvince;
    this.factions=COUNTRY_STARTS.map((country,id)=>({id,code:country.code,name:country.name,gold:10,reserve:5}));
  }
  private roll():number {
    let x=this.rngState;x^=x<<13;x^=x>>>17;x^=x<<5;
    this.rngState=x>>>0;return 1+(this.rngState%6);
  }
  private check(province:number):Province {
    const p=this.provinces[province];if(!p)throw new RangeError('Unknown province');return p;
  }
  private controlled(id:number):Province[]{return this.provinces.filter(p=>p.owner===id);}
  private grantIncome(id:number):void {
    const lands=this.controlled(id);
    this.factions[id].gold+=lands.reduce((sum,p)=>sum+1+p.cityLevel,0);
    this.factions[id].reserve+=Math.max(3,Math.floor(lands.length/3))+lands.reduce((sum,p)=>sum+Math.floor(p.cityLevel/2),0);
  }
  /** Explicit sequence prevents a player being attacked during their own planning. */
  nextPhase():void {
    const phases:TurnPhase[]=['reinforce','develop','attack','fortify'];
    const index=phases.indexOf(this.phase);
    if(index<3){this.phase=phases[index+1];return;}
    this.active=(this.active+1)%this.factions.length;
    if(this.active===0)this.round++;
    this.phase='reinforce';this.grantIncome(this.active);
  }
  deploy(province:number,amount:number):TurnResult {
    const p=this.check(province),f=this.factions[this.active];
    if(this.phase!=='reinforce'||p.owner!==this.active||!Number.isInteger(amount)||amount<1||f.reserve<amount)
      return {ok:false,reason:'Invalid deployment'};
    f.reserve-=amount;p.troops+=amount;return {ok:true,reason:'Reinforced'};
  }
  upgrade(province:number):TurnResult {
    const p=this.check(province),f=this.factions[this.active];
    const cost=[0,5,10,20,35][p.cityLevel];
    if(this.phase!=='develop'||p.owner!==this.active||p.cityLevel>=5||f.gold<cost)
      return {ok:false,reason:'Upgrade unavailable'};
    f.gold-=cost;p.cityLevel++;return {ok:true,reason:'City upgraded'};
  }
  /** One Risk-style dice exchange (max 3 attacking, 2 defending).
   * The defender wins ties; attacks never leave the source province empty.
   */
  attack(from:number,to:number,committed:number):TurnResult {
    const a=this.check(from),d=this.check(to);
    if(this.phase!=='attack'||a.owner!==this.active||d.owner===this.active||
      !a.neighbors.includes(to)||!Number.isInteger(committed)||committed<2||
      committed>=a.troops)return {ok:false,reason:'Illegal attack'};
    const count=Math.min(3,committed),defense=Math.min(2,d.troops);
    const roll=(n:number)=>Array.from({length:n},()=>this.roll()).sort((x,y)=>y-x);
    const aa=roll(count),dd=roll(defense);
    let lostA=0,lostD=0;
    for(let i=0;i<Math.min(aa.length,dd.length);i++){
      if(aa[i]>dd[i])lostD++;else lostA++;
    }
    a.troops-=lostA;d.troops-=lostD;
    let captured=false;
    if(d.troops===0){d.owner=this.active;d.troops=Math.min(a.troops-1,Math.max(1,count-lostA));
      a.troops-=d.troops;captured=true;}
    return {ok:true,reason:captured?'Province conquered':'Battle resolved',
      attackerLoss:lostA,defenderLoss:lostD,captured};
  }
  move(from:number,to:number,amount:number):TurnResult {
    const a=this.check(from),b=this.check(to);
    if(this.phase!=='fortify'||a.owner!==this.active||b.owner!==this.active||
      !a.neighbors.includes(to)||!Number.isInteger(amount)||amount<1||amount>=a.troops)
      return {ok:false,reason:'Illegal move'};
    a.troops-=amount;b.troops+=amount;return {ok:true,reason:'Moved'};
  }
  exportSave():TurnSnapshot {
    return {version:1,seed:this.seed,round:this.round,active:this.active,phase:this.phase,
      rngState:this.rngState,provinces:this.provinces.map(p=>({...p,neighbors:[...p.neighbors]})),
      factions:this.factions.map(f=>({...f}))};
  }
  static fromSave(saved:TurnSnapshot):TurnGame {
    if(saved.version!==1)throw new Error('Unknown save version');
    const game=new TurnGame(saved.seed);
    if(saved.provinces.length!==game.provinces.length||saved.factions.length!==game.factions.length)
      throw new Error('Invalid save geography');
    game.provinces.splice(0,game.provinces.length,...saved.provinces.map(p=>({...p,neighbors:[...p.neighbors]})));
    game.factions.splice(0,game.factions.length,...saved.factions.map(f=>({...f})));
    game.round=saved.round;game.active=saved.active;game.phase=saved.phase;game.rngState=saved.rngState;
    return game;
  }
}
