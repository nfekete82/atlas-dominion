import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productionJavaScript,pinRoots,moduleReferences,validRelease} from '../scripts/uberspace/package.mjs';
import {readFileSync} from 'node:fs';
import {request,ORIGIN} from '../scripts/uberspace/transport.mjs';
test('HTTPS size checks request uncompressed HEAD responses for manifest comparison',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,ORIGIN+'/releases/v-test-123/style.css');
   assert.equal(options.method,'HEAD');assert.equal(options.headers['accept-encoding'],'identity');
   return new Response(null,{status:200,headers:{'content-length':'4499'}});
  };
  const response=await request(ORIGIN+'/releases/v-test-123/style.css',{method:'HEAD'});
  assert.equal(response.headers.get('content-length'),'4499');
 }finally{globalThis.fetch=original;}
});
test('production packaging disables every debug query without changing regular campaign logic',()=>{
 const source="const query=new URLSearchParams(location.search); const map=query.has('debug')?2:12; if(new URLSearchParams(location.search).has('debug')) window.__reborn={}; const save=()=>indexedDB.open('campaign');";
 const output=productionJavaScript(source);assert.doesNotMatch(output,/\.has\(["']debug["']\)/);assert.match(output,/false \? 2 : 12/);assert.match(output,/indexedDB\.open/);
});
test('production pins root assets to a retained release and keeps relative module/worker registration',()=>{
 const result=pinRoots('import "./simulation.js"; const p="/src/assets/reborn/palm.png"; const w=new URL("./qwen-general.worker.js",import.meta.url); const cdn="https://cdn.jsdelivr.net/a.js"; url(/src/assets/reborn/sand.png)', 'v-test-123');
 assert.match(result,/\/releases\/v-test-123\/src\/assets\/reborn\/palm.png/);assert.match(result,/url\(\/releases\/v-test-123\/src/);assert.match(result,/https:\/\/cdn.jsdelivr.net/);assert.match(result,/new URL\("\.\/qwen-general.worker.js"/);
 assert.deepEqual(moduleReferences(result),['./simulation.js','./qwen-general.worker.js']);
});
test('production release IDs reject shell/path traversal and unowned directories',()=>{
 for(const value of ['v-good-123','v-20261030t120000z-abcd-0123'])assert.ok(validRelease(value));
 for(const value of ['../html','v-good/../../.ssh','test; echo bad','v-good-123\n','current','v-a-$(id)'])assert.equal(validRelease(value),false);
});
test('Apache guard keeps authentication outside releases and denies directory listing/debug paths',()=>{
 const guard=readFileSync('deploy/uberspace.htaccess','utf8');assert.match(guard,/AuthUserFile "\/var\/www\/virtual\/nf\/\.htpasswd"/);assert.match(guard,/Require valid-user/);assert.match(guard,/Options -Indexes/);assert.match(guard,/private, no-store/);assert.match(guard,/\^releases\//);assert.match(guard,/QUERY_STRING/);
 assert.doesNotMatch(guard,/Require all granted|Satisfy any|ProxyPass/i);
});
