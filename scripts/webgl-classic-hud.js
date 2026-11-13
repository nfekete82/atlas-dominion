/** Sandforge's original command HUD skin reused by the independent WebGL renderer.
 * Reuses /style.css and /retro-desert.css; no second stylesheet or divergent
 * menu layout required. The existing interactive elements are physically moved,
 * so their click handlers and accessibility identifiers remain intact. */
export function installClassicHud(){
 const oldHeader=document.querySelector('.header');
 const oldFooter=document.querySelector('.footer');
 const panel=document.createElement('div');
 panel.className='sf-rts';
 panel.id='sf-classic-root';
 panel.innerHTML=`
<header class="top hud frame" aria-label="Sandforge Ressourcen">
 <a class="wordmark" href="/" title="Zur klassischen Sandforge-Version">
  <img class="sandforge-logo sandforge-hud-logo" src="/src/assets/reborn/sandforge-logo-transparent.webp" alt="Sandforge: Bastion Wars" decoding="async">
 </a>
 <div class="resources">
  <span id="sf-stats" class="sf-assist-stats">Credits / Kapazität</span>
  <div class="credit-resource"><span class="credit-cube" aria-hidden="true">◆</span><div><strong id="sf-credits">500</strong><small><span id="sf-income">+35</span> / 10 S</small></div></div>
  <div class="capacity-resource"><span aria-hidden="true">♙</span><strong id="sf-capacity">2 <em>/ 48</em></strong></div>
 </div>
</header>
<nav class="tools hud frame sf-tools" id="sf-tools" aria-label="Spielmenü"></nav>
<aside id="sidebar" aria-label="Radar, Einheiten und Produktion">
 <section class="radar hud frame" aria-label="Minikarte">
  <span class="compass west">W</span><span class="compass east">E</span>
  <canvas id="sf-map" width="224" height="224" aria-label="Minikarte – Klicken verschiebt die Kamera"></canvas>
  <div class="radar-caption"><span id="sf-exploration">WÜSTENFRONT / 3D</span><button type="button" class="sf-sector-shortcut" data-action="sectors" title="Sektorenübersicht öffnen"><span id="sf-sectors">0 SEKTOREN</span></button></div>
 </section>
 <section class="catalog hud frame" aria-label="Einheiten und Gebäude">
  <nav class="catalog-tabs" id="sf-tabs" aria-label="Bau- und Einheitenmenü">
   <button type="button" data-tab="buildings" aria-pressed="true"><span aria-hidden="true" class="sf-tab-symbol">▦</span>Gebäude</button>
   <button type="button" data-tab="units" aria-pressed="false" disabled><span aria-hidden="true" class="sf-tab-symbol">♟</span>Einheiten</button>
   <button type="button" data-tab="research" aria-pressed="false" disabled><span aria-hidden="true" class="sf-tab-symbol">⚗</span>Forschung</button>
  </nav>
  <nav class="sf-modern-unit-categories" id="sf-unit-categories" aria-label="Einheitenarten" hidden>
   <button type="button" data-sf-unit-category="infantry" aria-pressed="true">Infanterie</button>
   <button type="button" data-sf-unit-category="vehicles" aria-pressed="false">Fahrzeuge</button>
   <button type="button" data-sf-unit-category="aircraft" aria-pressed="false">Flugzeuge</button>
  </nav>
  <div class="catalog-scroll" id="sf-actions" aria-label="Einheiten, Gebäude und Territorien"></div>
  <section class="production hud frame sf-production-panel" id="sf-production" aria-label="Produktion und Warteschlange">
   <div class="sf-production-heading">
    <strong>PRODUKTION</strong>
    <span id="sf-queue-count">0 AUFTRÄGE</span>
   </div>
   <div class="sf-production-slots" id="sf-queue-slots" role="list" aria-label="Produktionsaufträge">
    <div class="sf-production-empty">Noch keine Produktion aktiv</div>
   </div>
   <div class="sf-production-progressline">
    <div class="production-track" role="progressbar" aria-label="Aktuelle Produktion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="sf-progress"></i></div>
    <span id="sf-queue-time">--:--</span>
   </div>
   <div class="queue-info"><span id="sf-queue">WARTESCHLANGE LEER</span></div>
   <div id="sf-building-status" class="sf-building-status" hidden></div>
  </section>
  <div id="sf-catalog-detail">Pioniere errichten Produktionsgebäude. Fertige Gebäude schalten Einheiten frei.</div>
 </section>
</aside>
<section class="command hud frame sf-command" id="sf-selection-panel" aria-label="Auswahl und Befehle">
 <div class="selection">
  <div class="portrait"><img id="sf-portrait" src="/src/assets/reborn/headquarters.png" alt="">
   <div id="sf-squad-portrait" class="sf-squad-portrait" role="img" aria-label="Ausgewählter Trupp" hidden>
    <img class="sf-squad-member" alt="" aria-hidden="true">
    <img class="sf-squad-member" alt="" aria-hidden="true">
    <img class="sf-squad-member" alt="" aria-hidden="true">
    <span class="sf-squad-count" aria-hidden="true"></span>
   </div>
  </div>
  <div class="selection-copy" id="sf-selection"><small>BLAUE LEGION</small><strong>Keine Auswahl</strong></div>
 </div>
 <div class="command-group">
  <div class="section-label">KOMMANDOS</div>
  <div class="commands" id="sf-command-buttons">
   <button data-action="select-engineer" title="Lebenden Pionier auswählen (P)">PIONIER</button>
   <button data-action="select-all" title="Alle Truppen auswählen">ALLE</button>
   <button data-action="attack" title="Angriffsbewegung (F)">ANGRIFF</button>
   <button data-action="rally" id="sf-rally" title="Sammelpunkt für neue Einheiten setzen">SAMMELPUNKT</button>
   <button data-action="stop" title="Einheiten anhalten (X)">STOPP</button>
   <button data-action="unload" title="Alle Passagiere aus Humvee oder Transporthubschrauber ausladen (U)" hidden>ALLE AUSLADEN</button>
   <button data-action="missile-target" id="sf-strategic-fire" title="Langstreckenrakete: Ziel auf der Karte markieren" hidden>RAKETE STARTEN</button>
   <button data-action="interceptor-rearm" id="sf-interceptor-rearm" title="Drei Abwehrraketen für 650 Credits nachladen" hidden>ABWEHR LADEN</button>
   <button data-action="cancel" title="Auswahl oder Bauplatz abbrechen (Esc)">ZURÜCK</button>
  </div>
 </div>
</section>
<div class="sf-notice" id="sf-message" role="status" aria-live="polite"></div>
<div class="sf-game-settings hud frame" id="sf-settings">
 <div class="sf-settings-header"><div class="section-label">3D SCHLACHTFELD</div><button type="button" id="sf-settings-close" class="sf-settings-close" aria-label="Menü schließen">✕</button></div><div id="sf-settings-fields"></div>
</div>
<div class="sf-debug" id="sf-debug"><span id="sf-debug-status"></span><span id="sf-debug-error"></span></div>
`;
 document.body.append(panel);
 // The screenshot-like HUD changes only view layout: keep the original
 // production IDs, click handlers, and authoritative gameplay state.
 const svg=(contents)=>'<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round">'+contents+'</svg>';
 const modernBrand=document.createElement('div');
 modernBrand.className='sf-modern-brand';
 const menuToggle=document.createElement('button');
 menuToggle.type='button';menuToggle.id='sf-hud-menu-toggle';
 menuToggle.className='sf-hud-tools-toggle sf-modern-menu-button';
 menuToggle.setAttribute('aria-label','Werkzeugmenü öffnen');
 menuToggle.setAttribute('aria-controls','sf-tools');
 menuToggle.setAttribute('aria-expanded','false');
 menuToggle.title='Werkzeugmenü';menuToggle.innerHTML=svg('<path d="M4 6h16M4 12h16M4 18h16"/>');
 modernBrand.append(menuToggle);
 modernBrand.append(panel.querySelector('.wordmark'));
 panel.insertBefore(modernBrand,panel.querySelector('.top'));
 const top=panel.querySelector('.top'),resourceBar=top.querySelector('.resources');
 const incomeNode=panel.querySelector('#sf-income'),small=incomeNode.closest('small');
 small.removeChild(incomeNode);small.remove();
 const incomeResource=document.createElement('div');
 incomeResource.className='sf-income-resource';
 incomeResource.title='Tatsächliche Einnahmen pro 10 Sekunden';
 incomeResource.setAttribute('aria-label','Einnahmen pro zehn Sekunden');
 incomeResource.innerHTML='<span class="sf-income-icon" aria-hidden="true">ϟ</span>';
 incomeResource.append(incomeNode);
 resourceBar.insertBefore(incomeResource,resourceBar.querySelector('.capacity-resource'));
 const toolsToggle=document.createElement('button');toolsToggle.type='button';
 toolsToggle.id='sf-hud-tools-toggle';toolsToggle.className='sf-hud-tools-toggle sf-modern-settings-button';
 toolsToggle.title='Spielwerkzeuge und Optionen';
 toolsToggle.setAttribute('aria-label','Spielwerkzeuge und Optionen');
 toolsToggle.setAttribute('aria-controls','sf-tools');toolsToggle.setAttribute('aria-expanded','false');
 toolsToggle.innerHTML=svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M4.9 19.1l2.2-2.2M16.9 7.1l2.2-2.2"/>');
 // Keep the gear outside the transformed resource header. Otherwise
 // position:fixed uses that header as its containing block on some layouts.
 panel.append(toolsToggle);
 const sideActions=document.createElement('nav');
 sideActions.className='sf-modern-side-actions';
 sideActions.setAttribute('aria-label','Taktische Schnellaktionen');
 sideActions.innerHTML=
  '<button type="button" id="sf-modern-focus" title="Kamera zur Basis" aria-label="Kamera zur Basis">'+svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>')+'</button>'+
  '<button type="button" data-action="sectors" title="Sektorenübersicht" aria-label="Sektorenübersicht">'+svg('<path d="M5 21V3m0 2c6-4 8 4 15 0v10c-7 4-9-4-15 0"/>')+'</button>'+
  '<button type="button" id="sf-modern-selection" data-sf-drawer="selection" title="Auswahl und Befehle" aria-label="Auswahl und Befehle" aria-expanded="false">'+svg('<circle cx="12" cy="6" r="3"/><path d="M6 21v-4a6 6 0 0 1 12 0v4M2 21v-3a4 4 0 0 1 3-3M22 21v-3a4 4 0 0 0-3-3"/>')+'</button>'+
  '<button type="button" id="sf-modern-queue" data-sf-drawer="production" title="Produktion und Warteschlange" aria-label="Produktion und Warteschlange" aria-expanded="false">'+svg('<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="7" cy="5" r="1"/><circle cx="7" cy="12" r="1"/><circle cx="7" cy="19" r="1"/>')+'<span id="sf-modern-queue-count" hidden></span></button>';
 panel.dataset.drawer='';
 panel.dataset.unitCategory='infantry';
 // One full-width tactical dock. Move the existing nodes rather than
 // cloning them, preserving all click/keyboard handlers and accessible IDs.
 const dock=panel.querySelector('#sidebar');
 dock.insertBefore(sideActions,dock.querySelector('.catalog'));
 dock.append(panel.querySelector('#sf-production'));
 dock.append(panel.querySelector('#sf-selection-panel'));
 dock.setAttribute('aria-label','Minikarte, Einheiten, Gebäude, Forschung, Produktion und Befehle');

 const tools=panel.querySelector('#sf-tools');
 const setToolsOpen=(open)=>{
  panel.classList.toggle('sf-modern-tools-open',open);
  tools.hidden=!open;
  for(const button of [menuToggle,toolsToggle])
   button.setAttribute('aria-expanded',String(open));
 };
 setToolsOpen(false);
 for(const button of [menuToggle,toolsToggle])
  button.addEventListener('click',()=>setToolsOpen(!panel.classList.contains('sf-modern-tools-open')));
 panel.querySelector('#sf-modern-focus').addEventListener('click',()=>document.getElementById('home')?.click());
 const setDrawer=(name)=>{
  const open=panel.dataset.drawer===name?'':name;
  panel.dataset.drawer=open;
  for(const b of sideActions.querySelectorAll('[data-sf-drawer]'))
   b.setAttribute('aria-expanded',String(b.dataset.sfDrawer===open));
 };
 for(const button of sideActions.querySelectorAll('[data-sf-drawer]'))
  button.addEventListener('click',()=>setDrawer(button.dataset.sfDrawer));
 window.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||(!panel.classList.contains('sf-modern-tools-open')&&!panel.dataset.drawer))return;
  event.preventDefault();event.stopImmediatePropagation();
  setToolsOpen(false);panel.dataset.drawer='';
  for(const b of sideActions.querySelectorAll('[data-sf-drawer]'))b.setAttribute('aria-expanded','false');
 },true);
 const move=(id,parent)=>{
  const el=document.getElementById(id);if(!el)throw new Error('Missing existing WebGL control '+id);
  parent.append(el);return el;
 };
 const action=(id,label,tooltip)=>{
  const el=move(id,tools);el.title=tooltip;el.setAttribute('aria-label',label);
  el.classList.add('sf-tool-button');return el;
 };
 const makeAction=(action,label,icon)=>{
  const button=document.createElement('button');button.type='button';
  button.dataset.action=action;button.title=label;button.setAttribute('aria-label',label);
  button.textContent=icon;button.className='sf-tool-button';tools.append(button);
 };
 makeAction('save','Spiel speichern','▣');
 makeAction('load','Spielstand laden','⇧');
 makeAction('fog','Nebel des Krieges umschalten','◉');
 makeAction('health','Lebensbalken umschalten','♥');
 makeAction('menu','Spielmenü öffnen (Esc)','☰');
 action('rotate-left','Kamera links drehen','Kamera links drehen (Q)');
 action('rotate-right','Kamera rechts drehen','Kamera rechts drehen (E)');
 action('home','Kamera zur Basis','Ansicht zurücksetzen');
 action('sound','Sound ein- oder ausschalten','Audio');
 action('simulation','Simulation pausieren oder starten','Pause (Leertaste)');
 const clock=move('clock',tools),fps=move('fps',tools);
 clock.classList.add('sf-clock');fps.classList.add('sf-fps');
 const settings=panel.querySelector('#sf-settings-fields');
 const row=document.createElement('div');row.className='sf-settings-row';
 for(const id of ['bastions','seed','load'])move(id,row);
 settings.append(row);
 const settingsButton=document.createElement('button');
 settingsButton.type='button';settingsButton.className='sf-tool-button';
 settingsButton.textContent='⚙';settingsButton.title='Kartengröße und Seed';
 settingsButton.setAttribute('aria-label','Karteneinstellungen anzeigen');
 tools.insertBefore(settingsButton,tools.firstChild);
 const closeSettings=()=>{
  panel.classList.remove('sf-settings-open');
  settingsButton.setAttribute('aria-expanded','false');
 };
 const openSettings=()=>{
  panel.classList.add('sf-settings-open');
  settingsButton.setAttribute('aria-expanded','true');
 };
 settingsButton.addEventListener('click',()=>{
  if(panel.classList.contains('sf-settings-open'))closeSettings();
  else openSettings();
 });
 panel.querySelector('#sf-settings-close')?.addEventListener('click',closeSettings);
 window.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!panel.classList.contains('sf-settings-open'))
   return;
  event.preventDefault();
  event.stopImmediatePropagation();
  closeSettings();
 },true);
 const status=move('status',panel.querySelector('#sf-debug-status'));
 const error=move('error',panel.querySelector('#sf-debug-error'));
 status.classList.add('sf-status');error.classList.add('sf-error');
 if(oldHeader)oldHeader.hidden=true;
 if(oldFooter)oldFooter.hidden=true;
 panel.querySelectorAll('#sf-tabs [data-tab]').forEach(button=>button.addEventListener('click',()=>{
  panel.querySelectorAll('#sf-tabs [data-tab]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panel.dataset.tab=button.dataset.tab;
  panel.dispatchEvent(new CustomEvent('sandforge-tabchange',{detail:{tab:button.dataset.tab}}));
 }));
 panel.querySelectorAll('[data-sf-unit-category]').forEach(button=>button.addEventListener('click',()=>{
  panel.dataset.unitCategory=button.dataset.sfUnitCategory;
  panel.querySelectorAll('[data-sf-unit-category]').forEach(item=>
   item.setAttribute('aria-pressed',String(item===button)));
  panel.dispatchEvent(new CustomEvent('sandforge-tabchange',{detail:{tab:'units'}}));
 }));
 panel.dataset.tab='buildings';
 return panel;
}
