/** Original pastel strategy-map palette, independent of the simulation colors.
 * Keep strong faction hues for thin outlines while the occupied ground stays
 * soft and legible, as in the reference's flat territorial cartography.
 */
export const MAP_PALETTE = {
  oceanTop:'#4b8bad',
  oceanBottom:'#346f96',
  land:'#d9ddbe',
  landHighlight:'#e1e3cb',
  neutralBoundary:'#9a9d88',
  occupiedBorder:'#586370',
  hover:'#fff6db',
} as const;

export function mixHexColor(color: string, tint = '#e9e9cf', tintWeight = 0.58): string {
  if(!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(tint))
    throw new Error('Expected full six-digit RGB hex colors');
  const w=Math.max(0,Math.min(1,tintWeight));
  const hex=[0,2,4].map(offset=>{
    const src=parseInt(color.slice(offset+1,offset+3),16);
    const target=parseInt(tint.slice(offset+1,offset+3),16);
    return Math.round(src*(1-w)+target*w).toString(16).padStart(2,'0');
  });
  return '#'+hex.join('');
}
