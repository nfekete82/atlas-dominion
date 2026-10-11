/** Pixel-aligned boundaries for a logical sector grid on a finite bitmap.
 * Rounding each shared edge ONCE keeps adjacent sectors perfectly flush,
 * including grids that do not divide evenly into the render resolution.
 */
export function pixelGridEdges(cells: number, pixels: number): number[] {
  if (!Number.isInteger(cells) || cells < 1 ||
      !Number.isInteger(pixels) || pixels < cells) {
    throw new Error('Invalid sector grid dimensions');
  }
  return Array.from({length:cells+1}, (_,i)=>Math.round(i*pixels/cells));
}
