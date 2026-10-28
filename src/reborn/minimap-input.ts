import {clamp,type Point} from './config.js';
/** The minimap displays the entire square world, independent of camera zoom,
 * backing-store pixels and DPR. Its border is an outline outside this CSS box. */
export function minimapWorldPoint(pointer:Point,rect:{left:number;top:number;width:number;height:number},worldSize:number):Point|null{
 if(![pointer.x,pointer.y,rect.left,rect.top,rect.width,rect.height,worldSize].every(Number.isFinite)||rect.width<=0||rect.height<=0||worldSize<=0)return null;
 return {x:clamp((pointer.x-rect.left)/rect.width,0,1)*worldSize,y:clamp((pointer.y-rect.top)/rect.height,0,1)*worldSize};
}
