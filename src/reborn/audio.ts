import { clamp, distance, type Point } from './config.js';
import { Renderer } from './renderer.js';
import { Simulation, type Weapon } from './simulation.js';
import {UnitRadio,type PlayerOrder} from './unit-radio.js';

export const WEAPON_SOUNDS:Record<Weapon,{duration:number;level:number;high:number;low:number;bass:number}>={
 rifle:{duration:.11,level:.14,high:950,low:6500,bass:125},
 heavy:{duration:.15,level:.17,high:650,low:4700,bass:90},
 pistol:{duration:.075,level:.095,high:1500,low:7200,bass:180},
 turret:{duration:.17,level:.19,high:380,low:3400,bass:68},
 rocket:{duration:.32,level:.15,high:180,low:1900,bass:62},
 machinegun:{duration:.10,level:.115,high:820,low:5800,bass:106},
 cannon:{duration:.22,level:.17,high:300,low:2800,bass:55},
};
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
  pause():void{this.silence(true);this.radio.pause();}
  silenceScene():void{this.silence();this.radio.stop();if(this.context&&this.wind)this.wind.gain.setTargetAtTime(0,this.context.currentTime,.025);}
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
    if(this.context&&this.wind)this.wind.gain.setTargetAtTime(this.ambience&&!document.hidden&&!g.paused&&g.status==='playing' ? 1+g.weather.intensity*1.25 : 0,this.context.currentTime,.2);
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
