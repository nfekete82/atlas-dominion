import * as THREE from 'three';
import {RULES} from '/src/reborn/config.js';
import {captureSeconds} from '/src/reborn/territory-warfare.js';

// Display-only capture bars; the simulation remains authoritative.
export function createBastionCaptureBar(){
 const group=new THREE.Group();
 group.name='bastion-capture-bar';
 group.position.y=153;
 group.visible=false;
 const background=new THREE.Sprite(new THREE.SpriteMaterial({
  color:'#0c151d',opacity:.94,transparent:true,depthTest:false,depthWrite:false
 }));
 background.scale.set(144,17,1);
 background.renderOrder=1002;
 group.add(background);
 const fill=new THREE.Sprite(new THREE.SpriteMaterial({
  color:'#62c6e9',transparent:true,depthTest:false,depthWrite:false
 }));
 fill.scale.set(1,11,1);
 fill.renderOrder=1003;
 fill.position.z=1;
 group.add(fill);
 group.userData.captureFill=fill;
 group.userData.captureFraction=0;
 group.userData.captureSeconds=0;
 return group;
}

export function updateBastionCaptureBar(group,territory,game,fogEnabled){
 const active=territory.progress>0&&(territory.capturing===0||territory.capturing===1);
 const visible=active&&(!fogEnabled||game.canSee(0,territory.point));
 group.visible=visible;
 if(!visible){
  group.userData.captureFraction=0;
  return;
 }
 // Same elapsed time and same duration rule used by Simulation.step().
 const seconds=Math.max(.001,captureSeconds({
  version:game.world.mapVersion,
  territory,
  attacker:territory.capturing,
  units:game.units,
  bases:game.bases
 })||RULES.captureTime);
 const fraction=Math.max(0,Math.min(1,territory.progress/seconds));
 const fill=group.userData.captureFill;
 fill.scale.x=Math.max(.01,136*fraction);
 fill.position.x=-68+fill.scale.x/2;
 fill.material.color.set(territory.capturing===0?'#62c6e9':'#f19b73');
 group.userData.captureFraction=fraction;
 group.userData.captureSeconds=seconds;
}
