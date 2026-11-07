import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareBarracksPortal,setBarracksDoorOpen,updateBarracksPortalPlanes,disposeBarracksPortal}
 from '../scripts/webgl-barracks-portal.js';

const make=(name)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());m.name=name;return m;};

test('barracks blast door and authored facade become a real clipped 3D opening',()=>{
 const detail=new THREE.Group();
 const hull=make('Atlas_ArmouredHull_4');
 const airlock=make('Atlas_AirlockHousing_10');
 const door=make('Atlas_BarracksBlastDoor_20');
 const stiffener=make('Atlas_BarracksDoorStiffener_21');
 const independent=make('Atlas_RoofCamo_22');
 for(const mesh of [hull,airlock,door,stiffener,independent])detail.add(mesh);
 const entry={detail},renderer={localClippingEnabled:false};
 const portal=prepareBarracksPortal(entry,renderer);
 assert.ok(portal,'real original door must be found');
 assert.ok(renderer.localClippingEnabled);
 assert.equal(portal.doorPanels.length,2);
 assert.equal(hull.material.clippingPlanes.length,6);
 assert.equal(airlock.material.clippingPlanes.length,6);
 assert.equal(hull.material.clipIntersection,true,'a real portal cutout, not opaque wall');
 assert.equal(independent.material.clippingPlanes,null);
 assert.equal(door.material.clippingPlanes,null,'moving door must not be cut out');
 const oldY=door.position.y;
 setBarracksDoorOpen(portal,.5);
 assert.ok(door.position.y>oldY);
 assert.ok(door.scale.y<1);
 assert.ok(portal.hall.visible);
 detail.rotation.y=Math.PI/2;
 updateBarracksPortalPlanes(portal);
 assert.ok(Number.isFinite(portal.planes[0].normal.z));
 setBarracksDoorOpen(portal,0);
 assert.equal(door.position.y,oldY);
 assert.equal(door.scale.y,1);
 assert.equal(portal.hall.visible,false);
 disposeBarracksPortal(entry);
 assert.equal(entry.barracksPortal,undefined);
});
