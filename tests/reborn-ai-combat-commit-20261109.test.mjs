import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shouldCommitFirefight,newBattle,validBattle} from '../dist/src/reborn/battle-response.js';

const context={own:46,enemy:80,visible:6,inRange:4,healthy:3,
 knownTowers:0,time:150,commitUntil:0};

test('winnable observed close firefight does not cause immediate strategic withdrawal',()=>{
 assert.equal(shouldCommitFirefight(context),true);
 assert.equal(shouldCommitFirefight({...context,own:35,commitUntil:155,time:152}),true,
  '6s combat commitment resists one temporary threat spike');
 assert.equal(shouldCommitFirefight({...context,own:24,commitUntil:155,time:152}),false,
  'overwhelming opposition may still force actual retreat');
});

test('firing line never sees hidden troops, out-of-range threats or a turret as safe',()=>{
 assert.equal(shouldCommitFirefight({...context,visible:0}),false);
 assert.equal(shouldCommitFirefight({...context,inRange:0}),false);
 assert.equal(shouldCommitFirefight({...context,healthy:0}),false);
 assert.equal(shouldCommitFirefight({...context,knownTowers:1}),false,
  'unsupported assault on a dangerous observed turret still requires siege');
});

test('optional short combat commitment survives save validation without breaking old states',()=>{
 const old=newBattle();
 assert.equal(validBattle(old,150,()=>true,4),true);
 const fighting={...old,commitUntil:156};
 assert.equal(validBattle(fighting,150,()=>true,4),true);
 assert.equal(validBattle({...fighting,commitUntil:165},150,()=>true,4),false);
 assert.equal(validBattle({...fighting,commitUntil:-5},150,()=>true,4),false);
});
