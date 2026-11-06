import {RULES,campaignLayout} from './config.js';
import {battlefieldStart} from './battlefield-terrain.js';
import type {World} from './world.js';

export interface BattlefieldValidation {
 valid:boolean; candidate:number; errors:string[]; reachableSites:number; freeCells:number;
 connectedCells:number; tankReachableSites:number; buildAreaSamples:[number,number]; expansionDirections:[number,number];
}
/** Uses World.blocked, not a second navigation system. This throwaway flood
 * validates a conservative 32-unit clearance (larger than any ground unit),
 * then releases its arrays before the match starts. Runtime pathfinding is
 * unchanged. No invisible collision repair: retry whole geometry instead. */
export function validateBattlefield(world:World):BattlefieldValidation{
 const g=world.generated!,grid=RULES.grid,n=grid*grid,homes=campaignLayout(world.mapVersion,world.seed).headquarters;
 const safe=new Uint8Array(n),visited=new Uint8Array(n),queue=new Int32Array(n);
 let freeCells=0;
 for(let i=0;i<n;i++){
  if(!world.blocked[i])freeCells++;
  safe[i]=world.walkable(world.center(i),[],32)?1:0;
 }
 const from=world.index(g.sites[homes[0]]);let head=0,tail=0;
 if(safe[from]){visited[from]=1;queue[tail++]=from;}
 while(head<tail){
  const at=queue[head++],x=at%grid,y=Math.floor(at/grid);
  for(const next of [x?at-1:-1,x<grid-1?at+1:-1,y?at-grid:-1,y<grid-1?at+grid:-1]){
   if(next>=0&&safe[next]&&!visited[next]){visited[next]=1;queue[tail++]=next;}
  }
 }
 const component=world.components[from];let connectedCells=0;
 for(let i=0;i<n;i++)if(!world.blocked[i]&&world.components[i]===component)connectedCells++;
 const reachableSites=g.sites.filter(p=>world.walkable(p)&&world.components[world.index(p)]===component).length;
 const tankReachableSites=g.sites.filter(p=>visited[world.index(p)]&&world.walkable(p,[],32)).length;
 const buildAreaSamples=homes.map(id=>{
  const home=battlefieldStart(g.sites[id],world.size);let count=0;
  for(let y=-400;y<=400;y+=80)for(let x=-400;x<=400;x+=80){
   if(Math.hypot(x,y)>400)continue;
   const p={x:home.x+x,y:home.y+y};
   if(world.buildable(p,100)&&visited[world.index(p)])count++;
  }
  return count;
 }) as [number,number];
 const {columns,rows}=campaignLayout(world.mapVersion,world.seed);
 const expansionDirections=homes.map(id=>[id%columns>0?id-1:-1,id%columns<columns-1?id+1:-1,id>=columns?id-columns:-1,id<columns*(rows-1)?id+columns:-1]
  .filter(i=>i>=0&&visited[world.index(g.sites[i])]).length) as [number,number];
 const errors:string[]=[];
 if(reachableSites!==g.sites.length)errors.push('unreachable-bastion');
 if(connectedCells!==freeCells)errors.push('isolated-ground');
 if(tankReachableSites!==g.sites.length)errors.push('tank-clearance');
 if(buildAreaSamples.some(n=>n<65)||Math.abs(buildAreaSamples[0]-buildAreaSamples[1])>8)errors.push('start-building-area');
 if(expansionDirections.some(n=>n<2))errors.push('expansion-directions');
 for(const id of homes){
  const p=battlefieldStart(g.sites[id],world.size);
  if(!world.buildable(p,RULES.headquarters.radius)||!visited[world.index(p)])errors.push('unsafe-hq');
 }
 return {valid:!errors.length,candidate:g.battlefield!.candidate,errors,reachableSites,freeCells,connectedCells,tankReachableSites,buildAreaSamples,expansionDirections};
}
