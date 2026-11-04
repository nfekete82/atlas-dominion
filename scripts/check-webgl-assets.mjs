import fs from 'node:fs';

const required = [
  'src/assets/reborn/buildings-3d/textures/desert-basecolor.png',
  'src/assets/reborn/buildings-3d/textures/desert-normal.png',
  'src/assets/reborn/battlefield/crater.png',
  'src/assets/reborn/props-3d/palm-tree.glb',
  'src/assets/reborn/buildings-3d/headquarters-0.glb',
  'src/assets/reborn/buildings-3d/barracks-0.glb',
  'src/assets/reborn/buildings-3d/factory-0.glb',
  'src/assets/reborn/buildings-3d/airfield-0.glb',
  'src/assets/reborn/buildings-3d/generator-0.glb',
  'src/assets/reborn/buildings-3d/turret-0.glb'
];

let missing = 0;
for (const file of required) {
  if (fs.existsSync(file)) {
    console.log('OK   ', file);
  } else {
    console.log('MISS ', file);
    missing++;
  }
}

console.log('');
if (missing) {
  console.log(`Fehlende Assets: ${missing}`);
  process.exit(1);
} else {
  console.log('Alle wichtigen WebGL-Texturen/Modelle vorhanden.');
}
