/** Tracks player casualties across authoritative fixed simulation ticks.
 * This is deliberately not based on camera visibility: a unit dying at a
 * distant outpost still deserves a "unit lost" warning. Cargo remains in
 * Simulation.units while boarding/unloading and must not count as a death.
 * No gameplay, save-file or render mutations.
 */
export interface TrackedUnit {id:number;owner:number;hp:number;carrier?:number|null}
export class UnitLossMonitor {
 private previous=new Map<number,number>();
 private lastTime=Number.NaN;
 reset(units:readonly TrackedUnit[],time=0):void {
  this.previous=new Map(units.filter(u=>u.hp>0).map(u=>[u.id,u.owner]));
  this.lastTime=time;
 }
 poll(units:readonly TrackedUnit[],time:number):number {
  if(!Number.isFinite(time)||time===this.lastTime)return 0;
  const current=new Map<number,number>();
  for(const u of units)if(u.hp>0)current.set(u.id,u.owner);
  let lost=0;
  for(const [id,owner] of this.previous)
   if(owner===0&&!current.has(id))lost++;
  this.previous=current;
  this.lastTime=time;
  return lost;
 }
}
