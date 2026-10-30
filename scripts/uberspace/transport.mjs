import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {sha256} from './package.mjs';
const running=new Set();export const cancellation=new AbortController();
export function cancelActive(){cancellation.abort();for(const child of running)child.kill('SIGTERM');}
export const HOST='nf@janus.uberspace.de';
export const ORIGIN='https://nf.uber.space';
export const REMOTE_ROOT='/var/www/virtual/nf/.sandforge';
export const sshArgs=['-F','/dev/null','-i',path.join(os.homedir(),'.ssh/id_ed25519'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3'];
export const shellQuote=s=>"'"+String(s).replaceAll("'","'\\''")+"'";
export async function run(command,args,{cwd,input,quiet=false}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,stdio:[input===undefined?'ignore':'pipe',quiet?'pipe':'inherit',quiet?'pipe':'inherit']});
  running.add(child);const stdout=[],stderr=[];child.stdout?.on('data',b=>stdout.push(b));child.stderr?.on('data',b=>stderr.push(b));
  child.on('error',error=>{running.delete(child);reject(error);});child.on('exit',code=>{running.delete(child);
   const result={code,stdout:Buffer.concat(stdout).toString(),stderr:Buffer.concat(stderr).toString()};
   if(code!==0){const error=Error(command+' failed (exit '+code+')');error.result=result;reject(error);}else resolve(result);
  });if(input!==undefined)child.stdin.end(input);
 });
}
const remoteSource=()=>readFile(new URL('./remote.py',import.meta.url),'utf8');
export async function remote(action,payload={}){
 let result;
 try{result=await run('ssh',[...sshArgs,HOST,'python3 -c '+shellQuote(await remoteSource())+' '+shellQuote(action)],{input:JSON.stringify(payload),quiet:true});}
 catch(error){
  // Probe stdout can contain a temporary credential: never include raw responses.
  let message;try{message=JSON.parse(error.result?.stdout??'{}').error;}catch{}
  throw Error('Uberspace '+action+': '+(message??'SSH/control operation failed'));
 }
 let data;try{data=JSON.parse(result.stdout);}catch{throw Error('Invalid Uberspace control response');}
 if(data.error)throw Error('Uberspace '+action+': '+data.error);return data;
}
export async function guardHash(){return sha256(await readFile(new URL('../../deploy/uberspace.htaccess',import.meta.url)));}
export async function inspect(){return remote('inspect',{guardSHA256:await guardHash()});}
export async function withProbe(fn){
 const username='__sandforge_check_'+randomBytes(8).toString('hex');
 try{const credentials=await remote('probe',{username,guardSHA256:await guardHash()});return await fn(credentials);}
 finally{await remote('unprobe',{username});}
}
/** Retry only idempotent HTTP requests after transport errors, never after HTTP
 * authorization, TLS certificate, content integrity or validation failures.
 * Diagnostics contain only method/path/error codes, never Basic credentials. */
