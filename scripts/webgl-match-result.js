/** Rendered above the tactical map and HUD, but never steals mouse input.
 * One static DOM tree, updated ONLY when the match status changes.
 * No animation timer, no full-screen blur or expensive RAF reflows.
 */
const OUTCOMES=Object.freeze({
 victory:{
  title:'SIEG',
  subtitle:'Gefecht beendet',
  detail:'Alle gegnerischen Einheiten und Gebäude sind vernichtet.'
 },
 defeat:{
  title:'NIEDERLAGE',
  subtitle:'Gefecht beendet',
  detail:'Deine Einheiten und Gebäude wurden vollständig vernichtet.'
 }
});
export function matchResultCopy(status){return OUTCOMES[status]??null;}
export function installMatchResultOverlay(doc=document){
 const overlay=doc.createElement('div');
 overlay.id='sf3d-match-result';
 overlay.className='sf3d-match-result';
 overlay.setAttribute('role','status');
 overlay.setAttribute('aria-live','polite');
 overlay.setAttribute('aria-atomic','true');
 overlay.hidden=true;
 // Static markup only: no player-supplied content enters innerHTML.
 overlay.innerHTML='<div class="sf3d-match-result-panel">'+
  '<div class="sf3d-match-result-lines" aria-hidden="true"></div>'+
  '<strong class="sf3d-match-result-heading"></strong>'+
  '<span class="sf3d-match-result-subheading"></span>'+
  '<p class="sf3d-match-result-detail"></p></div>';
 const title=overlay.querySelector('.sf3d-match-result-heading');
 const sub=overlay.querySelector('.sf3d-match-result-subheading');
 const detail=overlay.querySelector('.sf3d-match-result-detail');
 doc.body.append(overlay);
 let last=null;
 return {
  element:overlay,
  render(status){
   if(status===last)return;
   last=status;
   const copy=matchResultCopy(status);
   overlay.hidden=!copy;
   if(!copy){overlay.removeAttribute('data-result');return;}
   overlay.dataset.result=status;
   title.textContent=copy.title;
   sub.textContent=copy.subtitle;
   detail.textContent=copy.detail;
  }
 };
}
