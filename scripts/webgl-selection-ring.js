import * as THREE from 'three';

// The same soft dashed marker is used for infantry, vehicles and aircraft.
// 28 independent curved rectangular dashes, with physical gaps in geometry
// instead of an alpha-texture overlay. One non-indexed draw call per unit.
export const UNIT_SELECTION_RING=Object.freeze({
 dashes:28,fill:.70,width:7.2,opacity:.27,stepsPerDash:3
});
// Preserve the former vehicle-specific API for existing callers and tests.
export const VEHICLE_SELECTION_RING=UNIT_SELECTION_RING;

export function createSegmentedSelectionRingGeometry(radius){
 const {dashes,fill,width,stepsPerDash}=UNIT_SELECTION_RING;
 const r=Math.max(1,Number.isFinite(radius)?radius:1);
 const half=Math.min(width*.5,r*.22);
 const inner=Math.max(1,r-half),outer=r+half;
 const positions=new Float32Array(dashes*stepsPerDash*18);
 const interval=Math.PI*2/dashes,sweep=interval*fill;
 let offset=0;
 for(let dash=0;dash<dashes;dash++){
  const start=interval*dash;
  for(let step=0;step<stepsPerDash;step++){
   const a=start+sweep*step/stepsPerDash;
   const b=start+sweep*(step+1)/stepsPerDash;
   const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
   positions.set([
    ca*inner,sa*inner,0,ca*outer,sa*outer,0,cb*outer,sb*outer,0,
    ca*inner,sa*inner,0,cb*outer,sb*outer,0,cb*inner,sb*inner,0
   ],offset);
   offset+=18;
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.name='SegmentedSelectionRingGeometry';
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.computeBoundingSphere();
 return geometry;
}

export function createSegmentedSelectionRing(radius,color='#9ddfeb'){
 const mesh=new THREE.Mesh(createSegmentedSelectionRingGeometry(radius),
  new THREE.MeshBasicMaterial({color,transparent:true,
   opacity:UNIT_SELECTION_RING.opacity,depthWrite:false,
   depthTest:true,side:THREE.DoubleSide}));
 mesh.name='SegmentedSelectionRing';
 return mesh;
}

export const createVehicleSelectionRingGeometry=createSegmentedSelectionRingGeometry;
export function createVehicleSelectionRing(radius,color='#9ddfeb'){
 const ring=createSegmentedSelectionRing(radius,color);
 ring.name='VehicleDashedSelectionRing';
 return ring;
}
