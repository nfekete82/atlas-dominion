import {clamp} from './config.js';
import type {UnitKind} from './catalog.js';

export type RadioAction='move'|'attack'|'heal'|'repair'|'build'|'load'|'unload'|'stop'|'hold';
export interface PlayerOrder {kind:RadioAction;unit:UnitKind;unitId:number}
export interface RadioClip {id:string;profile:string;group:string;text:string;file:string;duration:number;speaker:string}
export interface RadioManifest {version:1;language:string;clips:RadioClip[]}
const ROOT='/src/assets/reborn/voices/';
const air=(kind:UnitKind)=>['scout','bomber'].includes(kind);
export const radioProfile=(kind:UnitKind):string=>['medic','engineer'].includes(kind)?'support':['heavy','rover','tank','artillery'].includes(kind)?'crew':'soldier';
export function radioChoices(clips:RadioClip[],action:RadioAction,unit:UnitKind):RadioClip[]{
 const profile=radioProfile(unit),bank=clips.filter(c=>c.profile===profile),groups=(...names:string[])=>bank.filter(c=>names.includes(c.group));
 if(action==='stop'||action==='hold')return groups('stop');
 if(unit==='scout'&&(action==='load'||action==='unload'))return action==='load'?groups('load'):bank.filter(c=>c.group==='unload'||c.text==='Landezone bestätigt!');
 if(action==='attack'){const attacks=groups('attack');return attacks.length?attacks:groups('move');}
 if(unit==='medic')return groups('medic');
 if(unit==='engineer')return action==='build'?groups('engineer','build'):action==='repair'?groups('engineer','repair'):groups('engineer');
 if(air(unit))return groups('air');
 if(unit==='heavy')return groups('move').filter(c=>c.text!=='Besatzung bereit!'&&c.text!=='Zielkoordinaten bestätigt!');
 return groups('move');
}
/** One global channel. Priority can replace a less important message; nothing is queued. */
export class RadioPolicy {
 private lastAt=-Infinity;private priority=0;private lastId='';private lastText='';
 constructor(private readonly clips:RadioClip[],private readonly random=()=>Math.random()){}
 reset():void{this.lastAt=-Infinity;this.priority=0;this.lastId='';this.lastText='';}
 choose(action:RadioAction,unit:UnitKind,now:number,busy:boolean):RadioClip|null{
  const priority=action==='stop'||action==='hold'?4:action==='attack'?3:action==='unload'?2:1,elapsed=now-this.lastAt;
  const urgent=priority>this.priority&&elapsed>=.18;
  if((busy&&!urgent)||(elapsed<.95&&!urgent))return null;
  const bank=radioChoices(this.clips,action,unit),fresh=bank.filter(c=>c.id!==this.lastId&&c.text!==this.lastText),pool=fresh.length?fresh:bank.filter(c=>c.id!==this.lastId);
  if(!pool.length)return null;
  const clip=pool[Math.min(pool.length-1,Math.floor(clamp(this.random(),0,.999999)*pool.length))];
  this.lastAt=now;this.priority=priority;this.lastId=clip.id;this.lastText=clip.text;return clip;
 }
}

