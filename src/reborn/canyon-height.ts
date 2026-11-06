import type {CanyonRidge} from './canyon-front.js';

/** The optional WebGL renderer projects the existing 2D navigation map onto
 * this continuous heightfield; coordinates, AI, collision and saves stay 2D.
 * Never infer passable routes from elevation: World.blocked remains authority. */
const clamp=(n:number,a:number,b:number):number=>Math.max(a,Math.min(b,n));
const smooth=(t:number):number=>{const x=clamp(t,0,1);return x*x*(3-2*x);};
export function ridgeCenterY(ridge:CanyonRidge,x:number):number{
 const points=ridge.spine;
 if(x<=points[0].x)return points[0].y;
 for(let i=1;i<points.length;i++)if(x<=points[i].x){
  const a=points[i-1],b=points[i],t=(x-a.x)/(b.x-a.x);
  return a.y+(b.y-a.y)*t;
 }
 return points.at(-1)!.y;
}
export function rampAtX(ridge:CanyonRidge,x:number):boolean{
 return ridge.ramps.some(r=>Math.abs(x-r.x)<=r.width*.5);
}
export function canyonHeightAt(seed:number,ridges:readonly CanyonRidge[],x:number,z:number):number{
 const dune=4.8*Math.sin(x*.0053+seed*.002)*Math.cos(z*.0038)
  +2.9*Math.sin(z*.012+x*.009)+1.8*Math.cos(z*.022-x*.015);
 const ridge=ridges[0];
 if(!ridge)return dune;
 const a=ridge.spine[0].x,b=ridge.spine.at(-1)!.x;
 const span=smooth((x-a+180)/180)*smooth((b+180-x)/180);
 if(span<=0)return dune;
 const passage=rampAtX(ridge,x);
 const halfSpan=passage?235:21,delta=ridgeCenterY(ridge,x)-z;
 return dune+ridge.height*span*smooth((delta+halfSpan)/(halfSpan*2));
}
export function canyonGroundSampler(seed:number,ridges:readonly CanyonRidge[]){
 return (x:number,z:number)=>canyonHeightAt(seed,ridges,x,z);
}
