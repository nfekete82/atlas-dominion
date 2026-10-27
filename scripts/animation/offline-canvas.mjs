import {deflateSync,inflateSync} from 'node:zlib';

// Small dependency-free RGBA/PNG surface for the optional CPU asset baker.
// Browser exports continue to use the native Canvas implementation.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);let crc=0xffffffff;for(const b of Buffer.concat([name,data]))crc=crcTable[(crc^b)&255]^(crc>>>8);out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;}
export function encodePNG(width,height,pixels){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const stride=width*4,raw=Buffer.alloc((stride+1)*height);
 // Sub filtering compresses the fine procedural paint grain substantially.
 for(let y=0;y<height;y++){const row=y*(stride+1);raw[row]=1;for(let x=0;x<stride;x++)raw[row+x+1]=(pixels[y*stride+x]-(x>=4?pixels[y*stride+x-4]:0))&255;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:7})),chunk('IEND',Buffer.alloc(0))]);
}
export function decodePNG(bytes){
 if(bytes.subarray(1,4).toString()!=='PNG'||bytes[24]!==8||![2,6].includes(bytes[25]))throw Error('Expected 8-bit RGB/RGBA PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),channels=bytes[25]===6?4:3,parts=[];
 for(let p=8;p+12<=bytes.length;){const n=bytes.readUInt32BE(p),type=bytes.toString('ascii',p+4,p+8);if(p+n+12>bytes.length)throw Error('Truncated PNG chunk');if(type==='IDAT')parts.push(bytes.subarray(p+8,p+8+n));if(type==='IEND')break;p+=n+12;}
 const raw=inflateSync(Buffer.concat(parts)),stride=width*channels,unfiltered=Buffer.alloc(stride*height),pixels=new Uint8ClampedArray(width*height*4);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++)for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?unfiltered[i-channels]:0,b=y?unfiltered[i-stride]:0,c=y&&x>=channels?unfiltered[i-stride-channels]:0,f=raw[y*(stride+1)];if(f>4)throw Error('Invalid PNG filter');unfiltered[i]=(raw[y*(stride+1)+x+1]+[0,a,b,(a+b)>>1,paeth(a,b,c)][f])&255;}
 for(let i=0;i<width*height;i++){for(let k=0;k<3;k++)pixels[i*4+k]=unfiltered[i*channels+k];pixels[i*4+3]=channels===4?unfiltered[i*channels+3]:255;}
 return {width,height,pixels};
}
function color(value){
 if(typeof value==='object')return value;
 if(value.startsWith('#')){let v=value.slice(1);if(v.length===3)v=[...v].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)).concat(v.length===8?parseInt(v.slice(6),16)/255:1);}
 const v=value.match(/[\d.]+/g)?.map(Number);if(!v)throw Error('Unsupported offline color: '+value);return [...v.slice(0,3),v[3]??1];
}
const glyphs={A:['01110','10001','10001','11111','10001','10001','10001'],T:['11111','00100','00100','00100','00100','00100','00100'],L:['10000','10000','10000','10000','10000','10000','11111'],S:['01111','10000','10000','01110','00001','00001','11110'],N:['10001','11001','11001','10101','10011','10011','10001'],E:['11111','10000','10000','11110','10000','10000','11111'],U:['10001','10001','10001','10001','10001','10001','01110'],R:['11110','10001','10001','11110','10100','10010','10001'],'0':['01110','10011','10101','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'/':['00001','00001','00010','00100','01000','10000','10000'],' ':['00000','00000','00000','00000','00000','00000','00000']};
Object.assign(glyphs,{
 B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01110','10001','10000','10111','10001','10001','01110'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],K:['10001','10010','10100','11000','10100','10010','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],Q:['01110','10001','10001','10001','10101','10010','01101'],Y:['10001','10001','01010','00100','00100','00100','00100']
});
export class OfflineCanvas{
 constructor(width=1,height=1){this._width=width;this._height=height;this.pixels=new Uint8ClampedArray(width*height*4);this.context=new Context(this);}
 get width(){return this._width;}set width(v){this._width=v;this.reset();}
 get height(){return this._height;}set height(v){this._height=v;this.reset();}
 reset(){this.pixels=new Uint8ClampedArray(this.width*this.height*4);if(this.context)this.context.reset();}
 getContext(type){if(type!=='2d')throw Error('OfflineCanvas supports only 2D');return this.context;}
 toDataURL(){return 'data:image/png;base64,'+encodePNG(this.width,this.height,this.pixels).toString('base64');}
 toBlob(callback){callback(new Blob([encodePNG(this.width,this.height,this.pixels)],{type:'image/png'}));}
}
class Context{
 constructor(canvas){this.canvas=canvas;this.reset();}
 reset(){this.fillStyle=this.strokeStyle='#000000';this.globalAlpha=1;this.font='10px monospace';this.textAlign='left';this.sx=this.sy=1;this.tx=this.ty=0;}
 createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
 putImageData(image,x,y){for(let j=0;j<image.height;j++){const start=((y+j)*this.canvas.width+x)*4;this.canvas.pixels.set(image.data.subarray(j*image.width*4,(j+1)*image.width*4),start);}}
 getImageData(x,y,w,h){const out=this.createImageData(w,h);for(let j=0;j<h;j++)out.data.set(this.canvas.pixels.subarray(((y+j)*this.canvas.width+x)*4,((y+j)*this.canvas.width+x+w)*4),j*w*4);return out;}
 pixel(x,y,rgb){if(x<0||y<0||x>=this.canvas.width||y>=this.canvas.height)return;const i=(y*this.canvas.width+x)*4,p=this.canvas.pixels,a=rgb[3]*this.globalAlpha,old=p[i+3]/255,result=a+old*(1-a);for(let k=0;k<3;k++)p[i+k]=result?(rgb[k]*a+p[i+k]*old*(1-a))/result:0;p[i+3]=result*255;}
 fillRect(x,y,w,h){const style=color(this.fillStyle);for(let j=Math.max(0,Math.floor(y));j<Math.min(this.canvas.height,Math.ceil(y+h));j++)for(let i=Math.max(0,Math.floor(x));i<Math.min(this.canvas.width,Math.ceil(x+w));i++)this.pixel(i,j,Array.isArray(style)?style:style.sample(i,j));}
 fillText(text,x,y){const size=parseFloat(this.font.match(/[\d.]+/)?.[0]??10),unit=size/7,width=text.length*6*unit;if(this.textAlign==='center')x-=width/2;for(const c of text){const glyph=glyphs[c];if(!glyph)throw Error('Missing stencil glyph '+c);for(let j=0;j<7;j++)for(let i=0;i<5;i++)if(glyph[j][i]==='1')this.fillRect(x+i*unit,y-size+j*unit,unit,unit);x+=6*unit;}}
 createLinearGradient(x0,y0,x1,y1){const stops=[];return {addColorStop(p,c){stops.push([p,color(c)]);stops.sort((a,b)=>a[0]-b[0]);},sample(x,y){const dx=x1-x0,dy=y1-y0,t=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy)));let a=stops[0],b=stops.at(-1);for(let i=1;i<stops.length;i++)if(t<=stops[i][0]){a=stops[i-1];b=stops[i];break;}const u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0]||1)));return a[1].map((v,i)=>v+(b[1][i]-v)*u);}};}
 beginPath(){this.points=[];}moveTo(x,y){this.points.push([x,y]);}lineTo(x,y){this.points.push([x,y]);}
 stroke(){const rgb=color(this.strokeStyle);for(let k=1;k<this.points.length;k++){const [x,y]=this.points[k-1],[a,b]=this.points[k],n=Math.max(1,Math.ceil(Math.hypot(a-x,b-y)));for(let i=0;i<=n;i++)this.pixel(Math.round(x+(a-x)*i/n),Math.round(y+(b-y)*i/n),rgb);}}
 translate(x,y){this.tx+=x;this.ty+=y;}scale(x,y){this.sx*=x;this.sy*=y;}
 drawImage(source,...args){let sx=0,sy=0,sw=source.width,sh=source.height,dx,dy,dw,dh;if(args.length===2){[dx,dy]=args;dw=sw;dh=sh;}else if(args.length===4)[dx,dy,dw,dh]=args;else [sx,sy,sw,sh,dx,dy,dw,dh]=args;
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
   const i=(Math.min(source.height-1,Math.floor(sy+y*sh/dh))*source.width+Math.min(source.width-1,Math.floor(sx+x*sw/dw)))*4;
   const px=Math.floor(this.tx+(dx+x)*this.sx),py=Math.floor(this.ty+(dy+y)*this.sy-(this.sy<0?1:0));
   this.pixel(px,py,[source.pixels[i],source.pixels[i+1],source.pixels[i+2],source.pixels[i+3]/255]);
  }
 }
}
export function installOfflineCanvas(){
 globalThis.HTMLCanvasElement=OfflineCanvas;
 globalThis.document={createElement:type=>{if(type!=='canvas')throw Error('Unexpected offline DOM element '+type);return new OfflineCanvas();}};
 globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
 globalThis.self=globalThis;
}
