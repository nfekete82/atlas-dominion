/** Sandforge user-supplied two-minute cinematic music track.
 * One HTMLAudioElement is streamed/decoded by the browser, not into a huge
 * AudioBuffer or dozens of oscillators. Its own WebAudio gain bus controls
 * volume and radio ducking without touching shots or announcement volumes.
 * A local MP3 is installed at this path by scripts/install-sandforge-music.sh.
 */
export const SANDFORGE_SOUNDTRACK_URL='/src/assets/reborn/music/sandforge-theme.mp3';
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export const soundtrackGain=(volume:number,ducked:boolean,combat:number)=>
 clamp(volume)*.34*(ducked?.30:1-Math.min(1,Math.max(0,combat))*.20);

export class RecordedSoundtrack {
 private readonly bus:GainNode;
 private readonly audio:HTMLAudioElement|null;
 private readonly source:MediaElementAudioSourceNode|null;
 private ducked=false;
 private combat=0;
 private playing=false;
 private unavailable=false;
 private retryAt=0;
 enabled=true;
 volume=.22;
 constructor(private readonly context:AudioContext,destination:AudioNode){
  this.bus=context.createGain();
  this.bus.gain.value=0;
  this.bus.connect(destination);
  if(typeof Audio==='undefined'){
   this.audio=null;this.source=null;this.unavailable=true;return;
  }
  const audio=this.audio=new Audio();
  audio.src=SANDFORGE_SOUNDTRACK_URL;
  audio.preload='metadata';
  audio.loop=true;
  audio.volume=1; // individual loudness is controlled exclusively by WebAudio
  audio.addEventListener('error',()=>{
   this.unavailable=true;
   this.pause();
   console.warn('Sandforge soundtrack MP3 fehlt unter',SANDFORGE_SOUNDTRACK_URL);
  });
  this.source=context.createMediaElementSource(audio);
  this.source.connect(this.bus);
 }
 get missing():boolean{return this.unavailable;}
 get currentTime():number{return this.audio?.currentTime??0;}
 get isPlaying():boolean{return Boolean(this.audio&&!this.audio.paused);}
 setEnabled(value:boolean):void{
  this.enabled=Boolean(value);
  if(!this.enabled)this.pause();
  else if(this.playing)this.start();
  this.applyGain();
 }
 setVolume(volume:number):void{
  this.volume=clamp(volume);
  if(this.volume<=0)this.pause();
  else if(this.playing&&this.enabled)this.start();
  this.applyGain();
 }
 setDucking(ducked:boolean):void{this.ducked=Boolean(ducked);this.applyGain();}
 private applyGain():void{
  const target=this.playing&&this.enabled&&this.volume>0&&!this.unavailable
   ?soundtrackGain(this.volume,this.ducked,this.combat):0;
  this.bus.gain.setTargetAtTime(target,this.context.currentTime,.25);
 }
 /** Call on the player's first pointer/keyboard action for autoplay policy. */
 start():void{
  if(!this.audio||this.unavailable||!this.enabled||this.volume<=0)return;
  if(!this.audio.paused)return;
  // The update loop does not repeatedly issue rejected play promises.
  if(this.context.currentTime<this.retryAt)return;
  this.retryAt=this.context.currentTime+3;
  void this.audio.play().catch(error=>{
   if(error?.name==='AbortError')return; // pause during pending play()
   if(error?.name!=='NotAllowedError')
    console.warn('Sandforge Musik konnte nicht gestartet werden',error);
  });
 }
 update(_time:number,combat:number,playing:boolean):void{
  this.combat=clamp(combat);
  const active=playing&&this.enabled&&this.volume>0&&!this.unavailable;
  if(active!==this.playing){
   this.playing=active;
   if(active)this.start();
   else this.audio?.pause();
  }else if(active&&this.audio?.paused){
   this.start();
  }
  this.applyGain();
 }
 pause():void{
  this.playing=false;
  this.audio?.pause();
  this.applyGain();
 }
 dispose():void{
  this.pause();
  if(this.audio){this.audio.removeAttribute('src');this.audio.load();}
  this.source?.disconnect();
  this.bus.disconnect();
 }
}
