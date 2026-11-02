/** Audit of real catalog statistics and target-specific sustained DPS.
 * This is a transparent static comparison, NOT a simulated win rate.
 * Units can be mobile, require line of sight, heal, or carry passengers.
 * Rockets can be delayed / splash and soldiers fire in bursts.
 */
import {UNITS,BUILDINGS,canAttack,combatDpsAgainst} from '../dist/src/reborn/catalog.js';
const targetTypes=['infantry','heavy','tank','rover','artillery','bomber'];
const entries=Object.entries(UNITS);
const calc=(kind,target)=>{
 const attacker={kind},defender=target==='turret'?{kind:'turret',queue:[]}: {kind:target};
 return canAttack(attacker,defender)?combatDpsAgainst(attacker,defender):null;
};
const fmt=n=>n===null?'—':n.toFixed(1);
console.log('# Sandforge: balance audit (catalog + engine damage)');
console.log('');
console.log('Calculated sustained DPS; no travel time, target acquisition, cover, veteran rank,');
console.log('projectile delay, blast falloff, heals, transport, burst timing or range advantage.');
console.log('Tank versus infantry is the secondary machine gun, not its anti-armor rocket.');
console.log('');
console.log('| Unit | Credits | HP | HP / 100 Credits | Speed | Range | vs Infantry | vs Heavy | vs Tank | vs Rover | vs Artillery | vs Bomber |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const [kind,u] of entries)console.log(
 `| ${u.name} | ${u.cost} | ${u.hp} | ${(u.hp/u.cost*100).toFixed(1)} | ${u.speed} | ${u.range} | ${targetTypes.map(x=>fmt(calc(kind,x))).join(' | ')} |`
);
console.log('');
console.log(`Turret: ${BUILDINGS.turret.cost} Credits / ${BUILDINGS.turret.hp} HP / 600 range / 30 base DPS.`);
console.log('Interpretation: DPS is one factor only; artillery has splash, mobility and range matter.');
