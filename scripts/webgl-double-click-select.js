/** Double-click selects the SAME kind among currently visible friendly units.
 * Stateless and deterministic: projection is supplied by the WebGL view.
 * No map-wide reveals, enemy picks, cargo, or changes to gameplay orders. */
export function sameKindVisibleUnits(units,entries,kind,{project,isVisible=()=>true}={}){
 if(!kind||typeof project!=='function')return [];
 const matching=[];
 for(const unit of units){
  if(unit.owner!==0||unit.kind!==kind||unit.hp<=0||unit.carrier)continue;
  const entry=entries.get(unit.id);
  if(!entry||entry.node?.visible===false||!entry.node)continue;
  const ndc=project(entry.node,unit);
  if(!ndc||![ndc.x,ndc.y,ndc.z].every(Number.isFinite))continue;
  if(ndc.x < -1||ndc.x > 1||ndc.y < -1||ndc.y > 1||ndc.z < -1||ndc.z > 1)continue;
  if(!isVisible(ndc,unit))continue;
  matching.push(unit.id);
 }
 return matching;
}
