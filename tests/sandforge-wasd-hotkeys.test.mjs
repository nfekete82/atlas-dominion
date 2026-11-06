import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const input=readFileSync('src/reborn/input.ts','utf8');
const html=readFileSync('index.html','utf8');

test('keyboard: WASD is exclusively camera navigation, never a unit command',()=>{
 for(const [key,axis] of [['a','dx--'],['d','dx++'],['w','dy--'],['s','dy++']]){
  assert.match(input,new RegExp("this\\.keys\\.has\\('"+key+"'\\)\\)"+axis.replace(/[+]/g,'\\+').replace(/[-]/g,'\\-')),key);
 }
 assert.doesNotMatch(input,/key==='s'&&renderer\.selected\.size/);
 assert.doesNotMatch(input,/key==='a'&&renderer\.selected\.size/);
 assert.doesNotMatch(input,/commandHeld|held\('s'\)|held\('a'\)/);
});

test('keyboard: X stops and Q enters attack-move; help and buttons use identical shortcuts',()=>{
 assert.match(input,/key==='x'&&renderer\.selected\.size/);
 assert.match(input,/key==='q'&&renderer\.selected\.size/);
 assert.match(html,/id="stop" title="Stoppen \(X\)"/);
 assert.match(html,/id="attack" title="Angriffsbewegung \(Q\)"/);
 assert.match(html,/<b>X<\/b> Ausgewählte Einheiten stoppen/);
 assert.match(html,/<b>Q, dann Linksklick<\/b> Angriffsbewegung/);
 assert.match(html,/WASD \/ Pfeile \/ Bildschirmrand/);
});
