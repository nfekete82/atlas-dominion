/** Measured architectural constraints. Source GLBs and gameplay widths stay
 * untouched. The barracks doorway must clear the standing infantry GLB. */
export const BARRACKS_ARCHITECTURE=Object.freeze({
 sourceWidth:20.200000762939453,
 sourceDoorHeight:2.2549999952316284,
 sourceLowestRoof:4.215000152587891,
 renderWidth:158*1.27,
 soldierHeight:61*.56,
 // Both shipped GLBs place the door sill at Y=2.5-1.13=1.37.
 // Ground the building here, so the infantry exits directly onto terrain.
 sourceGroundY:1.37,
 doorClearanceRatio:1.16
});
export function barracksArchitecturalHeightScale(){
 const p=BARRACKS_ARCHITECTURE;
 const horizontal=p.renderWidth/p.sourceWidth;
 return p.soldierHeight*p.doorClearanceRatio/(p.sourceDoorHeight*horizontal);
}
export const BUILDING_DETAIL_STANDARD=Object.freeze({
 infantryDoorClearance:61*.56*1.10,
 sourceGeometry:'authored GLB; runtime clone only',
 decoration:'shared existing yard modules; no additional dressing',
 texelDensity:'HQ3 world surface / UV area',
 foundations:'Kaserne: door sill on terrain, external slab removed',
 fence:'existing instanced posts, rails and wire'
});
