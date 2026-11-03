import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {terminalSnapshot,TerminalObserver,options} from '../scripts/ai-terminal-cleanup-audit.mjs';

test('postmortem sampler leaves world, orders, economy and fog byte-for-byte untouched',()=>{
 const g=new Simulation(2075,11),before=g.save(),snapshot=terminalSnapshot(g);
 assert.equal(snapshot.status,'playing');
 assert.ok(Array.isArray(snapshot.allHeadquarters));
 assert.ok(Array.isArray(snapshot.pending));
 assert.equal(snapshot.at,0);
 assert.deepEqual(g.save(),before);
 const ob=new TerminalObserver(1,1);
 for(let i=0;i<25;i++)g.step(.05);
 const safe=g.save();
 ob.observe(g);
 assert.deepEqual(g.save(),safe);
 assert.equal(ob.finish().samples.length,1);
});
test('postmortem sampler can observe a 4-bastion paid campaign without guessing opponent state',()=>{
 const g=Simulation.campaign(2075,11);
 assert.ok(Array.isArray(terminalSnapshot(g).blueBases));
 assert.equal(g.territories.length,4);
 const s=terminalSnapshot(g);
 assert.equal(s.territoryRed+s.territoryBlue<=4,true);
 assert.ok(s.pending.every(t=>['capturing','contested','enemy-hq','out-of-range','no-unit','owned'].includes(t.readiness)));
});
test('audit CLI bounds seed, opponent and real play horizon',()=>{
 const o=options(['--opponent','pressure','--seeds','2026,2075','--seconds','900']);
 assert.deepEqual(o.seeds,[2026,2075]);
 assert.equal(o.seconds,900);
 for(const args of [['--opponent','fake'],['--seeds','1,1'],['--seeds','NaN'],['--seconds','10'],['--incorrect','value']])
  assert.throws(()=>options(args));
});
