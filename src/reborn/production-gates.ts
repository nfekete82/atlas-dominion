import type {BuildingKind} from './catalog.js';

/** Atlas-space apertures (512px baked facade) for the four production buildings.
 * The shutter reuses the original baked doorway pixels, not a detached UI sprite.
 * Coordinates are intentionally stable across blue/red textures of each model. */
export interface GateAperture {x:number;y:number;width:number;height:number;skew:number}
export const PRODUCTION_GATE_APERTURES:Readonly<Partial<Record<BuildingKind,Readonly<GateAperture>>>>={
 headquarters:{x:325,y:350,width:38,height:43,skew:-4},
 barracks:{x:337,y:369,width:45,height:48,skew:-5},
 factory:{x:332,y:354,width:52,height:58,skew:-5},
 airfield:{x:335,y:369,width:56,height:52,skew:-6},
} as const;

interface GateProducer {
 id:number;kind:BuildingKind;hp:number;buildRemaining:number;
 queue:readonly number[];production:number;
}
interface State {queueLength:number;duration:number;production:number;openUntil:number}
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
const smoothstep=(x:number)=>{const u=clamp01(x);return u*u*(3-2*u);};
/** Short pre-open, held through spawn, followed by a slow shutter close.
 * Only visual state is stored here; the Simulation/save payload is unaffected. */
export class ProductionGates {
 private previous=new Map<number,State>();
 clear():void{this.previous.clear();}
 sample(base:GateProducer,time:number,reducedMotion=false):number{
  if(!PRODUCTION_GATE_APERTURES[base.kind]||base.hp<=0||base.buildRemaining>0){
   this.previous.delete(base.id);return 0;
  }
  const previous=this.previous.get(base.id),duration=base.queue[0]??0;
  const progress=duration>0?clamp01(base.production/duration):0;
  const completed=!!previous&&previous.duration>0&&previous.production>=previous.duration*.80
   &&(base.queue.length<previous.queueLength||base.production+1e-6<previous.production);
  const openUntil=completed?time+1.35:previous?.openUntil??-1;
  this.previous.set(base.id,{queueLength:base.queue.length,duration,production:base.production,openUntil});
  const anticipation=duration>0?smoothstep((progress-.78)/.18):0;
  const after=time<openUntil?smoothstep((openUntil-time)/.65):0;
  const amount=Math.max(anticipation,after);
  return reducedMotion?amount>.45?1:0:amount;
 }
}
