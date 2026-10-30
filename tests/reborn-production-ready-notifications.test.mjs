import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

test('unit ready: only an actually spawned own production unit causes one readiness notification',()=>{
 const g=new Simulation(2026,11),hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const prior=g.count(0),enemyCount=g.count(1);
 assert.ok(g.recruit(hq.id,'engineer'));
 assert.equal(g.notices.filter(x=>x.startsWith('Einheit bereit:')).length,0,'queue is not production');
 hq.production=hq.queue[0]-.01;
 g.step();
 assert.equal(g.count(0),prior+1);
 assert.equal(g.count(1),enemyCount);
 assert.deepEqual(g.notices.filter(x=>x.startsWith('Einheit bereit:')),['Einheit bereit: Pionier.']);
 g.step();
 assert.equal(g.notices.filter(x=>x.startsWith('Einheit bereit:')).length,1,'no repeat after completion');
 const saved=g.save(),restored=Simulation.load(saved);
 assert.equal(restored.count(0),g.count(0));
 assert.equal(restored.notices.length,0,'transient notifications are not saved');
});

test('enemy unit production must not raise a message on the player HUD',()=>{
 const g=new Simulation(2026,11),red=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(g.recruit(red.id,'engineer'));
 red.production=red.queue[0]-.01;
 g.step();
 assert.equal(g.notices.filter(x=>x.startsWith('Einheit bereit:')).length,0);
});

test('building completed: require real construction progress with friendly builder; show once after completion',()=>{
 const g=new Simulation(2026,11),hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const engineer=g.units.find(u=>u.owner===0&&u.kind==='engineer');
 const id=10500,kind='generator',spec=BUILDINGS.generator;
 const site={x:hq.x+120,y:hq.y+100};
 const b={...hq,id,kind,...site,hp:250,radius:spec.radius,buildRemaining:.03,
   queue:[],queueTypes:[],queueCosts:[],production:0,constructionActive:false,cooldown:0,rally:null};
 g.bases.push(b);
 engineer.x=site.x+23;engineer.y=site.y+12;
 engineer.orders=[{kind:'build',...site,target:id}];engineer.workingTarget=id;
 assert.equal(g.notices.filter(x=>x.startsWith('Gebäude fertiggestellt:')).length,0);
 g.step();
 assert.equal(b.buildRemaining,0);
 assert.deepEqual(g.notices.filter(x=>x.startsWith('Gebäude fertiggestellt:')),['Gebäude fertiggestellt: Energiekern.']);
 g.step();
 assert.equal(g.notices.filter(x=>x.startsWith('Gebäude fertiggestellt:')).length,1);
});

test('ready notifications stay distinct from attack warnings and never change game save schemas',()=>{
 const main=readFileSync('src/reborn/main.ts','utf8'),
  audio=readFileSync('src/reborn/audio.ts','utf8'),
  style=readFileSync('src/reborn/retro-desert.css','utf8');
 assert.match(main,/announceReady\('building'\)/);
 assert.match(main,/announceReady\('unit'\)/);
 assert.match(main,/notice--ready/);
 assert.match(style,/\.notice--ready/);
 assert.match(audio,/Gebäude fertiggestellt\./);
 assert.match(audio,/Einheit bereit\./);
 assert.match(audio,/this\.lastReadySignal/,'audio should debounce multiple simultaneous completions');
 assert.match(audio,/window\.speechSynthesis\.speaking/,'a busy radio announcement is never interrupted');
 assert.match(main,/audio\.announceAttack\(\)/,'attacks remain independently handled');
});
