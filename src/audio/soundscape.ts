/** Original, asset-free ambient score and restrained tactical sound design.
 * Web Audio is constructed only after a user gesture. No network, downloads,
 * prerecorded tracks, or simulation RNG. Settings are deliberately separate
 * from the deterministic savegame.
 */
export interface AudioSettings {
  music:boolean;
  effects:boolean;
  master:number;
  musicVolume:number;
  effectsVolume:number;
}
export type SoundEvent='attack'|'conquest'|'alert'|'build'|'alliance'|
  'retreat'|'reinforce'|'victory'|'defeat'|'ui';
export const AUDIO_SETTINGS_KEY='atlas-dominion-audio-v1';
export const DEFAULT_AUDIO_SETTINGS:AudioSettings={
  music:false,effects:true,master:65,musicVolume:22,effectsVolume:38,
};
const clampVolume=(value:unknown,fallback:number):number=>
  typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):fallback;

export function normalizeAudioSettings(input:unknown):AudioSettings {
  const object=input&&typeof input==='object'?input as Record<string,unknown>:{};
  return {
    music:typeof object.music==='boolean'?object.music:DEFAULT_AUDIO_SETTINGS.music,
    effects:typeof object.effects==='boolean'?object.effects:DEFAULT_AUDIO_SETTINGS.effects,
    master:clampVolume(object.master,DEFAULT_AUDIO_SETTINGS.master),
    musicVolume:clampVolume(object.musicVolume,DEFAULT_AUDIO_SETTINGS.musicVolume),
    effectsVolume:clampVolume(object.effectsVolume,DEFAULT_AUDIO_SETTINGS.effectsVolume),
  };
}

/** Pure envelope/preset data can be verified without a browser AudioContext. */
export interface SoundNote {freq:number;duration:number;delay:number;gain:number;type:OscillatorType}
export function soundNotes(kind:SoundEvent):SoundNote[] {
  const tone=(freq:number,duration:number,delay=0,gain=.7,type:OscillatorType='sine'):SoundNote=>
    ({freq,duration,delay,gain,type});
  switch(kind){
    case 'attack':return [tone(180,.15,0,.65,'triangle'),tone(270,.19,.095,.5,'triangle')];
    case 'conquest':return [tone(392,.19,0,.58),tone(523.25,.26,.11,.45),tone(659.25,.38,.22,.30)];
    case 'alert':return [tone(220,.18,0,.70,'triangle'),tone(185,.25,.20,.55,'triangle')];
    case 'build':return [tone(440,.11,0,.35),tone(659.25,.26,.075,.35)];
    case 'alliance':return [tone(349.23,.19,0,.38),tone(440,.20,.14,.40),tone(523.25,.34,.27,.29)];
    case 'retreat':return [tone(320,.18,0,.45,'triangle'),tone(240,.25,.13,.32,'triangle')];
    case 'reinforce':return [tone(260,.13,0,.35,'triangle'),tone(390,.21,.09,.43,'triangle')];
    case 'victory':return [tone(392,.30,0,.50),tone(523.25,.35,.20,.46),tone(659.25,.52,.41,.44)];
    case 'defeat':return [tone(246.94,.33,0,.36,'triangle'),tone(196,.50,.19,.35,'triangle')];
    case 'ui':return [tone(540,.07,0,.24)];
  }
}

export class Soundscape {
  settings:AudioSettings;
  private context:AudioContext|null=null;
  private masterBus:GainNode|null=null;
  private musicBus:GainNode|null=null;
  private effectsBus:GainNode|null=null;
  private ticker:number|null=null;
  private nextChordAt=0;
  private chordIndex=0;
  private active=false;
  /** Whether the player explicitly permitted starting music in this session. */
  private musicGesture=false;
  constructor(settings:unknown){this.settings=normalizeAudioSettings(settings);}

