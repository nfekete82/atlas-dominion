import {MAP_HEIGHT,MAP_WIDTH,WORLD_HEIGHT,WORLD_WIDTH} from '../data/europe.js';
import {COUNTRY_STARTS} from '../data/countries.js';
import {createTopographyLayer} from './topography.js';
import {TurnGame} from '../engine/turn-game.js';

const W=MAP_WIDTH,H=MAP_HEIGHT;
const palette=(id:number):[number,number,number]=>{
  if(id===0)return [62,145,218];
  if(id<0)return [81,101,89];
  const hue=(id*137.508)%360;
  const channel=(h:number):number=>{
    const k=(h+hue/30)%12;
    return Math.round((0.55-0.19*Math.max(-1,Math.min(k-3,9-k,1)))*255);
  };
  return [channel(0),channel(8),channel(4)];
};
export class TurnMapRenderer {
  readonly canvas:HTMLCanvasElement;
  private ctx:CanvasRenderingContext2D;
  private raster=document.createElement('canvas');
  private terrain=createTopographyLayer();
  private borders=new Path2D();
  private selectedBorders:Path2D[]=[];
  private layout={scale:1,x:0,y:0};
  game:TurnGame;
  selected:number|null=null;
  target:number|null=null;
  constructor(canvas:HTMLCanvasElement,game:TurnGame){
    this.canvas=canvas;this.ctx=canvas.getContext('2d')!;
    this.raster.width=W;this.raster.height=H;this.game=game;
    this.buildBorders();
  }
  setGame(game:TurnGame):void{
    this.game=game;this.buildBorders();this.render();
  }
  private buildBorders():void{
    this.borders=new Path2D();
    this.selectedBorders=this.game.provinces.map(()=>new Path2D());
    const ids=this.game.cellProvince,wx=WORLD_WIDTH/W,hy=WORLD_HEIGHT/H;
    const add=(id:number,x1:number,y1:number,x2:number,y2:number)=>{
      if(id<0)return;
      const p=this.selectedBorders[id];
      p.moveTo(x1,y1);p.lineTo(x2,y2);
      this.borders.moveTo(x1,y1);this.borders.lineTo(x2,y2);
    };
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const i=y*W+x,id=ids[i];if(id<0)continue;
      const xx=x*wx,yy=y*hy;
      if(y===0||ids[i-W]!==id)add(id,xx,yy,xx+wx,yy);
      if(x===0||ids[i-1]!==id)add(id,xx,yy,xx,yy+hy);
      if(x===W-1||ids[i+1]!==id)add(id,xx+wx,yy,xx+wx,yy+hy);
      if(y===H-1||ids[i+W]!==id)add(id,xx,yy+hy,xx+wx,yy+hy);
    }
  }
  pick(clientX:number,clientY:number):number{
    const rect=this.canvas.getBoundingClientRect();
    const x=(clientX-rect.left-this.layout.x)/this.layout.scale;
    const y=(clientY-rect.top-this.layout.y)/this.layout.scale;
    if(x<0||y<0||x>=WORLD_WIDTH||y>=WORLD_HEIGHT)return -1;
    return this.game.cellProvince[Math.floor(y/WORLD_HEIGHT*H)*W+Math.floor(x/WORLD_WIDTH*W)];
  }
  render():void{
    const rect=this.canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    this.canvas.width=Math.round(rect.width*dpr);
    this.canvas.height=Math.round(rect.height*dpr);
    const c=this.ctx;
    c.setTransform(dpr,0,0,dpr,0,0);
    c.fillStyle='#071925';c.fillRect(0,0,rect.width,rect.height);
    const scale=Math.min(rect.width/WORLD_WIDTH,rect.height/WORLD_HEIGHT);
    const x=(rect.width-WORLD_WIDTH*scale)/2,y=(rect.height-WORLD_HEIGHT*scale)/2;
    this.layout={scale,x,y};
    const pix=this.raster.getContext('2d')!;
    const img=pix.createImageData(W,H);
    for(let i=0;i<this.game.cellProvince.length;i++){
      const id=this.game.cellProvince[i];
      if(id<0)continue;
      const province=this.game.provinces[id];
      const [red,green,blue]=palette(province.owner);
      const k=i*4;img.data[k]=red;img.data[k+1]=green;img.data[k+2]=blue;img.data[k+3]=255;
    }
    pix.putImageData(img,0,0);
    c.save();c.translate(x,y);c.scale(scale,scale);
    c.imageSmoothingEnabled=false;
    c.drawImage(this.raster,0,0,WORLD_WIDTH,WORLD_HEIGHT);
    if(this.terrain.dataset.ready==='true'){
      c.globalAlpha=.65;c.drawImage(this.terrain,0,0,WORLD_WIDTH,WORLD_HEIGHT);c.globalAlpha=1;
    }
    c.strokeStyle='rgba(8,22,30,.55)';c.lineWidth=1.6;c.stroke(this.borders);
    for(const [id,color] of [[this.selected,'#ffe5a3'],[this.target,'#f4a07c']] as Array<[number|null,string]>){
      if(id===null||id<0)continue;
      c.strokeStyle=color;c.lineWidth=5;c.stroke(this.selectedBorders[id]);
    }
    const size=Math.max(13,Math.min(23,17/scale));
    for(const p of this.game.provinces){
      if(!p.capital&&p.owner!==0&&p.id!==this.selected&&p.id!==this.target)continue;
      const xx=((p.center%W)+.5)/W*WORLD_WIDTH;
      const yy=(Math.floor(p.center/W)+.5)/H*WORLD_HEIGHT;
      c.textAlign='center';c.textBaseline='middle';
      const named=p.capital?COUNTRY_STARTS[p.id]?.name:'';
      if(named){
        c.font='700 '+size+'px system-ui';c.lineWidth=3.5;c.strokeStyle='#0a1a23';
        c.fillStyle=p.owner===0?'#fff2bd':'#eff1e9';
        c.strokeText(named,xx,yy-10,125);c.fillText(named,xx,yy-10,125);
      }
      c.font='700 '+Math.max(13,size-2)+'px system-ui';c.lineWidth=3;
      c.strokeStyle='#0a1a23';c.fillStyle='#f7e0ae';
      const label=String(p.troops)+(p.cityLevel?' ◆':'');
      c.strokeText(label,xx,yy+11,110);c.fillText(label,xx,yy+11,110);
    }
    c.restore();
  }
}
