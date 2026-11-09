/** Lightweight opt-in combat profiling for WebGL preview.
 * Keeps only rolling numeric arrays; never changes simulation or graphics.
 * Enable with ?perf=1. The stats object is available as
 * window.__sandforgeWebGL.performance.snapshot().
 */
export class SandforgePerformanceWatch{
 constructor({game,renderer,effects,groundTracks,battlefield=null}){
  Object.assign(this,{game,renderer,effects,groundTracks,battlefield});
  this.enabled=new URLSearchParams(location.search).get('perf')==='1';
  this.samples=new Float32Array(180);
  this.simSamples=new Float32Array(180);
  this.syncSamples=new Float32Array(180);
  this.renderSamples=new Float32Array(180);
  this.auxSamples=new Float32Array(180);
  this.effectsSamples=new Float32Array(180);
  // Collect only actual vision passes, not zero-duration idle RAF frames.
  this.visionSamples=new Float32Array(180);
  this.visionCursor=0;this.visionLength=0;this.lastObservedVisionAt=-1;
  this.cursor=0;this.length=0;this.lastRender=performance.now();
  this.lastReport=0;this.simMs=0;this.syncMs=0;this.renderMs=0;this.lastSnapshot=null;
  this.checkpoints=[];this.lastCheckpoint=0;
  // Keep only recent numeric measurements. Never retain scene nodes,
  // entities, canvases, or screenshots in the diagnostics ring.
  this.hitches=[];this.lastObservedAiPlanAt=-1;this.maxAiPlanMs=0;
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
  this.simMs=0;this.syncMs=0;this.renderMs=0;this.auxMs=0;this.effectsMs=0;
  this.frameInterval=now-this.lastRender;this.lastRender=now;
 }
 simulation(ms){if(this.enabled)this.simMs=ms;}
 presentation(ms){if(this.enabled)this.syncMs=ms;}
 render(ms){if(this.enabled)this.renderMs=ms;}
 auxiliary(ms){if(this.enabled)this.auxMs=ms;}
 effectsCost(ms){if(this.enabled)this.effectsMs=ms;}
 end(now){
  if(!this.enabled)return;
  this.samples[this.cursor]=this.frameInterval;
  this.simSamples[this.cursor]=this.simMs;
  this.syncSamples[this.cursor]=this.syncMs;
  this.renderSamples[this.cursor]=this.renderMs;
  this.auxSamples[this.cursor]=this.auxMs;
  this.effectsSamples[this.cursor]=this.effectsMs;
  this.cursor=(this.cursor+1)%this.samples.length;
  this.length=Math.min(this.length+1,this.samples.length);
  const workMs=performance.now()-this.started;
  const aiAt=this.game.aiPlanCompletedAt??-1;
  const aiRan=aiAt>=0&&aiAt!==this.lastObservedAiPlanAt;
  if(aiRan){
   this.lastObservedAiPlanAt=aiAt;
   this.maxAiPlanMs=Math.max(this.maxAiPlanMs,this.game.aiPlanDurationMs??0);
  }
  const visionAt=this.game.visionCompletedAt??-1;
  const visionRan=visionAt>=0&&visionAt!==this.lastObservedVisionAt;
  if(visionRan){
   this.lastObservedVisionAt=visionAt;
   this.visionSamples[this.visionCursor]=this.game.visionDurationMs??0;
   this.visionCursor=(this.visionCursor+1)%this.visionSamples.length;
   this.visionLength=Math.min(this.visionLength+1,this.visionSamples.length);
  }
  if(workMs>=30||this.frameInterval>=50){
   this.hitches.push({
    gameTime:Math.round(this.game.time*10)/10,
    frameMs:Math.round(this.frameInterval*10)/10,
    workMs:Math.round(workMs*10)/10,
    simulationMs:Math.round(this.simMs*10)/10,
    presentationMs:Math.round(this.syncMs*10)/10,
    auxiliaryMs:Math.round(this.auxMs*10)/10,
    effectsMs:Math.round(this.effectsMs*10)/10,
    renderMs:Math.round(this.renderMs*10)/10,
    aiPlanMs:aiRan?Math.round((this.game.aiPlanDurationMs??0)*10)/10:0,
    visionMs:visionRan?Math.round((this.game.visionDurationMs??0)*10)/10:0
   });
   if(this.hitches.length>32)this.hitches.shift();
  }
  if(now-this.lastReport<1000)return;
  this.lastReport=now;const report=this.snapshot();
  this.lastSnapshot=report;
  // Fixed-size, opt-in 15-game-second checkpoints expose the late-match
  // deterioration that a 180-frame rolling FPS panel cannot diagnose.
  // Use history() at 60, 180, 300, 360 s; never retain scene/actor objects.
  if(report.clock<this.lastCheckpoint-1){
   this.checkpoints.length=0;this.lastCheckpoint=0;
  }
  if(report.clock>=this.lastCheckpoint+15){
   this.lastCheckpoint=report.clock;
   this.checkpoints.push(report);
   if(this.checkpoints.length>64)this.checkpoints.shift();
  }
  this.element.textContent=
   'FPS '+report.fps.toFixed(0)+' / 1% '+report.lowFps.toFixed(0)+
   '\nSim-Zeit '+report.clock.toFixed(1)+' s · '+report.gameStatus+
   '\nFrame p95 '+report.frameP95.toFixed(1)+'ms · Sim p95 '+report.simP95.toFixed(1)+'ms'+
   '\nUI/3D Sync p95 '+report.syncP95.toFixed(1)+'ms · Render CPU p95 '+report.renderP95.toFixed(1)+'ms'+
   '\nNebenarbeiten p95 '+report.auxP95.toFixed(1)+'ms · Effekte '+report.effectsP95.toFixed(1)+'ms'+
   '\nSichtberechnung p95 '+report.visionP95.toFixed(1)+'ms · Max '+report.maxVisionMs.toFixed(1)+'ms'+\n   '\nKI-Planung zuletzt '+report.lastAiPlanMs.toFixed(1)+'ms · Max '+report.maxAiPlanMs.toFixed(1)+'ms'+
   '\nHänger im Verlauf '+report.hitchCount+' · Letzter '+(report.lastHitch?.workMs??0).toFixed(1)+'ms'+
   '\nDraw calls '+report.drawCalls+' · Triangles '+report.triangles+
   '\nUnits '+report.units+' · Moving '+report.moving+' · Orders '+report.orders+
   '\nParticles '+report.particles+
   '\nTrails '+report.tracks+' · Effects '+report.emitters+
   '\nGPU geometries '+report.geometries+' / textures '+report.textures;
 }
 snapshot(){
  const frames=Array.from(this.samples.subarray(0,this.length)).sort((a,b)=>a-b);
  const sim=Array.from(this.simSamples.subarray(0,this.length)).sort((a,b)=>a-b);
  const sync=Array.from(this.syncSamples.subarray(0,this.length)).sort((a,b)=>a-b);
  const render=Array.from(this.renderSamples.subarray(0,this.length)).sort((a,b)=>a-b);
  const auxiliary=Array.from(this.auxSamples.subarray(0,this.length)).sort((a,b)=>a-b);
  const effects=Array.from(this.effectsSamples.subarray(0,this.length)).sort((a,b)=>a-b);
  const vision=Array.from(this.visionSamples.subarray(0,this.visionLength)).sort((a,b)=>a-b);
  const p=(v,part)=>v[Math.max(0,Math.ceil(v.length*part)-1)]||0;
  const mean=frames.reduce((a,b)=>a+b,0)/Math.max(1,frames.length);
  const slow=frames.slice(-Math.max(1,Math.ceil(frames.length*.01)));
  const low=slow.reduce((a,b)=>a+b,0)/Math.max(1,slow.length);
  const info=this.renderer.info;
  return {
   fps:mean>0?1000/mean:0,lowFps:low>0?1000/low:0,
   frameP95:p(frames,.95),simP95:p(sim,.95),
   syncP95:p(sync,.95),renderP95:p(render,.95),
   auxP95:p(auxiliary,.95),effectsP95:p(effects,.95),
   visionP95:p(vision,.95),lastVisionMs:this.game.visionDurationMs??0,
   maxVisionMs:this.game.maxVisionMs??0,
   drawCalls:info.render.calls,triangles:info.render.triangles,
   geometries:info.memory.geometries,textures:info.memory.textures,
   lastAiPlanMs:this.game.aiPlanDurationMs??0,
   maxAiPlanMs:this.maxAiPlanMs,
   hitchCount:this.hitches.length,
   lastHitch:this.hitches.at(-1)??null,
   jsHeapMB:typeof performance.memory?.usedJSHeapSize==='number'?
    Math.round(performance.memory.usedJSHeapSize/1048576):null,
   sceneChildren:this.battlefield?.scene?.children?.length??null,
   actors3d:this.battlefield?.units?.size??null,
   selectionRings:this.battlefield?.selectedRings?.size??null,
   notices:this.game.notices?.length??0,
   units:this.game.units.filter(u=>u.hp>0&&!u.carrier).length,
   moving:this.game.units.filter(u=>u.hp>0&&!u.carrier&&u.moving).length,
   orders:this.game.units.filter(u=>u.hp>0&&!u.carrier&&u.orders?.length).length,
   clock:this.game.time,gameStatus:this.game.status+(this.game.paused?' (PAUSED)':''),
   particles:this.effects.particleCount,
   tracks:this.groundTracks.activeTracks,
   emitters:this.effects.emitters.length,
   blasts:this.effects.stats.blasts,wrecks:this.effects.stats.wrecks
  };
 }
 history(){return this.checkpoints.map(x=>({...x}));}
 spikeHistory(){return this.hitches.map(x=>({...x}));}
}
