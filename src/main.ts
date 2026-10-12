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
let attackMessage = 'Nachbarland anklicken · mehr eingesetzte Truppen = schnellere Front.';
let attackMessageKind: 'neutral'|'success'|'error' = 'neutral';
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
  const max = Math.max(1,...ranked.map(f=>f.territory));
  $('leaderboard').innerHTML = ranked.map((f,index)=>`
    <div class="power ${f.id===0?'player':''} ${!f.alive?'eliminated':''}">
      <span class="power-num">${String(index+1).padStart(2,'0')}</span>
      <b class="power-name"><i style="background:${f.color}"></i><span>${f.name}</span></b>
      <span class="power-area" title="${format(f.territory)} Sektoren / ${format(totalPopulation[f.id])} Einwohner und Truppen">${format(totalPopulation[f.id])} ⚔</span>
      <div class="power-bar"><div style="width:${(f.territory/max*100).toFixed(1)}%;background:${f.color}"></div></div>
    </div>`).join('');
  $('eventFeed').innerHTML = game.events.map(e=>`<div class="event"><i style="background:${e.color}"></i><div>${e.text}<small>TAG ${String(Math.floor(e.tick/240)+1).padStart(2,'0')} · ${String(Math.floor(e.tick*TICK_SECONDS/60)).padStart(2,'0')}:${String(Math.floor(e.tick*TICK_SECONDS%60)).padStart(2,'0')}</small></div></div>`).join('');
  const active = game.attackOrders.filter(o => o.factionId === 0);
  const neutralOrders=active.filter(o=>o.targetOwner<0);
  const hostileOrders=active.filter(o=>o.targetOwner>=0);
  $('ordersLabel').textContent=active.length
    ? [
        neutralOrders.length?`EXPANSION ${format(neutralOrders.reduce((n,o)=>n+o.remaining,0))} ⚔`:'',
        hostileOrders.length?`${hostileOrders.length} KÄMPFE · ${format(hostileOrders.reduce((n,o)=>n+o.remaining,0))} ⚔`:'',
        hostileOrders.some(o=>o.fallen>0)?`−${format(hostileOrders.reduce((n,o)=>n+o.fallen,0))} GEFALLEN`:'',
      ].filter(Boolean).join(' · ')
    : 'NACHBARGEBIET ANKLICKEN · ERNEUT KLICKEN ZUM VERSTÄRKEN';
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
  const result = landing ? game.launchLanding(0, point, attackRatio) : game.launchAttack(0, point, attackRatio);
  attackMessage=result.ok
    ? `${format(result.sent)} ⚔ · ${result.reason}`
    : result.reason;
  if(result.ok && result.front && result.sent>0)renderer.showReinforcement(result.front,result.sent);
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
  const existing=game.buildingAt(point);
  const existingName=BUILDINGS.find(b=>b.type===existing)?.name;
  const border=game.isThreatenedBorder(0,point);
  $('buildCoordinates').textContent=`${border?'GRENZPOSTEN':existingName?.toUpperCase()??'BAUEN'} · SEKTOR ${point.x}/${point.y}`;
  $('buildMoney').textContent=`${format(game.factions[0].money)} GELD VERFÜGBAR`;
  const upgrade=existing==='city' ? game.canUpgradeCity(0,point) : null;
  const upgradeLevel=existing==='city'?game.cityLevelAt(point):0;
  $('buildOptions').innerHTML=(upgrade? `<button type="button" class="build-entry" data-upgrade-city="true" ${upgrade.ok?'':'disabled'} title="${upgrade.reason}">
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
  if(modalVisible||!point){closeBuildMenu();return;}
  buildSpot=point;
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
  const defenseButton=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-defend]');
  if(defenseButton){
    const result=game.reinforceBorder(0,buildSpot,attackRatio);
    attackMessage=result.ok?`${format(result.sent)} Soldaten verteidigen jetzt diese Grenze.`:result.reason;
    attackMessageKind=result.ok?'success':'error';
    if(result.ok){renderer.updateTerritory();closeBuildMenu();beep(540);}else renderBuildMenu();
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
  if(!point || game.owner[pointToIndex(point)]===WATER){tooltip.hidden=true;return;}
  tooltip.hidden=false;
  const id=game.owner[pointToIndex(point)];
  const f=id>=0?game.factions[id]:null;
  const owner=$('hoverOwner');
  owner.textContent=f?.name??'UNBESETZTES GEBIET';
  owner.style.color=f?.color??'#bcc5bb';
  const built=game.buildingAt(point);
  const buildingName=BUILDINGS.find(b=>b.type===built)?.name;
  $('hoverCoords').textContent=`SEKTOR ${point.x} / ${point.y} · ${built==='city'?`STADT STUFE ${game.cityLevelAt(point)}/5`:buildingName?.toUpperCase()??(id===NEUTRAL?'NEUTRAL':'KONTROLLIERT')}`;
  const tile = pointToIndex(point);
  const attackFront=renderer.previewFront(point);
  const counter=id===0 && attackFront!==null;
  const actualTarget=attackFront?game.owner[pointToIndex(attackFront)]:id;
  const defendedSector = attackFront ? pointToIndex(attackFront) : tile;
  const stationedLocal = game.frontline[defendedSector];
  const sectorDefense = game.sectorDefense(defendedSector);
  $('hoverStats').textContent = f
    ? `⬡ ${format(stationedLocal)} GRENZTRUPPEN · ${format(sectorDefense)} ${attackFront?'ANGRIFFSFRONT':'LOKALE VERTEIDIGUNG'}`
    : '⚔ UNBESETZT';
  const matchup=$('hoverPower');
  const power=actualTarget>=0 && actualTarget!==0 ? game.relativeAttackPower(0,actualTarget):1;
  matchup.hidden=actualTarget<0||actualTarget===0;
  matchup.textContent=power<.96
    ? `ANGRIFFSWIRKUNG: ${Math.round(power*100)} % · STARKER GEGNER`
    : power>1.04
      ? `ANGRIFFSWIRKUNG: ${Math.round(power*100)} % · MACHTVORTEIL`
      : `ANGRIFFSWIRKUNG: ${Math.round(power*100)} % · AUSGEGLICHEN`;
  matchup.style.color=power<.96?'#f1a99b':power>1.04?'#9be3bd':'#d2dce0';
  const action = $('hoverAction');
  const attackable = renderer.canAttack(point);
  const canLand = renderer.canLand(point);
  action.textContent = id===0 && counter
    ? `KLICK: ${attackRatio} % GEGENANGRIFF AUF ${game.factions[actualTarget]?.name??'GEGNER'} · RECHTSKLICK: VERTEIDIGEN`
    : id===0 ? 'EIGENES LAND · RECHTSKLICK: STADT / GRENZPOSTEN'
    : landing && canLand ? `SHIFT+KLICK: ${attackRatio} % LANDEANGRIFF`
    : attackable ? `KLICK: ${attackRatio} % · ANGRIFF AUF ${f?.name ?? 'NEUTRALGEBIET'}`
    : canLand ? 'SHIFT+KLICK: SEELANDUNG'
    : 'KEINE ERREICHBARE LANDFRONT';
  action.classList.toggle('blocked',!attackable&&!canLand&&id!==0);
  const bounds=tooltip.getBoundingClientRect();
  const width=renderer.canvas.clientWidth,height=renderer.canvas.clientHeight;
  const left=px+24+bounds.width<=width-4?px+24:px-bounds.width-24;
  const top=py+24+bounds.height<=height-4?py+24:py-bounds.height-24;
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
  attackMessage='Nachbarland anklicken · SHIFT+Klick für Seelandung.';
  attackMessageKind='neutral';
  renderer.setGame(game);
  renderer.focusOnCapital(game.cities[0]);
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
  <div class="briefing-row"><b>01</b><span><strong>ANGREIFEN:</strong> Klicke auf ein erreichbares Nachbarland oder auf dein eigenes bedrohtes Grenzgebiet für einen unmittelbaren Gegenangriff. Der Angriff startet immer am tatsächlichen gemeinsamen Grenzsektor. Neutrales Land bleibt auf 14 Sektoren Klicktoleranz begrenzt.</span></div>
  <div class="briefing-row"><b>02</b><span><strong>SEELANDUNG:</strong> SHIFT gedrückt halten und auf eine markierte Anlegestelle am anderen Ufer klicken. Nur die eingezeichneten Seewege sind erlaubt; die Überfahrt dauert vier Ticks.</span></div>
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
update();
if(!restoreGame())showCountryPicker(false);
// Explicit dev-only API for smoke tests, not game simulation source of truth.
if(new URLSearchParams(location.search).has('debug')) {
  Object.assign(window,{__atlas:{getGame:()=>game, renderer, refresh:()=>{renderer.updateTerritory();update();}, save:saveGame, attack:(x:number,y:number,ratio=35)=>game.launchAttack(0,{x,y},ratio), step:()=>{game.step();renderer.updateTerritory();update();}}});
}
