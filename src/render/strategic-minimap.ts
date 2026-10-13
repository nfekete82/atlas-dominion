import {Game,NEUTRAL,WATER,pointToIndex,type Point} from '../engine/game.js';
import {MAP_HEIGHT,MAP_WIDTH,WORLD_WIDTH,WORLD_HEIGHT} from '../data/europe.js';
export const MINIMAP_WIDTH=240,MINIMAP_HEIGHT=130;

export function minimapTarget(x:number,y:number,width:number,height:number):Point|null {
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(width)||
     !Number.isFinite(height)||width<=0||height<=0||x<0||y<0||x>width||y>height)return null;
  return {x:Math.min(MAP_WIDTH-1,Math.floor(x/width*MAP_WIDTH)),
    y:Math.min(MAP_HEIGHT-1,Math.floor(y/height*MAP_HEIGHT))};
}
export function minimapCombatPoints(game:Game):Array<{index:number;friendly:boolean}> {
  return game.attackOrders.filter(o=>!o.returning&&
    (o.factionId===0||o.targetOwner===0)).map(order=>({
      index:order.contested??order.lastCaptured??pointToIndex(order.anchor),
      friendly:order.factionId===0,
    }));
}
function color(hex:string):[number,number,number]{
  const match=/^#([a-f0-9]{6})$/i.exec(hex);
  if(!match)return [125,151,148];
  return [parseInt(match[1].slice(0,2),16),
    parseInt(match[1].slice(2,4),16),parseInt(match[1].slice(4,6),16)];
}
export class StrategicMinimap {
  private readonly ctx:CanvasRenderingContext2D;
  constructor(readonly canvas:HTMLCanvasElement){
    canvas.width=MINIMAP_WIDTH;canvas.height=MINIMAP_HEIGHT;
    const context=canvas.getContext('2d');
    if(!context)throw Error('Minimap: Canvas 2D nicht verfügbar.');
    this.ctx=context;
  }
  invalidate():void {this.ctx.clearRect(0,0,MINIMAP_WIDTH,MINIMAP_HEIGHT); }
  render(game:Game,viewport:{x:number;y:number;width:number;height:number},
    tickPulse=0):void {
    // Real ownership is only rasterized when the simulation advances;
    // camera viewport and battle points are redrawn on every UI refresh.
    const c=this.ctx;
    const image=c.createImageData(MINIMAP_WIDTH,MINIMAP_HEIGHT);
    const colors=game.factions.map(f=>color(f.color));
    for(let y=0;y<MINIMAP_HEIGHT;y++)for(let x=0;x<MINIMAP_WIDTH;x++){
      const owner=game.owner[(y*2)*MAP_WIDTH+x*2],p=(y*MINIMAP_WIDTH+x)*4;
      const rgb=owner===WATER?[13,32,43]:owner===NEUTRAL?[62,75,68]:
        owner===0?[51,162,202]:game.isAllied(0,owner)?[95,166,128]:colors[owner]??[140,140,140];
      const dark=owner>0?.8:.95;
      image.data[p]=Math.round(rgb[0]*dark);
      image.data[p+1]=Math.round(rgb[1]*dark);
      image.data[p+2]=Math.round(rgb[2]*dark);
      image.data[p+3]=255;
    }
    c.putImageData(image,0,0);
    // Only active real military orders produce conflict markers.
    for(const p of minimapCombatPoints(game)){
      const x=(p.index%MAP_WIDTH)/MAP_WIDTH*MINIMAP_WIDTH;
      const y=Math.floor(p.index/MAP_WIDTH)/MAP_HEIGHT*MINIMAP_HEIGHT;
      c.fillStyle=p.friendly?'#6ce5ff':'#ff7777';
      c.strokeStyle='#0b1720';c.lineWidth=1.5;
      c.beginPath();c.arc(x,y,2.3+(tickPulse%5)*.17,0,Math.PI*2);c.fill();c.stroke();
    }
    const vx=viewport.x/WORLD_WIDTH*MINIMAP_WIDTH;
    const vy=viewport.y/WORLD_HEIGHT*MINIMAP_HEIGHT;
    const vw=viewport.width/WORLD_WIDTH*MINIMAP_WIDTH;
    const vh=viewport.height/WORLD_HEIGHT*MINIMAP_HEIGHT;
    c.fillStyle='rgba(225,245,229,.09)';
    c.strokeStyle='#f5ecc8';c.lineWidth=1;
    c.fillRect(Math.max(0,vx),Math.max(0,vy),Math.min(MINIMAP_WIDTH,vw),Math.min(MINIMAP_HEIGHT,vh));
    c.strokeRect(vx+.5,vy+.5,vw,vh);
  }
}
