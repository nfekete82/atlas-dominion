import type {UnitKind} from './catalog.js';
import type {Point} from './config.js';

/** Visual-only role markers; never tied to team color, HP or selection logic. */
export type InfantryRole='infantry'|'engineer'|'medic';
export interface RoleStyle {accent:string;pack:string;trim:string;label:string}
export const ROLE_STYLES:Readonly<Record<InfantryRole,RoleStyle>>={
  infantry:{accent:'#8ccaf4',pack:'#82745d',trim:'#5084bb',label:'SCHÜTZE'},
  engineer:{accent:'#f3bc54',pack:'#524432',trim:'#e6aa3c',label:'PIONIER'},
  medic:{accent:'#83e5c2',pack:'#e3e8d8',trim:'#2eaf91',label:'SANITÄTER'}
};
export function infantryRole(kind:UnitKind):InfantryRole|null {
  return kind==='infantry'||kind==='engineer'||kind==='medic'?kind:null;
}
export function roleStyle(kind:UnitKind):RoleStyle|null {
  const role=infantryRole(kind);return role?ROLE_STYLES[role]:null;
}

/** Compact hand-painted equipment silhouettes behind the existing animation. */
export function drawSupportPack(c:CanvasRenderingContext2D,kind:UnitKind,p:Point,angle:number):void {
  if(kind!=='engineer'&&kind!=='medic')return;
  const role=ROLE_STYLES[kind],side=Math.cos(angle)>=0?-1:1;
  const x=p.x+side*13,y=p.y-34;
  c.save();c.translate(x,y);c.rotate(side*.08);
  c.fillStyle='#392d22a8';c.fillRect(-8,-7,18,23);
  c.fillStyle=role.pack;c.fillRect(-9,-11,17,21);
  c.fillStyle=role.trim;c.fillRect(-9,-11,17,3);
  c.fillStyle='#282921';c.fillRect(-9,-2,17,2);
  if(kind==='engineer'){
    // Deep silhouette: tall antenna and external tool canister.
    c.fillStyle='#382e21';c.fillRect(8,-8,6,19);
    c.fillStyle='#e3ad45';c.fillRect(9,-6,4,13);
    c.fillStyle='#282d2a';c.fillRect(-4,-19,2,8);
    c.fillStyle='#f0c467';c.fillRect(-6,-20,6,3);
    c.strokeStyle='#f0c467';c.lineWidth=2;c.lineCap='round';
    c.beginPath();c.moveTo(-4,5);c.lineTo(3,-3);c.stroke();
    c.beginPath();c.moveTo(2,-4);c.lineTo(5,-8);c.moveTo(3,-3);c.lineTo(8,-4);c.stroke();
  }else{
    // Light-colored medical field kit with a large high-contrast teal cross.
    c.fillStyle='#f1eddb';c.fillRect(-6,-8,12,15);
    c.fillStyle='#279a81';c.fillRect(-1,-6,3,12);
    c.fillRect(-5,-2,11,3);
    c.fillStyle='#536c60';c.fillRect(8,-7,5,16);
    c.fillStyle='#d4e6db';c.fillRect(9,-6,3,11);
  }
  c.restore();
}

/** Small shoulder patch stays on top of the sprite; the backpack stays behind. */
export function drawSupportPatch(c:CanvasRenderingContext2D,kind:UnitKind,p:Point,angle:number):void {
  if(kind!=='engineer'&&kind!=='medic')return;
  const side=Math.cos(angle)>=0?1:-1;
  c.save();
  c.fillStyle='#202a28';c.fillRect(p.x+side*5-4,p.y-43,9,7);
  c.fillStyle=ROLE_STYLES[kind].accent;c.fillRect(p.x+side*5-3,p.y-42,7,5);
  if(kind==='medic'){
    c.fillStyle='#f5f7ed';c.fillRect(p.x+side*5,p.y-41,2,4);
    c.fillRect(p.x+side*5-1,p.y-40,4,2);
  }else{
    c.fillStyle='#382d1c';c.fillRect(p.x+side*5,p.y-41,2,4);
  }
  c.restore();
}

/** All three light infantry roles get compact, permanent ground-readable icons. */
export function drawInfantryRoleBadge(c:CanvasRenderingContext2D,kind:UnitKind,owner:number,p:Point):void {
  const role=infantryRole(kind);if(!role)return;
  const accent=ROLE_STYLES[role].accent,x=p.x+17,y=p.y-6;
  c.save();c.translate(x,y);
  c.fillStyle='#17211ee9';c.strokeStyle=owner===0?'#72bee9':'#e8796b';
  c.lineWidth=1.3;c.beginPath();c.arc(0,0,7.2,0,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle=accent;c.fillStyle=accent;c.lineCap='round';
  if(role==='medic'){
    c.fillRect(-1.4,-5,2.8,10);c.fillRect(-5,-1.4,10,2.8);
  }else if(role==='engineer'){
    c.lineWidth=2;c.beginPath();c.moveTo(-3.5,4);c.lineTo(3,-3);c.stroke();
    c.beginPath();c.moveTo(1,-4);c.lineTo(4,-5);c.moveTo(3,-3);c.lineTo(5,-1);c.stroke();
    c.fillStyle='#f6e1b6';c.beginPath();c.arc(-4,4,1.3,0,Math.PI*2);c.fill();
  }else{
    // Rifle: elongated barrel and short grip, distinct from the wrench.
    c.lineWidth=2;c.beginPath();c.moveTo(-4,2);c.lineTo(4,-2);c.moveTo(0,0);c.lineTo(2,4);c.stroke();
    c.lineWidth=1;c.beginPath();c.moveTo(3,-4);c.lineTo(5,-4);c.stroke();
  }
  c.restore();
}
