/**
 * Single source of truth for visual hit points in the optional 3D renderer.
 * Uses the same authoritative HP / catalog maximum as classic Sandforge.
 * Neither function mutates simulation data.
 */
export const healthFraction=(hp,maxHp)=>{
 const value=Number(hp),max=Number(maxHp);
 if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0)return 0;
 return Math.min(1,Math.max(0,value/max));
};
export const healthColor=fraction=>{
 const f=Math.min(1,Math.max(0,Number(fraction)||0));
 return f>.7?'#24e568':f>.4?'#f6d44b':f>.2?'#f29a36':'#ed5146';
};
