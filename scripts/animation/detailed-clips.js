import * as T from 'three';
// Bake the supporting arm into real quaternion tracks. This is offline skeletal
// animation authoring; the game receives ordinary frames and the GLB real clips.
export function bakeDetailedClips(model,mixer,sources){
 const bones=[];model.traverse(n=>{if(n.isBone)bones.push(n);});const bone=name=>bones.find(n=>n.name===name),rifle=model.getObjectByName('Atlas_Rifle');
 mixer.stopAllAction();model.updateMatrixWorld(true);model.attach(rifle);rifle.position.set(.025,1.20,.45);rifle.quaternion.identity();rifle.updateMatrixWorld(true);bone('Torso').attach(rifle);const rifleRest=rifle.position.clone(),barrelAxis=new T.Vector3(0,0,1).applyQuaternion(rifle.quaternion);
 const world=n=>n.getWorldPosition(new T.Vector3());
 const align=(joint,from,to)=>{const delta=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),rotation=delta.multiply(joint.getWorldQuaternion(new T.Quaternion()));joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rotation));joint.updateMatrixWorld(true);};
 function support(side){
  model.updateMatrixWorld(true);const upper=bone('UpperArm'+side),lower=bone('LowerArm'+side),wrist=bone('Index1'+side),a=world(upper),b=world(lower),c=world(wrist),target=rifle.localToWorld(side==='L'?new T.Vector3(0,-.055,.17):new T.Vector3(0,-.10,-.10));
  const l1=a.distanceTo(b),l2=b.distanceTo(c),raw=target.clone().sub(a),d=Math.max(.04,Math.min(raw.length(),l1+l2-.002)),dir=raw.normalize();
  const pole=new T.Vector3(side==='L'?.8:-.8,-.65,-.12),bend=pole.clone().addScaledVector(dir,-pole.dot(dir)).normalize();
  const x=(l1*l1-l2*l2+d*d)/(2*d),elbow=a.clone().addScaledVector(dir,x).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-x*x)));
  align(upper,b.clone().sub(a),elbow.clone().sub(a));const nowB=world(lower),nowC=world(wrist),end=a.clone().addScaledVector(dir,d);align(lower,nowC.sub(nowB),end.sub(nowB));
  return world(wrist).distanceTo(target);
 }
 const result=[];let maxGripError=0;
 for(const source of sources){const frames=Math.ceil(source.duration*30),times=[],riflePositions=[],values=new Map(bones.map(n=>[n,{position:[],quaternion:[],scale:[]} ]));
  for(let i=0;i<=frames;i++){
   mixer.stopAllAction();const action=mixer.clipAction(source);action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();const time=source.duration*i/frames;mixer.setTime(time);
   const recoil=source.name==='Idle_Shoot'?.04*Math.sin(Math.PI*Math.min(1,time/source.duration*2)):0;rifle.position.copy(rifleRest).addScaledVector(barrelAxis,-recoil);
   if(['Idle','Run_Gun','Idle_Shoot'].includes(source.name))maxGripError=Math.max(maxGripError,support('R'),support('L'));
   riflePositions.push(...rifle.position.toArray());
   times.push(time);for(const n of bones){const v=values.get(n);v.position.push(...n.position.toArray());v.quaternion.push(...n.quaternion.toArray());v.scale.push(...n.scale.toArray());}
  }
  mixer.stopAllAction();const tracks=[];for(const n of bones){const v=values.get(n);tracks.push(new T.VectorKeyframeTrack(n.name+'.position',times,v.position),new T.QuaternionKeyframeTrack(n.name+'.quaternion',times,v.quaternion),new T.VectorKeyframeTrack(n.name+'.scale',times,v.scale));}
  tracks.push(new T.VectorKeyframeTrack(rifle.name+'.position',times,riflePositions));result.push(new T.AnimationClip(source.name,source.duration,tracks));
 }
 rifle.position.copy(rifleRest);
 return {clips:result,maxGripError};
}
