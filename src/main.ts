import { Game, NEUTRAL, WATER, pointToIndex, TICK_SECONDS, type Point } from './engine/game.js';
import { MapRenderer } from './render/map.js';
import { BUILDINGS, type BuildingType } from './engine/economy.js';
import { COUNTRY_STARTS, countryByCode } from './data/countries.js';
import {formatCompact} from './format.js';

import {DIFFICULTY_SETTINGS,isDifficulty,type Difficulty} from './engine/difficulty.js';

const $ = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
};
const format = formatCompact;
let game = new Game(Date.now() % 2147483647);
game.paused = true; // The player must choose a country before the clock starts.
const renderer = new MapRenderer($<HTMLCanvasElement>('battleCanvas'), game);
let speed = 1;
let soundEnabled = false;
let audio: AudioContext | null = null;
let prevStatus = game.status;
let modalVisible = true;
let hasStarted = false;
let selectedDifficulty:Difficulty='balanced';
let buildSpot: Point | null = null;
let attackRatio = 35;
let showAllNations = false;
let attackMessage = 'Nachbarland anklicken · mehr eingesetzte Truppen = schnellere Front.';
let attackMessageKind: 'neutral'|'success'|'error' = 'neutral';

function populateDiplomacy():void {
  const selector=$<HTMLSelectElement>('diplomacyNation');
  const previous=selector.value;
  selector.innerHTML=game.factions.slice(1).map(f=>
    `<option value="${f.id}">${f.name}</option>`).join('');
  if([...selector.options].some(o=>o.value===previous))selector.value=previous;
}
function updateDiplomacyUI():void {
  const partners=game.alliesOf(0);
  const inbound=game.defenseAid.filter(a=>a.to===0).reduce((n,a)=>n+a.troops,0);
  $('diplomacyAllies').textContent=(partners.length?
    partners.map(id=>'🤝 '+game.factions[id].name).join(' · '):
    'Noch keine Bündnispartner (max. 2)')+(inbound>0?' · 🛡 '+format(inbound)+' Verstärkung unterwegs':'');
  const target=Number($<HTMLSelectElement>('diplomacyNation').value);
  const f=game.factions[target];
  const allied=game.isAllied(0,target);
  $('diplomacyDetail').textContent=!f?'Land auswählen.':
    allied?'🤝 Aktiver Bündnispartner · gegenseitiger Angriffsschutz':
    !f.alive?'Dieses Land wurde besiegt.':
    `${format(f.population)} Gesamtstärke · ${partners.length}/2 eigene Bündnisse`;
  const offer=$<HTMLButtonElement>('diplomacyOffer'),leave=$<HTMLButtonElement>('diplomacyLeave');
  offer.hidden=allied;leave.hidden=!allied;
  offer.disabled=!f||!f.alive||partners.length>=2||game.status!=='playing';
  leave.disabled=game.status!=='playing';
  // Render the inbox once per changed set, so screenreader focus survives ticks.
  const incoming=game.offers.filter(o=>o.to===0&&o.untilTick>game.tick);
  const inbox=$('diplomacyInbox');
  const key=incoming.map(o=>o.from+':'+o.untilTick).join(',');
  if(inbox.dataset.offers!==key){
    inbox.dataset.offers=key;
    inbox.innerHTML=incoming.map(o=>
      `<div class="diplomacy-incoming"><strong>🤝 ${game.factions[o.from].name} bietet ein Bündnis an</strong>
      <button type="button" data-alliance-accept="${o.from}">Annehmen</button>
      <button type="button" data-alliance-decline="${o.from}">Ablehnen</button></div>`).join('');
  }
}

