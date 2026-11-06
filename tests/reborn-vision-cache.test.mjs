import {test} from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/src/reborn/world.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
import {VisionCache} from '../dist/src/reborn/vision-cache.js';
function reference(w,sources){
 const out=new Uint8Array(RULES.grid**2);
 for(const s of sources){const gx=Math.floor(s.x/w.cell),gy=Math.floor(s.y/w.cell),r=Math.ceil(s.sight/w.cell);
  for(let y=Math.max(0,gy-r);y<=Math.min(RULES.grid-1,gy+r);y++)for(let x=Math.max(0,gx-r);x<=Math.min(RULES.grid-1,gx+r);x++){
   const i=y*RULES.grid+x;if(out[i])continue;const p=w.center(i),d=distance(s,p);if(d<=s.sight&&(s.air||d<=s.close||w.sightLine(s,p)))out[i]=1;
  }const own=w.index(s);if(own>=0)out[own]=1;
 }return out;
}
test('vision cache: every bit matches original ray casting across movement, cliffs, flight and all current maps',()=>{
 for(const version of [0,1,2,3,4,5]){
  const w=new World(2027,version),cache=new VisionCache(),visible=new Uint8Array(RULES.grid**2);
  const sources=[{key:'a',x:w.size*.3,y:w.size*.5,sight:680,close:50,air:false},{key:'b',x:w.size*.5,y:w.size*.4,sight:390,close:35,air:false},{key:'c',x:w.size*.7,y:w.size*.7,sight:780,close:50,air:true}];
  for(let i=0;i<5;i++){if(i===3)sources[0].x+=18.25;cache.update(w,0,sources,visible);assert.deepEqual(visible,reference(w,sources));}
  sources.pop();cache.update(w,0,sources,visible);assert.deepEqual(visible,reference(w,sources),'removed source leaves no ghost visibility');
 }
});
test('vision cache: changed terrain, ownership and sight invalidate exact masks without fog leakage',()=>{
 const w=new World(731,4),cache=new VisionCache(),visible=new Uint8Array(RULES.grid**2),s=[{key:'a',x:1000,y:1000,sight:390,close:40,air:false}];
 for(let i=0;i<3;i++)cache.update(w,0,s,visible);
 w.opaque.fill(0);cache.update(w,0,s,visible);assert.deepEqual(visible,reference(w,s));
 s[0].sight=110;cache.update(w,0,s,visible);assert.deepEqual(visible,reference(w,s));
 cache.update(w,0,[],visible);assert.equal(visible.some(Boolean),false);cache.update(w,1,s,visible);assert.deepEqual(visible,reference(w,s));
});
test('vision cache: stationary sources stop repeating terrain rays after warmup',()=>{
 const w=new World(2026,4),cache=new VisionCache(),visible=new Uint8Array(RULES.grid**2),s=[{key:'a',x:1500,y:1500,sight:680,close:40,air:false}];
 const line=w.sightLine.bind(w);let rays=0;w.sightLine=(...a)=>{rays++;return line(...a);};
 cache.update(w,0,s,visible);cache.update(w,0,s,visible);assert.ok(rays>0);rays=0;cache.update(w,0,s,visible);assert.equal(rays,0);
});

test('vision cache: paid autonomous simulation and saves match a deliberately uncached control',async()=>{
 const {Simulation}=await import('../dist/src/reborn/simulation.js');const a=new Simulation(2033,4),b=new Simulation(2033,4);a.time=b.time=25;a.aiClock=b.aiClock=3;
 // The control performs original rays: neither stationary reuse nor the new rectangle proof.
 b.visionCache.clearRectangle=()=>false;
 for(let i=0;i<240;i++){a.step(.1);b.visionCache.invalidate();b.step(.1);if(i%40===0){assert.deepEqual(a.visible,b.visible);assert.deepEqual(a.save(),b.save());}}
});

test('vision cache: clear-rectangle shortcut avoids empty-ground rays and still hides targets behind a changed wall',()=>{
 const w=new World(2026,4);w.opaque.fill(0);const cache=new VisionCache(),visible=new Uint8Array(RULES.grid**2),sources=[{key:'moving',x:1000,y:1000,sight:390,close:40,air:false}];
 const line=w.sightLine.bind(w);let rays=0;w.sightLine=(...a)=>{rays++;return line(...a);};
 const expected=reference(w,sources);rays=0;cache.update(w,0,sources,visible);assert.equal(rays,0);assert.deepEqual(visible,expected);
 const x=Math.floor(1100/w.cell);for(let y=0;y<RULES.grid;y++)w.opaque[y*RULES.grid+x]=1;
 cache.update(w,0,sources,visible);assert.ok(rays>0);assert.deepEqual(visible,reference(w,sources));assert.equal(visible[w.index({x:1250,y:1000})],0);
});
