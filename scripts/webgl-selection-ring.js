import * as THREE from 'three';

// One dashed draw call per selected ground vehicle (no separate mesh for each
// dash). Infantry and aircraft intentionally retain their existing ring.
export const VEHICLE_SELECTION_RING=Object.freeze({
 dashes:14,fill:.78,width:7.6,opacity:.66,stepsPerDash:6
});

export function createVehicleSelectionRingGeometry(radius){
 const {dashes,fill,width,stepsPerDash}=VEHICLE_SELECTION_RING;
 const r=Math.max(1,Number.isFinite(radius)?radius:1);
 const inner=Math.max(1,r-width*.5),outer=r+width*.5;
 const positions=new Float32Array(dashes*stepsPerDash*18);
 const interval=Math.PI*2/dashes,sweep=interval*fill;
 let offset=0;
 for(let dash=0;dash<dashes;dash++){
  const start=interval*dash;
  for(let step=0;step<stepsPerDash;step++){
   const a=start+sweep*step/stepsPerDash;
   const b=start+sweep*(step+1)/stepsPerDash;
   const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   // Two triangles for a thick arc segment. Gaps are actual empty geometry,
   // not an alpha map that might blur or overlap on the desert terrain.
   positions.set([
    ca*inner,sa*inner,0,ca*outer,sa*outer,0,cb*outer,sb*outer,0,
    ca*inner,sa*inner,0,cb*outer,sb*outer,0,cb*inner,sb*inner,0
   ],offset);
   offset+=18;
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.name='VehicleDashedSelectionRingGeometry';
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.computeBoundingSphere();
 return geometry;
}

export function createVehicleSelectionRing(radius,color='#79ecf9'){
 const mesh=new THREE.Mesh(createVehicleSelectionRingGeometry(radius),
  new THREE.MeshBasicMaterial({color,transparent:true,
   opacity:VEHICLE_SELECTION_RING.opacity,depthWrite:false,side:THREE.DoubleSide}));
 mesh.name='VehicleDashedSelectionRing';
 return mesh;
}
