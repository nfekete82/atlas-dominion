import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {buildingArtWidth} from '../dist/src/reborn/visual-scale.js';
import {foundationFootprint,foundationGroundOffset,paintDesertFoundation} from '../dist/src/reborn/desert-foundation.js';

const large=['headquarters','barracks','factory','airfield'];
const small=['generator','turret'];

test('foundations: every class has an opaque-looking shallow platform that follows its visual width',()=>{
  for(const kind of [...large,...small]){
    const f=foundationFootprint(kind);
    for(const k of ['width','depth','front','corner','lip','skew'])
      assert.ok(Number.isFinite(f[k])&&f[k]>0,kind+' '+k);
    assert.ok(f.depth<f.width*.74,kind+' platform stays a low ground apron, not a giant landscape polygon');
    assert.ok(f.lip<=3,kind+' foundation must remain low');
    assert.ok(f.front<=8,kind+' front edge stays near the actual foot');
    assert.ok(f.width<buildingArtWidth(kind,BUILDINGS[kind].width)*1.13,kind+' not a giant frame');
    assert.ok(f.depth<=f.width*.72,kind+' apron still fits the immediate building area');
  }
  for(const kind of large){
    const f=foundationFootprint(kind);
    assert.ok(
      f.width>=buildingArtWidth(kind,BUILDINGS[kind].width)*1.07,
      kind+' foundation must remain visibly wider than the 3D asset'
    );
    assert.ok(f.depth>=f.width*.55,kind+' rear perimeter must be visible behind the rooftop');
  }
  const hq=foundationFootprint('headquarters');
  assert.ok(hq.depth>=hq.width*.65,'HQ upper platform edge must extend behind the building');
  assert.ok(hq.depth>foundationFootprint('barracks').depth,'HQ has the deepest substantial apron');
  for(const kind of small)assert.ok(
    foundationFootprint(kind).width<buildingArtWidth(kind,BUILDINGS[kind].width),
    kind+' has a compact pad'
  );
});

test('foundations: registration follows the lower visible 3D model edge instead of the high pivot',()=>{
  for(const kind of [...large,...small]){
    const atlas=JSON.parse(readFileSync(new URL('../src/assets/reborn/buildings-3d/'+kind+'-0.json',import.meta.url),'utf8')).body;
    const foot=atlas.solidBounds.y+atlas.solidBounds.h-atlas.pivot[1];
    assert.ok(foot>0,kind);
    const scale=buildingArtWidth(kind,BUILDINGS[kind].width)/atlas.solidBounds.w;
    assert.ok(Math.abs(foundationGroundOffset(kind,atlas)-foot*scale)<1e-9,kind);
  }
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
    clip(){calls.push(['clip']);},
    translate(x,y){calls.push(['translate',x,y]);},
    rotate(a){calls.push(['rotate',a]);},
    scale(x,y){calls.push(['scale',x,y]);},
    arc(x,y,r,a,b){calls.push(['arc',x,y,r,a,b]);},
    bezierCurveTo(...args){calls.push(['bezier',...args]);},
    fill(){calls.push(['fill',this.globalAlpha,typeof this.fillStyle==='object'?'gradient':this.fillStyle]);},
    stroke(){calls.push(['stroke',this.globalAlpha,this.strokeStyle]);},
    ellipse(...args){calls.push(['grain',...args]);},
    createLinearGradient(...args){
      calls.push(['linear',...args]);
      return {addColorStop(offset,color){calls.push(['stop-linear',offset,color]);}};
    },
    createRadialGradient(...args){
      calls.push(['radial',...args]);
      return {addColorStop(offset,color){calls.push(['stop-radial',offset,color]);}};
    }
  };
  return {c,calls,saves};
}

test('foundations: sandstone top is solid and sand dunes cover its surface and edges',()=>{
  const out=drawing(),site={id:1008,kind:'headquarters',x:1290,y:1830};
  paintDesertFoundation(out.c,site);
  const linearStops=out.calls.filter(v=>v[0]==='stop-linear');
  assert.ok(linearStops.some(v=>v[2]==='#d8b584'),'opaque sandstone top rather than transparent wash');
  assert.ok(linearStops.some(v=>v[2]==='#b58a56'),'visible darker stone edge');
  assert.ok(out.calls.filter(v=>v[0]==='radial').length>=15,'windblown sand must overlap exposed top, rear and side edges');
  assert.ok(out.calls.some(v=>v[0]==='clip'),'sand on top must be clipped to foundation');
  const clippedIndex=out.calls.findIndex(v=>v[0]==='clip');
  const lastRadialIndex=out.calls.findLastIndex(v=>v[0]==='radial');
  assert.ok(lastRadialIndex>clippedIndex,'edge-covering sand is painted beyond the slab clipping pass');
  assert.ok(out.calls.filter(v=>v[0]==='bezier').length>=8,'organic dune ripple lines');
  const radialStops=out.calls.filter(v=>v[0]==='stop-radial');
  assert.ok(radialStops.some(v=>/0\.890/.test(v[2])),'sand crest should be visibly opaque');
  assert.ok(radialStops.some(v=>v[2]==='rgba(225,155,65,0)'),'outer sand should feather out into terrain');
});

test('foundations: stable deterministic painter, balanced canvas state and bounded work',()=>{
  const site={id:1024,kind:'barracks',x:1275,y:1880};
  const first=drawing(),second=drawing();
  paintDesertFoundation(first.c,site,.6);
  paintDesertFoundation(second.c,site,.6);
  assert.deepEqual(first.calls,second.calls,'no flickering or non-deterministic random sand');
  assert.equal(first.c.globalAlpha,1);
  assert.equal(first.saves.length,0,'balanced save/restore including sand masks');
  assert.ok(first.calls.some(v=>v[0]==='fill'&&v[1]===.6),'preview alpha honored');
  assert.ok(first.calls.filter(v=>v[0]==='fill').length<45,'bounded per-frame materials');
  const none=drawing();
  paintDesertFoundation(none.c,site,0);
  assert.deepEqual(none.calls,[]);
});

test('foundations: terrain pass stays below fog, tracks and all sprites, never reveals enemies',()=>{
  const source=readFileSync(new URL('../src/reborn/renderer.ts',import.meta.url),'utf8');
  const foundation=source.indexOf('this.drawFoundation(b)');
  assert.ok(foundation>0);
  assert.ok(foundation<source.indexOf('this.battlefield.drawTracks(c,g,effectsView)'));
  assert.ok(foundation<source.indexOf('c.drawImage(this.fog,0,0,s,s)'));
  assert.ok(foundation<source.indexOf('this.drawBase(e.base)'));
  assert.match(source,/b.owner===0\|\|g.canSee\(0,b\)\)\)this.drawFoundation\(b\)/);
  assert.match(source,/this.drawFoundation\(\{\.\.\.p,id:0,kind:this.placement\},\.55\)/);
  assert.match(source,/groundY=site.y\+foundationGroundOffset\(site.kind,body\)/);
});
