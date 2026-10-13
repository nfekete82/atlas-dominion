import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {Game} from '../dist/src/engine/game.js';
import {validSeaRoute} from '../dist/src/engine/navigation.js';

const directory=resolve(process.argv[2]??'docs/qa/rts-ai-long-term-20261013');
const {rows}=JSON.parse(readFileSync(join(directory,'matrix.json'),'utf8'));
assert.equal(rows.length,18,'run the complete comparison matrix before replay verification');
const cases=[...new Map(rows.map(row=>[`${row.countries}:${row.seed}`,row])).values()];
const verification=[];
const canonicalHash=value=>createHash('sha256').update(JSON.stringify(value,(_,item)=>
  item&&typeof item==='object'&&!Array.isArray(item)?
    Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item)).digest('hex');
for(const {countries,seed} of cases){
  let game=new Game(seed,countries-1,'DE','balanced',true),reference=null,recruited=0,maxDrift=0;
  const initial=game.factions.reduce((n,f)=>n+f.population,0);
  const instrument=()=>{
    const subject=game,recruit=subject.recruitSquad.bind(subject);
    subject.recruitSquad=(...args)=>{
      const result=recruit(...args);if(result.ok&&subject===game)recruited+=args[2];return result;
    };
  };
  instrument();
  const watched=new WeakSet();let moves=new Map();
  for(let tick=1;tick<=1000;tick++){
    moves=new Map();
    for(const unit of game.squads)if(!watched.has(unit)){
      watched.add(unit);const world=game;let position=unit.index;
      Object.defineProperty(unit,'index',{enumerable:true,configurable:true,
        get:()=>position,set:next=>{
          if(next===position)return;
          moves.set(unit.id,(moves.get(unit.id)??0)+1);
          assert.equal(moves.get(unit.id),1,`multiple moves for squad ${unit.id} at ${world.tick}`);
          const landing=unit.seaRoute?.length&&position===unit.seaRoute[0]&&
            unit.destination===null&&next===unit.seaLanding&&
            unit.seaTicks>=Math.max(8,Math.ceil(unit.seaRoute.length/3));
          if(landing)assert.ok(validSeaRoute(unit.seaRoute,position,next));
          else{
            const dx=next%480-position%480,dy=Math.floor(next/480)-Math.floor(position/480);
            assert.ok(Math.abs(dx)<=1&&Math.abs(dy)<=1,`illegal step at ${world.tick}`);
            if(dx&&dy)assert.ok(world.owner[position+dx]===unit.owner&&
              world.owner[position+dy*480]===unit.owner,`blocked diagonal at ${world.tick}`);
          }
          assert.equal(world.owner[next],unit.owner);position=next;
        }});
    }
    if(reference){reference.status='playing';reference.step();}
    game.status='playing';game.step();
    assert.equal(game.tick,tick);
    const people=game.factions.reduce((n,f)=>n+f.population,0);
    const losses=game.factions.reduce((n,f)=>n+f.attackFallen+f.defenseSpent,0);
    maxDrift=Math.max(maxDrift,Math.abs(initial+recruited-losses-people));
    assert.ok(maxDrift<1e-6,`soldier ledger at ${countries}/${seed}/${tick}`);
    assert.ok(game.squads.every(s=>s.troops>0&&game.owner[s.index]===s.owner));
    assert.ok(game.factions.every(f=>Number.isFinite(f.money)&&f.money>=0));
    if([360,500,1000].includes(tick)){
      const save=game.exportSave();
      const referenceSave=reference?.exportSave()??save;
      assert.deepEqual(save,referenceSave,`JSON simulation state at ${countries}/${seed}/${tick}`);
      assert.equal(canonicalHash(save),canonicalHash(referenceSave));
      // Raw JSON hashes are only compared for uninterrupted replays. JSON
      // reload can change the insertion order of optional object properties.
      const hash=createHash('sha256').update(JSON.stringify(referenceSave)).digest('hex');
      const expected=rows.find(row=>row.countries===countries&&row.seed===seed&&row.ticks===tick);
      assert.equal(hash,expected.candidate.stateHash,`replay at ${countries}/${seed}/${tick}`);
      if(tick===500){
        reference=game;
        for(const unit of reference.squads)Object.defineProperty(unit,'index',{
          value:unit.index,writable:true,enumerable:true,configurable:true});
        game=Game.fromSave(JSON.parse(JSON.stringify(save)));instrument();
        assert.deepEqual(game.exportSave(),save);
      }
    }
  }
  verification.push({countries,seed,ticks:game.tick,jsonReloadTick:500,maxDrift,
    canonicalStateHash:canonicalHash(game.exportSave()),passed:true});
  writeFileSync(join(directory,'replay-verification.json'),JSON.stringify(verification,null,2)+'\n');
  console.log(`Verified ${countries} countries, seed ${seed}: 1000 ticks and JSON reload at 500`);
}
