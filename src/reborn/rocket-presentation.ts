import type {Point} from './config.js';

/** Approximate six muzzle ports in baked 3x2 launcher art.
 * The first port is authored in the source atlas; these compact offsets give
 * visible per-tube launch variation without modifying hit detection. */
export function rocketTubeOffset(index:number,angle:number,scale=1):Point{
 if(!Number.isFinite(index)||!Number.isFinite(angle)||!Number.isFinite(scale))return {x:0,y:0};
 const slot=((Math.trunc(index)%6)+6)%6;
 const column=slot%3,row=Math.floor(slot/3);
 const sideways=(column-1)*4.1*scale;
 const raised=(row===0?2.8:-2.8)*scale;
 return {x:-Math.sin(angle)*sideways,
   y:Math.cos(angle)*sideways*.52-raised};
}
/** Rotating missile sprite: dark metal outline, warm ceramic body and soft,
 * short exhaust rather than a large orange cartoon triangle. */
export function drawRocketProjectile(ctx:CanvasRenderingContext2D,p:Point,angle:number,scale=1):void{
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
 const s=Math.max(.65,Math.min(1.4,scale));ctx.scale(s,s);
 const plume=ctx.createLinearGradient(-18,0,-5,0);
 plume.addColorStop(0,'rgba(255,178,91,0)');
 plume.addColorStop(.55,'rgba(242,178,107,.33)');
 plume.addColorStop(1,'rgba(255,222,153,.68)');
 ctx.fillStyle=plume;ctx.beginPath();
 ctx.moveTo(-19,0);ctx.quadraticCurveTo(-9,-2.2,-5,-1.6);
 ctx.lineTo(-5,1.6);ctx.quadraticCurveTo(-11,2.2,-19,0);ctx.fill();
 ctx.fillStyle='#38423a';ctx.beginPath();ctx.moveTo(-8,-2);
 ctx.lineTo(4,-2);ctx.lineTo(8,0);ctx.lineTo(4,2);ctx.lineTo(-8,2);ctx.closePath();ctx.fill();
 const shell=ctx.createLinearGradient(0,-1.5,0,1.5);
 shell.addColorStop(0,'#d8d5bd');shell.addColorStop(.48,'#b7b9aa');
 shell.addColorStop(1,'#726f60');
 ctx.fillStyle=shell;ctx.fillRect(-7,-1.15,11,2.3);
 ctx.fillStyle='#8c988d';ctx.beginPath();ctx.moveTo(-7,-1.2);ctx.lineTo(-10,-3.4);
 ctx.lineTo(-5,-2);ctx.lineTo(-5,2);ctx.lineTo(-10,3.4);ctx.lineTo(-7,1.2);ctx.fill();
 ctx.restore();
}
