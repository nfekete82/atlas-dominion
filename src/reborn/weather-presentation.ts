import type {Renderer} from './renderer.js';
/** Small reusable haze texture and bounded, seeded sand layers. Never draws entities. */
export class WeatherPresentation {
 private haze:HTMLCanvasElement|null=null;
 draw(r:Renderer,reducedMotion:boolean):void {
  const g=r.game,level=g.weather.intensity;if(level<=0)return;
  const c=r.context;
  if(!this.haze){const tile=this.haze=document.createElement('canvas');tile.width=256;tile.height=128;const t=tile.getContext('2d')!,shade=t.createLinearGradient(0,0,256,128);shade.addColorStop(0,'#302513');shade.addColorStop(.45,'#ad7e38');shade.addColorStop(1,'#63451e');t.fillStyle=shade;t.fillRect(0,0,256,128);}
  c.save();c.globalAlpha=level*.33;c.drawImage(this.haze,0,0,r.width,r.height);
  c.globalAlpha=level*.105;c.fillStyle='#17130d';c.fillRect(0,0,r.width,r.height);
  // Dust must remain visible even when optional combat particles are switched off.
  if(!reducedMotion){
   const time=g.time;c.lineCap='round';
   // Fixed screen-space budget: larger battles and DPR never add particles.
   for(let layer=0;layer<3;layer++){
    c.lineWidth=layer===0?1.1:layer===1?1.75:2.45;c.strokeStyle=layer===2?'#ebc47b':'#fae5b5';
    for(let i=0;i<42;i++){
     const seed=((Math.imul(i+1,73856093)^Math.imul(layer+1,19349663)^g.seed)>>>0)/4294967296;
     const x=((seed*r.width*3+time*(32+layer*25))%(r.width+80))-40;
     const y=((seed*713.23+layer*.21)%1)*r.height+Math.sin(time*.3+seed*29)*3;
     if(!g.canSee(0,r.world({x,y})))continue;
     c.globalAlpha=level*(.18+layer*.06)*(.5+.5*Math.sin(seed*13+time*.7)**2);
     c.beginPath();c.moveTo(x,y);c.lineTo(x+14+layer*13+seed*19,y+3+layer*1.4);c.stroke();
    }
   }
  }
  c.restore();
 }
}
