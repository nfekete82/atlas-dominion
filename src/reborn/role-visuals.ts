import type {UnitKind} from './catalog.js';
export const ROLE_VISUALS={infantry:{color:'#277fce',name:'Soldat'},heavy:{color:'#277fce',name:'Soldat'},medic:{color:'#269b62',name:'Sanitäter'},engineer:{color:'#d69d1c',name:'Pionier'}} as const;
export type InfantryRole=keyof typeof ROLE_VISUALS;
export const hasRole=(kind:UnitKind):kind is InfantryRole=>Object.hasOwn(ROLE_VISUALS,kind);
/** Vector paths shared by world badges and Retina menu canvases; no font glyphs. */
export function drawRoleBadge(c:CanvasRenderingContext2D,kind:UnitKind,x:number,y:number,diameter=12):void {
 if(!hasRole(kind))return;
 c.save();c.translate(x,y);c.scale(diameter/16,diameter/16);
 c.fillStyle=ROLE_VISUALS[kind].color;c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();c.fillStyle='#fff';
 if(kind==='medic'){c.fillRect(-1.5,-5,3,10);c.fillRect(-5,-1.5,10,3);}
 else if(kind==='engineer'){c.rotate(-.65);c.fillRect(-1,0,2,6);c.fillRect(-4,-4,8,4);}
 else {c.rotate(-.45);c.fillRect(-5,-1.5,9,2.5);c.fillRect(3,-1,3,1);c.fillRect(-6,-.5,2,3);c.fillRect(-1,1,2,3);c.fillRect(0,-3,2,2);}
 c.restore();
}
const badges=new Map<UnitKind,string>();
/** A separate fixed-size layer keeps the full portrait visible in every menu. */
export function roleBadgeMarkup(kind:UnitKind):string {
 if(!hasRole(kind))return '';
 let url=badges.get(kind);if(!url){const c=document.createElement('canvas');c.width=c.height=28;drawRoleBadge(c.getContext('2d')!,kind,14,14,28);url=c.toDataURL();badges.set(kind,url);}
 return `<span class="role-badge" data-role="${kind}" role="img" aria-label="${ROLE_VISUALS[kind].name}" style="background-image:url('${url}')"></span>`;
}
export function drawRank(c:CanvasRenderingContext2D,level:number,x:number,y:number,size=9):void {
 if(!level)return;c.save();c.translate(x,y);c.scale(size/10,size/10);c.strokeStyle=level===3?'#f5c85e':'#e8dfbf';c.fillStyle='#f5c85e';c.lineWidth=1.4;
 if(level===3){c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?2.1:5;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();}
 else for(let i=0;i<level;i++){c.beginPath();c.moveTo(-4,2+i*3);c.lineTo(0,-1+i*3);c.lineTo(4,2+i*3);c.stroke();}c.restore();
}
