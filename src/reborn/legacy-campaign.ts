import {distance,type Point,type Owner} from './config.js';

/** Legacy recon used map-array order, so it revisited neutral capture points
 * while an adjacent, publicly hostile frontier remained unobserved. Ownership
 * is public strategic information; this does not inspect enemy entities. */
export function rankLegacyFrontiers<T extends {id:number;owner:Owner;point:Point}>(frontiers:readonly T[],from:Point):T[]{
 return [...frontiers].sort((a,b)=>Number(b.owner===0)-Number(a.owner===0)||distance(from,a.point)-distance(from,b.point)||a.id-b.id);
}
