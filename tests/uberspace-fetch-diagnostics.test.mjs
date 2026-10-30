import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithDiagnostics,request,ORIGIN} from '../scripts/uberspace/transport.mjs';

const transportFailure=code=>new TypeError('fetch failed',{
 cause:Object.assign(new Error('network connection failed'),{code})
});

test('deploy: idempotent GET retries a transient connection reset, keeping the same path',async()=>{
 const oldFetch=globalThis.fetch,oldWarn=console.warn;
 let attempts=0;const warnings=[];
 try{
  console.warn=message=>warnings.push(message);
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,ORIGIN+'/releases/test/index.html');
   assert.equal(options.method,undefined);
   if(++attempts===1)throw transportFailure('ECONNRESET');
   return new Response('ok',{status:200});
  };
  const response=await fetchWithDiagnostics(ORIGIN+'/releases/test/index.html');
  assert.equal(await response.text(),'ok');
  assert.equal(attempts,2);
  assert.equal(warnings.length,1);
  assert.match(warnings[0],/ECONNRESET/);
 }finally{globalThis.fetch=oldFetch;console.warn=oldWarn;}
});

test('deploy: HTTP 401 is returned exactly once, never retried or ignored',async()=>{
 const oldFetch=globalThis.fetch;let attempts=0;
 try{
  globalThis.fetch=async()=>{attempts++;return new Response(null,{status:401,headers:{'www-authenticate':'Basic realm="test"'}});};
  const response=await request(ORIGIN+'/private/file.js');
  assert.equal(response.status,401);
  assert.equal(attempts,1);
 }finally{globalThis.fetch=oldFetch;}
});

test('deploy: a TLS certificate error fails immediately with code and without credentials',async()=>{
 const oldFetch=globalThis.fetch;let attempts=0;
 try{
  globalThis.fetch=async()=>{attempts++;throw transportFailure('CERT_HAS_EXPIRED');};
  await assert.rejects(
   request(ORIGIN+'/releases/test/secret.js',{credentials:{username:'example',password:'private-password'}}),
   error=>{assert.match(error.message,/CERT_HAS_EXPIRED/);assert.match(error.message,/attempt 1\/3/);
    assert.doesNotMatch(error.message,/private-password|example|Authorization/);return true;}
  );
  assert.equal(attempts,1);
 }finally{globalThis.fetch=oldFetch;}
});

test('deploy: retries are bounded, and HEAD remains uncompressed',async()=>{
 const oldFetch=globalThis.fetch,oldWarn=console.warn;let attempts=0;
 try{
  console.warn=()=>{};
  globalThis.fetch=async(url,options)=>{
   attempts++;
   assert.equal(options.method,'HEAD');
   assert.equal(options.headers['accept-encoding'],'identity');
   throw transportFailure('UND_ERR_CONNECT_TIMEOUT');
  };
  await assert.rejects(request(ORIGIN+'/releases/test/asset.png',{method:'HEAD'}),/attempt 3\/3/);
  assert.equal(attempts,3);
 }finally{globalThis.fetch=oldFetch;console.warn=oldWarn;}
});
