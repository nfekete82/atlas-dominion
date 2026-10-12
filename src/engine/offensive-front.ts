/** Cohesive local conquest selection, inspired by the gameplay principle of
 * a live frontier queue. Physical ownership, not the mouse cursor, authorizes
 * every advance. No traversing across enemy nations, water, or distant fronts.
 */
export interface FrontAdvance {
  owners:Int16Array; width:number; attackerId:number; targetOwner:number;
  candidates:Iterable<number>; anchor:number;
  /** Real sector captures by THIS attack, chronological and bounded. */
  trail:readonly number[];
  /** Previously engaged but not-yet-taken sector. */
  contested?:number;
}

/** Manhattan distance is topologically local and avoids diagonal leaps. */
function distance(a:number,b:number,width:number):number{
  return Math.abs(a%width-b%width)+
    Math.abs(Math.floor(a/width)-Math.floor(b/width));
}

export function chooseAdvancingSector(params:FrontAdvance):number{
  const {owners,width,attackerId,targetOwner,anchor,trail,contested}=params;
  if(width<=0)return -1;
  const height=Math.floor(owners.length/width);
  let best=-1,bestScore=-Infinity;
  for(const i of params.candidates){
    if(i<0||i>=owners.length||owners[i]!==targetOwner)continue;
    const x=i%width,y=Math.floor(i/width);
    let adjacent=0;
    if(x>0&&owners[i-1]===attackerId)adjacent++;
    if(x+1<width&&owners[i+1]===attackerId)adjacent++;
    if(y>0&&owners[i-width]===attackerId)adjacent++;
    if(y+1<height&&owners[i+width]===attackerId)adjacent++;
    if(!adjacent)continue;
    // A click determines where we START. After captures, the trail itself
    // pushes the front outward, even far beyond the original click radius.
    let near=distance(i,anchor,width);
    if(trail.length){
      near=Infinity;
      for(const captured of trail){
        const d=distance(i,captured,width);
        if(d<near)near=d;
        if(near===1)break;
      }
    }
    // Even if the active front gets blocked, never jump to a different
    // border of the same continent just because it has the same owner.
    if(near>5)continue;
    const focus=contested===i?5.2:0;
    // Prefer the next arc beside the advance and rounded multi-sided edges.
    // Tiny anchor bias resolves ties, but does not tether the front forever.
    const score=focus+adjacent*2.35-near*1.75-
      Math.sqrt(distance(i,anchor,width))*.055;
    if(score>bestScore || (score===bestScore && i<best)){
      best=i;bestScore=score;
    }
  }
  return best;
}

/** Clicks on the same adjacent section reinforce one existing assault,
 * but simultaneous invasions on opposite sides of a country stay separate.
 * Neutral land is one worldwide owner: distant neutral fronts MUST NOT merge.
 */
export function canReinforceFront(
  targetOwner:number,existingAnchor:number,newAnchor:number,width:number,
):boolean {
  const d=distance(existingAnchor,newAnchor,width);
  return d<= (targetOwner===-1?9:14);
}