const SAVE_KEY='atlas-dominion-save-v1';
function saveGame():void {
  if(!hasStarted)return;
  try {
    localStorage.setItem(SAVE_KEY,JSON.stringify(game.exportSave()));
  } catch(error) { console.warn('Autosave fehlgeschlagen:',error); }
}
function restoreGame():boolean {
  try {
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return false;
    const restored=Game.fromSave(JSON.parse(raw));
    game=restored;selectedDifficulty=restored.difficulty;
    hasStarted=true;modalVisible=false;
    $('countryPicker').hidden=true;
    renderer.setGame(game);renderer.focusOnCapital(game.cities[0]);
    populateDiplomacy();
    prevStatus=game.status;update();
    return true;
  }catch(error){console.warn('Spielstand konnte nicht geladen werden:',error);return false;}
}


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
  $('playerName').textContent = player.name;
  $('playerFlag').textContent = countryFlag(game.playerCode);
  $('difficultyBadge').textContent = 'KI: '+game.difficultySettings.label.toLocaleUpperCase('de-DE');
  const percent = player.territory / game.totalLand * 100;
  $('areaCount').textContent = format(player.territory);
  const stationedByNation=game.factions.map(()=>0);
  for(let i=0;i<game.owner.length;i++)if(game.owner[i]>=0)
    stationedByNation[game.owner[i]]+=game.frontline[i];
  const fightingByNation=game.factions.map(()=>0);
  for(const order of game.attackOrders)fightingByNation[order.factionId]+=order.remaining;
  const totalPopulation=game.factions.map(f=>f.troops+stationedByNation[f.id]+fightingByNation[f.id]);
  const stationed=stationedByNation[0];
  $('troopCount').textContent = format(totalPopulation[0]);
  // Mobilized armies have not died. This breakdown separates temporary
  // troop commitments from permanent casualties and automatic growth.
  $('mobileTroops').textContent = 'MOBIL: ' + format(player.troops);
  $('frontTroops').textContent = 'AN DER GRENZE: ' + format(stationed);
  $('offensiveTroops').textContent = 'IM ANGRIFF: ' + format(fightingByNation[0]);
  $('fallenTroops').textContent = 'GEFALLEN: ' + format(player.attackFallen+player.defenseSpent);
  $('defenseTickLoss').textContent = player.defenseFallenTick>0
    ? 'VERTEIDIGUNG: −'+format(player.defenseFallenTick)+' DIESE RUNDE'
    : 'VERTEIDIGUNG: KEINE VERLUSTE';
  $('borderDefense').textContent = `${format(game.threatenedBorders(0))} bedrohte Grenzsektoren · ${format(stationed)} stationiert · ${format(player.troops)} mobil`;
  $('casualtyReport').textContent = `⚔ ${format(player.attackFallen+player.defenseSpent)} eigene Gefallene · ${format(player.enemyFallen)} Gegnerverluste`;
  // The combat telemetry is factual: one tick's strikes, not estimates of
  // armies or soldiers magically moving between territories.
  const battles=game.battleEvents.filter(e=>e.attackerId===0||e.defenderId===0);
  const clashes=battles.filter(e=>e.defenderId>=0);
  const blueFallen=clashes.reduce((n,e)=>n+(e.attackerId===0?e.attackerLost:e.defenderLost),0);
  const redFallen=clashes.reduce((n,e)=>n+(e.attackerId===0?e.defenderLost:e.attackerLost),0);
  $('battleReport').innerHTML=clashes.length
    ? `<div class="battle-report-heading"><i class="battle-dot blue"></i> EIGENE <span>·</span>
       <i class="battle-dot red"></i> GEGNER <span>·</span> ${format(clashes.length)} GEFECHTE</div>
       <small><span class="battle-own-loss">−${format(blueFallen)} eigene</span> /
       <span class="battle-enemy-loss">−${format(redFallen)} gegnerische</span> Verluste</small>`
    : '<div class="battle-report-heading"><i class="battle-dot blue"></i> EIGENE <span>·</span> <i class="battle-dot red"></i> GEGNER</div>';
  $('ratioPercent').textContent = attackRatio + ' %';
  $('attackPreview').textContent = format(Math.floor(player.troops * attackRatio / 100)) + ' TRUPPEN';
  $('attackRatio').setAttribute('aria-valuenow', String(attackRatio));
  $('attackRatio').style.setProperty('--ratio', attackRatio + '%');
  document.querySelectorAll<HTMLButtonElement>('[data-ratio]').forEach(b=>b.classList.toggle('active',Number(b.dataset.ratio)===attackRatio));
  $('attackStatus').textContent = attackMessage;
  $('attackStatus').className = 'attack-status ' + (attackMessageKind === 'neutral' ? '' : attackMessageKind);
  $('incomeCount').textContent = '+' + format(player.income,1);
  $('cityCount').textContent = format(player.cityCount+player.builtCities);
  $('moneyCount').textContent = format(player.money);
  $('moneyGrowth').textContent = '+' + format(player.moneyIncome,1) + ' PRO TICK';
  $('controlCount').textContent = percent.toFixed(1) + '%';
  $('progressLabel').textContent = percent.toFixed(1) + ' / 65%';
  $('progressFill').style.width = Math.min(100, percent/65*100) + '%';
  const elapsed = Math.floor(game.tick * TICK_SECONDS);
  $('clock').textContent = `${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
  const ranked = [...game.factions].sort((a,b)=>b.territory-a.territory);
  $('leaderboardToggle').textContent=showAllNations?'Nur Top 12 anzeigen ↑':'Alle Länder anzeigen ↓';
  const max = Math.max(1,...ranked.map(f=>f.territory));
  $('leaderboard').innerHTML = (showAllNations?ranked:ranked.slice(0,12)).map((f,index)=>`
    <div class="power ${f.id===0?'player':''} ${!f.alive?'eliminated':''}">
      <span class="power-num">${String(index+1).padStart(2,'0')}</span>
      <b class="power-name"><i style="background:${f.color}"></i><span>${game.isAllied(0,f.id)?'🤝 ':''}${f.name}</span></b>
      <span class="power-area" title="${format(f.territory)} Sektoren / ${format(totalPopulation[f.id])} Einwohner und Truppen">${format(totalPopulation[f.id])} ⚔</span>
      <div class="power-bar"><div style="width:${(f.territory/max*100).toFixed(1)}%;background:${f.color}"></div></div>
    </div>`).join('');
  updateDiplomacyUI();
  $('eventFeed').innerHTML = game.events.map(e=>`<div class="event"><i style="background:${e.color}"></i><div>${e.text}<small>TAG ${String(Math.floor(e.tick/240)+1).padStart(2,'0')} · ${String(Math.floor(e.tick*TICK_SECONDS/60)).padStart(2,'0')}:${String(Math.floor(e.tick*TICK_SECONDS%60)).padStart(2,'0')}</small></div></div>`).join('');
  const active = game.attackOrders.filter(o => o.factionId === 0);
  const voyages=active.filter(o=>o.landing&&o.conquered===0);
  const neutralOrders=active.filter(o=>!voyages.includes(o)&&o.targetOwner<0);
  const hostileOrders=active.filter(o=>!voyages.includes(o)&&o.targetOwner>=0);
  $('ordersLabel').textContent=active.length
    ? [
        voyages.length?`${voyages.length} FLOTTEN · ${format(voyages.reduce((n,o)=>n+o.remaining,0))} ⚔${voyages.some(o=>o.returning)?' · RÜCKFAHRT':''}`:'',
        neutralOrders.length?`EXPANSION ${format(neutralOrders.reduce((n,o)=>n+o.remaining,0))} ⚔`:'',
        hostileOrders.length?`${hostileOrders.length} KÄMPFE · ${format(hostileOrders.reduce((n,o)=>n+o.remaining,0))} ⚔`:'',
        hostileOrders.some(o=>o.fallen>0)?`−${format(hostileOrders.reduce((n,o)=>n+o.fallen,0))} GEFALLEN`:'',
      ].filter(Boolean).join(' · ')
    : 'LAND / INSEL ANKLICKEN · SEELANDUNG AUTOMATISCH';
  $('pauseBtn').textContent = game.paused ? '▶' : 'Ⅱ';
  document.querySelectorAll<HTMLButtonElement>('[data-doctrine]').forEach(b=>b.classList.toggle('selected', b.dataset.doctrine===game.doctrine));
  if (game.status!==prevStatus) {
    prevStatus=game.status;
    beep(game.status==='victory'?880:180,0.3);
    const won=game.status==='victory';
    showDialog(won?'EUROPA IST DEIN.':'DEIN IMPERIUM IST GEFALLEN.',
      `<p>${won?'Du kontrollierst die strategische Mehrheit Europas.':'Deine letzten Gebiete wurden erobert.'} Wähle für die nächste Partie erneut dein Land.</p>`,
      'NEUE PARTIE STARTEN →', restart);
  }
}

function setAttackRatio(value:number) {
  attackRatio = Math.max(5, Math.min(100, Math.round(value / 5) * 5));
  ($<HTMLInputElement>('attackRatio')).value = String(attackRatio);
  update();
}
$('attackRatio').addEventListener('input',e=>setAttackRatio(Number((e.target as HTMLInputElement).value)));
for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-ratio]')) btn.addEventListener('click',()=>setAttackRatio(Number(btn.dataset.ratio)));
renderer.onSelect = (point:Point, landing:boolean) => {
  closeBuildMenu();
  // Left-click on friendly terrain must NEVER issue an attack or mobilize
  // soldiers. Right-click is still available for construction / defense.
  if(game.owner[pointToIndex(point)]===0)return;
  if(game.isAllied(0,game.owner[pointToIndex(point)]))return;
  const result = landing ? game.launchLanding(0, point, attackRatio) : game.launchAttack(0, point, attackRatio);
  attackMessage=result.ok
    ? `${format(result.sent)} ⚔ · ${result.reason}`
    : result.reason;
  if(result.ok && result.front && result.sent>0 && !result.reason.includes('Landung'))renderer.showReinforcement(result.front,result.sent);
  attackMessageKind = result.ok ? 'success' : 'error';
  beep(result.ok ? 620 : 190);
  update();
};
function closeBuildMenu(): void {
  buildSpot=null;
  $('buildMenu').hidden=true;
}
function renderBuildMenu(): void {
  if(!buildSpot)return;
  const point=buildSpot;
  const territory=game.owner[pointToIndex(point)];
  if(territory>=0&&territory!==0){
    const country=game.factions[territory];
    const allied=game.isAllied(0,territory);
    const evaluation=allied?null:game.evaluateAlliance(0,territory);
    $('buildCoordinates').textContent=`🤝 DIPLOMATIE · ${country.name.toUpperCase()}`;
    $('buildMoney').textContent=allied?'BESTEHENDE KOALITION · GEGENSEITIGER ANGRIFFSSCHUTZ':
      `KI-ENTSCHEIDUNG · ${evaluation!.accepted?'STRATEGISCH ATTRAKTIV':'GERINGER NUTZEN'}`;
    $('buildOptions').innerHTML=allied
      ?`<button type="button" class="build-entry diplomatic-choice" data-coalition-leave="true">
          <span class="build-entry-icon" aria-hidden="true">↩</span>
          <span class="build-entry-copy"><strong>Koalition beenden</strong>
          <small>Nichtangriffspakt mit ${country.name} auflösen</small></span>
          <span class="build-entry-cost">BEENDEN</span></button>`
      :`<button type="button" class="build-entry diplomatic-choice" data-coalition-offer="true"
          ${!country.alive||game.status!=='playing'?'disabled':''}>
          <span class="build-entry-icon" aria-hidden="true">🤝</span>
          <span class="build-entry-copy"><strong>Koalition anbieten</strong>
          <small>Die KI entscheidet nach Stärke, Bedrohung und strategischem Nutzen.</small></span>
          <span class="build-entry-cost">ANFRAGEN</span></button>
        <p class="coalition-assessment">${evaluation!.reason}</p>`;
    return;
  }
  const existing=game.buildingAt(point);
  const existingName=BUILDINGS.find(b=>b.type===existing)?.name;
  const border=game.isThreatenedBorder(0,point);
  $('buildCoordinates').textContent=`${border?'GRENZPOSTEN':existingName?.toUpperCase()??'BAUEN'} · SEKTOR ${point.x}/${point.y}`;
  $('buildMoney').textContent=`${format(game.factions[0].money)} GELD VERFÜGBAR`;
  const upgrade=existing==='city' ? game.canUpgradeCity(0,point) : null;
  const upgradeLevel=existing==='city'?game.cityLevelAt(point):0;
  const maxCity=existing==='city'?game.previewCityUpgrades(0,'single',point):null;
  const upgradeAll=game.previewCityUpgrades(0,'all');
  const fastSingle=maxCity?`<button type="button" class="build-entry" data-upgrade-max="true" ${maxCity.ok?'':'disabled'} title="${maxCity.reason}">
      <span class="build-entry-icon" aria-hidden="true">⬆⬆</span>
      <span class="build-entry-copy"><strong>Diese Stadt maximal ausbauen</strong><small>${maxCity.ok?`Stufe ${upgradeLevel} → ${maxCity.finalLevel} · ${maxCity.upgrades} Upgrades`:maxCity.reason}</small></span>
      <span class="build-entry-cost">${maxCity.ok?format(maxCity.cost)+' €':'—'}</span>
    </button>`:'';
  const fastAll=`<button type="button" class="build-entry" data-upgrade-all="true" ${upgradeAll.ok?'':'disabled'} title="${upgradeAll.reason}">
      <span class="build-entry-icon" aria-hidden="true">⇈</span>
      <span class="build-entry-copy"><strong>Alle Städte automatisch ausbauen</strong><small>${upgradeAll.ok?`${upgradeAll.cities} Städte · ${upgradeAll.upgrades} Ausbaustufen`:upgradeAll.reason} · günstigste Stufen zuerst</small></span>
      <span class="build-entry-cost">${upgradeAll.ok?format(upgradeAll.cost)+' €':'—'}</span>
    </button>`;
  $('buildOptions').innerHTML=fastSingle+fastAll+(upgrade? `<button type="button" class="build-entry" data-upgrade-city="true" ${upgrade.ok?'':'disabled'} title="${upgrade.reason}">
      <span class="build-entry-icon" aria-hidden="true">⬆</span>
      <span class="build-entry-copy"><strong>Stadt ausbauen ${upgradeLevel}/5</strong><small>${upgrade.ok?'Mehr Einwohner- und Truppenwachstum':upgrade.reason}</small></span>
      <span class="build-entry-cost">${upgrade.ok?upgrade.cost+' €':'MAX'}</span>
    </button>`:'')+BUILDINGS.map(building=>{
    const decision=game.canBuild(0,point,building.type);
    const explanation=decision.ok?building.description:decision.reason;
    return `<button type="button" class="build-entry" data-build="${building.type}" ${decision.ok?'':'disabled'} title="${explanation}">
      <span class="build-entry-icon" aria-hidden="true">${building.icon}</span>
      <span class="build-entry-copy"><strong>${building.name}</strong><small>${explanation}</small></span>
      <span class="build-entry-cost">${building.cost} €</span>
    </button>`;
  }).join('')+(border?`<button type="button" class="build-entry" data-defend="true" ${game.factions[0].troops*attackRatio/100<8?'disabled':''} title="Echte mobile Truppen an dieser bedrohten Grenze stationieren">
      <span class="build-entry-icon" aria-hidden="true">⬡</span>
      <span class="build-entry-copy"><strong>Grenze verstärken</strong><small>${attackRatio} % der mobilen Soldaten hier verteidigen lassen</small></span>
      <span class="build-entry-cost">${format(Math.floor(game.factions[0].troops*attackRatio/100))} ⚔</span>
    </button>`:'');
}
renderer.onBuildRequest=(point,clientX,clientY)=>{
  if(modalVisible||!point||game.owner[pointToIndex(point)]<0){closeBuildMenu();return;}
  buildSpot=point;
  const owner=game.owner[pointToIndex(point)];
  if(owner>0){
    const selector=$<HTMLSelectElement>('diplomacyNation');
    selector.value=String(owner);
    updateDiplomacyUI();
  }
  const menu=$('buildMenu');
  menu.hidden=false;
  renderBuildMenu();
  const bounds=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(clientX+8,window.innerWidth-bounds.width-8))+'px';
  menu.style.top=Math.max(8,Math.min(clientY+8,window.innerHeight-bounds.height-8))+'px';
};
$('buildClose').addEventListener('click',closeBuildMenu);
$('buildOptions').addEventListener('click',e=>{
  if(!buildSpot)return;
  const coalitionButton=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-coalition-offer],[data-coalition-leave]');
  if(coalitionButton){
    const target=game.owner[pointToIndex(buildSpot)];
    if(target<=0){closeBuildMenu();return;}
    const result=coalitionButton.hasAttribute('data-coalition-leave')
      ?game.leaveAlliance(0,target):game.offerAlliance(0,target);
    attackMessage=result.reason;
    attackMessageKind=result.ok?'success':'error';
    $('diplomacyFeedback').textContent=result.reason;
    if(result.ok){renderer.updateTerritory();saveGame();}
    beep(result.ok?620:190);
    closeBuildMenu();
    update();
    return;
  }
  const defenseButton=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-defend]');
  if(defenseButton){
    const result=game.reinforceBorder(0,buildSpot,attackRatio);
    attackMessage=result.ok?`${format(result.sent)} Soldaten verteidigen jetzt diese Grenze.`:result.reason;
    attackMessageKind=result.ok?'success':'error';
    if(result.ok){renderer.updateTerritory();closeBuildMenu();beep(540);}else renderBuildMenu();
    update();return;
  }
  const bulkButton=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade-max], [data-upgrade-all]');
  if(bulkButton){
    const scope=bulkButton.hasAttribute('data-upgrade-max')?'single':'all';
    const result=game.upgradeCities(0,scope,buildSpot);
    attackMessage=result.ok?`${result.reason} · ${format(result.cost)} € · Wachstum steigt`:result.reason;
    attackMessageKind=result.ok?'success':'error';
    if(result.ok){renderer.updateTerritory();closeBuildMenu();beep(690);}else renderBuildMenu();
    update();return;
  }
  const upgradeButton=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade-city]');
  if(upgradeButton){
    const result=game.upgradeCity(0,buildSpot);
    attackMessage=result.ok?`${result.reason} · ${result.cost} € · Wachstum steigt`:result.reason;
    attackMessageKind=result.ok?'success':'error';
    if(result.ok){renderer.updateTerritory();closeBuildMenu();beep(690);}else renderBuildMenu();
    update();return;
  }
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-build]');
  if(!button)return;
  const result=game.build(0,buildSpot,button.dataset.build as BuildingType);
  attackMessage=result.ok?`Stadt gebaut · ${result.cost} € · Wachstum steigt`:result.reason;
  attackMessageKind=result.ok?'success':'error';
  if(result.ok){renderer.updateTerritory();closeBuildMenu();beep(690);} else renderBuildMenu();
  update();
});
window.addEventListener('pointerdown',e=>{
  const menu=$('buildMenu');
  if(!menu.hidden&&!menu.contains(e.target as Node))closeBuildMenu();
});
renderer.onHover=(point,px,py,landing)=>{
  const tooltip=$('mapInfo');
  if(!point || game.owner[pointToIndex(point)]===WATER){
    tooltip.hidden=true;
    return;
  }
  tooltip.hidden=false;
  const id=game.owner[pointToIndex(point)];
  const faction=id>=0?game.factions[id]:null;
  const owner=$('hoverOwner');
  owner.textContent=faction?.name??'Neutrales Gebiet';
  owner.style.color=faction?.color??'#c6d0cb';

  // Two numbers are sufficient for tactical decisions. Detailed breakdown,
  // economy, city tiers and combat statistics remain in the main sidebar.
  const details=$('hoverMilitary');
  const summary=id>=0?renderer.military[id]:undefined;
  details.hidden=!summary;
  if(summary){
    if(details.children.length!==2){
      details.replaceChildren();
      for(const _ of [0,1]){
        const row=document.createElement('div');
        row.append(document.createElement('span'),document.createElement('b'));
        details.append(row);
      }
    }
    const values:[string,string][]=[
      ['⚔ Gesamt',format(summary.total)],
      ['● Mobil',format(summary.mobile)],
    ];
    values.forEach(([label,value],i)=>{
      const row=details.children[i];
      row.children[0].textContent=label;
      row.children[1].textContent=value;
    });
  }

  const action=$('hoverAction');
  const allied=id>=0&&game.isAllied(0,id);
  const attackable=id!==0&&!allied&&renderer.canAttack(point);
  const canLand=id!==0&&!allied&&renderer.canLand(point);
  action.textContent=id===0?'Rechtsklick: Stadt / Verteidigung'
    : allied?'🤝 Verbündet · Rechtsklick: Beenden'
    : canLand&&!game.findAttackFront(0,point)?'Links: Seeangriff · Rechts: Koalition'
    : attackable?`Links: Angriff ${attackRatio} % · Rechts: Koalition`
    : id>=0?'Rechtsklick: Koalition':'Kein Angriff möglich';
  action.classList.toggle('blocked',!attackable&&!canLand&&id!==0&&!allied);

  // Reposition using the *reduced* dimensions, also near the screen edges.
  const bounds=tooltip.getBoundingClientRect();
  const width=renderer.canvas.clientWidth,height=renderer.canvas.clientHeight;
  const left=px+20+bounds.width<=width-4?px+20:px-bounds.width-20;
  const top=py+20+bounds.height<=height-4?py+20:py-bounds.height-20;
  tooltip.style.left=Math.max(4,Math.min(left,width-bounds.width-4))+'px';
  tooltip.style.top=Math.max(4,Math.min(top,height-bounds.height-4))+'px';
};

function showDialog(title:string,body:string,actionLabel='VERSTANDEN →',onAction:()=>void=closeDialog) {
  closeBuildMenu();
  modalVisible = true;
  $('dialogTitle').textContent=title;
  $('dialogBody').innerHTML=body;
  $('dialogAction').textContent=actionLabel;
  ($('dialogAction') as HTMLButtonElement).onclick=onAction;
  $('dialog').hidden=false;
}
function closeDialog() {modalVisible=false;$('dialog').hidden=true;}
function countryFlag(code:string): string {
  if(code==='XK')return '🇽🇰';
  return [...code.toUpperCase()].map(ch=>String.fromCodePoint(127397+ch.charCodeAt(0))).join('');
}
function countryOptions(query:string): void {
  const needle=query.toLocaleLowerCase('de-DE').trim();
  const matched=COUNTRY_STARTS.filter(c=>
    c.name.toLocaleLowerCase('de-DE').includes(needle) ||
    c.capital.toLocaleLowerCase('de-DE').includes(needle) ||
    c.code.toLocaleLowerCase('de-DE').includes(needle));
  $('countryCount').textContent=`${matched.length} / ${COUNTRY_STARTS.length} Länder`;
  $('countryGrid').innerHTML=matched.map(c=>
    `<button type="button" class="country-option" data-country="${c.code}" aria-label="${c.name}, Hauptstadt ${c.capital}">
      <span class="country-flag" aria-hidden="true">${countryFlag(c.code)}</span>
      <span><strong>${c.name}</strong><small>${c.capital}</small></span></button>`).join('');
}
function updateDifficultySelection():void {
  document.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(button=>{
    const isSelected=button.dataset.difficulty===selectedDifficulty;
    button.classList.toggle('selected',isSelected);
    button.setAttribute('aria-pressed',String(isSelected));
  });
  $('difficultyDescription').textContent=DIFFICULTY_SETTINGS[selectedDifficulty].description
    +' Die Schwierigkeit gilt nur für KI-Länder.';
}
$('countryPicker').addEventListener('click',event=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-difficulty]');
  if(!button || !isDifficulty(button.dataset.difficulty))return;
  selectedDifficulty=button.dataset.difficulty;
  updateDifficultySelection();
  beep(490);
});
function showCountryPicker(canCancel = false): void {
  closeBuildMenu();
  closeDialog();
  modalVisible = true;
  $('countryPicker').hidden = false;
  $('countryCancel').hidden = !canCancel;
  ($<HTMLInputElement>('countrySearch')).value='';
  countryOptions('');
  updateDifficultySelection();
  ($<HTMLInputElement>('countrySearch')).focus();
}
function startCountry(code:string): void {
  const chosen=countryByCode(code);
  if(!chosen)return;
  game=new Game((Date.now()+Math.floor(Math.random()*100000))%2147483647,COUNTRY_STARTS.length-1,chosen.code,selectedDifficulty);
  localStorage.removeItem(SAVE_KEY);
  hasStarted=true;
  modalVisible=false;
  $('countryPicker').hidden=true;
  attackMessage='Land oder erreichbare Insel anklicken · Seelandung automatisch.';
  attackMessageKind='neutral';
  renderer.setGame(game);
  renderer.focusOnCapital(game.cities[0]);
  populateDiplomacy();
  prevStatus=game.status;
  update();saveGame();
}
function restart(): void { closeDialog(); showCountryPicker(false); }
$('countrySearch').addEventListener('input',e=>countryOptions((e.target as HTMLInputElement).value));
$('countryGrid').addEventListener('click',e=>{
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-country]');
  if(button?.dataset.country)startCountry(button.dataset.country);
});
$('countryCancel').addEventListener('click',()=>{
  if(!hasStarted)return;
  $('countryPicker').hidden=true;modalVisible=false;update();
});
$('resetBtn').addEventListener('click',()=>showCountryPicker(hasStarted));
$('helpBtn').addEventListener('click',()=>showDialog('DEIN EINSATZBEFEHL',`
  <p>ATLAS DOMINION ist ein Echtzeit-Eroberungsspiel. Starte in der Hauptstadt deines gewählten Landes, erweitere dein Gebiet und kontrolliere mindestens <strong>65 %</strong> Europas. Die KI-Schwierigkeit wählst du vor Spielbeginn zusammen mit deinem Land: Entspannt, Ausgeglichen, Intensiv oder Unmöglich.</p>
  <div class="briefing-row"><b>01</b><span><strong>ANGREIFEN:</strong> Linksklick ausschließlich auf ein erreichbares fremdes oder neutrales Gebiet. Ein Klick auf eigenes Gebiet verschickt niemals Truppen – auch nicht direkt an einer umkämpften Grenze. Für einen Gegenangriff auf die gegnerische Seite der Grenze klicken. Neutrales Land bleibt auf 14 Sektoren Klicktoleranz begrenzt.</span></div>
  <div class="briefing-row"><b>02</b><span><strong>SEELANDUNG:</strong> Eine erreichbare Insel oder Küste anklicken. Ohne gemeinsame Landfront starten deine Soldaten automatisch über einen echten Wasserweg. Die Reisedauer hängt von der Entfernung ab; der Kampf beginnt erst bei Ankunft.</span></div>
  <div class="briefing-row"><b>03</b><span><strong>ZIEHEN:</strong> Karte verschieben. Mausrad oder +/− zum Zoomen.</span></div>
  <div class="briefing-row"><b>04</b><span><strong>FRONT:</strong> Die Angriffslinie leuchtet an der Grenze. Die kleine Zahl zeigt die eingesetzten Truppen. Es gibt keine Marschroute von der Hauptstadt.</span></div>
  <div class="briefing-row"><b>05</b><span><strong>TRUPPEN:</strong> Der Prozentregler legt die Zahl der eingesetzten Einwohner/Soldaten fest. Nur tatsächlich Gefallene werden abgezogen; Überlebende kehren aus der Offensive zurück. Stärkere Armeen kämpfen an einer breiteren Front.</span></div>
  <div class="briefing-row"><b>06</b><span><strong>STÄDTE BAUEN:</strong> Rechtsklick auf eigenes Land. Städte kosten Geld und erhöhen das Wachstum. Auf eigenem bedrohtem Grenzgebiet kannst du im selben Menü gezielt Soldaten zur Verteidigung stationieren.</span></div>
  <div class="briefing-row"><b>07</b><span><strong>PAUSE:</strong> Leertaste oder Ⅱ. Mit 1×/2×/4× beschleunigen.</span></div>
  <p><strong>Doktrinen:</strong> EXPAND senkt die Kosten neutraler Eroberungen und erhöht deren Geschwindigkeit, BLITZ erhöht die Angriffsfrequenz, DEFENSE stärkt Einkommen und Garnisonen. Mit 1, 2, 3 umschalten.</p>
  <p><strong>Machtvergleich:</strong> Beim Angriff zählen auch die gesamte Bevölkerung, die Größe und die Städte des Gegners. Ein mächtigeres Reich reduziert deine Angriffswirkung prozentual und erhöht die eigenen Verluste. Kleinere Gegner kannst du effektiver angreifen. Die Wirkung ist auf 70–130 % begrenzt; die konkrete Grenzverteidigung entscheidet weiterhin mit.</p>
  <p><strong>LEBENDIGE FRONTEN:</strong> Direkt an echten Kampfgrenzen siehst du kleine blaue (dein Heer) und rote (Gegner) bewegte Truppensymbole. Die Zahlen zeigen die höchste tatsächlich beteiligte Soldatenzahl eines einzelnen Frontgefechts der aktuellen Runde; die gesamte offensive Armee steht weiter unter „Im Angriff“. Kontaktfunken erscheinen nur, wenn echte Verteidiger beteiligt sind. KI gegen KI ist dezenter dargestellt.</p>
  <p><strong>Verluste sehen:</strong> Rechts bei „Einwohner / Truppen“ stehen Gesamt, mobile Reserve, Grenztruppen, angreifende Soldaten und Gefallene getrennt. Der Gesamtwert kann trotz Gefallener durch Einwohnerwachstum steigen. Angriffe auf feindliche Länder kosten jetzt deutlich mehr Soldaten (oft etwa 1,8 Angreifer pro gefallenem Verteidiger), neutrale Gebiete bleiben kampfverlustfrei.</p>
  <p><strong>Einwohner = Truppen:</strong> Ein Angriff reserviert Truppen, ohne sie zu töten. Unbesetzte Sektoren werden ohne Kampftote erobert; gegen feindliche Garnisonen entstehen echte Verluste bei beiden Parteien. Nach Abschluss kehren die Überlebenden zurück. Größere Heere ermöglichen schnellere Fronten; gefährliche Kriege verringern Bevölkerung, Wachstum und Steuereinnahmen.</p>`));
$('dialogClose').addEventListener('click',closeDialog);
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog'))closeDialog();});
$('leaderboardToggle').addEventListener('click',()=>{showAllNations=!showAllNations;update();});
$('diplomacyNation').addEventListener('change',updateDiplomacyUI);
$('diplomacyOffer').addEventListener('click',()=>{
  const target=Number($<HTMLSelectElement>('diplomacyNation').value);
  const result=game.offerAlliance(0,target);
  $('diplomacyFeedback').textContent=result.reason;
  if(result.ok){beep(620);saveGame();renderer.updateTerritory();}
  update();
});
$('diplomacyLeave').addEventListener('click',()=>{
  const target=Number($<HTMLSelectElement>('diplomacyNation').value);
  const result=game.leaveAlliance(0,target);
  $('diplomacyFeedback').textContent=result.reason;
  if(result.ok){beep(430);saveGame();}
  update();
});
$('diplomacyInbox').addEventListener('click',e=>{
  const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-alliance-accept],[data-alliance-decline]');
  if(!button)return;
  const id=Number(button.dataset.allianceAccept??button.dataset.allianceDecline);
  const result=game.respondAlliance(id,button.hasAttribute('data-alliance-accept'));
  $('diplomacyFeedback').textContent=result.reason;
  if(result.ok){beep(610);saveGame();renderer.updateTerritory();}
  update();
});

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
  if(e.key==='Escape'&&!$('buildMenu').hidden){closeBuildMenu();return;}
  if(!$('countryPicker').hidden)return;
  if(e.key==='Escape'&&modalVisible){closeDialog();return;}
  if(modalVisible)return;
  if(e.code==='Space') {e.preventDefault();game.paused=!game.paused;update();}
  if (e.code === 'KeyT') setAttackRatio(attackRatio-5);
  if (e.code === 'KeyY') setAttackRatio(attackRatio+5);
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
setInterval(saveGame,30000);
window.addEventListener('pagehide',saveGame);
populateDiplomacy();
update();
if(!restoreGame())showCountryPicker(false);
// Explicit dev-only API for smoke tests, not game simulation source of truth.
if(new URLSearchParams(location.search).has('debug')) {
  Object.assign(window,{__atlas:{getGame:()=>game, renderer, refresh:()=>{renderer.updateTerritory();update();}, save:saveGame, attack:(x:number,y:number,ratio=35)=>game.launchAttack(0,{x,y},ratio), step:()=>{game.step();renderer.updateTerritory();update();}}});
}
