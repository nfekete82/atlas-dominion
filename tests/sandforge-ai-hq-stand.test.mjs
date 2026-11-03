import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

function emergency(distanceFromHome=170){
 const g=new Simulation(2026,11);
 const home=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1);
 const fighter=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 const invader=g.spawn(0,{x:home.x+distanceFromHome,y:home.y},'heavy');
 return {g,home,fighter,invader};
}
test('HQ: ordinary director retreats when outnumbered, experimental defender stands and fights',()=>{
 const x=emergency();
 const {g,home,fighter,invader}=x;
 g.tactical.hqStandMode='classic';
 g.tactical.localDefense([fighter],[],[invader],home);
 assert.equal(fighter.orders[0]?.kind,'move','original director must try to retreat');
 g.tactical.hqStandMode='lastStand';
 g.tactical.localDefense([fighter],[],[invader],home);
 assert.equal(fighter.orders[0]?.kind,'attack','last stand must shoot visible attacker');
 assert.equal(fighter.orders[0]?.target,invader.id);
 assert.equal(g.credits[1],950,'no free credits');
});
test('HQ: remote or non-four-bastion attacks keep normal withdrawal instead',()=>{
 const distant=emergency(700);
 distant.g.tactical.hqStandMode='lastStand';
 distant.g.tactical.localDefense([distant.fighter],[],[distant.invader],distant.home);
 assert.equal(distant.fighter.orders[0]?.kind,'move');
 const g=new Simulation(2027,12),home=g.bases.find(b=>b.kind==='headquarters'&&b.owner===1),
   fighter=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 const invader=g.spawn(0,{x:home.x+170,y:home.y},'heavy');
 g.tactical.hqStandMode='lastStand';
 g.tactical.localDefense([fighter],[],[invader],home);
 assert.equal(fighter.orders[0]?.kind,'move');
});
test('HQ: underdog behavior is unchanged when the defender has real fighting superiority',()=>{
 const {g,home,fighter,invader}=emergency();
 invader.hp=1;
 g.tactical.hqStandMode='classic';
 g.tactical.localDefense([fighter],[],[invader],home);
 assert.equal(fighter.orders[0]?.kind,'attack');
});
test('HQ: keep production default classic and do not store benchmark policy in save',()=>{
 const g=new Simulation(2026,11);
 assert.equal(g.tactical.hqStandMode,'classic');
 g.tactical.hqStandMode='lastStand';
 const saved=g.save();
 assert.equal(saved.ai?.hqStandMode,undefined);
 assert.equal(Simulation.load(saved).tactical.hqStandMode,'classic');
});
