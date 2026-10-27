import * as T from 'three';

/**
 * Seeded, texture-baked desert kit. No network requests, runtime shaders or
 * borrowed photographic textures. All channels export into the animated GLBs.
 */
export function realisticDesertMaterials(team) {
  let seed = 0x6c656769;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const size = 512;
  const makeCanvas = () => {const canvas = document.createElement('canvas');canvas.width = canvas.height = size;return canvas;};
  const maps = (kind) => {
    const diffuse = makeCanvas(), ctx = diffuse.getContext('2d');
    const patterns = {
      cloth: ['#c8b791','#b5a17b','#848c6b','#737657','#625a46','#dfceaa'],
      nylon: ['#ad9c79','#968766','#756f53','#bbaa87','#5c5a46','#d0b995'],
      ceramic: ['#c8b995','#b8a880','#9f926f','#d2c3a2','#857858','#e2d4b3'],
    };
    const palette = patterns[kind];
    ctx.fillStyle = palette[0];ctx.fillRect(0, 0, size, size);
    // Multiscale irregular multicam shapes, seamless across texture edges.
    const blobs = kind === 'ceramic' ? 46 : 115;
    for (let i = 0; i < blobs; i++) {
      const cx = random()*size,cy = random()*size,rx = 8+random()*(kind==='ceramic'?22:39),ry = 5+random()*25;
      const count = 8+Math.floor(random()*5), points = [];
      for(let j=0;j<count;j++){const theta=j/count*Math.PI*2,m=.55+random()*.63;points.push([Math.cos(theta)*rx*m,Math.sin(theta)*ry*m]);}
      ctx.fillStyle=palette[1+Math.floor(random()*(palette.length-1))];
      for (const dx of [-size,0,size]) for (const dy of [-size,0,size]) {
        ctx.beginPath();ctx.moveTo(cx+dx+points[0][0],cy+dy+points[0][1]);
        for(let j=0;j<count;j++){
          const a=points[j],b=points[(j+1)%count];
          ctx.quadraticCurveTo(cx+dx+a[0],cy+dy+a[1],cx+dx+(a[0]+b[0])*.5,cy+dy+(a[1]+b[1])*.5);
        }
        ctx.closePath();ctx.fill();
      }
    }
    // Fine paint erosion and dusty textile highlights stay visible at 192px.
    for(let i=0;i<9500;i++){
      const x=random()*size,y=random()*size;
      ctx.fillStyle=random()<.54?'rgba(244,231,195,.19)':'rgba(42,37,31,.14)';
      ctx.fillRect(x,y,.4+random()*2,.4+random()*1.8);
    }
    const pixels=ctx.getImageData(0,0,size,size),d=pixels.data;
    const rough=makeCanvas(),rctx=rough.getContext('2d'),rd=rctx.createImageData(size,size);
    const normal=makeCanvas(),nctx=normal.getContext('2d'),nd=nctx.createImageData(size,size);
    const height=new Float32Array(size*size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const j=y*size+x,k=j*4,grain=random()-.5,weave=kind==='ceramic'?0:((x%4<2?1:-1)*(y%4<2?1:-1));
      const shade=grain*16+weave*3;
      for(let c=0;c<3;c++)d[k+c]=Math.max(0,Math.min(255,d[k+c]+shade));
      height[j]=.5+grain*.065+weave*.021;
      const roughness=Math.round(255*(kind==='ceramic'?.84:kind==='cloth'?.96:.91)+grain*9);
      rd.data[k]=rd.data[k+1]=rd.data[k+2]=Math.max(0,Math.min(255,roughness));rd.data[k+3]=255;
    }
    ctx.putImageData(pixels,0,0);rctx.putImageData(rd,0,0);
    const h=(x,y)=>height[((y+size)%size)*size+(x+size)%size];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const nx=(h(x-1,y)-h(x+1,y))*.7,ny=(h(x,y-1)-h(x,y+1))*.7,nz=1;
      const inv=1/Math.hypot(nx,ny,nz),i=(y*size+x)*4;
      nd.data[i]=128+Math.round(nx*inv*127);nd.data[i+1]=128+Math.round(ny*inv*127);
      nd.data[i+2]=128+Math.round(nz*inv*127);nd.data[i+3]=255;
    }
    nctx.putImageData(nd,0,0);
    const texture=(canvas,color=false)=>{
      const t=new T.CanvasTexture(canvas);
      t.wrapS=t.wrapT=T.RepeatWrapping;
      t.anisotropy=8;
      if(color)t.colorSpace=T.SRGBColorSpace;
      return t;
    };
    return {map:texture(diffuse,true),roughnessMap:texture(rough),normalMap:texture(normal)};
  };
  const cloth=maps('cloth'),nylon=maps('nylon'),ceramic=maps('ceramic');
  const mat=(name,color,roughness,metalness,extra={})=>new T.MeshStandardMaterial({name,color,roughness,metalness,...extra});
  return {
    armour:mat('Atlas worn desert ballistic plates','#ffffff',.94,.025,{...ceramic,normalScale:new T.Vector2(.45,.45)}),
    cloth:mat('Atlas multicam desert woven uniform','#ffffff',.97,0,{...cloth,normalScale:new T.Vector2(.75,.75)}),
    webbing:mat('Atlas tactical MOLLE nylon','#ffffff',.99,0,{...nylon,normalScale:new T.Vector2(.65,.65)}),
    seam:mat('Atlas beige sewn seams','#8a7857',.96,0),
    edge:mat('Atlas scraped ballistic edge','#8f8265',.82,.08,{roughnessMap:ceramic.roughnessMap}),
    dark:mat('Atlas olive drab tactical fittings','#4c4e3d',.96,0,{normalMap:nylon.normalMap}),
    metal:mat('Atlas worn black phosphated firearm steel','#363a39',.6,.68,{roughnessMap:ceramic.roughnessMap}),
    worn:mat('Atlas rubbed blued steel','#727369',.53,.72),
    team:mat('Atlas small blue or red unit insignia',team?'#b12e29':'#1768aa',.8,.06),
    light:mat('Atlas tactical smoke lenses','#464b44',.25,.12),
    rubber:mat('Atlas dirty rubber soles','#2f3029',.98,0),
    medic:mat('Atlas red medical marker','#ae322e',.9,0),
    skin:mat('Atlas naturally tanned exposed face and ears','#bd9373',.82,0),
    sand:mat('Atlas sand canvas accessories','#bfa984',.98,0,{...nylon}),
  };
}
