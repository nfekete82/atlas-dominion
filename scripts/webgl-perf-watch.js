/** Lightweight opt-in combat profiling for WebGL preview.
 * Keeps only rolling numeric arrays; never changes simulation or graphics.
 * Enable with ?perf=1. The stats object is available as
 * window.__sandforgeWebGL.performance.snapshot().
 */
export class SandforgePerformanceWatch{
 constructor({game,renderer,effects,groundTracks}){
  Object.assign(this,{game,renderer,effects,groundTracks});
  this.enabled=new URLSearchParams(location.search).get('perf')==='1';
  this.samples=new Float32Array(180);
  this.simSamples=new Float32Array(180);
  this.cursor=0;this.length=0;this.lastRender=performance.now();
  this.lastReport=0;this.simMs=0;this.lastSnapshot=null;
  if(this.enabled){
   const element=document.createElement('pre');
   element.id='sf-webgl-performance';
   element.setAttribute('role','status');
   element.style.cssText='position:fixed;right:12px;top:62px;z-index:40;pointer-events:none;background:#050e12de;color:#a6f2d4;border:1px solid #496b68;padding:7px 10px;font:11px/1.35 monospace;white-space:pre;min-width:210px';
   document.body.append(element);this.element=element;
  }
 }
 begin(now){
  if(!this.enabled)return;
  this.started=performance.now();
  this.frameInterval=now-this.lastRender;this.lastRender=now;
 }
 simulation(ms){if(this.enabled)this.simMs=ms;}
 end(now){
  if(!this.enabled)return;
  this.samples[this.cursor]=this.frameInterval;
  this.simSamples[this.cursor]=this.simMs;
  this.cursor=(this.cursor+1)%this.samples.length;
  this.length=Math.min(this.length+1,this.samples.length);
  if(now-this.lastReport<1000)return;
  this.lastReport=now;const report=this.snapshot();
  this.lastSnapshot=report;
  this.element.textContent=
   'FPS '+report.fps.toFixed(0)+' / 1% '+report.lowFps.toFixed(0)+
   '\\nFrame p95 '+report.frameP95.toFixed(1)+'ms · Sim p95 '+report.simP95.toFixed(1)+'ms'+
   '\\nDraw calls '+report.drawCalls+' · Triangles '+report.triangles+
   '\\nUnits '+report.units+' · Particles '+report.particles+
   '\\nTrails '+report.tracks+' · Effects '+report.emitters+
   '\\nGPU geometries '+report.geometries+' / textures '+report.textures;
 }
 snapshot(){
  const frames=Array.from(this.samples.subarray(0,this.length)).sort((a,b)=>a-b);
  const sim=Array.from(this.simSamples.subarray(0,this.length)).sort((a,b)=>a-b);
  const p=(v,part)=>v[Math.max(0,Math.ceil(v.length*part)-1)]||0;
  const mean=frames.reduce((a,b)=>a+b,0)/Math.max(1,frames.length);
  const slow=frames.slice(-Math.max(1,Math.ceil(frames.length*.01)));
  const low=slow.reduce((a,b)=>a+b,0)/Math.max(1,slow.length);
  const info=this.renderer.info;
  return {
   fps:mean>0?1000/mean:0,lowFps:low>0?1000/low:0,
   frameP95:p(frames,.95),simP95:p(sim,.95),
   drawCalls:info.render.calls,triangles:info.render.triangles,
   geometries:info.memory.geometries,textures:info.memory.textures,
   units:this.game.units.filter(u=>u.hp>0&&!u.carrier).length,
   particles:this.effects.particleCount,
   tracks:this.groundTracks.activeTracks,
   emitters:this.effects.emitters.length,
   blasts:this.effects.stats.blasts,wrecks:this.effects.stats.wrecks
  };
 }
}
