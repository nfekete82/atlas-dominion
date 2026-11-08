/** Spread slow canvas/DOM/Fog-of-War refresh work over separate WebGL frames.
 * Without pacing, all three refresh periods periodically align, causing
 * visible hitches even when average render FPS is high. Force/immediate
 * (user-driven) refreshes remain unaffected. No timers or gameplay changes.
 */
export const WEBGL_REFRESH_MS=Object.freeze({fog:350,ui:280,minimap:700});
export function nextPeriodicRefresh(now,last){
 if(!Number.isFinite(now))return null;
 if(now-last.fog>WEBGL_REFRESH_MS.fog)return 'fog';
 if(now-last.ui>WEBGL_REFRESH_MS.ui)return 'ui';
 if(now-last.minimap>WEBGL_REFRESH_MS.minimap)return 'minimap';
 return null;
}