  snapshot():AudioSettings{return {...this.settings};}
  debug():{contextCreated:boolean;musicPlaying:boolean;musicGesture:boolean}{
    return {contextCreated:this.context!==null,musicPlaying:this.ticker!==null,musicGesture:this.musicGesture};
  }
  update(patch:Partial<AudioSettings>,fromGesture=false):void {
    this.settings=normalizeAudioSettings({...this.settings,...patch});
    if(fromGesture){
      this.musicGesture=true;
      this.unlock();
    }
    this.applyVolumes();
    this.syncMusic();
  }
  /** Trigger only from actual player-initiated UI actions, not on page load. */
  unlock():void {
    try{
      if(!this.context){
        this.context=new AudioContext();
        this.masterBus=this.context.createGain();
        this.musicBus=this.context.createGain();
        this.effectsBus=this.context.createGain();
        this.musicBus.connect(this.masterBus);
        this.effectsBus.connect(this.masterBus);
        this.masterBus.connect(this.context.destination);
      }
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
      this.active=true;this.applyVolumes();this.syncMusic();
    }catch{
      this.active=false;
    }
  }
  private applyVolumes():void {
    if(!this.context||!this.masterBus||!this.musicBus||!this.effectsBus)return;
    const now=this.context.currentTime;
    this.masterBus.gain.setTargetAtTime(this.settings.master/100*.65,now,.08);
    this.musicBus.gain.setTargetAtTime(this.settings.music&&this.musicGesture?
      this.settings.musicVolume/100*.22:0,now,.16);
    this.effectsBus.gain.setTargetAtTime(this.settings.effects?
      this.settings.effectsVolume/100*.33:0,now,.04);
  }
  private voice(bus:AudioNode,frequency:number,start:number,duration:number,volume:number,
    type:OscillatorType,attack=.014,release=.09):void {
    if(!this.context||duration<=0)return;
    const ctx=this.context;
    const oscillator=ctx.createOscillator(),envelope=ctx.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);
    envelope.gain.setValueAtTime(.00001,start);
    envelope.gain.linearRampToValueAtTime(Math.max(.00002,volume),start+attack);
    envelope.gain.setTargetAtTime(.00001,start+Math.max(attack,duration-release),
      Math.max(.018,release/3));
    oscillator.connect(envelope);envelope.connect(bus);
    oscillator.start(start);
    oscillator.stop(start+duration+.04);
    oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
  }
  playEffect(kind:SoundEvent):void {
    if(!this.settings.effects||!this.active||!this.context||!this.effectsBus)return;
    const now=this.context.currentTime+.009;
    for(const note of soundNotes(kind))
      this.voice(this.effectsBus,note.freq,now+note.delay,note.duration,note.gain,
        note.type,.012,.10);
  }
  /** Backward-compatible note used by existing small UI interaction cues. */
  beep(freq=440,duration=.08):void {
    if(!this.settings.effects||!this.active||!this.context||!this.effectsBus)return;
    this.voice(this.effectsBus,freq,this.context.currentTime+.008,duration,.28,'triangle');
  }
  private syncMusic():void {
    const shouldPlay=this.active&&this.musicGesture&&this.settings.music&&
      this.settings.master>0&&this.settings.musicVolume>0;
    if(!shouldPlay){
      if(this.ticker!==null){clearInterval(this.ticker);this.ticker=null;}
      this.nextChordAt=0;
      return;
    }
    if(this.ticker!==null)return;
    this.chordIndex=0;this.nextChordAt=0;
    this.scheduleMusic();
    this.ticker=window.setInterval(()=>this.scheduleMusic(),900);
  }
  private scheduleMusic():void {
    if(!this.context||!this.musicBus||!this.settings.music)return;
    const ctx=this.context;
    if(ctx.state==='suspended')return;
    const progression=[
      [110,130.81,164.81], // Am
      [87.31,110,130.81],  // F
      [73.42,110,146.83],  // Dm
      [98,123.47,146.83],  // G
    ];
    if(this.nextChordAt<ctx.currentTime)this.nextChordAt=ctx.currentTime+.1;
    // Schedule only one chord ahead: background tabs never accumulate voices.
    if(this.nextChordAt>ctx.currentTime+7.5)return;
    const t=this.nextChordAt;
    const chord=progression[this.chordIndex%progression.length];
    for(let n=0;n<chord.length;n++){
      // Slow pads: softly overlapping sine/triangle over the ocean and battles.
      this.voice(this.musicBus,chord[n],t,8.0,n===0?.43:.25,
        n===0?'triangle':'sine',1.6,1.7);
    }
    // Occasional sparse glockenspiel highlight, mixed below the main pad.
    if(this.chordIndex%2===0)
      this.voice(this.musicBus,chord[2]*2,t+3.2,1.5,.075,'sine',.035,.55);
    this.chordIndex++;this.nextChordAt=t+7.2;
  }
  /** Stop on navigation; audio state persists independently in localStorage. */
  dispose():void {
    if(this.ticker!==null){clearInterval(this.ticker);this.ticker=null;}
    this.active=false;
    if(this.context)void this.context.close().catch(()=>{});
    this.context=null;this.musicBus=null;this.effectsBus=null;this.masterBus=null;
  }
}
