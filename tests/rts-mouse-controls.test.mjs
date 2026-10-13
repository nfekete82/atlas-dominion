import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const map=readFileSync(new URL('../src/render/map.ts',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('selected RTS squads take right-click commands and shift-right-click opens contextual menu',()=>{
 assert.match(map,/this\.game\.rtsRecruitment&&point&&!forceMenu/);
 assert.match(map,/this\.onCommandSquads\(point\);return/);
 assert.match(map,/else requestBuild\(e\.clientX,e\.clientY,e\.shiftKey\)/);
 assert.match(ui,/renderer\.onCommandSquads=\(point:Point\)=>/);
});

test('empty left-click clears tactical selection without issuing attack or movement orders',()=>{
 const part=ui.split('renderer.onSelect = (point:Point')[1].split('function closeBuildMenu')[0];
 assert.match(part,/selectedSquadId=null;/);
 assert.match(part,/selectedSquadIds=\[\];/);
 assert.match(part,/renderer\.selectedSquadIds=\[\];/);
 assert.doesNotMatch(part,/game\.orderSquad(?:Attack)?\(/);
 assert.match(html,/Rechtsklick: Bewegen \/ Angreifen/);
});
