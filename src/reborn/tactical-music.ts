/** Sandforge's ORIGINAL generative ambient RTS soundtrack.
 * No licensed recordings, fetches, synthesizer workers or per-frame voices.
 * Four persistent triangle/sine oscillators make a restrained evolving motif.
 * Fixed state changes roughly every five seconds; no JS timers or allocations
 * inside the game loop and no audio work if muted, paused or backgrounded.
 */
export const MUSIC_CHORD_SECONDS=5.6;
export const MUSIC_SCORE=[
 [146.83,174.61,220.00,293.66], // D minor + open A
 [116.54,146.83,174.61,233.08], // B-flat major
 [130.81,164.81,196.00,261.63], // C major
 [98.00,146.83,196.00,261.63]   // G minor colour
] as const;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function musicChordAt(time:number):readonly number[]{
 const i=Math.floor(Math.max(0,time)/MUSIC_CHORD_SECONDS)%MUSIC_SCORE.length;
 return MUSIC_SCORE[i];
}
/** Combat emphasis is very modest: music must never obscure radio or shots. */
export function musicCombatLevel(shots:number,underAttack:boolean):number{
 return clamp((Math.min(shots,6)/6)*.56+(underAttack?.38:0));
}
export class TacticalMusic {
 private bus:GainNode;
 private filter:BiquadFilterNode;
 private voices:OscillatorNode[]=[];
 private envelopes:GainNode[]=[];
 private lastChord=-1;
 private lastActive=false;
 private ducking=false;
 enabled=true;
 volume=.30;
 readonly oscillatorCount=4;
 constructor(private readonly context:AudioContext,destination:AudioNode) {
  const a=context;
  this.bus=a.createGain();this.bus.gain.value=0;
  this.filter=a.createBiquadFilter();
  this.filter.type='lowpass';this.filter.frequency.value=900;this.filter.Q.value=.38;
  this.filter.connect(this.bus);this.bus.connect(destination);
  const waveforms:OscillatorType[]=['sine','triangle','sine','triangle'];
  for(let i=0;i<this.oscillatorCount;i++){
   const osc=a.createOscillator(),gain=a.createGain();
   osc.type=waveforms[i];osc.frequency.value=MUSIC_SCORE[0][i];
   gain.gain.value=[.46,.21,.13,.07][i];
   osc.connect(gain);gain.connect(this.filter);osc.start();
   this.voices.push(osc);this.envelopes.push(gain);
  }
 }
 setEnabled(enabled:boolean):void{this.enabled=enabled;this.applyGain();}
 setVolume(volume:number):void{this.volume=clamp(volume);this.applyGain();}
 setDucking(ducking:boolean):void{this.ducking=ducking;this.applyGain();}
 private applyGain():void{
  const a=this.context;
  const target=this.lastActive&&this.enabled?this.volume*(this.ducking?.27:1)*.19:0;
  this.bus.gain.setTargetAtTime(target,a.currentTime,.22);
 }
 update(time:number,combat:number,playing:boolean):void {
  if(!Number.isFinite(time))return;
  const active=playing&&this.enabled&&this.volume>0;
  if(active!==this.lastActive){this.lastActive=active;this.applyGain();}
  if(!active)return;
  const beat=Math.floor(Math.max(0,time)/MUSIC_CHORD_SECONDS);
  if(beat!==this.lastChord){
   this.lastChord=beat;
   const chord=musicChordAt(time),now=this.context.currentTime;
   for(let i=0;i<this.voices.length;i++){
    // Very slow pitch changes and soft harmonics, not a loud beat loop.
    this.voices[i].frequency.setTargetAtTime(chord[i],now,.65);
   }
  }
  // Ambient changes colour when fighting escalates. Heavy music competes
  // with effects, so intensity only opens the filter and lifts a fifth.
  this.filter.frequency.setTargetAtTime(570+clamp(combat)*520,
   this.context.currentTime,1.1);
 }
 pause():void{if(this.lastActive){this.lastActive=false;this.applyGain();}}
 dispose():void{
  this.pause();
  for(const osc of this.voices){try{osc.stop();}catch{}osc.disconnect();}
  for(const gain of this.envelopes)gain.disconnect();
  this.filter.disconnect();this.bus.disconnect();
  this.voices=[];this.envelopes=[];
 }
}
