import {BUILDINGS} from './catalog.js';
import {TURRET_RIG} from './turret-rig.js';
import {directionIndex} from './sprite-animator.js';
import type {Point} from './config.js';
export const turretPivot=(b:Point):Point=>({x:b.x+TURRET_RIG.pivot[0]*BUILDINGS.turret.width,y:b.y+TURRET_RIG.pivot[1]*BUILDINGS.turret.width});
export function turretMuzzles(b:Point,angle:number):Point[]{return TURRET_RIG.muzzles[directionIndex(angle,TURRET_RIG.muzzles.length)].map(p=>({x:b.x+p[0]*BUILDINGS.turret.width,y:b.y+p[1]*BUILDINGS.turret.width}));}
