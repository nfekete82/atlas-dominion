/** Which cliff models are currently observed? Read *live* vision only.
 * Exploration alone does not relight cliffs, and no unit/building visibility is changed.
 * A visible opaque terrain cell represents the rock's first surface facing the scout. */
export function visibleCliffIds(visible:Uint8Array,cliffIds:Int16Array,count:number):Uint8Array {
 if(visible.length!==cliffIds.length||!Number.isSafeInteger(count)||count<0)
  throw new Error('Invalid cliff visibility geometry');
 const lit=new Uint8Array(count);
 for(let i=0;i<visible.length;i++)if(visible[i]){
  const id=cliffIds[i];
  if(id>=0&&id<count)lit[id]=1;
 }
 return lit;
}
