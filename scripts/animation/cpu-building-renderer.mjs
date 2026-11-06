import * as T from 'three';
import {OfflineCanvas} from './offline-canvas.mjs';

const linear=Float32Array.from({length:256},(_,v)=>T.ColorManagement.colorSpaceToWorking(new T.Color().setRGB(v/255,v/255,v/255),T.SRGBColorSpace).r);
const aces=v=>Math.max(0,Math.min(1,(v*(2.51*v+.03))/(v*(2.43*v+.59)+.14)));
const srgb=v=>255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055);
const normalize=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sun=normalize([-6,10,6]),fill=normalize([5,4,-5]);

/** Deterministic orthographic PBR reference baker for machines without WebGL.
 * Uses the same meshes, camera, UVs, clips and layer registration as Three.js.
 * GGX direct specular, tangent normals, packed ORM, shadow mapping and 2x SSAA.
 */
export class CPUBuildingRenderer{
 constructor(){this.domElement=new OfflineCanvas();this.shadowMap={};this.toneMappingExposure=1.13;}
 setClearColor(){}
 setSize(w,h){this.width=w;this.height=h;this.domElement=new OfflineCanvas(w,h);}
 render(scene,camera){
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const width=this.width*2,height=this.height*2,depth=new Float32Array(width*height).fill(Infinity),pixels=new Float32Array(width*height*4),meshes=[];
  const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const shadowCamera=new T.OrthographicCamera(-5,5,5,-5,.1,40);shadowCamera.position.set(-6,10,6);shadowCamera.lookAt(0,0,0);shadowCamera.updateMatrixWorld(true);
  const lightVP=new T.Matrix4().multiplyMatrices(shadowCamera.projectionMatrix,shadowCamera.matrixWorldInverse),shadowSize=1024,shadowDepth=new Float32Array(shadowSize*shadowSize).fill(Infinity);
  const view=camera.getWorldDirection(new T.Vector3()).negate().toArray(),half=normalize(sun.map((v,i)=>v+view[i]));
  scene.traverseVisible(n=>{if(n.isMesh)meshes.push(n);});
  const transform=(mesh,matrix,w,h)=>{
   const g=mesh.geometry,p=g.attributes.position,out=new Float32Array(p.count*3),m=new T.Matrix4().multiplyMatrices(matrix,mesh.matrixWorld),v=new T.Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);out[i*3]=(v.x+1)*w/2;out[i*3+1]=(1-v.y)*h/2;out[i*3+2]=v.z;}return out;
  };
  function raster(coords,index,w,h,buffer,fragment,cull=false){
   const count=index?.count??coords.length/3;
   for(let i=0;i<count;i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
    const ax=coords[a],ay=coords[a+1],bx=coords[b],by=coords[b+1],cx=coords[c],cy=coords[c+1],area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    if(Math.abs(area)<1e-8||cull&&area>0)continue;
    const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
    if(minX>maxX||minY>maxY)continue;
    const shade=fragment?.(ids);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
     const u=((bx-x-.5)*(cy-y-.5)-(by-y-.5)*(cx-x-.5))/area,v=((cx-x-.5)*(ay-y-.5)-(cy-y-.5)*(ax-x-.5))/area,t=1-u-v;
     if(u<-.00001||v<-.00001||t<-.00001)continue;
     const z=u*coords[a+2]+v*coords[b+2]+t*coords[c+2],at=y*w+x;if(z>=buffer[at])continue;
     if(shade){if(shade(at,u,v,t)===false)continue;}buffer[at]=z;
    }
   }
  }
  for(const mesh of meshes)if(mesh.castShadow&&!mesh.material.isShadowMaterial)raster(transform(mesh,lightVP,shadowSize,shadowSize),mesh.geometry.index,shadowSize,shadowSize,shadowDepth);
  const shadow=(x,y,z)=>{
   const e=lightVP.elements,px=(e[0]*x+e[4]*y+e[8]*z+e[12]+1)*shadowSize/2,py=(1-e[1]*x-e[5]*y-e[9]*z-e[13])*shadowSize/2,pz=e[2]*x+e[6]*y+e[10]*z+e[14]-.0015;
   const ix=Math.round(px),iy=Math.round(py);if(ix<1||iy<1||ix>=shadowSize-1||iy>=shadowSize-1)return 1;
   let lit=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)lit+=pz<=shadowDepth[(iy+j)*shadowSize+ix+i]?1:0;return lit/9;
  };
  for(const mesh of meshes){
   const g=mesh.geometry,material=mesh.material;
   if(Array.isArray(material))throw Error('CPU baker requires split material primitives');
   const coords=transform(mesh,vp,width,height),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),world=new Float32Array(p.count*3),normals=new Float32Array(p.count*3),v3=new T.Vector3();
   for(let i=0;i<p.count;i++){v3.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray(world,i*3);if(n)v3.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix).toArray(normals,i*3);}
   const image=material.map?.image,normalImage=material.normalMap?.image,orm=material.roughnessMap?.image;
   // Prop masters use glTF texture transforms to preserve authored UV buffers.
   // All PBR channels share this transform; default building maps are identity.
   const textureMatrix=material.map?.matrix;
   const textureUV=id=>{const p=uv?new T.Vector2(uv.getX(id),uv.getY(id)):new T.Vector2();if(textureMatrix)p.applyMatrix3(textureMatrix);return p.toArray();};
   const sample=(image,u,v)=>{
    const x=Math.max(0,Math.min(image.width-1,u*image.width-.5)),y=Math.max(0,Math.min(image.height-1,(1-v)*image.height-.5)),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,at=(iy*image.width+ix)*4,at2=(Math.min(iy+1,image.height-1)*image.width+ix)*4,dx=ix+1<image.width?4:0,a=image.pixels;
    return [0,1,2].map(k=>(a[at+k]*(1-fx)+a[at+dx+k]*fx)*(1-fy)+(a[at2+k]*(1-fx)+a[at2+dx+k]*fx)*fy);
   };
   raster(coords,g.index,width,height,depth,ids=>{
    const pos=ids.map(id=>Array.from(world.subarray(id*3,id*3+3))),ns=ids.map(id=>Array.from(normals.subarray(id*3,id*3+3))),tex=ids.map(textureUV);
    const e1=pos[1].map((v,i)=>v-pos[0][i]),e2=pos[2].map((v,i)=>v-pos[0][i]),du1=tex[1][0]-tex[0][0],dv1=tex[1][1]-tex[0][1],du2=tex[2][0]-tex[0][0],dv2=tex[2][1]-tex[0][1],det=du1*dv2-dv1*du2;
    const tangent=normalize(e1.map((v,i)=>(v*dv2-e2[i]*dv1)/(det||1))),face=normalize(cross(e1,e2));
    return (at,a,b,c)=>{
     const position=pos[0].map((v,i)=>v*a+pos[1][i]*b+pos[2][i]*c),lit=shadow(...position);
     if(material.isShadowMaterial){const opacity=material.opacity*(1-lit);if(opacity<.005)return false;const pi=at*4;pixels[pi]=.025;pixels[pi+1]=.017;pixels[pi+2]=.01;pixels[pi+3]=opacity;return;}
     const u=tex[0][0]*a+tex[1][0]*b+tex[2][0]*c,v=tex[0][1]*a+tex[1][1]*b+tex[2][1]*c;
     let normal=normalize(ns[0].map((v,i)=>v*a+ns[1][i]*b+ns[2][i]*c));if(!n)normal=face;
     if(dot(normal,view)<0&&material.side===T.DoubleSide)normal=normal.map(v=>-v);
     if(normalImage&&Math.abs(det)>1e-10){
      const tn=sample(normalImage,u,v).map(v=>v/127.5-1);tn[0]*=material.normalScale.x;tn[1]*=material.normalScale.y;
      const orthogonal=normalize(tangent.map((v,i)=>v-normal[i]*dot(tangent,normal))),bitangent=cross(normal,orthogonal).map(v=>v*(det<0?-1:1));
      normal=normalize(normal.map((v,i)=>orthogonal[i]*tn[0]+bitangent[i]*tn[1]+v*tn[2]));
     }
     const base=image?sample(image,u,v).map(v=>linear[Math.max(0,Math.min(255,Math.round(v)))]):[1,1,1],surface=orm?sample(orm,u,v):[255,material.roughness*255,material.metalness*255];
     const ao=1-(1-surface[0]/255)*.65,rough=Math.max(.08,surface[1]/255),metal=surface[2]/255,ndv=Math.max(.01,dot(normal,view)),ndl=Math.max(0,dot(normal,sun)),ndh=Math.max(0,dot(normal,half)),vdh=Math.max(0,dot(view,half)),alpha=rough*rough,alpha2=alpha*alpha,den=ndh*ndh*(alpha2-1)+1,D=alpha2/(Math.PI*den*den),k=(rough+1)**2/8,G=ndv/(ndv*(1-k)+k)*ndl/(ndl*(1-k)+k),fresnel=(1-vdh)**5;
     const diffuseFill=Math.max(0,dot(normal,fill))*.65/Math.PI,hemisphere=(normal[1]*.5+.5),ambient=(.16+.22*hemisphere)*ao,pi=at*4,colors=[material.color.r,material.color.g,material.color.b],emissive=material.emissive;
     for(let channel=0;channel<3;channel++){
      const albedo=base[channel]*colors[channel],f0=.04*(1-metal)+albedo*metal,F=f0+(1-f0)*fresnel,specular=D*G*F/(4*ndv*Math.max(.01,ndl)),diffuse=albedo*(1-metal)*(1-F)/Math.PI;
      const envSpec=f0*(.18+.22*Math.pow(1-ndv,3))*(1-rough*.45)*ao;
      const lightColor=[1,.79,.57][channel],fillColor=[.53,.73,1][channel];
      const result=(diffuse+specular)*ndl*3.2*lightColor*lit+albedo*(ambient+diffuseFill*fillColor)*(1-metal*.8)+envSpec+[emissive.r,emissive.g,emissive.b][channel]*(material.emissiveIntensity??1);
      pixels[pi+channel]=aces(result*this.toneMappingExposure);
     }pixels[pi+3]=material.opacity;
    };
   },material.side===T.FrontSide);
  }
  // Resolve coverage in linear light, then encode sRGB. Keep premultiplied
  // edges correct so that desert sprites have no white/black fringe in Canvas.
  const out=this.domElement.pixels;
  for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
   const sum=[0,0,0];let alpha=0;
   for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const i=((y*2+dy)*width+x*2+dx)*4,a=pixels[i+3];alpha+=a;for(let k=0;k<3;k++)sum[k]+=pixels[i+k]*a;}
   const i=(y*this.width+x)*4;for(let k=0;k<3;k++)out[i+k]=alpha?srgb(sum[k]/alpha):0;out[i+3]=alpha/4*255;
  }
 }
}
