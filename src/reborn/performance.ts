/** Opt-in only. Fixed numeric rings avoid per-frame objects, sorting and logging. */
export const phases=['simulation','ai','pathfinding','vision','render','minimap','hud','audio','input','fog','sprites','corpses','particles'] as const;
export type Phase=typeof phases[number];
const width=phases.length,capacity=3600;
export let profiler:PerformanceRecorder|null=null;
export function setProfiler(value:PerformanceRecorder|null):void{profiler=value;}
export class PerformanceRecorder {
 private frames=new Float64Array(capacity);
 private work=new Float64Array(capacity);
 private times=new Float64Array(capacity*width);
 private current=new Float64Array(width);
 private totals=new Float64Array(width);private maxima=new Float64Array(width);private calls=new Uint32Array(width);
 private cursor=0;private count=0;private last=0;private started=0;
 private pathCalls=0;private pathNodes=0;private framePaths=0;private frameNodes=0;
 private paths=new Uint32Array(capacity);private nodes=new Uint32Array(capacity);
 private observer:PerformanceObserver|null=null;private longTasks=0;private maxLongTask=0;
 constructor(observe=true){
  if(observe&&typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes.includes('longtask')){
   this.observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){this.longTasks++;this.maxLongTask=Math.max(this.maxLongTask,e.duration);}});
   this.observer.observe({type:'longtask'});
  }
 }
 beginFrame(now:number):void{this.started=performance.now();this.current.fill(0);this.framePaths=0;this.frameNodes=0;if(!this.last)this.last=now;}
 endFrame(now:number):void{
  const interval=now-this.last;this.last=now;
  if(interval<=0){this.work[capacity-1]=performance.now()-this.started;this.times.set(this.current,(capacity-1)*width);return;}
  const i=this.cursor;this.frames[i]=interval;this.work[i]=performance.now()-this.started;
  this.times.set(this.current,i*width);this.paths[i]=this.framePaths;this.nodes[i]=this.frameNodes;
  this.cursor=(i+1)%capacity;this.count=Math.min(capacity,this.count+1);
 }
 record(phase:Phase,ms:number,nodes=0):void{
  const i=phases.indexOf(phase);this.current[i]+=ms;this.totals[i]+=ms;this.maxima[i]=Math.max(this.maxima[i],ms);this.calls[i]++;
  if(phase==='pathfinding'){this.pathCalls++;this.pathNodes+=nodes;this.framePaths++;this.frameNodes+=nodes;}
 }
 reset():void{this.cursor=0;this.count=0;this.last=0;this.current.fill(0);this.totals.fill(0);this.maxima.fill(0);this.calls.fill(0);this.pathCalls=this.pathNodes=this.longTasks=this.maxLongTask=0;this.work[capacity-1]=0;this.times.fill(0,(capacity-1)*width);}
 dispose():void{this.observer?.disconnect();}
 snapshot(){
  const samples=Array.from(this.frames.subarray(0,this.count)).sort((a,b)=>a-b),n=samples.length;
  const percentile=(p:number)=>samples[Math.max(0,Math.ceil(n*p)-1)]??0;
  const sum=samples.reduce((a,b)=>a+b,0),low=samples.slice(-Math.max(1,Math.ceil(n*.01)));
  const spikes=Array.from({length:n},(_,i)=>i).filter(i=>this.frames[i]>33).sort((a,b)=>this.frames[b]-this.frames[a]).slice(0,12).map(i=>{
   const previous=(i+capacity-1)%capacity;
   return {frameMs:this.frames[i],workMs:this.work[i],previousWorkMs:this.work[previous],phases:Object.fromEntries(phases.map((p,j)=>[p,this.times[i*width+j]])),previousPhases:Object.fromEntries(phases.map((p,j)=>[p,this.times[previous*width+j]])),paths:this.paths[i],nodes:this.nodes[i]};
  });
  return {frames:n,windowSeconds:sum/1000,fps:sum?1000*n/sum:0,low1Fps:low.length&&low[0]?1000*low.length/low.reduce((a,b)=>a+b,0):0,
   frameMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:samples[n-1]??0},
   over33:samples.filter(v=>v>33).length,over50:samples.filter(v=>v>50).length,over100:samples.filter(v=>v>100).length,
   phases:Object.fromEntries(phases.map((p,i)=>[p,{calls:this.calls[i],totalMs:this.totals[i],meanMs:this.calls[i]?this.totals[i]/this.calls[i]:0,maxMs:this.maxima[i]}])),
   pathfinding:{calls:this.pathCalls,nodes:this.pathNodes},longTasks:{count:this.longTasks,maxMs:this.maxLongTask},spikes};
 }
}

/** Small debug overlay; statistics are computed once per second, never per frame. */
export function mountPerformancePanel(recorder:PerformanceRecorder):void{
 const panel=document.createElement('details');panel.id='performance-panel';panel.open=true;
 panel.style.cssText='position:fixed;left:12px;top:64px;z-index:1000;max-width:500px;max-height:70vh;overflow:auto;padding:10px;background:#09121fee;color:#d8eef5;font:12px monospace;pointer-events:auto';
 const summary=document.createElement('summary');summary.textContent='Performance-Debug';
 const output=document.createElement('pre');output.style.margin='8px 0';
 const reset=document.createElement('button');reset.textContent='Messung zurücksetzen';reset.onclick=()=>recorder.reset();
 const download=document.createElement('button');download.textContent='JSON exportieren';download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(recorder.snapshot(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='atlas-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 panel.append(summary,output,reset,download);document.body.append(panel);
 setInterval(()=>{if(!panel.open||document.hidden)return;const s=recorder.snapshot(),f=(n:number)=>n.toFixed(1);output.textContent=`FPS ${f(s.fps)} · 1%-Low ${f(s.low1Fps)}\np50/p95/p99 ${f(s.frameMs.p50)} / ${f(s.frameMs.p95)} / ${f(s.frameMs.p99)} ms\n>33/50/100 ms ${s.over33} / ${s.over50} / ${s.over100}\n`+Object.entries(s.phases).map(([p,v])=>`${p.padEnd(12)} Ø ${f(v.meanMs)} · max ${f(v.maxMs)} ms`).join('\n')+`\nA*: ${s.pathfinding.calls} Wege / ${s.pathfinding.nodes} Knoten\nLong Tasks: ${s.longTasks.count} · max ${f(s.longTasks.maxMs)} ms`;},1000);
}
