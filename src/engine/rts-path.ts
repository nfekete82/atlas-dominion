/** Goal-directed pathfinding with cardinal or diagonal movement.
 * Returns one lawful step and optionally the complete validated route.
 */
export function nextRTSCampaignStep(start:number,goal:number,width:number,
  neighbors:readonly (readonly number[])[],canEnter:(tile:number)=>boolean,
  options:{diagonal?:boolean;canCross?:(from:number,to:number)=>boolean;maxVisits?:number;onPath?:(path:number[])=>void}={}):number|null {
  if(start===goal)return start;
  if(!canEnter(goal))return null;
  const heuristic=(tile:number)=>{
    const dx=Math.abs(tile%width-goal%width),dy=Math.abs(Math.floor(tile/width)-Math.floor(goal/width));
    return options.diagonal?Math.max(dx,dy):dx+dy;
  };
  type Node={tile:number;distance:number;estimate:number;route:string};
  const heap:Node[]=[];
  // Lexicographic neighbor paths preserve the former breadth-first tie choice.
  const earlier=(a:Node,b:Node)=>a.estimate<b.estimate||
    a.estimate===b.estimate&&a.route<b.route;
  const push=(node:Node)=>{
    let index=heap.length;
    heap.push(node);
    while(index>0){
      const parent=(index-1)>>1;
      if(!earlier(node,heap[parent]))break;
      heap[index]=heap[parent];index=parent;
    }
    heap[index]=node;
  };
  const pop=():Node=>{
    const first=heap[0],last=heap.pop()!;
    if(heap.length){
      let index=0;
      while(index*2+1<heap.length){
        let child=index*2+1;
        if(child+1<heap.length&&earlier(heap[child+1],heap[child]))child++;
        if(!earlier(heap[child],last))break;
        heap[index]=heap[child];index=child;
      }
      heap[index]=last;
    }
    return first;
  };
  const distance=new Map<number,number>([[start,0]]);
  const parent=new Map<number,number>();
  const routes=new Map<number,string>([[start,'']]);
  push({tile:start,distance:0,estimate:heuristic(start),route:''});
  let visits=0;
  while(heap.length&&visits<(options.maxVisits??Infinity)){
    const node=pop();
    if(distance.get(node.tile)!==node.distance||routes.get(node.tile)!==node.route)continue;
    visits++;
    if(node.tile===goal){
      if(options.onPath){
        const path:number[]=[];let cell=goal;
        while(cell!==start){path.push(cell);cell=parent.get(cell)!;}
        options.onPath(path.reverse());
      }
      let step=goal;
      while(parent.get(step)!==start)step=parent.get(step)!;
      return step;
    }
    for(let direction=0;direction<neighbors[node.tile].length;direction++){
      const next=neighbors[node.tile][direction],cost=node.distance+1;
      const route=node.route+direction;
      const previous=distance.get(next)??Infinity;
      if(cost>previous||cost===previous&&route>=(routes.get(next)??'')||!canEnter(next)||options.canCross&&!options.canCross(node.tile,next))continue;
      distance.set(next,cost);parent.set(next,node.tile);routes.set(next,route);
      push({tile:next,distance:cost,estimate:cost+heuristic(next),route});
    }
  }
  return null;
}
