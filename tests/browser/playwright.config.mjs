import { defineConfig } from '@playwright/test';
// Software-rendered UI jobs keep the full CSS viewport and assertions while
// selecting a supported raster density. Full-detail terrain contexts use DPR 1.
const testDpr=Number(process.env.ATLAS_TEST_DPR??1);
if(!Number.isFinite(testDpr)||testDpr<=0)throw Error('ATLAS_TEST_DPR must be positive');
export default defineConfig({
  testDir:'.',testMatch:'*.spec.mjs',timeout:45000,workers:1,
  reporter:[['list'],['html',{outputFolder:'artifacts/report',open:'never'}],['json',{outputFile:'artifacts/results.json'}]],
  outputDir:'artifacts/runs',
  webServer:process.env.ATLAS_BASE_URL?undefined:{
    command:'node scripts/serve.mjs',cwd:new URL('../../',import.meta.url).pathname,
    url:'http://127.0.0.1:8096',env:{PORT:'8096'},reuseExistingServer:!process.env.CI,
  },
  use:{deviceScaleFactor:testDpr,baseURL:process.env.ATLAS_BASE_URL??'http://127.0.0.1:8096',channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true,trace:'retain-on-failure'},
});
