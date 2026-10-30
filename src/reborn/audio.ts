import { clamp, distance, type Point } from './config.js';
import { Renderer } from './renderer.js';
import { Simulation, type Weapon } from './simulation.js';
import {UnitRadio,type PlayerOrder} from './unit-radio.js';
import {unitSpec} from './catalog.js';
import {ENGINE_KINDS,ENGINE_PROFILES,vehicleSoundMix,type EngineKind} from './vehicle-soundscape.js';

interface EngineVoice {
  gain:GainNode;pan:StereoPannerNode;engine:OscillatorNode;harmonic:OscillatorNode;
  noise:GainNode;pulseDepth:GainNode;previousMotion:number;
}

export const WEAPON_SOUNDS:Record<Weapon,{duration:number;level:number;high:number;low:number;bass:number}>={
 rifle:{duration:.11,level:.14,high:950,low:6500,bass:125},
 heavy:{duration:.15,level:.17,high:650,low:4700,bass:90},
 pistol:{duration:.075,level:.095,high:1500,low:7200,bass:180},
 turret:{duration:.17,level:.19,high:380,low:3400,bass:68},
 rocket:{duration:.32,level:.15,high:180,low:1900,bass:62},
 machinegun:{duration:.10,level:.115,high:820,low:5800,bass:106},
 cannon:{duration:.22,level:.17,high:300,low:2800,bass:55},
};
/** Pure visibility-aware levels: distant or unexplored enemy movement never leaks information. */
export function ambientActivity(g:Simulation,center:Point,visible:(p:Point)=>boolean):{motors:number;generator:number}{
 let motors=0,generator=0;
 for(const u of g.units){
  if(u.hp<=0||u.carrier||unitSpec(u).flying||unitSpec(u).group!=='Fahrzeuge'||!visible(u))continue;
  const falloff=Math.max(0,1-distance(u,center)/670);
  motors+=falloff*(u.moving?1:.40);
 }
 for(const b of g.bases){
  if(b.hp<=0||b.buildRemaining>0||!visible(b))continue;
  if(b.kind!=='generator'&&b.kind!=='headquarters'&&b.kind!=='factory')continue;
  const falloff=Math.max(0,1-distance(b,center)/700);
  generator+=falloff*(b.kind==='generator'?1:b.kind==='headquarters'?.5:.65);
 }
 return {motors:clamp(motors,0,2.4),generator:clamp(generator,0,1.8)};
}
/** Local sound design: synthesized effects and a separate pre-authored speech channel. */
export class Soundscape {
  context:AudioContext|null=null;
  analyser:AnalyserNode|null=null;
  enabled=true; volume=.6; ambience=true;
  readonly radio=new UnitRadio(()=>this.enabled&&this.volume>0&&!document.hidden,active=>{if(this.context&&this.effects)this.effects.gain.setTargetAtTime(active?.55:1,this.context.currentTime,.045);});
  readonly played={shots:0,steps:0,commands:0,captures:0,production:0,rifle:0,heavy:0,pistol:0,turret:0,cannon:0,rocket:0,machinegun:0};
  readonly voiceLimit=20;peakVoices=0;droppedVoices=0;
  private voices=new Map<AudioScheduledSourceNode,{stop:()=>void;gameplay:boolean}>();
  get activeVoices():number{return this.voices.size;}
  get activeGameplayVoices():number{let count=0;for(const v of this.voices.values())if(v.gameplay)count++;return count;}
  private master:GainNode|null=null;private effects:GainNode|null=null;private wind:GainNode|null=null;
  private motorGain:GainNode|null=null;private generatorGain:GainNode|null=null;private motorTone:OscillatorNode|null=null;
  private readonly engineVoices=new Map<EngineKind,EngineVoice>();
  private noise:AudioBuffer|null=null;private seenShots=new WeakSet<object>();
  private owners:number[]=[];private unitIds=new Set<number>();private footsteps=new Map<number,number>();
  private game:Simulation|null=null;private lastStep=0;
  async unlock():Promise<void>{
    if(!this.context){
      const a=this.context=new AudioContext();this.master=a.createGain();this.master.gain.value=this.enabled?this.volume:0;
      this.effects=a.createGain();this.effects.connect(this.master);this.radio.attach(a,this.master);
      this.analyser=a.createAnalyser();this.analyser.fftSize=256;const limiter=a.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=8;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.13;this.master.connect(limiter);limiter.connect(this.analyser);this.analyser.connect(a.destination);
      this.noise=a.createBuffer(1,a.sampleRate*3,a.sampleRate);const channel=this.noise.getChannelData(0);let seed=91821;
      for(let i=0;i<channel.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;channel[i]=seed/2147483648-1;}
      const source=a.createBufferSource(),filter=a.createBiquadFilter();source.buffer=this.noise;source.loop=true;
      filter.type='lowpass';filter.frequency.value=500;filter.Q.value=.4;
      const windLevel=a.createGain();windLevel.gain.value=.055;this.wind=a.createGain();this.wind.gain.value=1;
      source.connect(filter);filter.connect(windLevel);windLevel.connect(this.wind);this.wind.connect(this.effects);source.start();
      const lfo=a.createOscillator(),swell=a.createGain();lfo.frequency.value=.08;swell.gain.value=.025;lfo.connect(swell);swell.connect(windLevel.gain);lfo.start();
      // Two perpetually running but silent-by-default filtered oscillators; no per-frame voice allocations.
      const motor=a.createOscillator(),motorLow=a.createBiquadFilter(),motorGain=a.createGain();
      motor.type='sawtooth';motor.frequency.value=55;motorLow.type='lowpass';motorLow.frequency.value=195;motorGain.gain.value=0;
      motor.connect(motorLow);motorLow.connect(motorGain);motorGain.connect(this.effects);motor.start();
      this.motorGain=motorGain;this.motorTone=motor;
      const plant=a.createOscillator(),plantLow=a.createBiquadFilter(),plantGain=a.createGain();
      plant.type='triangle';plant.frequency.value=71;plantLow.type='lowpass';plantLow.frequency.value=145;plantGain.gain.value=0;
      plant.connect(plantLow);plantLow.connect(plantGain);plantGain.connect(this.effects);plant.start();
      this.generatorGain=plantGain;
      // Persistent, silent-by-default voices for each engine family.
      // No new audio nodes per moving unit or frame; five bounded composite voices.
      for(const kind of ENGINE_KINDS){
        const profile=ENGINE_PROFILES[kind];
        const gain=a.createGain(),pan=a.createStereoPanner(),lowpass=a.createBiquadFilter();
        gain.gain.value=0;pan.pan.value=0;lowpass.type='lowpass';lowpass.frequency.value=profile.cutoff;
        lowpass.connect(gain);gain.connect(pan);pan.connect(this.effects);
        const engine=a.createOscillator(),harmonic=a.createOscillator();
        engine.type=profile.type;harmonic.type=profile.secondary;
        engine.frequency.value=profile.low;harmonic.frequency.value=profile.high;
        const overtone=a.createGain();overtone.gain.value=kind==='bomber'?.15:.29;
        engine.connect(lowpass);harmonic.connect(overtone);overtone.connect(lowpass);
        engine.start();harmonic.start();
        const grit=a.createBufferSource(),gritFilter=a.createBiquadFilter(),noise=a.createGain();
        grit.buffer=this.noise;grit.loop=true;gritFilter.type='bandpass';
        gritFilter.frequency.value=profile.noiseHz;gritFilter.Q.value=profile.noiseQ;
        noise.gain.value=profile.texture;
        grit.connect(gritFilter);gritFilter.connect(noise);noise.connect(lowpass);grit.start();
        const pulseDepth=a.createGain();pulseDepth.gain.value=0;
        if(profile.pulse>0){
          const lfo=a.createOscillator();lfo.type='sine';lfo.frequency.value=profile.pulse;
          lfo.connect(pulseDepth);pulseDepth.connect(noise.gain);lfo.start();
        }
        this.engineVoices.set(kind,{gain,pan,engine,harmonic,noise,pulseDepth,previousMotion:0});
      }
    }
    if(this.context.state==='suspended')await this.context.resume();
    this.radio.flush();
  }
  setEnabled(enabled:boolean):void{this.enabled=enabled;if(!enabled){this.silence();this.radio.stop();}this.applyVolume();}
  setVolume(volume:number):void{this.volume=clamp(volume,0,1);if(this.volume===0){this.silence();this.radio.stop();}this.applyVolume();}
  acknowledge(order:PlayerOrder,g:Simulation):void{
    if(g.paused||g.status!=='playing'||!g.units.some(u=>u.id===order.unitId&&u.kind===order.unit&&u.owner===0&&u.hp>0&&!u.carrier))return;
    this.played.commands++;this.radio.request(order.kind,order.unit);
  }
  /** Short attack warning: local system German voice if available, otherwise
   * the radio chirp and visible message remain. No network TTS request. */
  announceAttack():void {
    if(!this.enabled||this.volume<=0||document.hidden)return;
    this.tone(820,.11,.085);this.tone(630,.16,.065,.13);
    if(!this.radio.enabled||this.radio.volume<=0||typeof window==='undefined'||
       !('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return;
    const voices=window.speechSynthesis.getVoices();
    const voice=voices.find(v=>v.lang.toLowerCase().startsWith('de')&&v.localService);
    if(!voice)return; // Fall back to tone + printed alert, never a cloud voice.
    this.radio.stop();
    const utterance=new SpeechSynthesisUtterance('Captain, wir werden angegriffen!');
    utterance.voice=voice;utterance.lang='de-DE';utterance.rate=1.04;utterance.pitch=.88;
    utterance.volume=Math.min(.68,this.volume*this.radio.volume*.92);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
  private lastReadySignal=-Infinity;
  /** Player-only construction/production cue, with no external TTS service.
   * Every completion is logged in the HUD; busy production lines share a short
   * signal rather than interrupting radio or flooding the speaker. */
  announceReady(kind:'building'|'unit'):void {
    const a=this.context;
    if(!a||!this.enabled||this.volume<=0||document.hidden||a.state!=='running')return;
    if(a.currentTime-this.lastReadySignal<2.1)return;
    this.lastReadySignal=a.currentTime;
    if(kind==='building'){
      this.tone(620,.13,.075);this.tone(930,.19,.063,.13);
    }else{
      this.tone(760,.09,.06);this.tone(1050,.14,.05,.10);
    }
    if(!this.radio.enabled||this.radio.volume<=0||this.radio.active>0||
       typeof window==='undefined'||!('speechSynthesis' in window)||
       typeof SpeechSynthesisUtterance==='undefined'||window.speechSynthesis.speaking)return;
    const voice=window.speechSynthesis.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith('de'));
    if(!voice)return;
    const announcement=new SpeechSynthesisUtterance(kind==='building'?'Gebäude fertiggestellt.':'Einheit bereit.');
    announcement.voice=voice;announcement.lang='de-DE';announcement.rate=1.05;
    announcement.pitch=.92;announcement.volume=Math.min(.58,this.volume*this.radio.volume*.8);
    window.speechSynthesis.speak(announcement);
  }
  pause():void{
    this.silence(true);this.radio.pause();
    if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();
  }
  silenceScene():void{
    this.silence();this.radio.stop();
    if(typeof window!=='undefined'&&'speechSynthesis' in window)window.speechSynthesis.cancel();
    if(this.context){
      for(const gain of [this.wind,this.motorGain,this.generatorGain])gain?.gain.setTargetAtTime(0,this.context.currentTime,.025);
      for(const voice of this.engineVoices.values()){voice.gain.gain.setTargetAtTime(0,this.context.currentTime,.035);voice.previousMotion=0;}
    }
  }
  bindGame(g:Simulation):void{
    if(this.game===g)return;this.silence();this.radio.reset();this.lastStep=g.time;this.game=g;this.owners=g.territories.map(t=>t.owner);this.unitIds=new Set(g.units.map(u=>u.id));this.footsteps.clear();this.seenShots=new WeakSet();
  }
  private applyVolume():void{if(this.context&&this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.035);}
  private silence(gameplayOnly=false):void{for(const v of this.voices.values())if(!gameplayOnly||v.gameplay)v.stop();}
  private room():boolean{if(this.voices.size>=this.voiceLimit){this.droppedVoices++;return false;}return true;}
  private track(source:AudioScheduledSourceNode,nodes:AudioNode[],extra:AudioScheduledSourceNode[]=[],gameplay=true):void{
    let ended=false;const stop=()=>{if(ended)return;ended=true;for(const s of [source,...extra]){try{s.stop();}catch{/* Already stopped. */}}for(const n of nodes)n.disconnect();this.voices.delete(source);};
    this.voices.set(source,{stop,gameplay});source.onended=stop;this.peakVoices=Math.max(this.peakVoices,this.voices.size);
  }
  private tone(frequency:number,duration:number,level:number,offset=0):void{
    const a=this.context;if(!a||!this.master||!this.enabled||this.volume<=0||a.state!=='running'||!this.room())return;
    const oscillator=a.createOscillator(),gain=a.createGain(),at=a.currentTime+offset;oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain);gain.connect(this.effects??this.master);this.track(oscillator,[oscillator,gain],[],false);oscillator.start(at);oscillator.stop(at+duration+.01);
  }
  command(attack=false):void{this.played.commands++;this.tone(attack?570:780,.07,.09);this.tone(attack?380:1040,.085,.055,.055);}
  select():void{this.tone(1150,.035,.055);}
  private burst(p:Point,r:Renderer,duration:number,level:number,filterHz:number,type:BiquadFilterType='highpass'):void{
    const a=this.context;if(!a||!this.master||!this.noise||!this.enabled||this.volume<=0||a.state!=='running'||!this.room())return;
    const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),pan=a.createStereoPanner();
    source.buffer=this.noise;filter.type=type;filter.frequency.value=filterHz;
    const screen=r.screen(p),attenuation=clamp(1-distance(p,r.camera)/(Math.max(r.width,r.height)/r.camera.zoom),.15,1);
    pan.pan.value=clamp((screen.x/r.width-.5)*1.5,-.8,.8);
    gain.gain.setValueAtTime(level*attenuation,a.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,a.currentTime+duration);
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.effects??this.master);
    this.track(source,[source,filter,gain,pan]);source.start(a.currentTime,(a.currentTime*.37)%2);source.stop(a.currentTime+duration+.01);
  }
  private weapon(kind:Weapon,p:Point,r:Renderer):boolean{
    const a=this.context;if(!a||!this.master||!this.noise||!this.room())return false;
    const profile=WEAPON_SOUNDS[kind],at=a.currentTime,screen=r.screen(p);
    const attenuation=clamp(1-distance(p,r.camera)/(Math.max(r.width,r.height)/r.camera.zoom),.04,1);
    const source=a.createBufferSource(),high=a.createBiquadFilter(),low=a.createBiquadFilter(),envelope=a.createGain(),pan=a.createStereoPanner();
    source.buffer=this.noise;high.type='highpass';high.frequency.value=profile.high;high.Q.value=.6;low.type='lowpass';low.frequency.value=profile.low;low.Q.value=.5;
    envelope.gain.setValueAtTime(.0001,at);envelope.gain.linearRampToValueAtTime(profile.level*attenuation,at+.0015);envelope.gain.exponentialRampToValueAtTime(.0001,at+profile.duration);
    pan.pan.value=clamp((screen.x/r.width-.5)*1.5,-.85,.85);
    source.connect(high);high.connect(low);low.connect(envelope);envelope.connect(pan);pan.connect(this.effects??this.master);
    // A very short mechanical/body transient sits under the filtered crack, never a pitched laser tail.
    const body=a.createOscillator(),bodyGain=a.createGain();body.type='triangle';body.frequency.setValueAtTime(profile.bass*1.5,at);body.frequency.exponentialRampToValueAtTime(profile.bass*.55,at+.045);
    bodyGain.gain.setValueAtTime(profile.level*.42*attenuation,at);bodyGain.gain.exponentialRampToValueAtTime(.0001,at+profile.duration*.65);body.connect(bodyGain);bodyGain.connect(pan);
    this.track(source,[source,high,low,envelope,pan,body,bodyGain],[body]);source.start(at,((this.played.shots*173)%2000)/1000);source.stop(at+profile.duration+.005);body.start(at);body.stop(at+profile.duration);
    return true;
  }
  update(g:Simulation,r:Renderer):void{
    this.bindGame(g);
    if(this.context){
      const sounding=this.enabled&&this.volume>0&&this.ambience&&!document.hidden&&!g.paused&&g.status==='playing';
      this.wind?.gain.setTargetAtTime(sounding?1+g.weather.intensity*1.25:0,this.context.currentTime,.2);
      const levels=sounding?ambientActivity(g,r.camera,p=>g.canSee(0,p)):{motors:0,generator:0};
      // Old generic engine bed remains extremely quiet; distinctive vehicle layers lead.
      this.motorGain?.gain.setTargetAtTime(levels.motors*.003,this.context.currentTime,.25);
      this.generatorGain?.gain.setTargetAtTime(levels.generator*.015,this.context.currentTime,.35);
      if(this.motorTone)this.motorTone.frequency.setTargetAtTime(53+Math.sin(g.time*1.8)*3+Math.min(8,levels.motors*3),this.context.currentTime,.12);
      const audibleRadius=Math.max(240,Math.min(880,Math.max(r.width,r.height)/r.camera.zoom*.72));
      const mix=sounding?vehicleSoundMix(g,r.camera,p=>g.canSee(0,p),audibleRadius):null;
      for(const kind of ENGINE_KINDS){
        const voice=this.engineVoices.get(kind);if(!voice)continue;
        const profile=ENGINE_PROFILES[kind],state=mix?.[kind];
        const level=state?.level??0,throttle=state?.throttle??0,moving=state?.moving??0;
        const now=this.context.currentTime;
        // The same oscillators spin up on departure and settle at idle when parked.
        // Frequency sweeps give a real ignition/acceleration cue without creating voices.
        const fundamental=profile.low*(1+.52*throttle);
        if(level>.02&&moving>.35&&voice.previousMotion<.08){
          voice.engine.frequency.setValueAtTime(Math.max(22,fundamental*.72),now);
          voice.engine.frequency.exponentialRampToValueAtTime(fundamental*1.09,now+.21);
        }else{
          voice.engine.frequency.setTargetAtTime(fundamental,now,.17);
        }
        voice.harmonic.frequency.setTargetAtTime(profile.high*(1+.34*throttle),now,.21);
        voice.pan.pan.setTargetAtTime(state?.pan??0,now,.20);
        voice.noise.gain.setTargetAtTime(profile.texture*(.5+.65*throttle),now,.24);
        voice.pulseDepth.gain.setTargetAtTime(
          profile.pulse>0?profile.texture*(kind==='tank'?.13:.20)*(.25+.75*throttle):0,now,.26);
        voice.gain.gain.setTargetAtTime(
          level*profile.volume,now,level>voice.gain.gain.value ? .14 : .30);
        voice.previousMotion=level>.02?moving:0;
      }
    }
    const active=this.context?.state==='running'&&this.enabled&&this.volume>0&&!document.hidden&&!g.paused;
    if(document.hidden){this.silence();this.radio.stop();}else if(g.paused)this.pause();
    for(const shot of g.shots)if(!this.seenShots.has(shot)){
      this.seenShots.add(shot);const from=shot.groundFrom??shot.from,to=shot.groundTo??shot.to;
      if(!active||g.time-(shot.at??g.time)>.15||(!g.canSee(0,from)&&!g.canSee(0,to)))continue;
      const p=r.screen(from);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
      const kind=shot.weapon??'rifle';if(this.weapon(kind,from,r)){this.played.shots++;this.played[kind]++;}

    }
    for(const t of g.territories){if(t.owner===0&&this.owners[t.id]!==0&&active){this.played.captures++;this.tone(523,.18,.1);this.tone(659,.2,.08,.12);this.tone(784,.35,.08,.25);}this.owners[t.id]=t.owner;}
    for(const id of this.footsteps.keys())if(!g.units.some(u=>u.id===id)){this.footsteps.delete(id);this.unitIds.delete(id);}
    for(const u of g.units){
      if(!this.unitIds.has(u.id)){this.unitIds.add(u.id);if(u.owner===0&&active){this.played.production++;this.tone(660,.13,.075);this.tone(990,.2,.065,.1);}}
      const walked=this.footsteps.get(u.id)??u.walkDistance;this.footsteps.set(u.id,u.walkDistance);
      if(!active||g.paused||!u.moving||Math.floor(walked/32)===Math.floor(u.walkDistance/32)||!g.canSee(0,u))continue;
      const p=r.screen(u);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height||g.time-this.lastStep<.05)continue;
      this.lastStep=g.time;this.played.steps++;this.burst(u,r,.06,.045,1100,'lowpass');
    }
  }
}
