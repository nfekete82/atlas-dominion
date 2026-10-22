import { RULES } from './config.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { saveCampaign, loadCampaign } from './storage.js';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let game=new Simulation();
const renderer=new Renderer(el<HTMLCanvasElement>('world'),el<HTMLCanvasElement>('minimap'),game);
const input=new Input(renderer);
let accumulator=0,last=performance.now(),uiClock=0,resultShown=false,busy=false;
let soundEnabled=true,audio:AudioContext|null=null;
const played=new WeakSet<object>();
function notify(message:string):void {
  const item=document.createElement('div');item.className='notice';item.textContent=message;el('notices').append(item);
  while(el('notices').children.length>3)el('notices').firstElementChild?.remove();setTimeout(()=>item.remove(),6000);
}
input.notify=notify;
function setPause(paused:boolean):void{game.paused=paused;accumulator=0;el('pause-label').hidden=!paused;el('pause').textContent=paused?'▶':'Ⅱ';el('pause').setAttribute('aria-label',paused?'Fortsetzen':'Pause');el('simulation-status').textContent=paused?'PAUSIERT':'LIVE SIMULATION';}
function reset():void{game=new Simulation();renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.canvas.classList.remove('attack');renderer.home();accumulator=0;resultShown=false;setPause(false);refresh();notify('Neue Kampagne · Erkunde die Wüste und sichere angrenzende Kontrollpunkte.');}
function refresh():void{
  const selected=game.units.filter(u=>renderer.selected.has(u.id)&&u.owner===0);renderer.selected=new Set(selected.map(u=>u.id));
  const base=game.bases.find(b=>b.id===renderer.selectedBase&&b.owner===0&&b.hp>0);if(!base)renderer.selectedBase=null;
  el('credits').textContent=Math.floor(game.credits[0]).toLocaleString('de-DE');
  el('income').textContent=`+${game.income(0)}`;
  el('territories').innerHTML=`${game.territories.filter(t=>t.owner===0).length} <em>/ 30</em>`;
  el('capacity').innerHTML=`${game.count(0)} <em>/ ${RULES.capacity}</em>`;
  el('clock').textContent=`${Math.floor(game.time/60).toString().padStart(2,'0')}:${Math.floor(game.time%60).toString().padStart(2,'0')}`;
  el('exploration').textContent=`${Math.round(game.explored[0].reduce((n,v)=>n+v,0)/game.explored[0].length*100)} % ERKUNDET`;
  el('production').hidden=!base;el('unit-commands').hidden=selected.length===0;el('quick-select').hidden=!!base||selected.length>0;
  el('portrait').classList.toggle('soldier',selected.length>0);
  const img=el('portrait').querySelector('img')!;const desired=selected.length?'/src/assets/reborn/infantry.png':'/src/assets/reborn/headquarters.png';if(img.getAttribute('src')!==desired)img.src=desired;
  el('selection-tag').textContent=selected.length?'BLAUE LEGION / INFANTERIE':base?'BLAUE LEGION / PRODUKTION':'BLAUE LEGION / KOMMANDO';
  el('selection-title').textContent=selected.length?`${selected.length===1?'Infanteriesoldat':`${selected.length} Infanteriesoldaten`}`:base?'Hauptquartier':'Die Wüste gehört niemandem.';
  el('selection-detail').textContent=selected.length?(renderer.attackMode?'Angriffsziel mit Linksklick wählen.':`${selected.filter(u=>u.orders.length>0).length?'Befehl wird ausgeführt.':'Bereit für deinen Befehl.'} Rechtsklick: Bewegen / Angreifen.`):base?'Infanterie ausbilden. Rechtsklick auf die Karte setzt den Sammelpunkt.':'Wähle deinen Soldaten. Erkunde die Wüste und sichere angrenzende Kontrollpunkte.';
  el('selection-health').textContent=selected.length?`${Math.round(selected.reduce((n,u)=>n+u.hp,0))} / ${selected.length*100} TP · SICHT 310 M`:base?`${Math.round(base.hp)} / 1200 TP`:'';
  if(base){
    const recruit=el<HTMLButtonElement>('recruit');recruit.disabled=game.credits[0]<RULES.infantry.cost||base.queue.length>=8||game.count(0)+game.queued(0)>=RULES.capacity||game.status!=='playing';
    el('queue').textContent=base.queue.length?`${base.queue.length} IM AUFTRAG · ${Math.max(0,5-base.production).toFixed(1)} S`:game.count(0)+game.queued(0)>=RULES.capacity?'EINHEITENLIMIT ERREICHT':game.credits[0]<100?'ZU WENIG CREDITS':'WARTESCHLANGE LEER';
    el('production-fill').style.width=`${base.production/5*100}%`;el<HTMLButtonElement>('cancel').disabled=!base.queue.length;
  }
  el('attack').setAttribute('aria-pressed',String(renderer.attackMode));el('overlay').setAttribute('aria-pressed',String(renderer.overlay));
  el('hint').textContent=renderer.attackMode?'ANGRIFFSBEWEGUNG: LINKSKLICK AUF DAS ZIEL':'ZIEHEN: AUSWAHL · RECHTSKLICK: BEWEGEN · SHIFT: BEFEHLSKETTE';
  for(const message of game.notices.splice(0))notify(message);
  if(game.status!=='playing'&&!resultShown){resultShown=true;el('result-title').textContent=game.status==='victory'?'Aridis gehört dir.':'Die Legion ist gefallen.';
    el('result-copy').textContent=game.status==='victory'?'Das feindliche Hauptquartier und seine drei Startgebiete sind unter deiner Kontrolle. Operation Sandkrone ist abgeschlossen.':'Dein Hauptquartier und deine Infanterie wurden vernichtet. Eine neue Kampagne wartet auf deinen Befehl.';
    el<HTMLDialogElement>('result-dialog').showModal();}
}
async function save():Promise<void>{if(busy)return;busy=true;try{await saveCampaign(game);notify('Kampagne lokal gespeichert.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
async function load():Promise<void>{if(busy)return;busy=true;try{const loaded=await loadCampaign();game=loaded;renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.canvas.classList.remove('attack');renderer.home();resultShown=false;accumulator=0;setPause(false);refresh();notify('Kampagne geladen.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
function modal(id:string):void{const d=el<HTMLDialogElement>(id),wasPaused=game.paused;setPause(true);d.returnValue='';d.showModal();d.addEventListener('close',()=>{if(d.returnValue!=='new')setPause(wasPaused);},{once:true});}
input.onPause=()=>setPause(!game.paused);input.onHelp=()=>modal('help-dialog');input.onSave=()=>void save();input.onLoad=()=>void load();input.onSelection=refresh;
el('save').onclick=()=>void save();el('load').onclick=()=>void load();el('pause').onclick=input.onPause;el('help').onclick=input.onHelp;
el('new').onclick=()=>modal('new-dialog');el<HTMLDialogElement>('new-dialog').addEventListener('close',()=>{if(el<HTMLDialogElement>('new-dialog').returnValue==='new')reset();});
el('result-new').onclick=()=>{el<HTMLDialogElement>('result-dialog').close();reset();};el('result-close').onclick=()=>el<HTMLDialogElement>('result-dialog').close();
el('home').onclick=()=>renderer.home();el('overlay').onclick=()=>{renderer.overlay=!renderer.overlay;refresh();};
el('select-unit').onclick=()=>{renderer.selectedBase=null;const u=game.units.find(u=>u.owner===0);renderer.selected=new Set(u?[u.id]:[]);if(u){renderer.camera.x=u.x;renderer.camera.y=u.y;renderer.boundCamera();}refresh();};
el('select-base').onclick=()=>{renderer.selected.clear();renderer.selectedBase=game.bases.find(b=>b.owner===0&&b.hp>0)?.id??null;renderer.home();refresh();};
el('stop').onclick=()=>{game.stop([...renderer.selected]);refresh();};el('attack').onclick=()=>{renderer.attackMode=!renderer.attackMode;renderer.canvas.classList.toggle('attack',renderer.attackMode);refresh();};
el('recruit').onclick=()=>{if(renderer.selectedBase!==null&&game.recruit(renderer.selectedBase))refresh();};el('cancel').onclick=()=>{if(renderer.selectedBase!==null){game.cancel(renderer.selectedBase);refresh();}};
el('sound').onclick=()=>{soundEnabled=!soundEnabled;el('sound').setAttribute('aria-pressed',String(soundEnabled));};
window.addEventListener('pointerdown',()=>{try{audio??=new AudioContext();if(audio.state==='suspended')void audio.resume();}catch{/* Audio is optional. */}},{once:true});
window.addEventListener('resize',()=>renderer.resize());document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;if(document.hidden)setPause(true);});
function effects():void{
  if(!audio||audio.state!=='running'||!soundEnabled)return;
  for(const s of game.shots)if(!played.has(s)&&(game.canSee(0,s.from)||game.canSee(0,s.to))){played.add(s);
    const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(160+game.time%1*70,audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(40,audio.currentTime+.055);
    gain.gain.setValueAtTime(.012,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.065);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.07);
  }
}
function frame(now:number):void{
  const dt=Math.min(.1,(now-last)/1000);last=now;input.update(dt);
  if(!game.paused){accumulator+=dt;let steps=0;while(accumulator>=RULES.tick&&steps++<5){game.step();accumulator-=RULES.tick;}}else accumulator=0;
  effects();renderer.render(dt);uiClock+=dt;if(uiClock>.1){refresh();uiClock=0;}requestAnimationFrame(frame);
}
try{await renderer.load();el('loading').remove();refresh();requestAnimationFrame(frame);}catch(e){el('loading').innerHTML='<strong>Der Wüstensektor konnte nicht geladen werden.</strong><p>Bitte neu laden und die lokalen Asset-Dateien prüfen.</p>';console.error(e);}
if(new URLSearchParams(location.search).has('debug')){
  Object.assign(window,{__reborn:{get game(){return game;},renderer,input,refresh,
    advance(seconds:number){for(let i=0;i<Math.round(seconds/RULES.tick);i++)game.step();refresh();renderer.render(0);},save,load}});
}
