/* Menu shell: no WebGL imports. The original Sandforge menu can open even
 * if WebGL2 or an optional 3D module is unavailable. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const query=new URLSearchParams(location.search);
 const savedKey='sandforge:webgl:v1';
 const optionKey='sandforge:webgl:options';
 const savedBiomeKey='sandforge:webgl:save-biome';
 const validBiome=value=>['desert','snow','jungle'].includes(value)?value:'desert';
 // The 3D game may run at / (release candidate) or /webgl-preview.html
 // (existing QA/deep links). Stay on the active entry during navigation.
 const gameRoute=()=>location.pathname==='/'||location.pathname==='/index.html'
  ?'/':'/webgl-preview.html';
 // Campaign revisions 27-30 use the same 4/8/12/16 bastion settings
 // with larger maps; older saved games remain loadable unchanged.
 const modes={15:4,16:8,17:12,18:16,19:4,20:8,21:12,22:16,23:4,24:8,25:12,26:16,27:4,28:8,29:12,30:16};
 const menu=$('main-dialog'),newDialog=$('sf3d-new-dialog');
 const optionsDialog=$('sf3d-options-dialog'),pauseDialog=$('sf3d-pause-dialog');
 const statsDialog=$('sf3d-stats-dialog'),creditsDialog=$('sf3d-credits-dialog'),exitDialog=$('sf3d-exit-dialog');
 const status=$('sf3d-menu-status');
 // Reuse the exact badge from the illustrated title in the tactical pause
 // dialog. The previous badge remains if the new image has not been installed.
 const pauseLogo=$('sf3d-pause-dialog')?.querySelector('.sandforge-pause-logo');
 const badgeUrl='/src/assets/reborn/sandforge-bastion-logo.webp';
 const badgeProbe=new Image();
 badgeProbe.onload=()=>{if(pauseLogo)pauseLogo.src=badgeUrl;};
 badgeProbe.src=badgeUrl;
 const readSave=()=>{try{const raw=localStorage.getItem(savedKey);return raw?JSON.parse(raw):null;}catch{return null;}};
 const readOptions=()=>{try{return JSON.parse(localStorage.getItem(optionKey)||'{}');}catch{return {};}};
 const notify=(message)=>{status.textContent=message;};
 const volume=(key,fallback)=>Math.max(0,Math.min(100,
  Number.isFinite(Number(readOptions()[key]))&&readOptions()[key]!=null?
   Number(readOptions()[key]):fallback));
 const renderAudioSliders=()=>{
  const options=readOptions();
  for(const [id,key,defaultValue] of [
   ['sf3d-master-volume','masterVolume',85],
   ['sf3d-effects-volume','effectsVolume',85],
   ['sf3d-music-volume','musicVolume',22]
  ]){
   const value=options[key];
   $(id).value=String(value==null?defaultValue:Math.max(0,Math.min(100,Number(value))));
   $(id.replace('-volume','-value')).textContent=$(id).value+' %';
  }
  // The user's original cinematic MP3 is the default. Explicit mute or
  // previously saved musicEnabled=false remains fully respected.
  $('sf3d-music-enabled').checked=options.musicEnabled!==false;
  $('sf3d-engine-sounds').checked=options.engineSoundsEnabled!==false;
 };
 function applyLiveAudio(){
  const a=window.__sandforgeWebGL?.sound;
  for(const id of ['sf3d-master','sf3d-effects','sf3d-music']){
   const value=$(id+'-volume').value;
   $(id+'-value').textContent=value+' %';
  }
  if(!a)return;
  a.setVolume(Number($('sf3d-master-volume').value)/100);
  a.setEffectsVolume(Number($('sf3d-effects-volume').value)/100);
  a.setMusicVolume(Number($('sf3d-music-volume').value)/100);
  a.setMusicEnabled($('sf3d-music-enabled').checked);
  a.setEngineSoundsEnabled($('sf3d-engine-sounds').checked);
 }
 const running=()=>Boolean(window.__sandforgeWebGL?.simulationRunning);
 const changePause=(shouldRun)=>{
  if(running()!==shouldRun)$('simulation')?.click();
 };
 // Typed only in the actual tactical-pause modal. No visible debug controls.
 // The sequence may be entered again to grant another 1,000 credits.
 const pauseCheat='iddqd';
 let pauseCheatProgress=0;
 let returnToGame=false;
 const saved=readSave();
 const play=(count,seed,{resume=false,legacy=false,terrain='random',biome='desert'}={})=>{
  const params=new URLSearchParams({bastions:String(count),seed:String(seed>>>0),play:'1'});
  if(resume)params.set('resume','1');
  if(legacy)params.set('legacy','1');
  const options=readOptions();
  if(options.quality==='lite')params.set('lite','1');
  if(options.fog===false)params.set('fog','0');
  if(!resume&&!legacy)params.set('terrain',terrain);
  if(!legacy)params.set('biome',validBiome(biome));
  location.assign(gameRoute()+'?'+params);
 };
 function continueSave(){
  const data=readSave(),bastions=data&&modes[data.mapVersion];
  if(!data||!bastions||!Number.isSafeInteger(data.seed)){
   notify('Kein kompatibler 3D-Spielstand gefunden.');return;
  }
  // Cosmetic biome metadata is stored separately: the validated game-save
  // schema and its deterministic gameplay state remain untouched.
  let visual=null;
  try{visual=JSON.parse(localStorage.getItem(savedBiomeKey)||'null');}catch{}
  const biome=visual?.seed===data.seed&&visual?.mapVersion===data.mapVersion
   ?validBiome(visual.biome):'desert';
  play(bastions,data.seed,{resume:true,legacy:data.mapVersion<=18,biome});
 }
 function randomSeed(){
  if(window.crypto?.getRandomValues){
   const a=new Uint32Array(1);window.crypto.getRandomValues(a);return a[0];
  }
  return Math.floor(Math.random()*4294967296)>>>0;
 }
 function openStats(){
  const snapshot=readSave();
  const content=$('sf3d-stats-content');
  content.replaceChildren();
  const row=(title,value)=>{
   const label=document.createElement('dt'),data=document.createElement('dd');
   label.textContent=title;data.textContent=String(value);
   content.append(label,data);
  };
  if(!snapshot||!Number.isSafeInteger(snapshot.seed)){
   row('Spielstand','Noch keine gespeicherte Kampagne');
  }else{
   const fmt=new Intl.NumberFormat('de-DE');
   const secs=Number.isFinite(snapshot.time)?Math.max(0,Math.floor(snapshot.time)):0;
   const units=Array.isArray(snapshot.units)?snapshot.units.filter(u=>u.owner===0&&u.hp>0).length:0;
   const buildings=Array.isArray(snapshot.bases)?snapshot.bases.filter(b=>b.owner===0&&b.hp>0).length:0;
   const bastions=Array.isArray(snapshot.territories)?snapshot.territories.filter(t=>t.owner===0).length:0;
   const money=Array.isArray(snapshot.credits)?snapshot.credits[0]:0;
   row('Spielzeit',Math.floor(secs/3600)+' h '+Math.floor(secs%3600/60)+' min');
   row('Karten-Seed',snapshot.seed);
   row('Eigene Bastionen',fmt.format(bastions));
   row('Aktive Einheiten',fmt.format(units));
   row('Eigene Gebäude',fmt.format(buildings));
   row('Credits',fmt.format(Math.floor(Number.isFinite(money)?money:0)));
  }
  statsDialog.showModal();
 }
 function openOptions(){
  const opts=readOptions();
  $('sf3d-quality').value=opts.quality==='lite'?'lite':'high';
  $('sf3d-fog').checked=opts.fog!==false;
  $('sf3d-sound').checked=opts.sound!==false;
  renderAudioSliders();
  optionsDialog.showModal();
 }
 function saveOptions(){
  try{
   localStorage.setItem(optionKey,JSON.stringify({
    quality:$('sf3d-quality').value,
    fog:$('sf3d-fog').checked,
    sound:$('sf3d-sound').checked,
    musicEnabled:$('sf3d-music-enabled').checked,
    engineSoundsEnabled:$('sf3d-engine-sounds').checked,
    masterVolume:Number($('sf3d-master-volume').value),
    effectsVolume:Number($('sf3d-effects-volume').value),
    musicVolume:Number($('sf3d-music-volume').value)
   }));
  }catch(error){console.warn('Could not save local graphics options:',error);}
  optionsDialog.close();
  const active=window.__sandforgeWebGL;
  if(active?.battlefield){
   const enabled=$('sf3d-fog').checked;
   active.battlefield.fogEnabled=enabled;
   active.battlefield.updateFog();
   const soundButton=$('sound');
   const shouldEnable=$('sf3d-sound').checked;
   soundButton.disabled=false;
   active.sound.setEnabled(shouldEnable);
   applyLiveAudio();
   soundButton.setAttribute('aria-pressed',String(shouldEnable));
   soundButton.textContent=shouldEnable?'Sound ausschalten':'Sound einschalten';
   soundButton.title=shouldEnable?'Audio freigegeben (Klick zum Ausschalten)':'Audio deaktiviert (Klick zum Einschalten)';
   if(shouldEnable)void active.sound.unlock().catch(error=>console.warn('WebAudio activation requires a gesture',error));
  }
  notify('Optionen gespeichert. Musiklautstärke und Sound wirken sofort.');
 }
 function openPause(){
  if(!window.__sandforgeWebGL?.loaded)return;
  if(pauseDialog.open)return;
  returnToGame=running();
  pauseCheatProgress=0;
  $('sf3d-pause-status').textContent='';
  if(returnToGame)changePause(false);
  pauseDialog.showModal();
 }
 function resumeGame(){
  pauseCheatProgress=0;
  pauseDialog.close();
  if(returnToGame)changePause(true);
 }
 function goMain(){
  location.assign(gameRoute());
 }
 $('sf3d-new').addEventListener('click',()=>{
  const source=$('bastions');
  $('sf3d-map-size').value=source?.value??'8';
  $('sf3d-seed').value='';
  $('sf3d-terrain').value='random';
  $('sf3d-biome').value='desert';
  newDialog.showModal();
 });
 $('sf3d-campaign').addEventListener('click',()=>newDialog.showModal());
 $('sf3d-continue').addEventListener('click',continueSave);
 $('sf3d-main-load').addEventListener('click',continueSave);
 $('sf3d-main-options').addEventListener('click',openOptions);
 $('sf3d-main-stats').addEventListener('click',openStats);
 $('sf3d-main-credits').addEventListener('click',()=>creditsDialog.showModal());
 $('sf3d-main-exit').addEventListener('click',()=>exitDialog.showModal());
 $('sf3d-exit-confirm').addEventListener('click',()=>{
  // Browsers only permit window.close() for script-opened windows. Navigate
  // to a blank document otherwise so "Beenden" remains an actual action.
  window.close();
  location.replace('about:blank');
 });
 $('sf3d-options-save').addEventListener('click',saveOptions);
 for(const id of ['sf3d-master-volume','sf3d-effects-volume','sf3d-music-volume']){
  $(id).addEventListener('input',applyLiveAudio);
 }
 $('sf3d-music-enabled').addEventListener('change',applyLiveAudio);
 $('sf3d-engine-sounds').addEventListener('change',applyLiveAudio);
 $('sf3d-audio-test').addEventListener('click',async()=>{
  const status=$('sf3d-audio-status');
  const runtime=window.__sandforgeWebGL;
  if(!runtime?.sound){
   status.textContent='Audio-Test erst innerhalb einer gestarteten Kampagne verfügbar.';
   return;
  }
  // Deliberate user gesture: browsers allow AudioContext.resume() here.
  const sound=runtime.sound;
  $('sf3d-sound').checked=true;
  sound.setEnabled(true);
  // The sound test obeys the user's three audio sliders and should not
  // suddenly turn the overall volume up to 85 percent.
  applyLiveAudio();
  try{
   await sound.unlock();
   if(sound.context?.state!=='running')throw new Error('AudioContext '+(sound.context?.state??'unbekannt'));
   sound.command();sound.select();
   status.textContent='Soundtest gespielt · AudioContext läuft · Lautstärke '+Math.round(sound.volume*100)+' %';
  }catch(error){
   status.textContent='Audio blockiert: '+String(error?.message??error);
   console.warn('Sandforge sound test failed:',error);
  }
 });
 $('sf3d-new-confirm').addEventListener('click',()=>{
  const count=Number($('sf3d-map-size').value);
  const text=$('sf3d-seed').value.trim();
  const n=text.length?Number(text):randomSeed();
  if(!Number.isSafeInteger(n)||n<0||n>4294967295){
   $('sf3d-new-status').textContent='Seed muss zwischen 0 und 4294967295 liegen.';return;
  }
  play(count,n,{terrain:$('sf3d-terrain').value,biome:$('sf3d-biome').value});
 });
 $('sf3d-pause-resume').addEventListener('click',resumeGame);
 $('sf3d-pause-save').addEventListener('click',()=>{
  const game=window.__sandforgeWebGL?.battlefield;
  const saved=game?.saveGame?.()===true;
  if(saved)try{
   localStorage.setItem(savedBiomeKey,JSON.stringify({
    seed:game.game.seed,mapVersion:game.world.mapVersion,
    biome:validBiome(window.__sandforgeWebGL?.biome)
   }));
  }catch(error){console.warn('Biom-Einstellung konnte nicht gespeichert werden:',error);}
  $('sf3d-pause-status').textContent=saved
   ?'Kampagne lokal gespeichert.'
   :'Speichern fehlgeschlagen. Bitte Speicherplatz und Browser-Einstellungen prüfen.';
 });
 $('sf3d-pause-load').addEventListener('click',continueSave);
 $('sf3d-pause-options').addEventListener('click',openOptions);
 $('sf3d-pause-new').addEventListener('click',()=>{
  pauseDialog.close();newDialog.showModal();
 });
 $('sf3d-pause-main').addEventListener('click',goMain);
 for(const el of document.querySelectorAll('[data-sf3d-close]')){
  el.addEventListener('click',()=>el.closest('dialog')?.close());
 }
 menu.addEventListener('cancel',e=>e.preventDefault());
 pauseDialog.addEventListener('cancel',e=>{e.preventDefault();resumeGame();});
 pauseDialog.addEventListener('close',()=>{pauseCheatProgress=0;});
 document.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||
   (e.target instanceof Element&&e.target.matches('input,select,textarea,[contenteditable]')))return;
  if(pauseDialog.open&&!menu.open&&!newDialog.open&&!optionsDialog.open){
   if(typeof e.key==='string'&&/^[a-z]$/i.test(e.key)){
    // Do not pan the camera or trigger normal game shortcuts behind the modal.
    e.preventDefault();e.stopImmediatePropagation();
    const key=e.key.toLowerCase();
    pauseCheatProgress=key===pauseCheat[pauseCheatProgress]
     ?pauseCheatProgress+1:key===pauseCheat[0]?1:0;
    if(pauseCheatProgress===pauseCheat.length){
     pauseCheatProgress=0;
     const active=window.__sandforgeWebGL,g=active?.game;
     if(active?.loaded&&g?.status==='playing'&&Number.isFinite(g.credits?.[0])){
      g.credits[0]+=1000;
      active.battlefield?.drawInterface?.();
      $('sf3d-pause-status').textContent='TESTCODE AKTIV · +1.000 CREDITS';
     }
    }
    return;
   }
   // Every non-letter breaks the sequence, including unrelated shortcuts.
   pauseCheatProgress=0;
  }
  if(e.code==='Space'){
   if(menu.open||newDialog.open||optionsDialog.open)return;
   if(!window.__sandforgeWebGL?.loaded)return;
   // A modal dialog is the actual classic-style pause screen. The key must
   // not also toggle the bare simulation button in webgl-preview.js.
   e.preventDefault();e.stopImmediatePropagation();
   if(pauseDialog.open)resumeGame();
   else openPause();
   return;
  }
  if(e.code!=='Escape'||menu.open||newDialog.open||optionsDialog.open||pauseDialog.open)return;
  const field=window.__sandforgeWebGL?.battlefield;
  if(field&&(field.attackMode||field.buildKind))return;
  if(window.__sandforgeWebGL?.loaded){e.preventDefault();e.stopImmediatePropagation();openPause();}
 },true);
 window.Sandforge3DMenu={openPause,goMain,continueSave,play,readSave,readOptions,gameRoute};
 const options=readOptions();
 $('sf3d-continue').hidden=!Boolean(saved&&modes[saved.mapVersion]);
 $('sf3d-main-load').disabled=!Boolean(saved&&modes[saved.mapVersion]);
 if(query.has('play')||query.has('bastions')||query.has('seed')||query.has('resume')){
  // Direct deep links from existing tests and bookmarks remain supported.
  const start=$('sf3d-boot');
  if(start)start.hidden=false;
  // Catch *static import failures* (including missing dependencies) instead
  // of leaving an empty viewport stuck at "Initialisiere".
  import('/webgl-preview.js').then(()=>{
   if(start)start.hidden=true;
  }).catch(error=>{
   console.error('Sandforge WebGL bootstrap failed:',error);
   const title=$('sf3d-fatal-title'),detail=$('sf3d-fatal-detail'),fatal=$('sf3d-fatal');
   title.textContent='3D-GRAFIK KONNTE NICHT STARTEN';
   detail.textContent=String(error?.message??error);
   fatal.hidden=false;
   if(start)start.hidden=true;
  });
 }else{
  menu.showModal();
  status.textContent='WEITE WÜSTE · 3D-KAMPAGNE';
 }
})();
