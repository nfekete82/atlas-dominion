import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FOG_SCALE,FOG_REMEMBERED_ALPHA,FOG_UNKNOWN_ALPHA,makeSmoothFogAlpha,fogMaskChanged} from '../dist/src/reborn/fog-presentation.js';

const testMask=(w=15)=>({w,v:new Uint8Array(w*w),e:new Uint8Array(w*w)});
const pixel=(mask,x,y)=>mask[y*15*FOG_SCALE+x];

test('fog: inward feathering never reveals unknown terrain or lightens stale explored cells',()=>{
  const {w,v,e}=testMask();
  for(let y=3;y<12;y++)for(let x=3;x<12;x++)e[y*w+x]=1;
  for(let y=5;y<10;y++)for(let x=5;x<10;x++)v[y*w+x]=1;
  const out=makeSmoothFogAlpha(v,e,w);
  for(let i=0;i<v.length;i++)for(let dy=0;dy<FOG_SCALE;dy++)for(let dx=0;dx<FOG_SCALE;dx++){
    const x=(i%w)*FOG_SCALE+dx,y=Math.floor(i/w)*FOG_SCALE+dy,a=out[y*w*FOG_SCALE+x];
    if(!e[i])assert.equal(a,FOG_UNKNOWN_ALPHA);
    else if(!v[i])assert.ok(a>=FOG_REMEMBERED_ALPHA);
  }
  assert.equal(out.length,(w*FOG_SCALE)**2);
  assert.equal(pixel(out,15,15),0,'center of sight must remain clear');
  assert.ok(pixel(out,11,15)>0,'visible fringe should be softened');
  assert.ok(pixel(out,11,15)<FOG_REMEMBERED_ALPHA+3);
});

test('fog: rounded diagonal transitions remain deterministic and contain multiple alpha levels',()=>{
  const {w,v,e}=testMask();
  e.fill(1);for(let y=0;y<w;y++)for(let x=0;x<w;x++)if(Math.hypot(x-7,y-7)<4.3)v[y*w+x]=1;
  const a=makeSmoothFogAlpha(v,e,w),b=makeSmoothFogAlpha(v,e,w);
  assert.deepEqual(a,b);
  assert.ok(new Set(a).size>8,'soft silhouette must not reproduce sharp binary stair steps');
  assert.ok(a.every(x=>x>=0&&x<=255));
});

test('fog: visibility snapshots skip redundant work; invalid dimensions are rejected',()=>{
  const {w,v,e}=testMask(),p=v.slice(),q=e.slice();
  assert.equal(fogMaskChanged(v,e,p,q),false);
  e[0]=1;assert.equal(fogMaskChanged(v,e,p,q),true);
  assert.throws(()=>makeSmoothFogAlpha(v,new Uint8Array(1),w));
});

test('fog: renderer uses cached 2x mask for battlefield and minimap; simulation remains unchanged',()=>{
  const renderer=readFileSync(new URL('../src/reborn/renderer.ts',import.meta.url),'utf8');
  assert.match(renderer,/fogMaskChanged\(v,e,this\.previousFogVisible,this\.previousFogExplored\)/);
  assert.match(renderer,/makeSmoothFogAlpha\(v,e,RULES\.grid\)/);
  assert.match(renderer,/this\.fog\.width=this\.fog\.height=RULES\.grid\*FOG_SCALE/);
  assert.match(renderer,/c\.imageSmoothingQuality='high'/);
});
