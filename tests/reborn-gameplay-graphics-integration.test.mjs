import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {makeSmoothFogAlpha,FOG_UNKNOWN_ALPHA,FOG_SCALE} from '../dist/src/reborn/fog-presentation.js';
import {RULES} from '../dist/src/reborn/config.js';

test('integration: weather-driven visibility uses the same smooth fog without revealing unexplored terrain',()=>{
 const g=new Simulation(2026,4);
 g.units=[];g.bases=[];g.territories.forEach(t=>t.owner=-1);
 g.world.opaque.fill(0);g.world.blocked.fill(0);
 g.spawn(0,{x:1900,y:1900},'infantry');
 const enemy=g.spawn(1,{x:2150,y:1900},'infantry');
 g.updateVision();assert.equal(g.canSee(0,enemy),true);
 g.time=g.weather.endsAt+12+.2;g.weather.update(g.time);g.updateVision();
 assert.equal(g.weather.phase,'SANDSTORM');
 assert.equal(g.canSee(0,enemy),false);
 const alpha=makeSmoothFogAlpha(g.visible[0],g.explored[0],RULES.grid);
 const x=Math.floor(enemy.x/g.world.cell),y=Math.floor(enemy.y/g.world.cell);
 assert.ok(alpha[(y*FOG_SCALE)*(RULES.grid*FOG_SCALE)+x*FOG_SCALE]>0);
 const unknown=g.explored[0].findIndex(v=>v===0);assert.ok(unknown>=0);
 const ux=unknown%RULES.grid,uy=Math.floor(unknown/RULES.grid);
 assert.equal(alpha[(uy*FOG_SCALE)*(RULES.grid*FOG_SCALE)+ux*FOG_SCALE],FOG_UNKNOWN_ALPHA);
 g.time=g.weather.endsAt+10+.1;g.weather.update(g.time);g.updateVision();
 assert.equal(g.weather.phase,'CLEAR');assert.equal(g.canSee(0,enemy),true);
});

test('integration: veteran ranks, shared menu badges, organic fog and 2K desert sand coexist',()=>{
 const files=['renderer.ts','terrain-presentation.ts','role-visuals.ts','weather-presentation.ts'];
 const [renderer,terrain,roles,weather]=files.map(f=>readFileSync(new URL('../src/reborn/'+f,import.meta.url),'utf8'));
 assert.match(renderer,/drawRoleBadge/);
 assert.match(renderer,/drawRank/);
 assert.match(renderer,/this\.weatherEffects\.draw/);
 assert.match(renderer,/makeSmoothFogAlpha/);
 assert.match(renderer,/FOG_BACKGROUND/);
 assert.match(terrain,/fineSandPattern\(c,sand\)/);
 assert.match(roles,/roleBadgeMarkup/);
 assert.match(weather,/g\.weather\.intensity/);
});
