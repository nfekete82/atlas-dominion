/* Menu shell: no WebGL imports. The original Sandforge menu can open even
 * if WebGL2 or an optional 3D module is unavailable. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const query=new URLSearchParams(location.search);
 const savedKey='sandforge:webgl:v1';
 const optionKey='sandforge:webgl:options';
 const modes={15:4,16:8,17:12,18:16};
 const menu=$('main-dialog'),newDialog=$('sf3d-new-dialog');
 const optionsDialog=$('sf3d-options-dialog'),pauseDialog=$('sf3d-pause-dialog');
 const status=$('sf3d-menu-status');
 const readSave=()=>{try{const raw=localStorage.getItem(savedKey);return raw?JSON.parse(raw):null;}catch{return null;}};
 const readOptions=()=>{try{return JSON.parse(localStorage.getItem(optionKey)||'{}');}catch{return {};}};
 const notify=(message)=>{status.textContent=message;};
 const running=()=>Boolean(window.__sandforgeWebGL?.simulationRunning);
 const changePause=(shouldRun)=>{
  if(running()!==shouldRun)$('simulation')?.click();
 };
 let returnToGame=false;
 const saved=readSave();
 const play=(count,seed,{resume=false}={})=>{
  const params=new URLSearchParams({bastions:String(count),seed:String(seed>>>0),play:'1'});
  if(resume)params.set('resume','1');
  const options=readOptions();
  if(options.quality==='lite')params.set('lite','1');
  if(options.fog===false)params.set('fog','0');
  location.assign('/webgl-preview.html?'+params);
 };
 function continueSave(){
  const data=readSave(),bastions=data&&modes[data.mapVersion];
  if(!data||!bastions||!Number.isSafeInteger(data.seed)){
   notify('Kein kompatibler 3D-Spielstand gefunden.');return;
  }
  play(bastions,data.seed,{resume:true});
 }
 function randomSeed(){
  if(window.crypto?.getRandomValues){
   const a=new Uint32Array(1);window.crypto.getRandomValues(a);return a[0];
  }
  return Math.floor(Math.random()*4294967296)>>>0;
 }
 function openOptions(){
  const opts=readOptions();
  $('sf3d-quality').value=opts.quality==='lite'?'lite':'high';
  $('sf3d-fog').checked=opts.fog!==false;
  $('sf3d-sound').checked=opts.sound!==false;
  optionsDialog.showModal();
 }
 function saveOptions(){
  try{
   localStorage.setItem(optionKey,JSON.stringify({
    quality:$('sf3d-quality').value,
    fog:$('sf3d-fog').checked,
    sound:$('sf3d-sound').checked
   }));
  }catch(error){console.warn('Could not save local graphics options:',error);}
  optionsDialog.close();
  const active=window.__sandforgeWebGL;
  if(active?.battlefield){
   const enabled=$('sf3d-fog').checked;
   active.battlefield.fogEnabled=enabled;
   active.battlefield.updateFog();
   const soundButton=$('sound');
   soundButton.disabled=!$('sf3d-sound').checked;
   if(soundButton.disabled&&active.sound?.enabled){
    active.sound.setEnabled(false);
    soundButton.setAttribute('aria-pressed','false');
   }
  }
  notify('Optionen gespeichert. Grafikqualität gilt beim nächsten Spielstart.');
 }
 function openPause(){
  if(!window.__sandforgeWebGL?.loaded)return;
  if(pauseDialog.open)return;
  returnToGame=running();
  if(returnToGame)changePause(false);
  pauseDialog.showModal();
 }
 function resumeGame(){
  pauseDialog.close();
  if(returnToGame)changePause(true);
 }
 function goMain(){
  location.assign('/webgl-preview.html');
 }
 $('sf3d-new').addEventListener('click',()=>{
  const source=$('bastions');
  $('sf3d-map-size').value=source?.value??'8';
  $('sf3d-seed').value='';
  newDialog.showModal();
 });
 $('sf3d-campaign').addEventListener('click',()=>newDialog.showModal());
 $('sf3d-continue').addEventListener('click',continueSave);
 $('sf3d-main-load').addEventListener('click',continueSave);
 $('sf3d-main-options').addEventListener('click',openOptions);
 $('sf3d-options-save').addEventListener('click',saveOptions);
 $('sf3d-new-confirm').addEventListener('click',()=>{
  const count=Number($('sf3d-map-size').value);
  const text=$('sf3d-seed').value.trim();
  const n=text.length?Number(text):randomSeed();
  if(!Number.isSafeInteger(n)||n<0||n>4294967295){
   $('sf3d-new-status').textContent='Seed muss zwischen 0 und 4294967295 liegen.';return;
  }
  play(count,n);
 });
 $('sf3d-pause-resume').addEventListener('click',resumeGame);
 $('sf3d-pause-save').addEventListener('click',()=>{
  const game=window.__sandforgeWebGL?.battlefield;
  if(!game)return;
  game.panel.querySelector('[data-action="save"]')?.click();
  $('sf3d-pause-status').textContent='Kampagne lokal gespeichert.';
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
 document.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||
   (e.target instanceof Element&&e.target.matches('input,select,textarea,[contenteditable]')))return;
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
 window.Sandforge3DMenu={openPause,goMain,continueSave,play,readSave,readOptions};
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
  status.textContent='CANYON FRONT · 3D-KAMPAGNE';
 }
})();
