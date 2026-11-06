import * as T from 'three';

/** Offline-only microstructure: no engine-side texture fetch or per-frame shader work.
 * The user-refined HQ mesh, UV layout, paint colors and moving rigs stay intact. */
export function applyFieldFinish(model,kind){
 if(kind!=='headquarters'&&kind!=='barracks')return;
 const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size);
 let seed=kind==='headquarters'?0x71ab2c13:0x5a3d791b;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4;
  // Fine-grain sandblasted finish, occasional long directional wear.
  const grain=(rand()-.5)*36,brushed=Math.sin(x*.71+y*.09)*8;
  const v=Math.round(Math.max(65,Math.min(235,174+grain+brushed)));
  image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 ctx.save();ctx.globalAlpha=.17;
 for(let i=0;i<205;i++){
  const x=rand()*size,y=rand()*size;
  ctx.strokeStyle=rand()>.45?'#f1e9d6':'#6d6250';
  ctx.lineWidth=.45+rand()*.55;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(2+rand()*10),y+(rand()-.5)*.8);ctx.stroke();
 }
 ctx.restore();
 const texture=new T.CanvasTexture(canvas);
 texture.wrapS=texture.wrapT=T.RepeatWrapping;
 texture.repeat.set(2,2);texture.colorSpace=T.NoColorSpace;
 texture.anisotropy=4;
 const seen=new Set();let finished=0;
 model.traverse(node=>{
  if(!node.isMesh||!node.geometry?.attributes?.uv)return;
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(!material?.isMeshStandardMaterial||seen.has(material))continue;
   seen.add(material);
   const name=(material.name??'').toLowerCase();
   if(/glass|lens|light|emission|glow|window/.test(name))continue;
   if(!/sand|ceramic|bronze|edge|steel|armour|armor|enamel|trim|panel|metal/.test(name))continue;
   if(!material.bumpMap){material.bumpMap=texture;material.bumpScale=name.includes('ceramic')?.022:.013;}
   // Retain the original base-color textures and all faction colors. Only the
   // physical response of unweathered hard surfaces gets more variation.
   if(!material.roughnessMap)material.roughnessMap=texture;
   material.roughness=Math.max(.58,Math.min(.9,material.roughness??.72));
   material.needsUpdate=true;finished++;
  }
 });
 model.userData.fieldFinish={revision:1,kind,materials:finished,roughness:'sandblasted / brushed edges'};
 return finished;
}
