/** Render-only deterministic layout. No mutation of maps, saves or navigation. */
export function oasisRandom(seed){
 let s=seed>>>0;return ()=>{s=(s+0x6d2b79f5)>>>0;let n=s;
 n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
 return ((n^(n>>>14))>>>0)/4294967296;};
}
export function segmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function safeOasis(p,{world,startRegions=[],heightAt},placed=[]){
 const r=p.radius*1.35,size=world.size,g=world.generated;
 if(p.x<r+180||p.y<r+180||p.x>size-r-180||p.y>size-r-180)return false;
 if(g.sites.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<r+340))return false;
 if(startRegions.some(s=>Math.hypot(p.x-s.center.x,p.y-s.center.y)<r+s.radius+180))return false;
 if(g.corridors.some(([a,b])=>segmentDistance(p,a,b)<r+150))return false;
 if(g.ruins.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<r+Math.hypot(s.width,s.depth)*.5+100))return false;
 if(placed.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<r+s.radius*1.35+400))return false;
 // Sample the entire footprint, not only its centre: reject cliffs and
 // protected road shoulders even when a candidate straddles them.
 for(let z=-r;z<=r;z+=r/5)for(let x=-r;x<=r;x+=r/5){
  if(!world.walkable({x:p.x+x,y:p.y+z}))return false;
  const h=heightAt(p.x+x,p.y+z);
  if(!Number.isFinite(h)||Math.abs(heightAt(p.x+x+8,p.y+z)-h)>1.0||Math.abs(heightAt(p.x+x,p.y+z+8)-h)>1.0)return false;
 }
 return true;
}
export function generateOases(options){
 const {world,seed=world.seed}=options;
 if(!world.generated||world.mapVersion<15)return [];
 const r=oasisRandom(seed^0x729bad31),result=[];
 const target=world.generated.sites.length===4?3:Math.min(4,2+Math.floor(world.size**2/60000000));
 for(let trial=0;trial<2400&&result.length<target;trial++){
  const p={id:result.length,x:world.size*(.07+r()*.86),y:world.size*(.07+r()*.86),
   radius:105+r()*45,type:['water','dry','semi'][result.length%3],phase:r()*Math.PI*2,
   aspect:.62+r()*.23,rotation:r()*Math.PI,seed:Math.floor(r()*4294967296)};
  if(safeOasis(p,options,result))result.push(p);
 }
 return result;
}
// Continuous irregular outline shared by mesh generation and planting.
export function oasisContour(angle,phase){return 1+.13*Math.sin(angle*3+phase)+.085*Math.sin(angle*5-phase*1.7)+.045*Math.cos(angle*9+phase);}
export function oasisPoint(o,angle,radius){
 const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius*o.aspect,c=Math.cos(o.rotation),s=Math.sin(o.rotation);
 return {x:o.x+x*c-z*s,y:o.y+x*s+z*c};
}
