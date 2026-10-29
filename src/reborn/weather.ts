import {WEATHER_RULES,clamp,type Point} from './config.js';
export type WeatherPhase='CLEAR'|'WARNING'|'SANDSTORM'|'RECOVERY';
/** Independent integer hash: weather never consumes simulation/AI randomness. */
function sample(seed:number,cycle:number,salt:number):number {
 let n=(seed^Math.imul(cycle+1,0x9e3779b1)^salt)>>>0;
 n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return ((n^(n>>>16))>>>0)/4294967296;
}
const duration=(seed:number,cycle:number,salt:number,range:readonly [number,number])=>range[0]+Math.floor(sample(seed,cycle,salt)*(range[1]-range[0]+1));
export class Weather {
 phase:WeatherPhase='CLEAR';startedAt=0;endsAt:number;cycle=0;private time=0;
 constructor(readonly seed:number,readonly enabled=true){this.endsAt=enabled?duration(seed,0,11,WEATHER_RULES.first):Number.POSITIVE_INFINITY;}
 get storm():boolean{return this.phase==='SANDSTORM';}
 get remaining():number{return this.enabled?Math.max(0,this.endsAt-this.time):0;}
 get intensity():number {
  const smooth=(n:number)=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
  return this.phase==='WARNING'?.08*smooth((this.time-this.startedAt)/WEATHER_RULES.warning):this.storm?.08+.92*smooth((this.time-this.startedAt)/WEATHER_RULES.fadeIn):this.phase==='RECOVERY'?1-smooth((this.time-this.startedAt)/WEATHER_RULES.recovery):0;
 }
 /** Only transitions do work. The complete plan is reconstructible from seed + saved time. */
 update(time:number):WeatherPhase[] {
  if(!Number.isFinite(time)||time<0||!this.enabled)return [];
  if(time<this.time){this.phase='CLEAR';this.startedAt=0;this.cycle=0;this.endsAt=duration(this.seed,0,11,WEATHER_RULES.first);}
  this.time=time;const transitions:WeatherPhase[]=[];
  while(time+1e-8>=this.endsAt){
   this.startedAt=this.endsAt;
   if(this.phase==='CLEAR'){this.phase='WARNING';this.endsAt+=WEATHER_RULES.warning;}
   else if(this.phase==='WARNING'){this.phase='SANDSTORM';this.endsAt+=duration(this.seed,this.cycle,23,WEATHER_RULES.storm);}
   else if(this.phase==='SANDSTORM'){this.phase='RECOVERY';this.endsAt+=WEATHER_RULES.recovery;}
   else {this.phase='CLEAR';this.cycle++;this.endsAt+=duration(this.seed,this.cycle,37,WEATHER_RULES.calm);}
   transitions.push(this.phase);
  }
  return transitions;
 }
 artilleryOffset(projectileId:number,sourceId:number):Point {
  if(!this.storm)return {x:0,y:0};
  const angle=sample(this.seed,projectileId,sourceId)*Math.PI*2,radius=WEATHER_RULES.artilleryDrift*(.35+.65*sample(this.seed,projectileId,sourceId^431));
  return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
 }
}
