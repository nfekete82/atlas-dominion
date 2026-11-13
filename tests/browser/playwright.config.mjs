import { defineConfig } from '@playwright/test';
import { createServer } from 'node:net';
// Software-rendered UI jobs keep the full CSS viewport and assertions while
// selecting a supported raster density. Full-detail terrain contexts use DPR 1.
const env=(name,legacy)=>process.env[name]??process.env[legacy];
const testDpr=Number(env('SANDFORGE_TEST_DPR','ATLAS_TEST_DPR')??1);
const baseURL=env('SANDFORGE_BASE_URL','ATLAS_BASE_URL');
// Never borrow a previously running preview: a stale dist/ would make both
// readiness checks time out despite a successful build. Allocate an isolated
// loopback port for this Playwright invocation instead.
async function availablePort(){
  return await new Promise((resolve,reject)=>{
    const server=createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const address=server.address();
      server.close(error=>error?reject(error):resolve(address.port));
    });
  });
}
const configuredPort=env('SANDFORGE_TEST_PORT','ATLAS_TEST_PORT');
const port=baseURL?null:configuredPort?Number(configuredPort):await availablePort();
if(!baseURL&&(!Number.isInteger(port)||port<1||port>65535))throw Error('SANDFORGE_TEST_PORT must be a valid TCP port');
const isolatedURL=baseURL??`http://127.0.0.1:${port}`;
if(!Number.isFinite(testDpr)||testDpr<=0)throw Error('SANDFORGE_TEST_DPR must be positive');
export default defineConfig({
  testDir:'.',testMatch:'*.spec.mjs',timeout:45000,workers:1,
  reporter:[['list'],['html',{outputFolder:'artifacts/report',open:'never'}],['json',{outputFile:'artifacts/results.json'}]],
  outputDir:'artifacts/runs',
  webServer:baseURL?undefined:{
    command:'node scripts/serve.mjs',cwd:new URL('../../',import.meta.url).pathname,
    url:isolatedURL,env:{PORT:String(port)},reuseExistingServer:false,
  },
  use:{deviceScaleFactor:testDpr,baseURL:isolatedURL,channel:env('SANDFORGE_BROWSER_CHANNEL','ATLAS_BROWSER_CHANNEL')??'chrome',headless:true,trace:'retain-on-failure'},
});
