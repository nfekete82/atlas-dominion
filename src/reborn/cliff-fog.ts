/** Purely visual correction for opaque, already-discovered cliffs.
 * Seeing any exposed face makes the same physical rock readable in full;
 * world.visible / world.explored remain authoritative for enemy visibility.
 * Only the cliff's own opaque footprint may be lightened. */
export function revealVisibleRockSurface(
 pixels:Uint8ClampedArray,
 visible:Uint8Array,
 explored:Uint8Array,
 cliffIds:Int16Array,
 cliffCells:ReadonlyArray<ReadonlyArray<number>>,
 alpha=24
):void {
 const frontFaces=new Set<number>();
 for(let i=0;i<visible.length;i++){
  const id=cliffIds[i];
  if(visible[i]&&id>=0)frontFaces.add(id);
 }
 for(const id of frontFaces)for(const cell of cliffCells[id]??[]){
  // Keep unknown cells and already-visible cells untouched. In particular,
  // NEVER touch adjacent terrain or cells on the far side of the obstacle.
  if(!explored[cell]||visible[cell])continue;
  const a=cell*4+3;
  pixels[a]=Math.min(pixels[a],alpha);
 }
}
