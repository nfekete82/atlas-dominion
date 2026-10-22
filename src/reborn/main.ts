import { RULES } from './config.js';
import { Simulation, type Base } from './simulation.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { saveCampaign, loadCampaign } from './storage.js';
import { Soundscape } from './audio.js';
import { BUILDINGS, UNITS, buildingKinds, unitKinds, buildingSpec, unitSpec, type UnitKind, type BuildingKind } from './catalog.js';
import { icon } from './icons.js';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
for(const span of document.querySelectorAll<HTMLElement>('[data-icon]'))span.innerHTML=icon(span.dataset.icon!);
let game=new Simulation();
const renderer=new Renderer(el<HTMLCanvasElement>('world'),el<HTMLCanvasElement>('minimap'),game),input=new Input(renderer),audio=new Soundscape();
let accumulator=0,last=performance.now(),uiClock=0,resultShown=false,busy=false,ready=false,selectionSound='',catalogTab='units';
const messages:{time:string;message:string}[]=[];
try{const s=JSON.parse(localStorage.getItem('atlas-reborn-sound')??'null');if(s){audio.setEnabled(s.enabled!==false);audio.setVolume(Number.isFinite(s.volume)?s.volume:.6);audio.ambience=s.ambience!==false;}}catch{/* Optional local preferences. */}
const timestamp=()=>`${Math.floor(game.time/60).toString().padStart(2,'0')}:${Math.floor(game.time%60).toString().padStart(2,'0')}`;
function notify(message:string):void{
 const item=document.createElement('div');item.className='notice';item.textContent=message;el('notices').append(item);while(el('notices').children.length>3)el('notices').firstElementChild?.remove();setTimeout(()=>item.remove(),6000);
 messages.unshift({time:timestamp(),message});if(messages.length>60)messages.pop();el('unread').hidden=false;
}
input.notify=notify;
function setPause(paused:boolean):void{game.paused=paused;accumulator=0;el('pause-label').hidden=!paused||!!document.querySelector('dialog[open]');el('pause').textContent=paused?'▶':'Ⅱ';el('pause').setAttribute('aria-label',paused?'Fortsetzen':'Pause');el('simulation-status').textContent=paused?'PAUSIERT':'LIVE SIMULATION';}
function closeDialogs():void{for(const d of document.querySelectorAll<HTMLDialogElement>('dialog[open]'))d.close('switch');}
function modal(id:string):void{
 const d=el<HTMLDialogElement>(id);if(d.open)return;const wasPaused=game.paused;setPause(true);d.returnValue='';d.showModal();
 el('pause-label').hidden=true;d.addEventListener('close',()=>{if(d.returnValue==='resume')setPause(false);else if(!['switch','new'].includes(d.returnValue))setPause(wasPaused);},{once:true});
}
function openMenu():void{modal('pause-dialog');}
function contextBase():Base|undefined{return game.bases.find(b=>b.id===renderer.selectedBase&&b.owner===0&&b.hp>0)??game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);}
function tab(next:string):void{catalogTab=next;for(const name of ['units','buildings','territories']){el('catalog-'+name).hidden=name!==next;el('tab-'+name).setAttribute('aria-pressed',String(name===next));}el('catalog-detail').textContent=next==='buildings'?'Gebäude wählen, dann eine freie Stelle im sichtbaren eigenen Gebiet anklicken.':next==='territories'?'Sektor wählen, um die Kamera zu seiner Bastion zu bewegen.':'Einheit wählen, um sie in einer verfügbaren Produktionsstätte auszubilden.';}
function placement(kind:BuildingKind):void{renderer.placement=kind;renderer.attackMode=false;renderer.canvas.classList.remove('attack');renderer.canvas.classList.add('building');tab('buildings');refresh();}
function train(kind:UnitKind):void{
 const selected=contextBase(),producer=selected&&UNITS[kind].producers.includes(selected.kind)&&selected.buildRemaining<=0?selected:game.producer(0,kind);
 if(producer&&game.recruit(producer.id,kind)){audio.command();refresh();}else notify(producer?'Produktion derzeit nicht möglich.':`${UNITS[kind].producers.map(k=>BUILDINGS[k].name).join(' oder ')} erforderlich.`);
}
function prepareCatalog():void{
 for(const group of ['Infanterie','Fahrzeuge','Luftunterstützung']){
  const heading=document.createElement('h2');heading.textContent=group.toLocaleUpperCase('de-DE');el('catalog-units').append(heading);const grid=document.createElement('div');grid.className='catalog-grid';el('catalog-units').append(grid);
  for(const kind of unitKinds.filter(k=>UNITS[k].group===group)){
   const spec=UNITS[kind],button=document.createElement('button');button.className='catalog-card';button.dataset.unit=kind;button.setAttribute('aria-label',`${spec.name} ausbilden · ${spec.cost} Credits`);
   button.innerHTML=`<img src="${renderer.icon('unit',kind)}" alt=""/><span class="card-cost"><i>◆</i>${spec.cost.toLocaleString('de-DE')}</span>`;
   button.onclick=()=>train(kind);button.onpointerenter=()=>{el('catalog-detail').textContent=`${spec.name} · ${spec.buildTime} S — ${spec.description}`;};grid.append(button);
  }
 }
 const heading=document.createElement('h2');heading.textContent='BASISAUSBAU';el('catalog-buildings').append(heading);const grid=document.createElement('div');grid.className='catalog-grid';el('catalog-buildings').append(grid);
 for(const kind of buildingKinds.filter(k=>k!=='headquarters')){
  const spec=BUILDINGS[kind],button=document.createElement('button');button.className='catalog-card';button.dataset.building=kind;button.setAttribute('aria-label',`${spec.name} bauen · ${spec.cost} Credits`);
  button.innerHTML=`<img src="${renderer.icon('building',kind)}" alt=""/><span class="card-cost"><i>◆</i>${spec.cost}</span>`;button.onclick=()=>placement(kind);button.onpointerenter=()=>{el('catalog-detail').textContent=`${spec.name} · ${spec.buildTime} S — ${spec.description}`;};grid.append(button);
 }
 for(const t of game.territories){const button=document.createElement('button');button.className='territory-row';button.dataset.territory=String(t.id);button.innerHTML='<i></i><strong></strong><small></small>';button.onclick=()=>{renderer.camera.x=game.territories[t.id].point.x;renderer.camera.y=game.territories[t.id].point.y;renderer.boundCamera();};el('catalog-territories').append(button);}
 for(let i=0;i<5;i++){const button=document.createElement('button');button.onclick=()=>{const b=contextBase();if(b&&i<b.queue.length){game.cancel(b.id,i);refresh();}else tab('units');};el('queue-slots').append(button);}
}
function reset():void{closeDialogs();game=new Simulation();renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.placement=null;renderer.canvas.classList.remove('attack','building');renderer.home();accumulator=0;resultShown=false;messages.length=0;setPause(false);tab('units');refresh();notify('Neue Kampagne. Bastionen sichern und die Basis ausbauen.');}
function refresh():void{
 if(!ready)return;
 const selected=game.units.filter(u=>renderer.selected.has(u.id)&&u.owner===0);renderer.selected=new Set(selected.map(u=>u.id));
 if(!game.bases.some(b=>b.id===renderer.selectedBase&&b.hp>0&&b.owner===0))renderer.selectedBase=null;
 const base=contextBase(),first=selected[0],spec=first?unitSpec(first):undefined;
 el('credits').textContent=Math.floor(game.credits[0]).toLocaleString('de-DE');el('income').textContent=`+${game.income(0)}`;el('capacity').innerHTML=`${game.count(0)} <em>/ ${RULES.capacity}</em>`;
 el('territories').textContent=`${game.territories.filter(t=>t.owner===0).length} / 30`;el('clock').textContent=timestamp();el('exploration').textContent=`${Math.round(game.explored[0].reduce((n,v)=>n+v,0)/game.explored[0].length*100)} % ERKUNDET`;
 const title=selected.length?(selected.length===1?spec!.name:`${selected.length} Einheiten`):base?(base.kind==='headquarters'?'Hauptquartier':buildingSpec(base).name):'Feldkommando';
 el('selection-title').textContent=title;el('selection-tag').textContent=`BLAUE LEGION${spec?' / '+spec.group.toLocaleUpperCase('de-DE'):''}`;
 const img=el('portrait').querySelector('img')!,desired=first?renderer.icon('unit',first.kind):renderer.icon('building',base?.kind??'headquarters');if(img.getAttribute('src')!==desired)img.src=desired;
 const hp=selected.length?selected.reduce((n,u)=>n+u.hp,0):base?.hp??0,max=selected.length?selected.reduce((n,u)=>n+unitSpec(u).hp,0):base?buildingSpec(base).hp:1;
 el('health-fill').style.width=`${Math.max(0,hp/max*100)}%`;el('selection-health').textContent=`${Math.round(hp)} / ${max}${spec?' · '+spec.sight+' M SICHT':''}`;
 el('selection-detail').textContent=renderer.placement?'Bauplatz im eigenen Gebiet wählen.':selected.length?(renderer.attackMode?'Angriffsziel mit Linksklick wählen.':spec!.description):base?(base.buildRemaining>0?`Wird errichtet. Noch ${Math.ceil(base.buildRemaining)} Sekunden.`:buildingSpec(base).description):'Wähle eine Einheit oder ein Gebäude.';
 el('unit-commands').hidden=selected.length===0;el('attack').setAttribute('aria-pressed',String(renderer.attackMode));el('overlay').setAttribute('aria-pressed',String(renderer.overlay));
 el('placement-tip').hidden=!renderer.placement;if(renderer.placement)el('placement-name').textContent=BUILDINGS[renderer.placement].name;renderer.canvas.classList.toggle('building',!!renderer.placement);
 el('hint').textContent=renderer.placement?'BAUPLATZ WÄHLEN · ESC: ABBRECHEN':renderer.attackMode?'ANGRIFFSBEWEGUNG: LINKSKLICK AUF DAS ZIEL':'ZIEHEN: AUSWAHL · RECHTSKLICK: BEWEGEN · SHIFT: BEFEHLSKETTE';
 if(base){
  const building=base.buildRemaining>0,duration=base.queue[0]??5,ratio=building?1-base.buildRemaining/buildingSpec(base).buildTime:base.production/duration;
  el('production-fill').style.width=`${ratio*100}%`;el('production-time').textContent=building?`BAU ${Math.ceil(base.buildRemaining).toString().padStart(2,'0')} S`:base.queue.length?`00:${Math.ceil(duration-base.production).toString().padStart(2,'0')}`:'00:00';
  el('queue').textContent=building?'BAUSTELLE AKTIV':base.queue.length?`${base.queue.length} IM AUFTRAG · ${Math.max(0,duration-base.production).toFixed(1)} S`:'WARTESCHLANGE LEER';
  el<HTMLButtonElement>('cancel').disabled=!building&&!base.queue.length;
 }else{el('queue').textContent='KEINE PRODUKTIONSSTÄTTE';el('production-fill').style.width='0';el('production-time').textContent='00:00';el<HTMLButtonElement>('cancel').disabled=true;}
 for(const [i,button] of [...el('queue-slots').children].entries()){
  const kind=base?.queueTypes[i],key=kind??'empty';if((button as HTMLElement).dataset.kind!==key){(button as HTMLElement).dataset.kind=key;button.innerHTML=kind?`<img src="${renderer.icon('unit',kind)}" alt=""/><span class="queue-index">${i+1}</span>`:'+';}
  button.classList.toggle('empty',!kind);button.classList.toggle('current',!!kind&&i===0);(button as HTMLElement).title=kind?`${UNITS[kind].name} · Auftrag stornieren`:'Einheit hinzufügen';
 }
 el<HTMLButtonElement>('recruit').disabled=!game.producer(0,'infantry')||game.credits[0]<100||game.count(0)+game.queued(0)>=RULES.capacity;
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-unit]')){
  const kind=button.dataset.unit as UnitKind,producer=game.producer(0,kind);button.disabled=!producer||game.credits[0]<UNITS[kind].cost||game.count(0)+game.queued(0)>=RULES.capacity||game.status!=='playing';button.classList.toggle('locked',!producer);button.title=`${UNITS[kind].name} · ${UNITS[kind].cost} Credits · ${UNITS[kind].buildTime} S${producer?'':' · '+UNITS[kind].producers.map(k=>BUILDINGS[k].name).join(' / ')+' erforderlich'}`;
 }
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-building]')){const kind=button.dataset.building as BuildingKind;button.disabled=game.credits[0]<BUILDINGS[kind].cost||!game.bases.some(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);button.setAttribute('aria-pressed',String(renderer.placement===kind));button.title=`${BUILDINGS[kind].name} · ${BUILDINGS[kind].cost} Credits · ${BUILDINGS[kind].buildTime} S`;}
 if(catalogTab==='territories')for(const button of document.querySelectorAll<HTMLButtonElement>('[data-territory]')){const t=game.territories[Number(button.dataset.territory)],known=game.hasExplored(0,t.point)||t.owner===0;button.className=`territory-row ${known?t.owner===0?'blue':t.owner===1?'red':'neutral':'unknown'}`;button.querySelector('strong')!.textContent=known?t.name:`Unbekannter Sektor ${t.id+1}`;button.querySelector('small')!.textContent=known?`+${t.income}`:'—';}
 for(const message of game.notices.splice(0))notify(message);
 if(game.status!=='playing'&&!resultShown){resultShown=true;closeDialogs();setPause(true);el('result-title').textContent=game.status==='victory'?'Aridis gesichert.':'Die Legion ist gefallen.';el('result-copy').textContent=game.status==='victory'?'Das feindliche Hauptquartier und seine drei Startgebiete sind unter deiner Kontrolle.':'Deine Produktionsstätten und Truppen wurden vernichtet.';el<HTMLDialogElement>('result-dialog').showModal();}
}
async function save():Promise<void>{if(busy)return;busy=true;try{await saveCampaign(game);notify('Kampagne lokal gespeichert.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
async function load():Promise<void>{if(busy)return;busy=true;try{const loaded=await loadCampaign();closeDialogs();game=loaded;renderer.game=game;renderer.invalidate();renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;renderer.placement=null;renderer.canvas.classList.remove('attack','building');renderer.home();resultShown=false;accumulator=0;setPause(false);refresh();notify('Kampagne geladen.');}catch(e){notify((e as Error).message);}finally{busy=false;}}
input.onPause=()=>setPause(!game.paused);input.onMenu=openMenu;input.onBuild=()=>tab('buildings');input.onHelp=()=>modal('help-dialog');input.onSave=()=>void save();input.onLoad=()=>void load();
input.onSelection=()=>{const next=[...renderer.selected].join(',')+':'+renderer.selectedBase;if(next!==selectionSound){selectionSound=next;audio.select();}refresh();};input.onOrder=attack=>audio.command(attack);
el('save').onclick=()=>void save();el('load').onclick=()=>void load();el('main-load').onclick=()=>void load();el('pause').onclick=input.onPause;el('menu').onclick=openMenu;el('help').onclick=input.onHelp;
el('to-main').onclick=()=>{closeDialogs();modal('main-dialog');};el('main-continue').onclick=()=>{closeDialogs();setPause(false);};el('new').onclick=()=>modal('new-dialog');el<HTMLDialogElement>('new-dialog').addEventListener('close',()=>{if(el<HTMLDialogElement>('new-dialog').returnValue==='new')reset();});
el('result-new').onclick=()=>{closeDialogs();reset();};el('result-close').onclick=()=>el<HTMLDialogElement>('result-dialog').close();
el('home').onclick=()=>renderer.home();el('command-home').onclick=()=>renderer.home();el('overlay').onclick=()=>{renderer.overlay=!renderer.overlay;refresh();};
el('select-unit').onclick=()=>{renderer.selectedBase=null;const u=game.units.find(u=>u.owner===0);renderer.selected=new Set(u?[u.id]:[]);if(u){renderer.camera.x=u.x;renderer.camera.y=u.y;renderer.boundCamera();}refresh();};
el('select-base').onclick=()=>{renderer.selected.clear();renderer.selectedBase=game.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0)?.id??null;renderer.home();refresh();};
el('stop').onclick=()=>{game.stop([...renderer.selected]);refresh();};el('attack').onclick=()=>{renderer.attackMode=!renderer.attackMode;renderer.canvas.classList.toggle('attack',renderer.attackMode);refresh();};
el('move-mode').onclick=()=>{if(renderer.selected.size){renderer.attackMode=false;notify('Rechtsklick auf das Bewegungsziel.');}else notify('Zuerst eine Einheit auswählen.');};
el('rally-mode').onclick=()=>{const b=contextBase();if(b){renderer.selected.clear();renderer.selectedBase=b.id;notify('Rechtsklick auf den neuen Sammelpunkt.');refresh();}};
el('recruit').onclick=()=>train('infantry');el('build-shortcut').onclick=()=>tab('buildings');el('cancel').onclick=()=>{const b=contextBase();if(b){if(b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else game.cancel(b.id);refresh();}};
el('cancel-action').onclick=()=>{if(renderer.placement)renderer.placement=null;else{const b=contextBase();if(b&&b.buildRemaining>0){game.cancelConstruction(b.id);renderer.selectedBase=null;}else{renderer.selected.clear();renderer.selectedBase=null;renderer.attackMode=false;}}refresh();};
for(const name of ['units','buildings','territories'])el('tab-'+name).onclick=()=>tab(name);
const soundPreferences=()=>{audio.setEnabled(el<HTMLInputElement>('audio-enabled').checked);audio.setVolume(Number(el<HTMLInputElement>('audio-volume').value)/100);audio.ambience=el<HTMLInputElement>('audio-ambience').checked;el('audio-level').textContent=`${Math.round(audio.volume*100)} %`;try{localStorage.setItem('atlas-reborn-sound',JSON.stringify({enabled:audio.enabled,volume:audio.volume,ambience:audio.ambience}));}catch{/* Optional. */}};
el<HTMLInputElement>('audio-enabled').checked=audio.enabled;el<HTMLInputElement>('audio-volume').value=String(Math.round(audio.volume*100));el<HTMLInputElement>('audio-ambience').checked=audio.ambience;el('audio-level').textContent=`${Math.round(audio.volume*100)} %`;
for(const id of ['audio-enabled','audio-volume','audio-ambience'])el(id).addEventListener('input',soundPreferences);
const openAudio=()=>{modal('audio-panel');el('sound').setAttribute('aria-expanded','true');};el('sound').onclick=openAudio;el('options').onclick=openAudio;el<HTMLDialogElement>('audio-panel').addEventListener('close',()=>el('sound').setAttribute('aria-expanded','false'));el('audio-test').onclick=()=>{void audio.unlock().then(()=>audio.command());};
el('messages').onclick=()=>{const history=el('message-history');history.replaceChildren();if(!messages.length){const p=document.createElement('p');p.textContent='Keine neuen Funkmeldungen.';history.append(p);}for(const item of messages){const p=document.createElement('p'),time=document.createElement('time');time.textContent=item.time;p.append(time,document.createTextNode(item.message));history.append(p);}el('unread').hidden=true;modal('message-dialog');};
window.addEventListener('pointerdown',()=>{void audio.unlock().catch(()=>{});},{capture:true});window.addEventListener('keydown',()=>{void audio.unlock().catch(()=>{});},{capture:true});window.addEventListener('resize',()=>renderer.resize());document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;if(document.hidden)setPause(true);});
function frame(now:number):void{const dt=Math.min(.1,(now-last)/1000);last=now;input.update(dt);if(!game.paused){accumulator+=dt;let steps=0;while(accumulator>=RULES.tick&&steps++<5){game.step();accumulator-=RULES.tick;}}else accumulator=0;audio.update(game,renderer);renderer.render(dt,accumulator/RULES.tick);uiClock+=dt;if(uiClock>.1){refresh();uiClock=0;}requestAnimationFrame(frame);}
try{await renderer.load();prepareCatalog();ready=true;el('loading').remove();refresh();requestAnimationFrame(frame);}catch(e){el('loading').innerHTML='<strong>Der Wüstensektor konnte nicht geladen werden.</strong><p>Bitte neu laden und die lokalen Grafiken prüfen.</p>';console.error(e);}
if(new URLSearchParams(location.search).has('debug'))Object.assign(window,{__reborn:{get game(){return game;},renderer,input,refresh,audio,advance(seconds:number){for(let i=0;i<Math.round(seconds/RULES.tick);i++)game.step();refresh();renderer.render(0);},save,load}});
