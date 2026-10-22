import { clamp, distance, type Point } from './config.js';
import { Renderer } from './renderer.js';
import { Simulation } from './simulation.js';

/** Local sound design: filtered noise, layered weapon transients and radio tones. */
export class Soundscape {
  context:AudioContext|null=null;
  analyser:AnalyserNode|null=null;
  enabled=true; volume=.6; ambience=true;
  readonly played={shots:0,steps:0,commands:0,captures:0,production:0};
  private master:GainNode|null=null;private wind:GainNode|null=null;
  private noise:AudioBuffer|null=null;private seenShots=new WeakSet<object>();
  private owners:number[]=[];private unitIds=new Set<number>();private footsteps=new Map<number,number>();
  private game:Simulation|null=null;private lastStep=0;private alertAt=0;
  async unlock():Promise<void>{
    if(!this.context){
      const a=this.context=new AudioContext();this.master=a.createGain();this.master.gain.value=this.enabled?this.volume:0;
      this.analyser=a.createAnalyser();this.analyser.fftSize=256;this.master.connect(this.analyser);this.analyser.connect(a.destination);
      this.noise=a.createBuffer(1,a.sampleRate*3,a.sampleRate);const channel=this.noise.getChannelData(0);let seed=91821;
      for(let i=0;i<channel.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;channel[i]=seed/2147483648-1;}
      const source=a.createBufferSource(),filter=a.createBiquadFilter();source.buffer=this.noise;source.loop=true;
      filter.type='lowpass';filter.frequency.value=500;filter.Q.value=.4;
      const windLevel=a.createGain();windLevel.gain.value=.055;this.wind=a.createGain();this.wind.gain.value=1;
      source.connect(filter);filter.connect(windLevel);windLevel.connect(this.wind);this.wind.connect(this.master);source.start();
      const lfo=a.createOscillator(),swell=a.createGain();lfo.frequency.value=.08;swell.gain.value=.025;lfo.connect(swell);swell.connect(windLevel.gain);lfo.start();
    }
    if(this.context.state==='suspended')await this.context.resume();
  }
  setEnabled(enabled:boolean):void{this.enabled=enabled;this.applyVolume();}
  setVolume(volume:number):void{this.volume=clamp(volume,0,1);this.applyVolume();}
  private applyVolume():void{if(this.context&&this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.035);}
  private tone(frequency:number,duration:number,level:number,offset=0):void{
    const a=this.context;if(!a||!this.master||!this.enabled||a.state!=='running')return;
    const oscillator=a.createOscillator(),gain=a.createGain(),at=a.currentTime+offset;oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(level,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain);gain.connect(this.master);oscillator.start(at);oscillator.stop(at+duration+.01);
  }
  command(attack=false):void{this.played.commands++;this.tone(attack?570:780,.07,.09);this.tone(attack?380:1040,.085,.055,.055);}
  select():void{this.tone(1150,.035,.055);}
  private burst(p:Point,r:Renderer,duration:number,level:number,filterHz:number,type:BiquadFilterType='highpass'):void{
    const a=this.context;if(!a||!this.master||!this.noise||!this.enabled||a.state!=='running')return;
    const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain(),pan=a.createStereoPanner();
    source.buffer=this.noise;filter.type=type;filter.frequency.value=filterHz;
    const screen=r.screen(p),attenuation=clamp(1-distance(p,r.camera)/(Math.max(r.width,r.height)/r.camera.zoom),.15,1);
    pan.pan.value=clamp((screen.x/r.width-.5)*1.5,-.8,.8);
    gain.gain.setValueAtTime(level*attenuation,a.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,a.currentTime+duration);
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.master);
    source.start(a.currentTime,(a.currentTime*.37)%2);source.stop(a.currentTime+duration+.01);
  }
  update(g:Simulation,r:Renderer):void{
    if(this.game!==g){this.game=g;this.owners=g.territories.map(t=>t.owner);this.unitIds=new Set(g.units.map(u=>u.id));this.footsteps.clear();this.seenShots=new WeakSet();}
    if(this.context&&this.wind)this.wind.gain.setTargetAtTime(this.ambience&&!document.hidden&&!g.paused ? 1 : 0,this.context.currentTime,.2);
    const active=this.context?.state==='running'&&this.enabled&&!document.hidden;
    for(const shot of g.shots)if(!this.seenShots.has(shot)){
      this.seenShots.add(shot);if(!active||(!g.canSee(0,shot.from)&&!g.canSee(0,shot.to)))continue;
      const p=r.screen(shot.from);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height)continue;
      this.played.shots++;this.burst(shot.from,r,.095,.36,1900);this.tone(95,.09,.13);
      if(shot.owner===1&&g.time>this.alertAt){this.alertAt=g.time+8;this.tone(410,.12,.05,.13);this.tone(360,.12,.05,.28);}
    }
    for(const t of g.territories){if(t.owner===0&&this.owners[t.id]!==0&&active){this.played.captures++;this.tone(523,.18,.1);this.tone(659,.2,.08,.12);this.tone(784,.35,.08,.25);}this.owners[t.id]=t.owner;}
    for(const u of g.units){
      if(!this.unitIds.has(u.id)){this.unitIds.add(u.id);if(u.owner===0&&active){this.played.production++;this.tone(660,.13,.075);this.tone(990,.2,.065,.1);}}
      const walked=this.footsteps.get(u.id)??u.walkDistance;this.footsteps.set(u.id,u.walkDistance);
      if(!active||g.paused||!u.moving||Math.floor(walked/32)===Math.floor(u.walkDistance/32)||!g.canSee(0,u))continue;
      const p=r.screen(u);if(p.x<0||p.y<0||p.x>r.width||p.y>r.height||g.time-this.lastStep<.05)continue;
      this.lastStep=g.time;this.played.steps++;this.burst(u,r,.06,.045,1100,'lowpass');
    }
  }
}
