import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('animation-lab.html','dist/animation-lab.html');
cpSync('src/reborn/style.css', 'dist/style.css');
cpSync('legacy', 'dist/legacy', {recursive:true});
cpSync('src/assets', 'dist/src/assets', {recursive:true});
console.log('Built ATLAS DOMINION in dist/');
