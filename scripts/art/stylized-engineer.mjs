import {buildSoldier} from './stylized-soldier.mjs';

// Same underlying 15-bone animation skeleton, soldier silhouette and shared
// palette. Distinct equipment, tool, and helmet; independent blue/red exports.
export function buildEngineer(owner){
  return buildSoldier(owner,'engineer');
}
