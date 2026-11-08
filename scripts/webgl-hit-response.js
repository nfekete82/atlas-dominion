/** C&C-style combat readability without importing gameplay or allocating
 * extra particles/meshes per frame. Every profile is visual only.
 * The authoritative simulation decides damage and hits.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const HIT_RESPONSE={
 armor:Object.freeze({kind:'armor',sparkCount:7,chipCount:3,dustCount:1,duration:.18}),
 sand:Object.freeze({kind:'sand',sparkCount:1,chipCount:0,dustCount:5,duration:.30}),
 flesh:Object.freeze({kind:'infantry',sparkCount:1,chipCount:0,dustCount:2,duration:.16}),
 explosion:Object.freeze({kind:'explosion',sparkCount:0,chipCount:0,dustCount:0,duration:.58})
};
export function hitResponseFor(shot){
 if(shot?.weapon==='rocket'||shot?.weapon==='cannon'||shot?.weapon==='bomb')
  return HIT_RESPONSE.explosion;
 if(shot?.armored||shot?.targetClass==='structure'||shot?.targetClass==='armor')
  return HIT_RESPONSE.armor;
 return shot?.targetClass==='infantry'?HIT_RESPONSE.flesh:HIT_RESPONSE.sand;
}
/** Authored rockets don't draw a hitscan line. Machine-gun traces are SHORT
 * bright moving slivers, not persistent blue/red laser beams across the map.
 */
export function tracerWindow(shot,ttl=.65){
 if(!shot||shot.weapon==='rocket'||shot.weapon==='bomb')return null;
 const elapsed=clamp(1-(shot.life??ttl)/ttl);
 const tip=clamp(elapsed*4.25+.03);
 const span=shot.weapon==='cannon'?.20:.105;
 return {from:Math.max(0,tip-span),to:tip,alpha:1-elapsed*.60};
}
export function impactHeight(shot){
 const given=shot?.impactElevation;
 if(Number.isFinite(given))return clamp(given,6,185);
 return shot?.armored?43:18;
}
/** Ailing ground vehicles emit subtle smoke from their engines, only if
 * visible, at most one puff / 0.5 seconds per nearby vehicle. */
export function damagedVehicleIntensity(unit,maxHp){
 if(!unit||!['tank','rover','artillery'].includes(unit.kind)||!(maxHp>0)||unit.hp<=0)return 0;
 const health=unit.hp/maxHp;
 if(health>.51)return 0;
 return clamp((.51-health)/.40,0,1);
}
