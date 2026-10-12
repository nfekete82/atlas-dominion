import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'*.spec.mjs',timeout:45000,workers:1,
  reporter:[['list'],['html',{outputFolder:'artifacts/report',open:'never'}],['json',{outputFile:'artifacts/results.json'}]],
  outputDir:'artifacts/runs',
  webServer:process.env.ATLAS_BASE_URL?undefined:{
    command:'node scripts/serve.mjs',cwd:new URL('../../',import.meta.url).pathname,
    url:'http://127.0.0.1:8096',env:{PORT:'8096'},reuseExistingServer:!process.env.CI,
  },
  use:{baseURL:process.env.ATLAS_BASE_URL??'http://127.0.0.1:8096',channel:process.env.ATLAS_BROWSER_CHANNEL??'chrome',headless:true,trace:'retain-on-failure'},
});
