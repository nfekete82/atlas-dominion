/** Rendering data only. Animation clocks never alter combat or order queues. */
export type AnimationState='idle'|'walk'|'attack'|'hit'|'death';
export interface AnimationFrame {x:number;y:number;w:number;h:number;pivot:[number,number];duration:number;muzzle?:[number,number]}
export interface AnimationClip {frames:number[][];duration:number;loop:boolean;sourceClip:string}
export interface AnimationAtlas {version:1;image:string;kind:string;team:number;cell:[number,number];nativeScale:number;directions:number;stride:number;source:string;timeBasedLocomotion?:boolean;rotor?:boolean;clips:Record<string,AnimationClip>;frames:AnimationFrame[]}
export interface AnimationIntent {moving:boolean;distance:number;angle:number;attack:boolean;hit:boolean;dead:boolean}
export const angleDifference=(a:number,b:number):number=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export const turnTowards=(from:number,to:number,speed:number,dt:number):number=>from+Math.max(-speed*dt,Math.min(speed*dt,angleDifference(from,to)));
export const directionIndex=(angle:number,count:number):number=>((Math.round(angle/(Math.PI*2/count))%count)+count)%count;
export class SpriteAnimator {
 state:AnimationState='idle';age=0;direction=0;private lastAttack=false;private lastHit=false;private hitLockout=0;private walkDistance=0;private locomotionAge=0;private lastDistance:number|null=null;
 constructor(readonly atlas:AnimationAtlas){}
 update(dt:number,input:AnimationIntent):AnimationFrame {
  dt=Math.max(0,dt);if(this.atlas.timeBasedLocomotion)this.locomotionAge+=dt;this.hitLockout=Math.max(0,this.hitLockout-dt);const attack=input.attack&&!this.lastAttack,hit=input.hit&&!this.lastHit;
  this.lastAttack=input.attack;this.lastHit=input.hit;this.direction=directionIndex(input.angle,this.atlas.directions);
  if(this.lastDistance===null)this.walkDistance=input.distance;else if(input.moving)this.walkDistance+=Math.max(0,input.distance-this.lastDistance);this.lastDistance=input.distance;
  let next=this.state;
  if(input.dead||this.state==='death')next='death';
  // Firing always wins over a flinch, including when both events arrive in the
  // same tick. Incoming hits cannot restart or interrupt an active shot.
  else if(attack)next='attack';
  else if(this.state==='attack'&&this.age<this.atlas.clips.attack?.duration)next='attack';
  else if(hit&&this.state!=='hit'&&this.hitLockout<=0)next='hit';
  else if(this.state==='hit'&&this.age<this.atlas.clips.hit?.duration)next='hit';
  else next=input.moving?'walk':'idle';
  if(next!==this.state||attack&&next==='attack'){this.state=next;this.age=0;if(next==='hit')this.hitLockout=Math.max(.60,(this.atlas.clips.hit?.duration??0)*2);}else this.age+=dt;
  return this.frame();
 }
 frame(tag:string=this.state,angle?:number):AnimationFrame {
  const clip=this.atlas.clips[tag];if(!clip)throw Error(`Missing animation ${tag} for ${this.atlas.kind}`);
  const row=clip.frames[angle===undefined?this.direction:directionIndex(angle,clip.frames.length)];
  let index=0;
  if(tag==='walk'&&!this.atlas.timeBasedLocomotion)index=Math.floor(this.walkDistance/this.atlas.stride*row.length)%row.length;
  else {
   // Rotor/propeller phase is independent of idle/walk state transitions.
   const age=this.atlas.timeBasedLocomotion&&(tag==='idle'||tag==='walk')?this.locomotionAge:this.age;
   const clock=clip.loop?age%clip.duration:Math.min(age,clip.duration-1e-8);let elapsed=0;
   for(let i=0;i<row.length;i++){elapsed+=this.atlas.frames[row[i]].duration;if(clock<elapsed){index=i;break;}index=i;}
  }
  return this.atlas.frames[row[index]];
 }
 get finished():boolean{return this.state==='death'&&this.age>=this.atlas.clips.death.duration;}
}
