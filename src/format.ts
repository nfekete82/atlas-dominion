/** Short German HUD numbers so side panels never expand with huge values.
 * K = Tausend, M = Millionen, Mrd. = Milliarden, Bio. = Billionen.
 * Extreme / invalid inputs are handled without giant decimal strings.
 */
const units: readonly [number,string][]=[
  [1e12,'Bio.'],[1e9,'Mrd.'],[1e6,'M'],[1e3,'K'],
];
const de=(n:number,decimals:number)=>new Intl.NumberFormat('de-DE',{
  minimumFractionDigits:0,maximumFractionDigits:decimals,
}).format(n);

/** Shared across HUD, leaderboard, tooltips and map labels. */
export function formatCompact(value:number, decimals=0):string {
  if(Number.isNaN(value))return '–';
  if(!Number.isFinite(value))return value<0?'−∞':'∞';
  const negative=value<0?'−':'';
  const n=Math.abs(value);
  if(n>=1e15)return negative+n.toExponential(1).replace('.',',');
  for(const [factor,suffix] of units){
    if(n>=factor){
      const precision=n/factor<10?1:0;
      return negative+de(n/factor,precision)+(suffix==='Mrd.'||suffix==='Bio.'?' ':'')+suffix;
    }
  }
  return negative+de(n,decimals);
}
