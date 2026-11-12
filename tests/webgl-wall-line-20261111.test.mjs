import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {wallLinePlacements,WALL_SEGMENT_SPACING,WALL_DRAG_MAX_SEGMENTS,WALL_DRAG_SLOP}
 from '../scripts/webgl-wall-line.js';
test('click creates one wall, horizontal/vertical drags create aligned sections',()=>{
 assert.equal(BUILDINGS.wall.cost,60);
 assert.equal(WALL_SEGMENT_SPACING,112);
 assert.equal(WALL_DRAG_SLOP,9);
 const a=wallLinePlacements({x:1000,y:1000},{x:1000,y:1000});
 assert.equal(a.length,1);
 const horizontal=wallLinePlacements({x:1000,y:1000},{x:1550,y:1040});
 assert.equal(horizontal.length,6);
 assert.ok(horizontal.every(x=>x.facing===0));
 assert.equal(horizontal[1].point.x,1112);
 assert.equal(horizontal[1].point.y,1000);
 const vertical=wallLinePlacements({x:1000,y:1000},{x:995,y:500});
 assert.ok(vertical.length>=5);
 assert.ok(vertical.every(x=>x.facing===2));
 assert.equal(vertical[1].point.y,888);
 assert.equal(vertical[1].point.x,1000);
});
test('line builder caps the number of preview instances and never creates phantom walls',()=>{
 assert.equal(wallLinePlacements({x:100,y:100},{x:100000,y:100}).length,WALL_DRAG_MAX_SEGMENTS);
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(ui.includes("this.buildWallLine({clientX:start.x,clientY:start.y},event,event.shiftKey)"));
 assert.ok(ui.includes("new THREE.InstancedMesh(geometry,material,WALL_DRAG_MAX_SEGMENTS)"));
 assert.ok(ui.includes("this.game.buildError(0,'wall',point,facing)"));
 assert.ok(ui.includes("submitConstruction(this.game,'wall',site.point,this.selected"));
 assert.ok(ui.includes("this.clearWallLinePreview()"));
 assert.ok(readFileSync('scripts/build.mjs','utf8').includes('webgl-wall-line.js'));
});

test('mouse capture and centered 75% menu icon for multi-wall building',()=>{
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 const css=readFileSync('src/reborn/webgl-classic-hud.css','utf8');
 assert.ok(ui.includes("canvas.setPointerCapture(e.pointerId)"));
 assert.ok(ui.includes("moved>WALL_DRAG_SLOP"));
 assert.ok(ui.includes("this.buildKind==='wall'"));
 assert.ok(css.includes('button.catalog-card[data-build="wall"] .sf-card-image'));
 assert.ok(css.includes('height:75%!important;width:75%!important'));
 assert.ok(css.includes('height:128px!important;align-self:stretch!important'));
});
