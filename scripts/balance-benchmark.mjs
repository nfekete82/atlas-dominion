#!/usr/bin/env node
/** Repeatable balance benchmark, independent of the browser. No artificial
 * player orders; this measures economic/diplomatic/AI behaviour, not player skill.
 * Run after npm run build.
 *
 * Quick: node scripts/balance-benchmark.mjs
 * Thorough: node scripts/balance-benchmark.mjs --seeds=30 --ticks=2000 \
 *   --countries=DE,HU,LT,IE --difficulties=relaxed,balanced,intense,impossible
 */
import {Game} from '../dist/src/engine/game.js';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

const args=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{
  const [key,...rest]=a.slice(2).split('=');return [key,rest.join('=')];
}));
const seeds=Math.max(1,Math.min(30,Number(args.seeds)||3));
const ticks=Math.max(10,Math.min(2000,Number(args.ticks)||500));
const countries=(args.countries||'DE').split(',').filter(Boolean);
const difficulties=(args.difficulties||'balanced').split(',').filter(Boolean);
const scenarios=[];
const round=x=>Math.round(x*100)/100;

for(const difficulty of difficulties)for(const country of countries)for(let n=0;n<seeds;n++){
  const seed=90210+n*17;
  const game=new Game(seed,49,country,difficulty);
  let playerMobileShare=0,warPressure=0,aliveCount=0,samples=0;
  const startingPlayer=game.factions[0].territory;
  for(let i=0;i<ticks&&game.status==='playing';i++){
    game.step();
    if(i%25!==24&&i!==ticks-1)continue;
    const player=game.factions[0];
    playerMobileShare+=player.troops/Math.max(1,player.population);
    warPressure+=game.attackOrders.filter(o=>o.targetOwner>=0&&!o.returning).length;
    aliveCount+=game.factions.filter(f=>f.alive).length;
    samples++;
  }
  const player=game.factions[0],powers=game.factions.map(f=>f.population);
  const totalPopulation=powers.reduce((a,b)=>a+b,0);
  const richest=[...game.factions].sort((a,b)=>b.population-a.population)[0];
  const cities=Array.from(game.buildings).reduce((a,b)=>a+(b===1?1:0),0);
  const upgraded=game.cityUpgrades.reduce((a,b)=>a+(b>0?1:0),0);
  const scenario={seed,country,difficulty,tick:game.tick,status:game.status,
    territoryRatio:round(player.territory/Math.max(1,startingPlayer)),
    playerMobileRatio:round(playerMobileShare/Math.max(1,samples)),
    averageActiveWars:round(warPressure/Math.max(1,samples)),
    averageSurvivingCountries:round(aliveCount/Math.max(1,samples)),
    leadingPopulationShare:round(richest.population/Math.max(1,totalPopulation)),
    cities,upgradedCities:upgraded,
    pacts:game.alliances.length,truces:game.warTruces.length,
    playerPopulation:round(player.population),playerTroops:round(player.troops)};
  scenarios.push(scenario);
  console.log(`${country}/${difficulty}/${seed}: ${scenario.status} tick=${scenario.tick} area=×${scenario.territoryRatio} mobile=${Math.round(scenario.playerMobileRatio*100)}% wars=${scenario.averageActiveWars} cities=${scenario.cities}`);
}
const average=field=>round(scenarios.reduce((sum,s)=>sum+s[field],0)/Math.max(1,scenarios.length));
const report={parameters:{seeds,ticks,countries,difficulties},aggregate:{
  meanMobileReserveShare:average('playerMobileRatio'),
  meanSimultaneousNationalWars:average('averageActiveWars'),
  meanTopNationShare:average('leadingPopulationShare'),
  meanPlayerTerritoryMultiple:average('territoryRatio'),
  meanBuiltCities:average('cities'),
},scenarios};
console.log('\nBALANCE RESULTS\n'+JSON.stringify(report.aggregate,null,2));
if(args.json){mkdirSync(dirname(args.json),{recursive:true});writeFileSync(args.json,JSON.stringify(report,null,2)+'\n');console.log('Written:',args.json);}
