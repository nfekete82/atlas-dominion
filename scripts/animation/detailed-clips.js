import * as T from 'three';

// Author both arms against weapon-space grip frames, then bake ordinary GLB tracks.
// The rifle stays on the right wrist in EVERY clip, including hit and death.
export function bakeDetailedClips(model,mixer,sources){
 const bones=[];model.traverse(n=>{if(n.isBone)bones.push(n);});
 const bone=name=>{const n=bones.find(n=>n.name===name);if(!n)throw Error('Missing rig joint '+name);return n;};
 const rifle=model.getObjectByName('Atlas_Rifle'),chest=model.getObjectByName('Atlas_Breastplate');
 const grips={R:rifle.getObjectByName('Atlas_GripR'),L:rifle.getObjectByName('Atlas_GripL')};
 if(rifle.parent?.name!=='Atlas_WeaponSocket'||rifle.parent.parent!==bone('Index1R'))throw Error('Rifle must be bound to the right wrist socket');
 mixer.stopAllAction();model.updateMatrixWorld(true);
 const rest=bones.map(n=>({n,p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}));
 const reset=()=>{for(const {n,p,q,s} of rest){n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);}model.updateMatrixWorld(true);};
 const world=n=>n.getWorldPosition(new T.Vector3());
 const setWorldRotation=(joint,q)=>{joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));joint.updateMatrixWorld(true);};
 function align(joint,child,target,front,part){
  const from=world(child).sub(world(joint)).normalize(),to=target.clone().sub(world(joint)).normalize();
  setWorldRotation(joint,new T.Quaternion().setFromUnitVectors(from,to).multiply(joint.getWorldQuaternion(new T.Quaternion())));
  // Resolve twist as well as direction so armour does not inherit the source's arm swing.
  const normal=new T.Vector3(0,0,1).applyQuaternion(part.getWorldQuaternion(new T.Quaternion()));
  normal.addScaledVector(to,-normal.dot(to)).normalize();const desired=front.clone().addScaledVector(to,-front.dot(to)).normalize();
  if(desired.lengthSq()>.01&&normal.lengthSq()>.01){const angle=Math.atan2(to.dot(normal.clone().cross(desired)),normal.dot(desired));setWorldRotation(joint,new T.Quaternion().setFromAxisAngle(to,angle).multiply(joint.getWorldQuaternion(new T.Quaternion())));}
 }
 function solve(side,target,orientation){
  model.updateMatrixWorld(true);
  const upper=bone('UpperArm'+side),lower=bone('LowerArm'+side),wrist=bone('Index1'+side),a=world(upper),b=world(lower),c=world(wrist);
  const l1=a.distanceTo(b),l2=b.distanceTo(c),raw=target.clone().sub(a),d=T.MathUtils.clamp(raw.length(),Math.abs(l1-l2)+.001,l1+l2-.001),dir=raw.normalize();
  const chestRotation=chest.getWorldQuaternion(new T.Quaternion());
  const pole=new T.Vector3(side==='L'?1:-1,-.85,.10).applyQuaternion(chestRotation),bend=pole.addScaledVector(dir,-pole.dot(dir)).normalize();
  const x=(l1*l1-l2*l2+d*d)/(2*d),elbow=a.clone().addScaledVector(dir,x).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-x*x)));
  const front=new T.Vector3(0,0,1).applyQuaternion(chestRotation);
  align(upper,lower,elbow,front,model.getObjectByName('Atlas_UpperArm'+side));
  align(lower,wrist,a.clone().addScaledVector(dir,d),front,model.getObjectByName('Atlas_Forearm'+side));
  setWorldRotation(wrist,orientation);
  return world(wrist).distanceTo(target);
 }
 const result=[],gripAudit={};let maxGripError=0;
 for(const source of sources){
  if(!source)throw Error('Missing infantry animation');
  const frames=Math.ceil(source.duration*60),times=[],values=new Map(bones.map(n=>[n,{position:[],quaternion:[],scale:[]} ]));
  const audit={samples:frames+1,right:0,left:0};
  for(let i=0;i<=frames;i++){
   mixer.stopAllAction();reset();const action=mixer.clipAction(source);action.reset().setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
   const time=source.duration*i/frames,phase=time/source.duration;mixer.setTime(time);model.updateMatrixWorld(true);
   // Low ready and shouldered aim share one socket. Only the authored pose changes.
   const shooting=source.name==='Idle_Shoot',hit=source.name==='HitReact'?Math.sin(Math.PI*phase):0;
   const recoil=shooting?.018*Math.pow(Math.max(0,Math.sin(Math.PI*phase*2)),4):0;
   const position=new T.Vector3(shooting?-.255:-.23,shooting?.14:.06,.56-recoil);
   const orientation=chest.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromEuler(new T.Euler((shooting?.015:.16)-recoil*.9+hit*.055,.22,-.025-hit*.035)));
   const origin=chest.localToWorld(position),rightTarget=grips.R.position.clone().applyQuaternion(orientation).add(origin);
   audit.right=Math.max(audit.right,solve('R',rightTarget,orientation));
   // Right wrist now drives the actual rifle; the second hand follows its actual socket.
   model.updateMatrixWorld(true);audit.left=Math.max(audit.left,solve('L',world(grips.L),rifle.getWorldQuaternion(new T.Quaternion())));
   times.push(time);for(const n of bones){const v=values.get(n);v.position.push(...n.position.toArray());
    // Keep quaternion signs continuous for reliable interpolation and export.
    const q=n.quaternion.clone(),last=v.quaternion.slice(-4);if(last.length&&q.dot(new T.Quaternion().fromArray(last))<0)q.set(-q.x,-q.y,-q.z,-q.w);
    v.quaternion.push(...q.toArray());v.scale.push(...n.scale.toArray());}
  }
  maxGripError=Math.max(maxGripError,audit.right,audit.left);gripAudit[source.name]=audit;
  mixer.stopAllAction();const tracks=[];for(const n of bones){const v=values.get(n);tracks.push(new T.VectorKeyframeTrack(n.name+'.position',times,v.position),new T.QuaternionKeyframeTrack(n.name+'.quaternion',times,v.quaternion),new T.VectorKeyframeTrack(n.name+'.scale',times,v.scale));}
  result.push(new T.AnimationClip(source.name,source.duration,tracks));
 }
 reset();
 if(maxGripError>.002)throw Error('Unreachable weapon grip: '+maxGripError.toFixed(5)+'m');
 return {clips:result,maxGripError,gripAudit};
}