const transientCodes=new Set([
 'EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','EPIPE',
 'ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT',
 'UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET'
]);
export async function fetchWithDiagnostics(url,options={}){
 const method=(options.method??'GET').toUpperCase(),where=new URL(url).pathname;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   // Give every attempt its own deadline. The global cancellation always wins.
   return await fetch(url,{...options,signal:AbortSignal.any([cancellation.signal,AbortSignal.timeout(30000)])});
  }catch(error){
   const code=error?.cause?.code??error?.code??null;
   const reason=code??error?.name??'unknown';
   const retryable=method==='GET'||method==='HEAD';
   const transient=code?transientCodes.has(code):error instanceof TypeError&&error.message==='fetch failed'||error?.name==='TimeoutError';
   if(cancellation.signal.aborted||!retryable||!transient||attempt===3)
    throw new Error(method+' '+where+' failed ('+reason+', attempt '+attempt+'/3)',{cause:error});
   console.warn('[Sandforge] Netzwerkprüfung '+method+' '+where+': '+reason+'; erneuter Versuch '+(attempt+1)+'/3.');
   await new Promise(resolve=>setTimeout(resolve,250*attempt));
  }
 }
}
export async function request(url,{credentials,method='GET',headers={},body=false}={}){
 if(new URL(url).origin!==ORIGIN)throw Error('Refusing credentials outside the configured HTTPS origin');
 // Compare manifest sizes with the original representation. Apache may report
 // the size of an empty gzip stream for a compressed HEAD response.
 const all={...(method==='HEAD'?{'accept-encoding':'identity'}:{}),...headers};if(credentials)all.Authorization='Basic '+Buffer.from(credentials.username+':'+credentials.password).toString('base64');
 const response=await fetchWithDiagnostics(url,{method,headers:all,redirect:'error'});
 if(!body)await response.body?.cancel();return response;
}
export async function unauthorizedChecks(release){
 const insecure=await fetchWithDiagnostics('http://nf.uber.space/',{redirect:'manual'});
 await insecure.body?.cancel();
 if(![301,302,307,308].includes(insecure.status)||insecure.headers.get('location')!==ORIGIN+'/')throw Error('HTTP must redirect to the configured HTTPS origin before authentication');
 const paths=['/','/deployment.json','/src/reborn/main.js'];
 if(release)for(const file of ['index.html','src/reborn/main.js','style.css','src/assets/reborn/props-3d/palm-tree.glb','src/assets/reborn/props-3d/props.png','src/assets/reborn/voices/manifest.json','src/assets/reborn/voices/soldier-move-01.wav'])paths.push('/releases/'+release+'/'+file);
 for(const file of paths){const response=await request(ORIGIN+file);if(response.status!==401||!/Basic/i.test(response.headers.get('www-authenticate')??''))throw Error('Authentication gate failed: '+file+' HTTP '+response.status);}
 return paths.length;
}
export async function authenticatedChecks(credentials,expectedRelease,{allAssets=true}={}){
 const root=await request(ORIGIN+'/',{credentials,body:true});if(root.status!==200)throw Error('Authenticated index: HTTP '+root.status);
 const html=await root.text();if(!html.includes('Sandforge: Bastion Wars'))throw Error('Wrong application at HTTPS origin');
 const response=await request(ORIGIN+'/deployment.json',{credentials,body:true});if(response.status!==200)throw Error('Live manifest unavailable');
 const manifest=await response.json();if(manifest.release!==expectedRelease)throw Error('Live release differs from activated version');
 if(sha256(Buffer.from(html))!==manifest.files['index.html'].sha256)throw Error('Served index differs from the verified release');
 if(!html.includes('/releases/'+expectedRelease+'/src/reborn/main.js'))throw Error('Document does not pin its modules to the release');
 if(!root.headers.get('cache-control')?.includes('no-store'))throw Error('Entry document must not be cached across deployments');
 const names=allAssets?Object.keys(manifest.files):['src/reborn/main.js','src/assets/reborn/props-3d/props.png','src/assets/reborn/props-3d/palm-tree.glb','src/assets/reborn/voices/manifest.json'];
 let at=0,checked=0;
 await Promise.all(Array.from({length:4},async()=>{
  while(at<names.length){const file=names[at++],r=await request(ORIGIN+'/releases/'+manifest.release+'/'+file,{credentials,method:'HEAD'});
   if(r.status!==200)throw Error('Authenticated asset unavailable: '+file+' HTTP '+r.status);
   const size=Number(r.headers.get('content-length'));if(size&&size!==manifest.files[file].size)throw Error('Asset length mismatch: '+file);
   if(file.endsWith('.js')&&!/(?:javascript|ecmascript)/i.test(r.headers.get('content-type')??''))throw Error('Wrong module MIME type: '+file);checked++;
  }
 }));
 for(const file of ['/.current/index.html','/.releases/','/?debug','/model-3d.html']){
  const r=await request(ORIGIN+file,{credentials});if(r.status!==404&&r.status!==403)throw Error('Internal/development route reachable: '+file);
 }
 for(const file of ['src/reborn/main.js','src/reborn/qwen-general.worker.js','src/assets/reborn/props-3d/props.png','src/assets/reborn/props-3d/palm-tree.glb','src/assets/reborn/voices/soldier-move-01.wav']){
  const r=await request(ORIGIN+'/releases/'+manifest.release+'/'+file,{credentials,body:true});
  if(r.status!==200||sha256(Buffer.from(await r.arrayBuffer()))!==manifest.files[file].sha256)throw Error('HTTPS content integrity mismatch: '+file);
 }
 return {release:manifest.release,commit:manifest.commit,assets:checked,httpsVerified:true,criticalContentHashes:6};
}
