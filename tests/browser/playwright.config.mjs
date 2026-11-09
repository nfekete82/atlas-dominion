import { defineConfig } from '@playwright/test';
// Software-rendered UI jobs keep the full CSS viewport and assertions while
// selecting a supported raster density. Full-detail terrain contexts use DPR 1.
const env=(name,legacy)=>process.env[name]??process.env[legacy];
const testDpr=Number(env('SANDFORGE_TEST_DPR','ATLAS_TEST_DPR')??1);
const baseURL=env('SANDFORGE_BASE_URL','ATLAS_BASE_URL');
if(!Number.isFinite(testDpr)||testDpr<=0)throw Error('SANDFORGE_TEST_DPR must be positive');
export default defineConfig({
  testDir:'.',testMatch:'*.spec.mjs',timeout:45000,workers:1,
  reporter:[['list'],['html',{outputFolder:'artifacts/report',open:'never'}],['json',{outputFile:'artifacts/results.json'}]],
  outputDir:'artifacts/runs',
  webServer:baseURL?undefined:{
    command:'node scripts/serve.mjs',cwd:new URL('../../',import.meta.url).pathname,
    url:'http://127.0.0.1:8096',env:{PORT:'8096'},reuseExistingServer:!process.env.CI,
  },
  use:{deviceScaleFactor:testDpr,baseURL:baseURL??'http://127.0.0.1:8096',channel:env('SANDFORGE_BROWSER_CHANNEL','ATLAS_BROWSER_CHANNEL')??'chrome',headless:true,trace:'retain-on-failure'},
});
