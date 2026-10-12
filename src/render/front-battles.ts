import type {BattleEvent} from '../engine/game.js';

/** The map never invents soldiers. One marker summarizes real strike events
 * occurring close together along the same geographical battlefront.
 */
export interface FrontGroup {
  x:number; y:number; dx:number; dy:number;
  leftId:number; rightId:number;
  blue:number; red:number;
  attacker:number; defender:number;
  fallenBlue:number; fallenRed:number;
  strikes:number; captures:number; playerBattle:boolean;
  seed:number;
}

function adjacent(index:number,width:number,length:number):number[] {
  const x=index%width;
  const result:number[]=[];
  if(x>0)result.push(index-1);
  if(x+1<width)result.push(index+1);
  if(index>=width)result.push(index-width);
  if(index+width<length)result.push(index+width);
  return result;
}

/** Contact normal goes from attacking side toward the defending side.
 * Only real orthogonally adjacent sectors qualify; no shortcuts over water.
 * For just-captured isolated sectors the last strike may no longer have a
 * visible border, so no phantom frontline is drawn.
 */
export function locateBattleContact(
  event:BattleEvent,owners:Int16Array,width:number,
):{x:number;y:number;dx:number;dy:number}|null {
  if(!Number.isInteger(event.index)||event.index<0||event.index>=owners.length||width<=0)return null;
  const x=event.index%width,y=Math.floor(event.index/width);
  const owner=owners[event.index];
  let dx=0,dy=0;
  if(owner===event.defenderId){
    // Enemy still holds the targeted cell; attacker must border it.
    const src=adjacent(event.index,width,owners.length).find(i=>owners[i]===event.attackerId);
    if(src===undefined)return null;
    dx=x-src%width;dy=y-Math.floor(src/width);
  }else if(owner===event.attackerId){
    // Sector fell; look for the NEXT real defender along this active front.
    const next=adjacent(event.index,width,owners.length).find(i=>owners[i]===event.defenderId);
    if(next===undefined)return null;
    dx=next%width-x;dy=Math.floor(next/width)-y;
  }else return null;
  const norm=Math.hypot(dx,dy);
  if(norm===0)return null;
  const direction=owner===event.defenderId?-.46:.46;
  return {x:x+.5+dx*direction,y:y+.5+dy*direction,dx:dx/norm,dy:dy/norm};
}

/** Group neighbouring strikes by country pair AND position, so 150 quick
 * sector hits become a handful of readable contacts rather than label spam.
 * Only genuine recorded assaults are shown, not guessed garrison strengths.
 */
export function groupBattles(
  battles:readonly BattleEvent[],owners:Int16Array,width:number,maxGroups=90,
):FrontGroup[] {
  const groups:FrontGroup[]=[];
  if(width<=0||maxGroups<=0)return groups;
  for(const event of battles){
    if(!(event.attacking>0) || !Number.isFinite(event.attacking))continue;
    const contact=locateBattleContact(event,owners,width);
    if(!contact)continue;
    const a=Math.min(event.attackerId,event.defenderId);
    const b=Math.max(event.attackerId,event.defenderId);
    const playerBattle=event.attackerId===0||event.defenderId===0;
    let group=groups.find(g=>g.leftId===a&&g.rightId===b&&
      (g.x-contact.x)**2+(g.y-contact.y)**2<=49);
    if(!group){
      if(groups.length>=maxGroups)continue;
      group={x:contact.x,y:contact.y,dx:0,dy:0,
        leftId:a,rightId:b,blue:0,red:0,attacker:0,defender:0,
        fallenBlue:0,fallenRed:0,strikes:0,captures:0,
        playerBattle,seed:(event.index*31+event.tick*17)>>>0};
      groups.push(group);
    }
    const count=group.strikes;
    group.x=(group.x*count+contact.x)/(count+1);
    group.y=(group.y*count+contact.y)/(count+1);
    const orientation=event.attackerId===0||!playerBattle?1:-1;
    group.dx+=contact.dx*orientation;
    group.dy+=contact.dy*orientation;
    group.strikes++;
    group.captures+=event.captured?1:0;
    group.attacker+=event.attacking;
    group.defender+=event.defending;
    if(playerBattle){
      group.blue+=event.attackerId===0?event.attacking:event.defending;
      group.red+=event.attackerId===0?event.defending:event.attacking;
      group.fallenBlue+=event.attackerId===0?event.attackerLost:event.defenderLost;
      group.fallenRed+=event.attackerId===0?event.defenderLost:event.attackerLost;
    }
  }
  // Render human conflicts first so busy AI-vs-AI wars do not obscure them.
  groups.sort((x,y)=>Number(y.playerBattle)-Number(x.playerBattle) ||
    y.strikes-x.strikes || x.seed-y.seed);
  return groups.map(g=>{
    const normal=Math.hypot(g.dx,g.dy);
    return {...g,dx:normal?g.dx/normal:1,dy:normal?g.dy/normal:0};
  });
}

/** Stable hash for visual offsets. Render-only, cannot alter combat RNG. */
export function visualNoise(seed:number,index:number):number {
  let x=(seed^(index*0x9e3779b9))>>>0;
  x=Math.imul(x^(x>>>16),0x85ebca6b);
  x=Math.imul(x^(x>>>13),0xc2b2ae35);
  return ((x^(x>>>16))>>>0)/4294967296;
}
