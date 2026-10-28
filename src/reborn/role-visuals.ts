import type {UnitKind} from './catalog.js';
import type {Point} from './config.js';

/** Clear, compact role markers; the existing 3D-derived soldier sprites stay unmodified. */
export type InfantryRole='infantry'|'engineer'|'medic';
export interface RoleStyle {accent:string;label:string}
export const ROLE_STYLES:Readonly<Record<InfantryRole,RoleStyle>>={
  infantry:{accent:'#277fce',label:'SCHÜTZE'},
  engineer:{accent:'#d69d1c',label:'PIONIER'},
  medic:{accent:'#269b62',label:'SANITÄTER'}
};
export const ROLE_BADGE_RADIUS=5.3;
export function infantryRole(kind:UnitKind):InfantryRole|null {
  return kind==='infantry'||kind==='engineer'||kind==='medic'?kind:null;
}
export function roleStyle(kind:UnitKind):RoleStyle|null {
  const role=infantryRole(kind);return role?ROLE_STYLES[role]:null;
}

/**
 * Just one small colored disk with a white pictogram.
 * No bulky backpacks, no extra equipment hanging off the animation.
 * Badge colors denote roles; uniform colors still denote factions.
 */
export function drawInfantryRoleBadge(c:CanvasRenderingContext2D,kind:UnitKind,_owner:number,p:Point):void {
  const role=infantryRole(kind);if(!role)return;
  c.save();
  c.translate(p.x+14,p.y-5);
  c.fillStyle=ROLE_STYLES[role].accent;
  c.strokeStyle='#152329';
  c.lineWidth=.7;
  c.beginPath();c.arc(0,0,ROLE_BADGE_RADIUS,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle='#fff';
  c.strokeStyle='#fff';
  if(role==='medic'){
    // White medical cross, large enough to survive normal RTS zoom.
    c.fillRect(-.9,-3.3,1.8,6.6);
    c.fillRect(-3.3,-.9,6.6,1.8);
  }else if(role==='engineer'){
    // White hammer: flat head plus a clearly separate handle.
    c.rotate(-Math.PI/4);
    c.fillRect(-.72,-1.3,1.44,4.6);
    c.fillRect(-3.3,-3,6.6,1.9);
  }else{
    // White rifle silhouette, distinct from the hammer and medical cross.
    c.rotate(-.28);
    c.fillRect(-3.4,-.85,6.6,1.7);
    c.fillRect(2.7,-.43,1.7,.85);
    c.fillRect(-2.5,.6,1.2,2.5);
    c.lineWidth=1.1;
    c.beginPath();c.moveTo(-3.25,-.1);c.lineTo(-4,-1.7);c.stroke();
  }
  c.restore();
}
