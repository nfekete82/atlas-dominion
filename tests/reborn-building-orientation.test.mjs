import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('building facing is opt-in and old legacy campaign saves stay exactly compatible',()=>{
 const g=new Simulation(2026,11),old=g.save();
 assert.ok(g.bases.every(b=>b.facing===undefined));
 assert.equal(Simulation.load(old).bases.find(b=>b.owner===0).facing,undefined);
});
test('facing changes cosmetic orientation only, not site validity or unit pathfinding',()=>{
 const g=new Simulation(2026,11),eng=g.units.find(u=>u.owner===0&&u.kind==='engineer'),hq=g.bases.find(b=>b.owner===0);
 g.credits[0]=25000;
 let target;
 for(let radius=200;radius<=750&&!target;radius+=20)
  for(let i=0;i<40;i++){
   const p={x:hq.x+radius*Math.cos(i*Math.PI/20),y:hq.y+radius*Math.sin(i*Math.PI/20)};
   if(!g.buildError(0,'generator',p)){target=p;break;}
  }
 assert.ok(target,'test needs a legal site near headquarters');
 const b=g.build(0,'generator',target,[eng.id],1);
 assert.ok(b);
 assert.equal(b.facing,1);
 assert.equal(b.radius,38);
 assert.equal(b.kind,'generator');
 assert.equal(g.obstacles().find(x=>x.id===b.id),b);
 const stored=g.save(),restored=Simulation.load(stored);
 assert.equal(restored.bases.find(x=>x.id===b.id).facing,1);
 assert.equal(restored.bases.find(x=>x.id===b.id).radius,b.radius);
 assert.equal(restored.bases.find(x=>x.id===b.id).x,b.x);
 assert.equal(restored.bases.find(x=>x.id===b.id).y,b.y);
 const tampered=structuredClone(stored);
 tampered.bases.find(x=>x.id===b.id).facing=45;
 assert.throws(()=>Simulation.load(tampered),/beschädigt|Spielstand/);
});
test('direction control has live ghost, R shortcut, clickable HUD, and symmetric decorated final building',()=>{
 const main=readFileSync('src/reborn/main.ts','utf8');
 const input=readFileSync('src/reborn/input.ts','utf8');
 const renderer=readFileSync('src/reborn/renderer.ts','utf8');
 const html=readFileSync('index.html','utf8');
 assert.match(input,/key==='r'&&renderer\.placement/);
 assert.match(input,/renderer\.placementFacing=renderer\.placementFacing===0\?1:0/);
 assert.match(input,/renderer\.game\.build\(0,renderer\.placement,point,\[\.\.\.renderer\.selected\],renderer\.placementFacing\)/);
 assert.match(main,/rotate-building'\)\.onclick/);
 assert.match(main,/el<HTMLButtonElement>\('rotate-building'\)\.hidden=!renderer\.placement/);
 assert.match(html,/id="rotate-building"/);
 assert.match(renderer,/if\(this\.placementFacing===1\)\{c\.translate\(2\*p\.x,0\);c\.scale\(-1,1\)/);
 assert.match(renderer,/if\(b\.facing===1\)\{c\.translate\(2\*b\.x,0\);c\.scale\(-1,1\)/);
 assert.match(renderer,/this\.decor\.draw\(c,b\.kind/);
 assert.match(renderer,/b\.facing===1\?Math\.PI-angle:angle/);
});
