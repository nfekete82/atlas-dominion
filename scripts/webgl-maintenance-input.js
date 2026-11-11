/** Pure WebGL input helpers for deterministic, rotation-aware maintenance targeting.
 * Gameplay owns repairs; this module only routes player clicks to a site.
 */
const kinds=Object.freeze({
 airfield:new Set(['bomber','scout']),
 factory:new Set(['rover','tank','artillery'])
});
const headings=[0,Math.PI,Math.PI/2,Math.PI*1.5];
export function selectedMaintenanceKind(units,selected){
 const picked=units.filter(u=>selected.has(u.id)&&u.owner===0&&u.hp>0&&!u.carrier);
 const planes=picked.some(u=>kinds.airfield.has(u.kind));
 const vehicles=picked.some(u=>kinds.factory.has(u.kind));
 return planes&&!vehicles?'airfield':vehicles&&!planes?'factory':null;
}
export function serviceFootprintContains(base,point){
 if(!base||!point||!kinds[base.kind]||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
 const angle=headings[base.facing??0]??0,c=Math.cos(angle),s=Math.sin(angle);
 const dx=point.x-base.x,dz=point.y-base.y;
 const localX=dx*c-dz*s,localZ=dx*s+dz*c;
 // Includes central hall and each outdoor service bay; not the nearby desert.
 return base.kind==='factory'
  ?localX>=-133&&localX<=274&&localZ>=-74&&localZ<=181
  :localX>=-380&&localX<=220&&localZ>=-205&&localZ<=412;
}

/** Right-click targeting precedence. Ground-based enemies standing on a
 * friendly airport runway/factory apron are still ATTACK TARGETS, not repair
 * facility clicks. This decision only routes input; Simulation.command()
 * authoritatively validates ownership, weapon and attack range. */
export function maintenanceClickAllowed({enemy=null,attackMode=false,rallyMode=false,
 strategicTargetMode=false,building=false,hasSelectedUnits=false,
 hasSelectedBase=false}={}){
 return !enemy&&!attackMode&&!rallyMode&&!strategicTargetMode&&
  !building&&hasSelectedUnits&&!hasSelectedBase;
}
