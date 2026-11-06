import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleInViewport} from '../dist/src/reborn/viewport-culling.js';

test('render culling: generous asset margins preserve close off-screen sprites',()=>{
 const view={left:200,right:700,top:300,bottom:650};
 assert.equal(visibleInViewport({x:201,y:301},view),true);
 assert.equal(visibleInViewport({x:0,y:400},view),false);
 assert.equal(visibleInViewport({x:0,y:400},view,250),true);
 assert.equal(visibleInViewport({x:0,y:400},view,190),false);
 assert.equal(visibleInViewport({x:NaN,y:400},view,250),false);
 assert.equal(visibleInViewport({x:1200,y:400},view,500),true);
 assert.equal(visibleInViewport({x:1201,y:400},view,500),false);
});

test('render culling: body and corpse draw checks share viewport without touching simulation',()=>{
 const renderer=readFileSync(new URL('../src/reborn/renderer.ts',import.meta.url),'utf8');
 const units=readFileSync(new URL('../src/reborn/unit-presentation.ts',import.meta.url),'utf8');
 assert.match(renderer,/visibleInViewport/);
 assert.match(renderer,/this\.units\.drawCorpses\(c,p=>g\.canSee\(0,p\),p=>inView\(p,250\)\)/);
 assert.match(units,/drawCorpses\(c:CanvasRenderingContext2D,visible:\(p:Point\)=>boolean,inViewport:/);
});
