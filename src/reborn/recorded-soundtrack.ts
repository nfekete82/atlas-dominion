/** Sandforge soundtrack playlist with the user's supplied original MP3s.
 * One HTMLAudioElement is streamed/decoded by the browser, not into a huge
 * AudioBuffer or dozens of oscillators. Its own WebAudio gain bus controls
 * volume and radio ducking without touching shots or announcement volumes.
 * Additional original MP3s are installed without overwriting the theme.
 */
export const SANDFORGE_SOUNDTRACK_URL='/src/assets/reborn/music/sandforge-theme.mp3';
export const SANDFORGE_AMBIENT_URL='/src/assets/reborn/music/sandforge-ambient-patrol.mp3';
export const SANDFORGE_SOUNDTRACK_URLS=Object.freeze([
 SANDFORGE_SOUNDTRACK_URL,SANDFORGE_AMBIENT_URL
] as const);
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
 private trackIndex=0;
 private readonly missingTracks=new Set<number>();
 private retryAt=0;
 private pendingPlay=false;
 private lastGain=-1;
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
  audio.src=SANDFORGE_SOUNDTRACK_URLS[0];
  audio.preload='metadata';
  audio.loop=false; // the ended event advances to the next user-supplied track
  audio.volume=1; // individual loudness is controlled exclusively by WebAudio
  audio.addEventListener('ended',()=>this.advanceTrack());
  audio.addEventListener('error',()=>{
   this.missingTracks.add(this.trackIndex);
   console.warn('Sandforge Musikdatei nicht verfügbar:',SANDFORGE_SOUNDTRACK_URLS[this.trackIndex]);
   if(this.missingTracks.size>=SANDFORGE_SOUNDTRACK_URLS.length){
    this.unavailable=true;this.pause();
   }else this.advanceTrack();
  });
  this.source=context.createMediaElementSource(audio);
  this.source.connect(this.bus);
 }
 /** URL of the selected recording; useful for diagnostics and tests. */
 get trackUrl():string{return SANDFORGE_SOUNDTRACK_URLS[this.trackIndex];}
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
  // Do not schedule identical AudioParam automations at 60 FPS for hours.
  // Changes happen only on combat intensity/voice/slider/pause transitions.
  if(Math.abs(target-this.lastGain)<.0001)return;
  this.lastGain=target;
  this.bus.gain.setTargetAtTime(target,this.context.currentTime,.25);
 }
 /** Rotate existing recordings without allocating additional media elements.
  * Missing optional tracks are skipped; the old theme continues normally.
  * A pause never advances the playlist or resets the playback position.
  */
 private advanceTrack():void{
  if(!this.audio||this.unavailable)return;
  let next=this.trackIndex;
  for(let i=0;i<SANDFORGE_SOUNDTRACK_URLS.length;i++){
   next=(next+1)%SANDFORGE_SOUNDTRACK_URLS.length;
   if(!this.missingTracks.has(next))break;
  }
  if(this.missingTracks.has(next)){this.unavailable=true;this.pause();return;}
  this.trackIndex=next;
  this.pendingPlay=false;
  this.retryAt=0;
  this.audio.src=SANDFORGE_SOUNDTRACK_URLS[next];
  this.audio.load();
  if(this.playing&&this.enabled&&this.volume>0)this.start();
 }
 /** Call on the player's first pointer/keyboard action for autoplay policy. */
 start():void{
  if(!this.audio||this.unavailable||!this.enabled||this.volume<=0)return;
  if(!this.audio.paused)return;
  // The update loop does not repeatedly issue rejected play promises.
  if(this.pendingPlay||this.context.currentTime<this.retryAt)return;
  this.pendingPlay=true;
  void this.audio.play().then(()=>{
   this.pendingPlay=false;this.retryAt=0;
  }).catch(error=>{
   this.pendingPlay=false;
   if(error?.name==='AbortError')return; // pause or next track while play() is pending
   if(error?.name==='NotSupportedError'){
    this.missingTracks.add(this.trackIndex);
    if(this.missingTracks.size>=SANDFORGE_SOUNDTRACK_URLS.length){
     this.unavailable=true;this.pause();
    }else this.advanceTrack();
    return;
   }
   this.retryAt=this.context.currentTime+3;
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
