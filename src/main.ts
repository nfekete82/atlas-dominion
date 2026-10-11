import { Game, NEUTRAL, WATER, pointToIndex, TICK_SECONDS, type Point } from './engine/game.js';
import { MapRenderer } from './render/map.js';

const $ = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
};
const format = (n:number) => new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(n);
let game = new Game(Date.now() % 2147483647);
const renderer = new MapRenderer($<HTMLCanvasElement>('battleCanvas'), game);
let speed = 1;
let soundEnabled = false;
let audio: AudioContext | null = null;
let prevStatus = game.status;
let modalVisible = false;

function beep(freq = 440, duration = 0.08) {
  if (!soundEnabled) return;
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator(); const gain = audio.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, audio.currentTime);
    gain.gain.setValueAtTime(0.035, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(gain); gain.connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + duration);
  } catch { soundEnabled = false; }
}

function update() {
  const player = game.factions[0];
  const percent = player.territory / game.totalLand * 100;
  $('areaCount').textContent = format(player.territory);
  $('troopCount').textContent = format(player.troops);
  $('incomeCount').textContent = '+' + format(player.income);
  $('controlCount').textContent = percent.toFixed(1) + '%';
  $('progressLabel').textContent = percent.toFixed(1) + ' / 65%';
  $('progressFill').style.width = Math.min(100, percent/65*100) + '%';
  const elapsed = Math.floor(game.tick * TICK_SECONDS);
  $('clock').textContent = `${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
  const ranked = [...game.factions].sort((a,b)=>b.territory-a.territory);
  const max = Math.max(1,...ranked.map(f=>f.territory));
  $('leaderboard').innerHTML = ranked.map((f,index)=>`
    <div class="power ${f.id===0?'player':''} ${!f.alive?'eliminated':''}">
      <span class="power-num">${String(index+1).padStart(2,'0')}</span>
      <b class="power-name"><i style="background:${f.color}"></i><span>${f.name}</span></b>
      <span class="power-area">${format(f.territory)}</span>
      <div class="power-bar"><div style="width:${(f.territory/max*100).toFixed(1)}%;background:${f.color}"></div></div>
    </div>`).join('');
  $('eventFeed').innerHTML = game.events.map(e=>`<div class="event"><i style="background:${e.color}"></i><div>${e.text}<small>TAG ${String(Math.floor(e.tick/240)+1).padStart(2,'0')} · ${String(Math.floor(e.tick*TICK_SECONDS/60)).padStart(2,'0')}:${String(Math.floor(e.tick*TICK_SECONDS%60)).padStart(2,'0')}</small></div></div>`).join('');
  const target = player.target;
  $('ordersLabel').textContent = `ANGRIFFSZIEL: SEKTOR ${Math.floor(target.x)} / ${Math.floor(target.y)} · VORMARSCH AKTIV`;
  $('pauseBtn').textContent = game.paused ? '▶' : 'Ⅱ';
  document.querySelectorAll<HTMLButtonElement>('[data-doctrine]').forEach(b=>b.classList.toggle('selected', b.dataset.doctrine===game.doctrine));
  if (game.status!==prevStatus) {
    prevStatus=game.status;
    beep(game.status==='victory'?880:180,0.3);
    const won=game.status==='victory';
    showDialog(won?'EUROPA IST DEIN.':'DEIN IMPERIUM IST GEFALLEN.',
      `<p>${won?'Du kontrollierst die strategische Mehrheit Europas.':'Deine letzten Gebiete wurden erobert.'} Starte eine neue Partie und ändere deine Strategie.</p>`,
      'NEUE PARTIE STARTEN →', restart);
  }
}

renderer.onSelect = (point:Point) => {
  const i=pointToIndex(point);
  if(game.owner[i]===WATER){beep(140);return;}
  if(game.order(0,point)){beep(570);update();}
};
renderer.onHover=(point,px,py)=>{
  const tooltip=$('mapInfo');
  if(!point || game.owner[pointToIndex(point)]===WATER){tooltip.hidden=true;return;}
  tooltip.hidden=false;
  const id=game.owner[pointToIndex(point)];
  const f=id>=0?game.factions[id]:null;
  const owner=$('hoverOwner');
  owner.textContent=f?.name??'UNBESETZTES GEBIET';
  owner.style.color=f?.color??'#bcc5bb';
  $('hoverCoords').textContent=`SEKTOR ${point.x} / ${point.y} · ${id===NEUTRAL?'NEUTRAL':'KONTROLLIERT'}`;
  tooltip.style.left=Math.min(px,renderer.canvas.clientWidth-175)+'px';
  tooltip.style.top=Math.min(py,renderer.canvas.clientHeight-70)+'px';
};

function showDialog(title:string,body:string,actionLabel='VERSTANDEN →',onAction:()=>void=closeDialog) {
  modalVisible = true;
  $('dialogTitle').textContent=title;
  $('dialogBody').innerHTML=body;
  $('dialogAction').textContent=actionLabel;
  ($('dialogAction') as HTMLButtonElement).onclick=onAction;
  $('dialog').hidden=false;
}
function closeDialog() {modalVisible=false;$('dialog').hidden=true;}
function restart() {
  closeDialog();
  game=new Game((Date.now()+Math.floor(Math.random()*100000))%2147483647);
  renderer.setGame(game);prevStatus=game.status;
  update();
}
$('resetBtn').addEventListener('click',()=>showDialog('NEUE OPERATION STARTEN?',
  '<p>Die laufende Partie wird verworfen. Dein neues Europa startet mit neu verteilten Entscheidungen der KI.</p>',
  'NEUE OPERATION →',restart));
$('helpBtn').addEventListener('click',()=>showDialog('DEIN EINSATZBEFEHL',`
  <p>ATLAS DOMINION ist ein Echtzeit-Eroberungsspiel. Starte in Berlin, erweitere dein Gebiet und kontrolliere mindestens <strong>65 %</strong> Europas.</p>
  <div class="briefing-row"><b>01</b><span><strong>KLICKEN:</strong> Angriffsziel setzen. Deine Front bewegt sich automatisch darauf zu.</span></div>
  <div class="briefing-row"><b>02</b><span><strong>ZIEHEN:</strong> Karte verschieben. Mausrad oder +/− zum Zoomen.</span></div>
  <div class="briefing-row"><b>03</b><span><strong>TRUPPEN:</strong> Werden laufend durch Territorium und Städte erzeugt. Angriffe verbrauchen Reserven.</span></div>
  <div class="briefing-row"><b>04</b><span><strong>PAUSE:</strong> Leertaste oder Ⅱ. Mit 1×/2×/4× beschleunigen.</span></div>
  <p><strong>Doktrinen:</strong> EXPAND beschleunigt neutrale Eroberungen, BLITZ erhöht die Angriffsfrequenz, DEFENSE stärkt Einkommen und Garnisonen. Mit 1, 2, 3 umschalten.</p>
  <p>Die KI expandiert ebenfalls und greift Gegner an. Hauptstadtverteidigung ist stärker als gewöhnliches Terrain.</p>`));
$('dialogClose').addEventListener('click',closeDialog);
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog'))closeDialog();});
$('soundBtn').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('soundBtn').textContent=soundEnabled?'♫':'♪';if(soundEnabled)beep(660);});
$('fullBtn').addEventListener('click',()=>{if(!document.fullscreenElement)void document.documentElement.requestFullscreen();else void document.exitFullscreen();});
$('pauseBtn').addEventListener('click',()=>{game.paused=!game.paused;update();});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-doctrine]'))button.addEventListener('click',()=>{
  game.setDoctrine(button.dataset.doctrine as 'expand'|'blitz'|'fortify');beep(490);update();
});
$('zoomIn').addEventListener('click',()=>renderer.zoomBy(1.3));
$('zoomOut').addEventListener('click',()=>renderer.zoomBy(1/1.3));
$('zoomFit').addEventListener('click',()=>renderer.fit());
for(const btn of document.querySelectorAll<HTMLButtonElement>('[data-speed]')) btn.addEventListener('click',()=>{
  speed=Number(btn.dataset.speed)||1;
  document.querySelectorAll('[data-speed]').forEach(e=>e.classList.toggle('active',e===btn));
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&modalVisible){closeDialog();return;}
  if(modalVisible)return;
  if(e.code==='Space') {e.preventDefault();game.paused=!game.paused;update();}
  if(['Digit1','Digit2','Digit3'].includes(e.code)){game.setDoctrine(({Digit1:'expand',Digit2:'blitz',Digit3:'fortify'} as const)[e.code as 'Digit1'|'Digit2'|'Digit3']);update();}
  if(e.key==='+'||e.key==='=')renderer.zoomBy(1.2);
  if(e.key==='-')renderer.zoomBy(1/1.2);
});

setInterval(()=>{
  if(modalVisible||game.paused||game.status!=='playing')return;
  for(let i=0;i<speed;i++)game.step();
  renderer.updateTerritory();
  update();
},250);
update();
// Explicit dev-only API for smoke tests, not game simulation source of truth.
if(new URLSearchParams(location.search).has('debug')) {
  Object.assign(window,{__atlas:{getGame:()=>game, order:(x:number,y:number)=>game.order(0,{x,y}), step:()=>{game.step();renderer.updateTerritory();update();}}});
}
