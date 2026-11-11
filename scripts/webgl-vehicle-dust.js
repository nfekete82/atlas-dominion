/** Bounded, visual-only desert vehicle dust. Called once per 20-Hz state tick. */
export const VEHICLE_DUST_CAP=120;
export const VEHICLE_DUST_CAP_LITE=28;
const KINDS=new Set(['rover','tank','artillery']);
export function vehicleDustEligible({kind,moving,dx,dz,biome='desert',visible=true,
 enabled=true,distanceToCamera=0,lite=false,tick=0,id=0}){
 if(!enabled||biome!=='desert'||!visible||!moving||!KINDS.has(kind))return false;
 const step=Math.hypot(dx,dz);
 if(step<3||step>85)return false; // actual motion only, no idle or teleport
 if(distanceToCamera>(lite?1150:1850))return false;
 return (Math.floor(tick)+Math.floor(id)*7)%3===0;
}
export function vehicleDustTail({x,y},dx,dz,width=76){
 const len=Math.hypot(dx,dz);
 if(len<.001)return {x,y};
 const back=Math.min(38,Math.max(17,width*.27));
 return {x:x-dx/len*back,y:y-dz/len*back};
}
