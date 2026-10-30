import * as T from 'three';

/** Shared building/prop camera, desert light and transparent shadow receiver. */
export function isometricStage(size=512,pivot=[256,382],zoom=1){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-3.4,3.4,3.4,-3.4,.01,100);
 const offset=(pivot[1]-size/2)*6.8/size/Math.cos(Math.atan2(8,12));
 camera.zoom=zoom;camera.position.set(0,8+offset/zoom,12);camera.lookAt(0,offset/zoom,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 scene.add(new T.HemisphereLight('#c8dfff','#65482b',1.55));
 const sun=new T.DirectionalLight('#ffe4be',3.2);sun.position.set(-6,10,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-5;sun.shadow.camera.right=sun.shadow.camera.top=5;sun.shadow.normalBias=.007;scene.add(sun);scene.add(sun.target);
 const fill=new T.DirectionalLight('#8ab9df',.65);fill.position.set(5,4,-5);scene.add(fill);
 const floor=new T.Mesh(new T.PlaneGeometry(30,30),new T.ShadowMaterial({color:'#292017',opacity:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
 return {scene,camera,floor,offset};
}
