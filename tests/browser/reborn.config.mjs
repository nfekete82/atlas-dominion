import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'reborn.spec.mjs',timeout:45000,workers:1,
 reporter:[['list'],['json',{outputFile:'artifacts/reborn-results.json'}]],outputDir:'artifacts/reborn',
 webServer:process.env.ATLAS_BASE_URL?undefined:{command:'node scripts/serve.mjs',cwd:new URL('../../',import.meta.url).pathname,url:'http://127.0.0.1:8097',env:{PORT:'8097'},reuseExistingServer:!process.env.CI},
 use:{baseURL:process.env.ATLAS_BASE_URL??'http://127.0.0.1:8097',channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true,trace:'retain-on-failure'},
});
