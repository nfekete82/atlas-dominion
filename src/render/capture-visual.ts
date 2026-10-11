/** Pure presentation helpers for a small, organic capture glow.
 * Physical sector ownership stays deterministic and grid-based.
 */
export function organicCaptureRadius(progress:number,cellSize:number,index:number):number {
  const p=Math.max(0,Math.min(1,progress));
  const wave=p*p*(3-2*p);
  // Stable slight variation; no per-frame jitter or flickering blobs.
  const variation=.97+(Math.abs((index*37)%17)/17)*.06;
  return Math.max(0,cellSize)*1.15*wave*variation;
}
export function burningFrontAlpha(progress:number):number {
  const p=Math.max(0,Math.min(1,progress));
  return Math.sin(Math.PI*p)*.40;
}
