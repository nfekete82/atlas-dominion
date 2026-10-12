import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('risk.html', 'dist/risk.html');
cpSync('src/risk-style.css', 'dist/risk-style.css');
cpSync('src/style.css', 'dist/style.css');
cpSync('src/assets', 'dist/src/assets', {recursive:true});
console.log('Built ATLAS DOMINION in dist/');
