import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {sameKindVisibleUnits} from '../scripts/webgl-double-click-select.js';

const make=(id,kind='tank',x=0,y=0,z=0,owner=0)=>({
 unit:{id,kind,owner,hp:100},
 entry:{node:{visible:true,position:{x,y,z}}}
});
test('double click selects only friendly active same-type units in current screen frustum',()=>{
 const a=make(1,'tank',0,0,0),b=make(2,'tank',.8,.2,0),
  c=make(3,'tank',1.2,0,0),d=make(4,'tank',0,0,1.5),
  e=make(5,'rover',0,0,0),f=make(6,'tank',0,0,0,1),
  g=make(7,'tank',-.3,0,0),h=make(8,'tank',0,0,0),
  i=make(9,'tank',0,0,0),j=make(10,'tank',0,0,0);
 g.unit.carrier=12;h.unit.hp=0;i.entry.node.visible=false;
 const units=[a,b,c,d,e,f,g,h,i,j].map(m=>m.unit),
 entries=new Map([a,b,c,d,e,f,g,h,i,j].map(m=>[m.unit.id,m.entry]));
 entries.delete(10);
 const pick=sameKindVisibleUnits(units,entries,'tank',{
  project:node=>node.position,
  isVisible:ndc=>ndc.y<.3
 });
 assert.deepEqual(pick,[1,2]);
 assert.deepEqual(sameKindVisibleUnits(units,entries,'rover',{
  project:node=>node.position
 }),[5]);
});

test('viewport selection does not allocate game state, command a unit or select enemies',()=>{
 const units=[{id:10,kind:'scout',hp:360,owner:0},
  {id:11,kind:'scout',hp:360,owner:1},
  {id:12,kind:'scout',hp:360,owner:0}];
 const entries=new Map(units.map(u=>[u.id,{node:{visible:true,position:{x:0,y:0,z:0}}}]));
 const snapshot=JSON.stringify(units);
 assert.deepEqual(sameKindVisibleUnits(units,entries,'scout',{
  project:node=>node.position,isVisible:(ndc,u)=>u.id!==12
 }),[10]);
 assert.equal(JSON.stringify(units),snapshot);
 assert.deepEqual(sameKindVisibleUnits(units,entries,'missing',{
  project:node=>node.position
 }),[]);
 assert.deepEqual(sameKindVisibleUnits(units,entries,'scout',{}),[]);
});

test('real WebGL uses native doubleclick only for left click and skips build/attack/rally modes',()=>{
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(source,/canvas\.addEventListener\('dblclick'/);
 assert.match(source,/selectSameKindOnScreen\(event\)/);
 assert.match(source,/event\.button!==0\|\|this\.buildKind\|\|this\.rallyMode\|\|this\.attackMode/);
 assert.match(source,/this\.friendlyAtPointer\(event\)/);
 assert.match(source,/this\.selected=event\.shiftKey\?new Set\(\[\.\.\.this\.selected,\.\.\.ids\]\):new Set\(ids\)/);
 assert.match(source,/front===canvas\|\|canvas\.contains\(front\)/);
 assert.ok(existsSync('dist/webgl-double-click-select.js'));
 assert.match(build,/cpSync\('scripts\/webgl-double-click-select\.js','dist\/webgl-double-click-select\.js'\)/);
});