/** Only pre-authored local PCM files reach this channel; no runtime speech synthesis. */
export class UnitRadio {
 enabled=true;volume=.85;manifest:RadioManifest|null=null;
 readonly stats={started:0,dropped:0,interrupted:0,failed:0,decoded:0};
 lastClip:RadioClip|null=null;private policy:RadioPolicy|null=null;
 private encoded=new Map<string,ArrayBuffer>();private buffers=new Map<string,AudioBuffer>();
 private loading:Promise<void>|null=null;private decoding:Promise<void>|null=null;
 private context:AudioContext|null=null;private output:AudioNode|null=null;
 private current:{source:AudioBufferSourceNode;gain:GainNode;nodes:AudioNode[];preview:boolean}|null=null;
 private pending:{action:RadioAction;unit:UnitKind;until:number;preview:boolean}|null=null;
 get active():number{return this.current?1:0;}
 get loaded():boolean{return this.buffers.size>0&&this.stats.decoded+this.stats.failed>=(this.manifest?.clips.length??Infinity);}
 get ready():Promise<void>{return this.decoding??this.preload();}
 constructor(private readonly allowed:()=>boolean,private readonly onActive:(active:boolean)=>void=()=>{}){}
 preload():Promise<void>{
  return this.loading??=this.load().catch(()=>{this.stats.failed++;});
 }
 private async load():Promise<void>{
  const response=await fetch(ROOT+'manifest.json');if(!response.ok)throw Error('Voice bank missing');
  const manifest=await response.json() as RadioManifest;
  if(manifest.version!==1||!Array.isArray(manifest.clips)||manifest.clips.length>96||manifest.clips.some(c=>!/^[-a-z0-9]+\.wav$/.test(c.file)))throw Error('Invalid voice bank');
  this.manifest=manifest;this.policy=new RadioPolicy(manifest.clips);
  await Promise.all(manifest.clips.map(async clip=>{try{const r=await fetch(ROOT+clip.file);if(!r.ok)throw Error('Clip missing');this.encoded.set(clip.id,await r.arrayBuffer());}catch{this.stats.failed++;}}));
 }
 attach(context:AudioContext,output:AudioNode):void{
  if(this.context===context)return;this.context=context;this.output=output;
  this.decoding=this.preload().then(async()=>{
   await Promise.all([...this.encoded].map(async([id,data])=>{try{this.buffers.set(id,await context.decodeAudioData(data));this.stats.decoded++;}catch{this.stats.failed++;}finally{this.encoded.delete(id);}}));
   this.flush();
  });
 }
 flush():void{
  if(!this.loaded||this.context?.state!=='running')return;const pending=this.pending;this.pending=null;
  if(pending&&performance.now()<=pending.until)this.request(pending.action,pending.unit,pending.preview);
 }
 setEnabled(enabled:boolean):void{this.enabled=enabled;if(!enabled)this.stop();}
 setVolume(volume:number):void{this.volume=clamp(volume,0,1);if(!this.volume)this.stop();else if(this.current&&this.context)this.current.gain.gain.setTargetAtTime(this.volume,this.context.currentTime,.025);}
 request(action:RadioAction,unit:UnitKind,preview=false):boolean{
  const a=this.context;
  if(!this.enabled||!this.volume||!a||!this.output||!this.allowed())return false;
  if(!this.loaded||a.state==='suspended'){this.pending={action,unit,preview,until:performance.now()+350};return false;}
  if(a.state!=='running')return false;
  const clip=this.policy?.choose(action,unit,a.currentTime,!!this.current);
  if(!clip){this.stats.dropped++;return false;}
  const buffer=this.buffers.get(clip.id);if(!buffer)return false;
  if(this.current){this.stats.interrupted++;this.stopCurrent();}
  const source=a.createBufferSource(),gain=a.createGain(),nodes:AudioNode[]=[source,gain];source.buffer=buffer;gain.gain.value=this.volume;
  if(air(unit)){const high=a.createBiquadFilter(),low=a.createBiquadFilter();high.type='highpass';high.frequency.value=260;low.type='lowpass';low.frequency.value=3700;source.connect(high);high.connect(low);low.connect(gain);nodes.push(high,low);}else source.connect(gain);
  gain.connect(this.output);const current=this.current={source,gain,nodes,preview};
  source.onended=()=>{for(const n of nodes)n.disconnect();if(this.current===current){this.current=null;this.onActive(false);}};
  this.lastClip=clip;this.stats.started++;this.onActive(true);source.start();return true;
 }
 private stopCurrent():void{
  const current=this.current;if(!current)return;this.current=null;current.source.onended=null;
  try{current.source.stop();}catch{/* Already ended. */}for(const n of current.nodes)n.disconnect();this.onActive(false);
 }
 stop():void{this.pending=null;this.stopCurrent();}
 pause():void{if(this.pending&&!this.pending.preview)this.pending=null;if(this.current&&!this.current.preview)this.stopCurrent();}
 reset():void{this.stop();this.policy?.reset();this.lastClip=null;}
}
