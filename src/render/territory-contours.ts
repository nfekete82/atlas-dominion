/** Marching-squares isolines around owned cell centres.
 * Returns render-only segments; game ownership and hit-tests stay tile-exact.
 * Coordinates are in logical tile units, with outside-the-map padding.
 */
export type ContourSegment = readonly [number,number,number,number];
export function territoryContours(owners:Int16Array,width:number):Map<number,ContourSegment[]> {
  if(!Number.isInteger(width)||width<1||owners.length%width!==0)throw new Error('Invalid owner grid');
  const height=owners.length/width;
  const result=new Map<number,ContourSegment[]>();
  const sample=(x:number,y:number)=>x<0||y<0||x>=width||y>=height?-1:owners[y*width+x];
  // Vertices correspond to tile centres. A 1-cell outside margin closes coastlines.
  for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
    const a=sample(x,y),b=sample(x+1,y),d=sample(x+1,y+1),e=sample(x,y+1);
    const ids=new Set([a,b,d,e]);
    for(const id of ids){
      if(id<0)continue;
      const mask=(a===id?1:0)|(b===id?2:0)|(d===id?4:0)|(e===id?8:0);
      if(mask===0||mask===15)continue;
      const top:[number,number]=[x+1,y+.5];
      const right:[number,number]=[x+1.5,y+1];
      const bottom:[number,number]=[x+1,y+1.5];
      const left:[number,number]=[x+.5,y+1];
      const crossings:Array<[number,number]>=[];
      if(Boolean(mask&1)!==Boolean(mask&2))crossings.push(top);
      if(Boolean(mask&2)!==Boolean(mask&4))crossings.push(right);
      if(Boolean(mask&4)!==Boolean(mask&8))crossings.push(bottom);
      if(Boolean(mask&8)!==Boolean(mask&1))crossings.push(left);
      const segments=result.get(id)??[];
      const add=(p:[number,number],q:[number,number])=>segments.push([p[0],p[1],q[0],q[1]]);
      if(crossings.length===2)add(crossings[0],crossings[1]);
      else if(crossings.length===4){
        // Keep diagonally touching territory disconnected: never invent a land bridge.
        if(mask===5){add(top,left);add(right,bottom);}
        else {add(top,right);add(bottom,left);}
      }
      result.set(id,segments);
    }
  }
  return result;
}
