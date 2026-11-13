/** Measured architectural constraints. Source GLBs and gameplay widths stay
 * untouched. The barracks doorway must clear the standing infantry GLB. */
export const BARRACKS_ARCHITECTURE=Object.freeze({
 sourceWidth:20.200000762939453,
 sourceDoorHeight:2.2549999952316284,
 sourceLowestRoof:4.215000152587891,
 renderWidth:158*1.20,
 soldierHeight:61*.56,
 doorClearanceRatio:1.10
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
 foundations:'existing ground registration and service paving',
 fence:'existing instanced posts, rails and wire'
});
