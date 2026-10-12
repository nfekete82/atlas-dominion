import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('src/style.css', 'dist/style.css');
cpSync('src/assets', 'dist/src/assets', {recursive:true});
console.log('Built ATLAS DOMINION in dist/');
