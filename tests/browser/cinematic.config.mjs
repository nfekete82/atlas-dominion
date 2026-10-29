import {defineConfig} from '@playwright/test';

// Dedicated, non-reused test server for the clean-title title installer.
// The general browser suite uses 8096. Reusing that port can silently test
// another locally-running RTS and produce false menu/game failures.
const port=18996;
export default defineConfig({
  testDir:'.',
  testMatch:'*.spec.mjs',
  timeout:45000,
  workers:1,
  reporter:[['list']],
  outputDir:'artifacts/cinematic',
  webServer:{
    command:'node scripts/serve.mjs',
    cwd:new URL('../../',import.meta.url).pathname,
    url:`http://127.0.0.1:${port}/src/assets/reborn/start-screen.png`,
    env:{PORT:String(port)},
    reuseExistingServer:false,
    timeout:30000,
  },
  use:{
    baseURL:`http://127.0.0.1:${port}`,
    channel:process.env.ATLAS_BROWSER_CHANNEL??'chromium',
    headless:true,
    trace:'retain-on-failure',
  },
});
