import type {Point} from './config.js';
import {distance,clamp,RULES} from './config.js';
import {unitSpec,type UnitKind} from './catalog.js';
import type {Simulation} from './simulation.js';

/** Five lightweight synthesized families; no prerecorded samples or downloads. */
export type EngineKind='rover'|'tank'|'artillery'|'scout'|'bomber';
export const ENGINE_KINDS:readonly EngineKind[]=['rover','tank','artillery','scout','bomber'];
export interface EngineMix {level:number;throttle:number;pan:number;moving:number;count:number}
export type EngineMixes=Record<EngineKind,EngineMix>;
export const ENGINE_PROFILES:Readonly<Record<EngineKind,{
  low:number;high:number;cutoff:number;noiseHz:number;noiseQ:number;
  type:OscillatorType;secondary:OscillatorType;volume:number;texture:number;pulse:number
}>>={
 rover:{low:67,high:117,cutoff:310,noiseHz:680,noiseQ:.5,type:'sawtooth',secondary:'triangle',volume:.075,texture:.17,pulse:0},
 tank:{low:44,high:70,cutoff:180,noiseHz:480,noiseQ:.9,type:'sawtooth',secondary:'square',volume:.095,texture:.37,pulse:11},
 artillery:{low:50,high:82,cutoff:225,noiseHz:510,noiseQ:.65,type:'sawtooth',secondary:'triangle',volume:.085,texture:.24,pulse:0},
 scout:{low:37,high:66,cutoff:330,noiseHz:760,noiseQ:.6,type:'triangle',secondary:'sawtooth',volume:.095,texture:.40,pulse:17},
 bomber:{low:123,high:185,cutoff:580,noiseHz:1900,noiseQ:.55,type:'sine',secondary:'sawtooth',volume:.075,texture:.48,pulse:0}
};
/** Only the mixer is allowed to make movement audible. No movement means
 * zero output, even with an active (but silent) persistent WebAudio oscillator.
 * The old 0.50 multiplier was nearly inaudible after master, FX and distance.
 */
export function engineAudibleGain(level:number,profileVolume:number):number{
 return clamp(Number.isFinite(level)?level:0,0,1)*
  clamp(Number.isFinite(profileVolume)?profileVolume:0,0,.1)*1.6;
}
/** A wider but softly attenuated field makes nearby moving vehicles audible
 * at the normal tactical zoom. It never expands visibility through fog.
 */
export function engineAudibleRadius(width:number,height:number,zoom:number):number{
 const viewport=Math.max(Number.isFinite(width)?width:0,Number.isFinite(height)?height:0);
 const safeZoom=Number.isFinite(zoom)&&zoom>.01?zoom:1;
 return clamp(viewport/safeZoom*.65,300,880);
}
const empty=():EngineMix=>({level:0,throttle:0,pan:0,count:0,moving:0});
/** Audible motors require an actual change in authoritative world position
 * over the last 20 Hz simulation tick. An order, turning in place and
 * driveSpeed (which can remain nonzero while blocked) are NOT movement.
 * No persisted fields or WebAudio / render-frame timing are involved.
 */
export function measuredEngineSpeed(u:{
 x:number;y:number;previousX?:number;previousY?:number;moving?:boolean
}):number {
 if(!u.moving||!Number.isFinite(u.previousX)||!Number.isFinite(u.previousY))return 0;
 const dx=u.x-u.previousX!,dy=u.y-u.previousY!;
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return 0;
 const speed=Math.hypot(dx,dy)/RULES.tick;
 return Number.isFinite(speed)?speed:0;
}
/** Visibility and camera radius are enforced *before* mixing.
 * Unknown enemies cannot be heard behind fog, even when they drive nearby.
 * The pure mixer never touches RNG, state, engine commands or WebAudio. */
export function vehicleSoundMix(
 g:Pick<Simulation,'units'>,camera:Point,visible:(p:Point)=>boolean,
 radius=730
):EngineMixes {
 const result:EngineMixes={rover:empty(),tank:empty(),artillery:empty(),scout:empty(),bomber:empty()};
 const sums:Record<EngineKind,number>={rover:0,tank:0,artillery:0,scout:0,bomber:0};
 const maxRange=Math.max(120,Number.isFinite(radius)?radius:730);
 for(const u of g.units){
  // Only actual measured physical motion is audible; moving=true alone,
  // a standing tank turning its hull, or a blocked driver is silent.
  if(u.hp<=0||u.carrier||!u.moving||
     !ENGINE_KINDS.includes(u.kind as EngineKind)||!visible(u))continue;
  const kind=u.kind as EngineKind;
  const dist=distance(u,camera);
  if(dist>=maxRange)continue;
  const fraction=Math.max(0,1-dist/maxRange);
  const weight=fraction*fraction; // No sharp sound boundary and natural distance roll-off
  const profile=unitSpec(u);
  const physicalSpeed=measuredEngineSpeed(u);
  // Reject positional snaps/spawn corrections as well as stopped vehicles.
  if(physicalSpeed<2||physicalSpeed>profile.speed*3)continue;
  const throttle=clamp(physicalSpeed/Math.max(1,profile.speed),0,1);
  const motion=1;
  // No idle level and no baseline hum; volume depends on real vehicle
  // motion and fades with the square of the camera distance. For slow
  // vehicles a lower floor still makes acceleration audible.
  const activity=weight*clamp(throttle*.85,.05,.85);
  const m=result[kind];sums[kind]+=activity;m.count++;
  m.throttle+=activity*throttle;
  m.moving+=activity*motion;
  m.pan+=activity*clamp((u.x-camera.x)/(maxRange*.72),-.82,.82);
 }
 for(const kind of ENGINE_KINDS){
  const m=result[kind],sum=sums[kind];if(sum<=0)continue;
  m.level=1-Math.exp(-sum); // Nearby convoy louder but never scales linearly to dozens of vehicles
  m.throttle=clamp(m.throttle/sum,0,1);
  m.moving=clamp(m.moving/sum,0,1);
  m.pan=clamp(m.pan/sum,-.82,.82);
 }
 return result;
}
