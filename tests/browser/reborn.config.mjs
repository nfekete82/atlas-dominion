import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:['reborn-three-column-catalog.spec.mjs','reborn-map-sizes.spec.mjs','reborn-humvee-roster.spec.mjs','reborn-bomber-shadow.spec.mjs','reborn-gameplay-update.spec.mjs','reborn-compact-ui.spec.mjs','reborn-rocket-pbr.spec.mjs','reborn-transport-pbr.spec.mjs','reborn-production.spec.mjs','reborn-tactics-visuals.spec.mjs','reborn-performance.spec.mjs','reborn.spec.mjs','reborn-building-pbr.spec.mjs','reborn-support.spec.mjs','reborn-overhaul.spec.mjs','reborn-defense-map.spec.mjs','reborn-polish.spec.mjs','reborn-tactical-ai.spec.mjs','reborn-combined-arms.spec.mjs','reborn-radio.spec.mjs','reborn-layout.spec.mjs'],timeout:45000,workers:1,
 reporter:[['list'],['json',{outputFile:'artifacts/reborn-results.json'}]],outputDir:'artifacts/reborn',
 webServer:process.env.ATLAS_BASE_URL?undefined:{command:'node scripts/serve.mjs',cwd:new URL('../../',import.meta.url).pathname,url:'http://127.0.0.1:8097',env:{PORT:'8097'},reuseExistingServer:!process.env.CI},
 use:{baseURL:process.env.ATLAS_BASE_URL??'http://127.0.0.1:8097',channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true,trace:'retain-on-failure'},
});
