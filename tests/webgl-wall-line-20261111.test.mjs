import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {wallLinePlacements,wallLineFromTurret,wallLineToTurret,
 wallLineBetweenTurrets,WALL_TOWER_ENDPOINT_OFFSET,
 WALL_SEGMENT_SPACING,WALL_DRAG_MAX_SEGMENTS,WALL_DRAG_SLOP}
 from '../scripts/webgl-wall-line.js';
import {sitesVisuallyOverlap} from '../dist/src/reborn/construction-spacing.js';
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
 assert.ok(ui.includes("this.buildWallLine({clientX:start.x,clientY:start.y,...(tower?{tower}:{})}"));
 assert.ok(ui.includes("event,event.shiftKey)"));
 assert.ok(ui.includes("new THREE.InstancedMesh(geometry,material,WALL_DRAG_MAX_SEGMENTS)"));
 assert.ok(ui.includes("createWallPreviewGeometry()"));
 assert.ok(ui.includes("mergeGeometries(parts,false)"));
 assert.ok(!ui.includes("new THREE.BoxGeometry(108,37,31)"));
 assert.ok(ui.includes("mesh.frustumCulled=false"));
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

test('wall ghost overlay is drawn even when the single-building preview is hidden',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const input=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(preview.includes('battlefield.buildPreview?.visible||battlefield.wallLinePreview?.visible'));
 assert.ok(input.includes('this.wallAnchorTower=tower'));
 assert.ok(input.includes('this.updateWallLinePreview({tower:this.wallAnchorTower},e)'));
 assert.ok(input.includes('this.wallTurretAtPointer(e)'));
});
test('wall lines snap to either turret without placing through the foundation',()=>{
 const a={id:11,x:1000,y:1000},b={id:12,x:1700,y:1000};
 const placement=wallLineBetweenTurrets(a,b);
 assert.ok(placement.length>=3);
 assert.ok(placement.every(s=>s.facing===0));
 assert.ok(placement[0].point.x-a.x>=WALL_TOWER_ENDPOINT_OFFSET-1);
 assert.ok(b.x-placement.at(-1).point.x>=WALL_TOWER_ENDPOINT_OFFSET-1);
 assert.ok(!sitesVisuallyOverlap('wall',placement[0].point,0,'turret',a));
 assert.ok(!sitesVisuallyOverlap('wall',placement.at(-1).point,0,'turret',b));
 for(let i=1;i<placement.length;i++)
  assert.equal(sitesVisuallyOverlap('wall',placement[i].point,0,
   'wall',placement[i-1].point,0),false);
 assert.equal(wallLineBetweenTurrets(a,a).length,0);
 assert.ok(wallLineFromTurret(a,{x:1750,y:1000})[0].point.x>a.x+90);
 const to=wallLineToTurret({x:1000,y:1000},b);
 assert.ok(to.at(-1).point.x<b.x-90);
});
test('orthogonal turret-to-turret paths turn at a legal non-overlapping corner',()=>{
 const a={id:31,x:1000,y:1000},b={id:32,x:1810,y:1620};
 const parts=wallLineBetweenTurrets(a,b);
 assert.ok(parts.length>=5);
 assert.ok(parts.some(s=>s.facing===0));
 assert.ok(parts.some(s=>s.facing===2));
 for(let i=1;i<parts.length;i++)
  assert.equal(sitesVisuallyOverlap('wall',parts[i].point,parts[i].facing,
   'wall',parts[i-1].point,parts[i-1].facing),false,
   'no overlapping corner at wall '+i);
 assert.ok(!sitesVisuallyOverlap('wall',parts[0].point,parts[0].facing,'turret',a));
 assert.ok(!sitesVisuallyOverlap('wall',parts.at(-1).point,parts.at(-1).facing,'turret',b));
});
