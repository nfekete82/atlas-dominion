import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtWidth} from '../dist/src/reborn/visual-scale.js';
import {foundationFootprint,paintDesertFoundation} from '../dist/src/reborn/desert-foundation.js';

const large=['headquarters','barracks','factory','airfield'];
const small=['generator','turret'];

test('foundations: all six building classes have finite low-profile desert platforms scaled to their visual footprint',()=>{
  for(const kind of [...large,...small]){
    const f=foundationFootprint(kind);
    for(const k of ['width','depth','front','corner','lip','skew'])assert.ok(Number.isFinite(f[k])&&f[k]>0,kind+' '+k);
    assert.ok(f.depth<f.width*.6,kind+' should read as an on-ground pad');
    assert.ok(f.lip<=3,kind+' must not appear elevated');
    assert.ok(f.width<buildingArtWidth(kind,BUILDINGS[kind].width)*1.12,kind+' must not become a giant concrete slab');
  }
  for(const kind of large)assert.ok(
    foundationFootprint(kind).width>buildingArtWidth(kind,BUILDINGS[kind].width),
    kind+' must show a fine foundation border beyond the enlarged structure'
  );
  for(const kind of small)assert.ok(
    foundationFootprint(kind).width<buildingArtWidth(kind,BUILDINGS[kind].width),
    kind+' must have a compact pad'
  );
});

function drawing(){
  const calls=[],saves=[];
  const c={
    globalAlpha:1,fillStyle:null,strokeStyle:null,lineWidth:1,
    save(){saves.push(this.globalAlpha);calls.push(['save']);},
    restore(){this.globalAlpha=saves.pop();calls.push(['restore']);},
    beginPath(){calls.push(['begin']);},
    moveTo(x,y){calls.push(['move',x,y]);},
    lineTo(x,y){calls.push(['line',x,y]);},
    closePath(){calls.push(['close']);},
    fill(){calls.push(['fill',this.globalAlpha,this.fillStyle instanceof Object?'gradient':this.fillStyle]);},
    stroke(){calls.push(['stroke',this.globalAlpha,this.strokeStyle]);},
    ellipse(x,y,rx,ry,rotation,start,end){calls.push(['grain',x,y,rx,ry,rotation,start,end]);},
    createLinearGradient(){return {addColorStop(offset,color){calls.push(['stop',offset,color]);}};},
  };
  return {c,calls,saves};
}
test('foundations: painter is deterministic, alpha-safe, and draws a few muted material layers',()=>{
  const site={id:1024,kind:'barracks',x:1275,y:1880};
  const first=drawing(),second=drawing();
  paintDesertFoundation(first.c,site,.6);
  paintDesertFoundation(second.c,site,.6);
  assert.deepEqual(first.calls,second.calls,'no unstable random material or frame-dependent animation');
  assert.equal(first.c.globalAlpha,1,'canvas alpha must be restored');
  assert.equal(first.saves.length,0,'no unbalanced canvas state');
  assert.ok(first.calls.some(c=>c[0]==='fill'&&c[1]===.6),'foundation honors placement preview opacity');
  assert.ok(first.calls.some(c=>c[0]==='grain'),'very sparse settled sand grains');
  assert.ok(first.calls.filter(c=>c[0]==='fill').length<20,'foundation stays cheap to render');
  const disabled=drawing();
  paintDesertFoundation(disabled.c,site,0);
  assert.deepEqual(disabled.calls,[]);
});

test('foundations: ground pass is below tracks, fog and all gameplay sprites and invisible enemies do not leak',()=>{
  const source=readFileSync(new URL('../src/reborn/renderer.ts',import.meta.url),'utf8');
  const foundation=source.indexOf('paintDesertFoundation(c,b)');
  assert.ok(foundation>0);
  assert.ok(foundation<source.indexOf('this.battlefield.drawTracks(c,g,effectsView)'));
  assert.ok(foundation<source.indexOf('c.drawImage(this.fog,0,0,s,s)'));
  assert.ok(foundation<source.indexOf('this.drawBase(e.base)'));
  assert.match(source,/b.owner===0\|\|g.canSee\(0,b\)\)\)paintDesertFoundation\(c,b\)/);
  assert.match(source,/paintDesertFoundation\(c,\{\.\.\.p,id:0,kind:this.placement\},\.55\)/);
});
