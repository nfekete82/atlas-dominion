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
  <span class="emblem">SF</span><span class="brand-copy">SAND<b>FORGE</b></span>
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
  <div class="radar-caption"><span id="sf-exploration">WÜSTENFRONT / 3D</span><span id="sf-sectors">0 SEKTOREN</span></div>
 </section>
 <section class="catalog hud frame" aria-label="Einheiten und Gebäude">
  <nav class="catalog-tabs" id="sf-tabs" aria-label="Katalog">
   <button data-tab="units" aria-pressed="true">EINHEITEN</button>
   <button data-tab="buildings" aria-pressed="false">GEBÄUDE</button>
   <button data-tab="territories" aria-pressed="false">SEKTOREN</button>
  </nav>
  <div class="catalog-scroll" id="sf-actions" aria-label="Einheiten, Gebäude und Territorien"></div>
  <div class="production" id="sf-production">
   <div class="section-label">PRODUKTION <span id="sf-queue-count">0 AUFTRÄGE</span></div>
   <div class="production-track"><i id="sf-progress"></i></div>
   <div class="queue-info"><span id="sf-queue">WARTESCHLANGE LEER</span><span id="sf-queue-time">--:--</span></div>
  </div>
  <div id="sf-catalog-detail">Pioniere errichten Produktionsgebäude. Fertige Gebäude schalten Einheiten frei.</div>
 </section>
</aside>
<section class="command hud frame sf-command" id="sf-selection-panel" aria-label="Auswahl und Befehle">
 <div class="selection">
  <div class="portrait"><img id="sf-portrait" src="/src/assets/reborn/headquarters.png" alt=""></div>
  <div class="selection-copy" id="sf-selection"><small>BLAUE LEGION</small><strong>Keine Auswahl</strong></div>
 </div>
 <div class="command-group">
  <div class="section-label">KOMMANDOS</div>
  <div class="commands" id="sf-command-buttons">
   <button data-action="select-all" title="Alle Truppen auswählen">ALLE</button>
   <button data-action="attack" title="Angriffsbewegung (F)">ANGRIFF</button>
   <button data-action="stop" title="Einheiten anhalten (X)">STOPP</button>
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
 const tools=panel.querySelector('#sf-tools');
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
 panel.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
  panel.querySelectorAll('[data-tab]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
  panel.dataset.tab=button.dataset.tab;
  panel.dispatchEvent(new CustomEvent('sandforge-tabchange',{detail:{tab:button.dataset.tab}}));
 }));
 panel.dataset.tab='units';
 return panel;
}
