import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {PIXEL_ART_SPRITES} from '../dist/src/render/pixel-art-manifest.js';
import {buildingSpriteBounds,buildingSpriteName,buildingSpriteScale,visualHash} from '../dist/src/render/pixel-art-style.js';

// Independent PNG decoder: verify actual shipped RGBA pixels, not just metadata.
function png(name){
 const bytes=readFileSync(new URL(`../src/assets/pixel-art/${name}.png`,import.meta.url));
 assert.equal(bytes.subarray(1,4).toString(),'PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),chunks=[];
 assert.equal(bytes[24],8);assert.equal(bytes[25],6);
 for(let p=8;p<bytes.length;){const size=bytes.readUInt32BE(p);if(bytes.toString('ascii',p+4,p+8)==='IDAT')chunks.push(bytes.subarray(p+8,p+8+size));p+=size+12;}
 const raw=inflateSync(Buffer.concat(chunks)),pixels=Buffer.alloc(width*height*4),stride=width*4;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
  const pos=y*stride+x,filter=raw[y*(stride+1)],v=raw[y*(stride+1)+x+1];
  const a=x>=4?pixels[pos-4]:0,b=y?pixels[pos-stride]:0,c=y&&x>=4?pixels[pos-stride-4]:0;
  pixels[pos]=(v+([0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter]))&255;
 }
 return {width,height,pixels};
}
function crop(image,f){
 const out=Buffer.alloc(f.width*f.height*4);
 for(let y=0;y<f.height;y++)image.pixels.copy(out,y*f.width*4,((f.y+y)*image.width+f.x)*4,((f.y+y)*image.width+f.x+f.width)*4);
 return out;
}

test('all shipped PNG frames match both manifests, include real transparent pixel art, and have exact ink bounds',()=>{
 for(const [name,sprites] of Object.entries(PIXEL_ART_SPRITES)){
  const image=png(name),json=JSON.parse(readFileSync(new URL(`../src/assets/pixel-art/${name}.json`,import.meta.url)));
  assert.deepEqual(sprites,json.sprites);assert.deepEqual([image.width,image.height],json.size);
  for(const [key,f] of Object.entries(sprites)){
   assert.ok(f.x>=0&&f.y>=0&&f.x+f.width<=image.width&&f.y+f.height<=image.height,key);
   assert.equal(f.pivotX,f.width/2);assert.equal(f.pivotY,f.height-3);
   const p=crop(image,f);let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1,transparent=0;
   const colors=new Set();
   for(let i=0;i<p.length;i+=4){
    if(!p[i+3]){transparent++;continue;}
    const x=(i/4)%f.width,y=Math.floor(i/4/f.width);
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    colors.add(p.subarray(i,i+4).toString('hex'));
   }
   assert.ok(transparent>0,key);assert.ok(colors.size>=2&&colors.size<=32,key);
   assert.deepEqual([f.inkX,f.inkY,f.inkWidth,f.inkHeight],[minX,minY,maxX-minX+1,maxY-minY+1],key);
  }
 }
});

test('six city levels, paired silhouettes, real building classes and animated infantry have distinct pixels',()=>{
 const image=png('buildings'),hash=key=>createHash('sha256').update(crop(image,PIXEL_ART_SPRITES.buildings[key])).digest('hex');
 const hashes=[];
 for(let n=0;n<=5;n++)for(let v=0;v<2;v++)hashes.push(hash(`city-${n}-${v}`));
 for(const name of ['factory','barracks','tower'])hashes.push(hash(name));
 assert.equal(new Set(hashes).size,15);
 assert.equal(Object.keys(PIXEL_ART_SPRITES.terrain).length,12);
 const infantry=png('soldiers');
 for(const team of ['blue','red','green','neutral'])for(const [state,count] of [['idle',2],['move',4],['fire',3]]){
  const frames=[];
  for(let i=0;i<count;i++){
   const f=PIXEL_ART_SPRITES.soldiers[`${team}-${state}-${i}`];assert.equal(f.state,state);assert.ok(f.duration>0);
   frames.push(createHash('sha256').update(crop(infantry,f)).digest('hex'));
  }
  if(state!=='idle')assert.ok(new Set(frames).size>=2,`${team} ${state}`);
 }
});

test('LOD bounds cover precisely the nontransparent pixel envelope with the shared foot pivot, including both variants',()=>{
 for(const zoom of [.8,1,1.249,1.25,1.799,1.8,3,4])for(const code of [1,2,3,4])for(let level=0;level<=5;level++)for(const variant of [0,1]){
  const f=PIXEL_ART_SPRITES.buildings[buildingSpriteName(code,level,variant)],scale=buildingSpriteScale(code,level,zoom);
  const b=buildingSpriteBounds(123.3,456.7,code,level,zoom,variant);
  assert.equal(b.x,123+(f.inkX-f.pivotX)*scale);assert.equal(b.y,457+(f.inkY-f.pivotY)*scale);
  assert.equal(b.width,f.inkWidth*scale);assert.equal(b.height,f.inkHeight*scale);
 }
});

test('visual terrain variation is stable and independent from the simulation random stream',()=>{
 const a=Array.from({length:100},(_,i)=>visualHash(i,i*7,9));
 for(let i=0;i<100;i++)assert.equal(visualHash(i,i*7,9),a[i]);
 assert.ok(a.every(v=>v>=0&&v<1));assert.ok(new Set(a).size>95);
});
