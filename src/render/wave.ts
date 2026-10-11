/** Pure presentation state: combat animation must never alter the simulation. */
export interface CaptureFrame {
  index: number;
  previous: number;
  owner: number;
  start: number;
  delay: number;
}

export const WAVE_DURATION_MS = 190;
const WAVE_STEP_MS = 24;
const MAX_DELAY_MS = 72;

/**
 * Tracks only changed sectors, not all map tiles per frame.
 * A multi-source BFS delays chained captures in the same simulation tick:
 * cells touching the old front animate first, deeper cells follow.
 */
export class TerritoryWave {
  private previous: Int16Array;
  private readonly frames = new Map<number, CaptureFrame>();

  constructor(owners: Int16Array, private readonly width: number) {
    this.previous = owners.slice();
  }

  reset(owners: Int16Array): void {
    this.previous = owners.slice();
    this.frames.clear();
  }

  capture(owners: Int16Array, now: number): number {
    if (owners.length !== this.previous.length) throw new Error('Territory grid size changed; call reset().');
    const changed = new Set<number>();
    for (let i=0; i<owners.length; i++) {
      if (owners[i] !== this.previous[i]) changed.add(i);
    }
    if (!changed.size) return 0;

    const delay = new Map<number, number>();
    const queue: number[] = [];
    // Multi-source BFS: newly captured cells touching the already-owned region
    // form the wave crest; later captures fan out across the front.
    for (const index of changed) {
      const owner=owners[index];
      const x=index%this.width;
      const y=Math.floor(index/this.width);
      const adjacent=[x>0?index-1:-1,x+1<this.width?index+1:-1,y>0?index-this.width:-1,index+this.width<owners.length?index+this.width:-1];
      if (adjacent.some(n=>n>=0 && !changed.has(n) && this.previous[n]===owner)) {
        delay.set(index,0);queue.push(index);
      }
    }
    // Isolated captures (e.g. a scripted ownership change) animate without
    // holding up the queue; never spread beyond the new owner's cells.
    if (!queue.length) {
      for (const index of changed) {delay.set(index,0);queue.push(index);}
    }
    for (let head=0;head<queue.length;head++) {
      const index=queue[head];
      const x=index%this.width,y=Math.floor(index/this.width);
      const neighbors=[x>0?index-1:-1,x+1<this.width?index+1:-1,y>0?index-this.width:-1,index+this.width<owners.length?index+this.width:-1];
      for (const n of neighbors) {
        if(n<0 || !changed.has(n) || delay.has(n) || owners[n]!==owners[index])continue;
        delay.set(n,Math.min(MAX_DELAY_MS,(delay.get(index)??0)+WAVE_STEP_MS));
        queue.push(n);
      }
    }
    for (const index of changed) {
      this.frames.set(index,{index,previous:this.previous[index],owner:owners[index],start:now,delay:delay.get(index)??0});
      this.previous[index]=owners[index];
    }
    return changed.size;
  }

  active(now: number): CaptureFrame[] {
    const result: CaptureFrame[]=[];
    for (const [index,frame] of this.frames) {
      if(now >= frame.start+frame.delay+WAVE_DURATION_MS) this.frames.delete(index);
      else result.push(frame);
    }
    return result;
  }
}

export function waveProgress(frame: CaptureFrame, now: number): number {
  const linear=Math.max(0,Math.min(1,(now-frame.start-frame.delay)/WAVE_DURATION_MS));
  return linear*linear*(3-2*linear);
}
