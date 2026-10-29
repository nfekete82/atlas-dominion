import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {newExperience,canOverrun,finishExperience,lessonScore,validExperience} from '../dist/src/reborn/battle-learning.js';

test('3.0: overwhelming paid conventional force can attack observed turret without artillery',()=>{
 const experience=newExperience();
 assert.equal(canOverrun(50,20,20,1,experience),true);
 assert.equal(canOverrun(24,20,20,1,experience),false);
 assert.equal(canOverrun(50,20,4,1,experience),false);
 assert.equal(canOverrun(50,20,20,0,experience),false);
});
test('3.0: repeated failure raises overrun threshold; success lowers it, with bounded confidence',()=>{
 const e=newExperience();
 const start=canOverrun(40,20,12,1,e);assert.equal(start,true);
 for(let i=0;i<3;i++){e.active={sector:1,tactic:'overrun',guns:1,force:12,at:10,initialUnits:12,initialHP:1200,progress:0};finishExperience(e,false,100);}
 assert.ok(lessonScore(e,'overrun',1,12)<0);
 assert.equal(canOverrun(40,20,12,1,e),false);
 for(let i=0;i<6;i++){e.active={sector:1,tactic:'overrun',guns:1,force:12,at:10,initialUnits:12,initialHP:1200,progress:0};finishExperience(e,true,1100);}
 assert.ok(lessonScore(e,'overrun',1,12)>-0.15);
 assert.ok(e.records.length<=36);
});
test('3.0: experience persists with game save and rejects malformed forged entries',()=>{
 const g=new Simulation(2026,4);
 const e=newExperience();
 e.active={sector:1,tactic:'overrun',guns:1,force:12,at:0,initialUnits:12,initialHP:1200,progress:0};
 finishExperience(e,true,1000);
 g.tactical.state.experience=e;
 const saved=g.save();
 assert.ok(validExperience(e,g.time,g.territories.length));
 assert.equal(validExperience({...e,records:[{...e.records[0],score:Infinity}]},g.time,g.territories.length),false);
 assert.equal(validExperience({...e,records:[{...e.records[0],wins:-1}]},g.time,g.territories.length),false);
 assert.deepEqual(saved.tactical?.experience,e);
});
