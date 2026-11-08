import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {eliminationOutcome,hasFactionAssets}
 from '../dist/src/reborn/match-outcome.js';
import {matchResultCopy} from '../scripts/webgl-match-result.js';

const soldier=(owner,overrides={})=>({owner,hp:100,kind:'infantry',...overrides});
const building=(owner,overrides={})=>({owner,hp:500,kind:'turret',buildRemaining:0,...overrides});
const fresh=(bootstrap=true)=>{
 const g=new Simulation(2074,23,false,bootstrap,'dunes');
 g.aiClock=-1000000;
 g.tactical.plan=()=>{};
 g.status='playing';
 return g;
};

test('victory requires every enemy unit AND every enemy building to be destroyed',()=>{
 assert.equal(eliminationOutcome([soldier(0),soldier(1)],[building(1)]),'playing');
 assert.equal(eliminationOutcome([soldier(0),soldier(1)],[]),'playing');
 assert.equal(eliminationOutcome([soldier(0)],[building(1)]),'playing');
 assert.equal(eliminationOutcome([soldier(0)],[]),'victory');
 assert.equal(eliminationOutcome([soldier(1)],[]),'defeat');
 assert.equal(eliminationOutcome([],[building(0)]),'victory');
 assert.equal(eliminationOutcome([],[building(1)]),'defeat');
 assert.equal(eliminationOutcome([],[]),'defeat','simultaneous elimination is not a player victory');
});

test('boarded soldiers, unfinished sites, turrets and generators count as living assets',()=>{
 const ally=soldier(0);
 const passenger=soldier(1,{carrier:324});
 assert.equal(hasFactionAssets([ally,passenger],[],1),true);
 assert.equal(eliminationOutcome([ally,passenger],[]),'playing');
 assert.equal(eliminationOutcome([ally],[building(1,{kind:'turret'})]),'playing');
 assert.equal(eliminationOutcome([ally],[building(1,{kind:'generator'})]),'playing');
 assert.equal(eliminationOutcome([ally],[building(1,{kind:'airfield',buildRemaining:18})]),'playing');
 assert.equal(eliminationOutcome([ally],[building(1,{kind:'headquarters',hp:0})]),'victory');
 assert.equal(eliminationOutcome([ally,soldier(1,{hp:0})],[building(1,{hp:0})]),'victory');
});

test('the missing enemy engineer/HQ cannot trigger the old instant victory',()=>{
 const g=fresh();
 assert.equal(g.bases.length,0,'WebGL campaign starts without HQ');
 // Remove the last RED engineer but leave a living red infantryman.
 const red=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 assert.ok(red);
 g.units=g.units.filter(u=>u.owner===0||u.id===red.id);
 g.step(.05);
 assert.equal(g.needsHeadquarters(1),true);
 assert.equal(g.status,'playing','opponent still has a live soldier');
 g.units=g.units.filter(u=>u.owner===0);
 g.step(.05);
 assert.equal(g.status,'victory','last enemy killed is the only winning condition');
});

test('capturing every enemy HQ sector is not a shortcut to victory',()=>{
 const g=fresh(false);
 const enemy=g.units.find(u=>u.owner===1);
 assert.ok(enemy);
 g.territories.forEach(t=>{t.owner=0;t.progress=0;t.capturing=-1;});
 for(const b of g.bases.filter(b=>b.kind==='headquarters')){
  b.owner=0;b.hp=Math.max(1,b.hp);
 }
 // Keep one last opposing actor and no opposing structures.
 g.units=g.units.filter(u=>u.owner===0||u.id===enemy.id);
 g.step(.05);
 assert.equal(g.status,'playing');
 g.units=g.units.filter(u=>u.owner===0);
 g.step(.05);
 assert.equal(g.status,'victory');
});

test('last enemy building persists victory check after troops are eliminated',()=>{
 const g=fresh();
 g.units=g.units.filter(u=>u.owner===0);
 const site={
  id:904,owner:1,kind:'generator',
  hp:500,x:g.world.size*.65,y:g.world.size*.63,
  radius:38,territory:1,
  queue:[],queueTypes:[],production:0,buildRemaining:4,
  cooldown:0,rally:null
 };
 g.bases.push(site);
 g.step(.05);
 assert.equal(g.status,'playing');
 site.hp=0;
 g.step(.05);
 assert.equal(g.status,'victory');
});

test('player is not defeated while any live unit or building remains',()=>{
 const g=fresh();
 const player=g.units.find(u=>u.owner===0&&u.kind==='infantry');
 g.units=g.units.filter(u=>u.owner===1||u.id===player.id);
 g.step(.05);
 assert.equal(g.status,'playing','last lone infantry can still fight');
 g.units=g.units.filter(u=>u.owner===1);
 g.step(.05);
 assert.equal(g.status,'defeat');
});

test('saved false terminal states resume; genuine terminal states survive round trip',()=>{
 const g=fresh();
 const original=g.save();
 original.status='victory';
 const loaded=Simulation.load(original);
 assert.equal(loaded.status,'playing','fix historical false victory on restore');
 original.status='defeat';
 assert.equal(Simulation.load(original).status,'playing',
  'fix historical false defeat on restore');

 const won=fresh();
 won.units=won.units.filter(u=>u.owner===0);
 won.step(.05);
 assert.equal(won.status,'victory');
 const restored=Simulation.load(won.save());
 assert.equal(restored.status,'victory','real finished victory remains terminal');
 const wrong=won.save();
 wrong.status='defeat';
 assert.equal(Simulation.load(wrong).status,'victory',
  'old contradictory terminal save is reconciled with actual living factions');
});

test('large central outcome has distinct text for each side and no pause duplication',()=>{
 const victory=matchResultCopy('victory');
 assert.deepEqual(victory,{
  title:'SIEG',
  subtitle:'Gefecht beendet',
  detail:'Alle gegnerischen Einheiten und Gebäude sind vernichtet.'
 });
 assert.equal(matchResultCopy('defeat').title,'NIEDERLAGE');
 assert.equal(matchResultCopy('playing'),null);
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const style=readFileSync('src/reborn/webgl-classic-hud.css','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(preview,/installMatchResultOverlay\(document\)/);
 assert.match(preview,/matchResultOverlay\.render\(game\.status\)/);
 assert.match(preview,/const reason=game\.status!=='playing'\?'':/);
 assert.match(preview,/game\.status!==lastOutcome/);
 assert.match(style,/#sf3d-match-result\.sf3d-match-result/);
 assert.match(style,/font-size:clamp\(72px,10vw,138px\)/);
 assert.match(style,/#sf3d-match-result\[hidden\]\{display:none!important\}/);
 assert.match(style,/pointer-events:none/);
 assert.match(build,/cpSync\('scripts\/webgl-match-result\.js','dist\/webgl-match-result\.js'\)/);
 assert.ok(existsSync('dist/webgl-match-result.js'));
});

test('outcome evaluation uses current live HP and excludes dead HQ capture stubs',()=>{
 const code=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(code,/this\.status=eliminationOutcome\(this\.units,this\.bases\)/);
 assert.doesNotMatch(code,/this\.bootstrapLost\(1\)/);
 assert.doesNotMatch(code,/campaignLayout\(this\.world\.mapVersion,this\.seed\)\.starts\[1\]\.every/);
 assert.doesNotMatch(code,/this\.status='victory'/);
 assert.doesNotMatch(code,/this\.status='defeat'/);
});
