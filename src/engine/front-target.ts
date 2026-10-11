/** Find the nearest genuinely adjacent enemy FRONT from a clicked land sector.
 * Breadth-first traversal is confined to exactly the clicked owner and normal
 * orthogonal map edges: no sea crossings, third-party territory or teleports.
 *
 * Finite maxDistance is used for the globally shared neutral owner; named
 * factions can be selected anywhere in the same contiguous occupied region.
 */
export function findConnectedAttackFront(
  owners: Int16Array,
  width: number,
  clickedIndex: number,
  attackerId: number,
  maxDistance = Number.POSITIVE_INFINITY,
): number {
  if(!Number.isInteger(width)||width<=0||owners.length%width!==0||
     !Number.isInteger(clickedIndex)||clickedIndex<0||clickedIndex>=owners.length)return -1;
  const owner=owners[clickedIndex];
  if(owner === -2 || owner === attackerId || attackerId<0)return -1;
  const queue=new Int32Array(owners.length);
  const visited=new Uint8Array(owners.length);
  queue[0]=clickedIndex;visited[clickedIndex]=1;
  let head=0,tail=1,depth=0,layerEnd=1;
  const height=owners.length/width;
  while(head<tail && depth<=maxDistance){
    const i=queue[head++];
    const x=i%width,y=Math.floor(i/width);
    const adjacent=[x>0?i-1:-1,x+1<width?i+1:-1,y>0?i-width:-1,y+1<height?i+width:-1];
    for(const n of adjacent)if(n>=0 && owners[n]===attackerId)return i;
    if(depth<maxDistance){
      for(const n of adjacent){
        if(n<0 || visited[n] || owners[n]!==owner)continue;
        visited[n]=1;
        queue[tail++]=n;
      }
    }
    if(head===layerEnd){depth++;layerEnd=tail;}
  }
  return -1;
}
