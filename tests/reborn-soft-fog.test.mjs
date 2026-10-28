import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FOG_SCALE,FOG_REMEMBERED_ALPHA,FOG_UNKNOWN_ALPHA,FOG_FEATHER_CELLS,FOG_BACKGROUND,makeSmoothFogAlpha,fogMaskChanged,fogEdgeOffset,fogOverlayRgb} from '../dist/src/reborn/fog-presentation.js';

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

test('fog: wider organic fade is stable and bounded, without expanding gameplay vision',()=>{
  assert.ok(FOG_FEATHER_CELLS>=2.3&&FOG_FEATHER_CELLS<3);
  const offsets=[];
  for(let y=0;y<64;y+=2)for(let x=0;x<64;x+=2){
    const z=fogEdgeOffset(x,y);offsets.push(z);
    assert.equal(z,fogEdgeOffset(x,y));
    assert.ok(Math.abs(z)<=.311);
  }
  assert.ok(Math.max(...offsets)-Math.min(...offsets)>.35);
  const {w,v,e}=testMask(31);e.fill(1);
  for(let y=0;y<w;y++)for(let x=0;x<w;x++)if(Math.hypot(x-15,y-15)<8)v[y*w+x]=1;
  const mask=makeSmoothFogAlpha(v,e,w);
  for(let i=0;i<v.length;i++)if(!v[i]){
    for(let dy=0;dy<FOG_SCALE;dy++)for(let dx=0;dx<FOG_SCALE;dx++){
      const x=i%w*FOG_SCALE+dx,y=Math.floor(i/w)*FOG_SCALE+dy;
      assert.ok(mask[y*w*FOG_SCALE+x]>=FOG_REMEMBERED_ALPHA);
    }
  }
});

test('fog: warm dusty fringe is visible-side only, unknown remains opaque charcoal',()=>{
  assert.equal(FOG_BACKGROUND,'#080b0d');
  assert.deepEqual(fogOverlayRgb(95,false,20,40),[8,11,13]);
  assert.deepEqual(fogOverlayRgb(255,true,20,40),[8,11,13]);
  assert.deepEqual(fogOverlayRgb(0,true,20,40),[8,11,13]);
  const dust=fogOverlayRgb(95,true,20,40);
  assert.ok(dust[0]>dust[1]&&dust[1]>dust[2],'warm mineral dust, not green/blue halo');
  assert.ok(dust[0]>50&&dust[0]<100,'subtle, dark rim');
  const {w,v,e}=testMask();e.fill(1);
  for(let y=5;y<10;y++)for(let x=5;x<10;x++)v[y*w+x]=1;
  const m=makeSmoothFogAlpha(v,e,w);
  for(let y=0;y<w*FOG_SCALE;y++)for(let x=0;x<w*FOG_SCALE;x++){
    const cell=Math.floor(y/FOG_SCALE)*w+Math.floor(x/FOG_SCALE);
    if(!v[cell]){
      assert.deepEqual(fogOverlayRgb(m[y*w*FOG_SCALE+x],false,x,y),[8,11,13]);
    }
  }
});

test('fog: renderer uses stable background and visible-only dust tint',()=>{
  const renderer=readFileSync(new URL('../src/reborn/renderer.ts',import.meta.url),'utf8');
  assert.match(renderer,/c\.fillStyle=FOG_BACKGROUND/);
  assert.match(renderer,/fogOverlayRgb\(alpha\[i\],v\[index\]===1,x,y\)/);
  assert.doesNotMatch(renderer,/c\.fillStyle='#030507'/);
});
