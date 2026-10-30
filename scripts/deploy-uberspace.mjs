import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packageProduction,sha256,validRelease} from './uberspace/package.mjs';
import {run,remote,inspect,withProbe,guardHash,unauthorizedChecks,authenticatedChecks,sshArgs,shellQuote,cancelActive,cancellation,HOST,ORIGIN,REMOTE_ROOT} from './uberspace/transport.mjs';
import {browserCheck} from './uberspace/browser-check.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),args=process.argv.slice(2),mode=args[0]??'--deploy';
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{console.error('[Sandforge] Abbruch: laufende Prüfung/Übertragung beenden und Zustand wiederherstellen.');cancelActive();});
const log=message=>console.log('[Sandforge] '+message);
const curated=['uberspace-deployment','reborn-hq-bootstrap','reborn-production','reborn-construction-assembly','reborn-static-props-visibility','reborn-building-orientation','reborn-navigation-clearance','reborn-production-ready-notifications','reborn-campaign-records','reborn-radio','reborn-qwen-plan','reborn-animation','savegame'];
async function localPreview(directory,release){
 const credentials={username:'local-check',password:randomBytes(24).toString('base64url')},authorization='Basic '+Buffer.from(credentials.username+':'+credentials.password).toString('base64');
 const server=createServer(async(req,res)=>{
  try{
   if(req.headers.authorization!==authorization){res.writeHead(401,{'WWW-Authenticate':'Basic realm="local-production-check"'}).end();return;}
   const url=new URL(req.url,'http://localhost');let file=url.pathname;
   if(url.searchParams.has('debug')){res.writeHead(404).end();return;}
   if(file==='/')file='/index.html';else if(file.startsWith('/releases/'+release+'/'))file=file.slice(('/releases/'+release).length);
   else if(file!=='/deployment.json'){res.writeHead(404).end();return;}
   const target=path.resolve(directory,'.'+decodeURIComponent(file));if(!target.startsWith(directory+path.sep))throw Error('Invalid path');
   const mime={'.js':'application/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.html':'text/html','.webp':'image/webp','.svg':'image/svg+xml','.wav':'audio/wav','.glb':'model/gltf-binary'};
   res.writeHead(200,{'Content-Type':mime[path.extname(target)]??'application/octet-stream','Cache-Control':'private, no-store'});res.end(await readFile(target));
  }catch{res.writeHead(404).end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{return await browserCheck({baseURL:'http://127.0.0.1:'+server.address().port,credentials,release});}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
async function status(){
 log('Prüfe SSH-Ziel, Apache, DocumentRoot, Schutzdatei und aktuelle Version.');
 const state=await inspect();const unauthorized=await unauthorizedChecks(state.current);
 if(!state.current){log('Apache geschützt; noch kein Spiel-Release aktiv.');return {current:null,unauthorized};}
 const health=await withProbe(credentials=>authenticatedChecks(credentials,state.current));
 const result={...health,unauthorized,previous:state.state.previous??null};log(JSON.stringify(result));return result;
}
async function deploy(dryRun=false){
 const dirty=(await run('git',['status','--porcelain'],{cwd:root,quiet:true})).stdout.trim();
 if(dirty&&!dryRun)throw Error('Lokale Änderungen zuerst committen; veröffentlicht werden nur nachvollziehbare Git-Versionen.');
 const commit=(await run('git',['rev-parse','HEAD'],{cwd:root,quiet:true})).stdout.trim(),branch=(await run('git',['branch','--show-current'],{cwd:root,quiet:true})).stdout.trim();
 const release='v-'+new Date().toISOString().slice(0,19).replace(/[-:]/g,'').toLowerCase()+'z'+'-'+commit.slice(0,12)+'-'+randomBytes(3).toString('hex');
 const directory=path.join(root,'release-artifacts/uberspace',release);await mkdir(directory,{recursive:true});
 log('Erzeuge aktuellen Build.');await run('npm',['run','build'],{cwd:root});
 log('Prüfe Spiel, Savegames, HQ-Aufbau, Grafik-/Audiointegration und Deployment-Invarianten.');
 await run('node',['--test',...curated.map(name=>'tests/'+name+'.test.mjs')],{cwd:root});
 await run('python3',['-B','-m','unittest','discover','-s','tests/uberspace','-v'],{cwd:root});
 log('Packe ausschließlich Produktionsmodule, vollständige Spielassets und Versionsmanifest.');
 const pack=await packageProduction({root,output:directory,release,commit,branch});
 log(Object.keys(pack.manifest.files).length+' Dateien, '+(pack.bytes/1024/1024).toFixed(1)+' MiB; keine Source-Maps, Entwicklungseinstiege oder Secrets.');
 log('Phase 1/3: Prüfe lokales Produktionspaket im Browser ohne Debug-Modus.');
 const localBrowser=await localPreview(directory,release);
 log('Phase 1/3: Lokaler Produktionsbrowser bestanden.');
 log('Phase 2/3: Prüfe Uberspace-SSH-Zustand und Release-Zeiger.');
 const before=await inspect();
 log('Phase 2/3: SSH-Zustand bestätigt.');
 log('Phase 3/3: Prüfe HTTP→HTTPS und anonymen 401-Schutz.');
 await unauthorizedChecks(before.current);
 log('Phase 3/3: HTTPS-Schutz bestätigt; beginne erst jetzt mit der Release-Vorbereitung.');
 const uploadArgs=['-rczi','--delay-updates','--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r','-e',['ssh',...sshArgs].map(shellQuote).join(' ')];
 if(before.current)uploadArgs.push('--link-dest='+REMOTE_ROOT+'/releases/'+before.current);
 if(dryRun){
  log('Dry-Run: keine Änderungen an Server, Authentifizierung oder aktivem Release.');
  await run('rsync',[...uploadArgs,'--dry-run',directory+'/',HOST+':'+REMOTE_ROOT+'/releases/'+release+'/'],{cwd:root});
  const after=await inspect();if(JSON.stringify(after.readOnlySnapshot)!==JSON.stringify(before.readOnlySnapshot)||after.current!==before.current)throw Error('Remote state changed during dry-run');
  log('Dry-Run erfolgreich; aktiver Stand bleibt '+(before.current??'unveröffentlicht')+'.');return;
 }
 // Local tests/build must not alter tracked files after the clean commit check.
 if((await run('git',['status','--porcelain'],{cwd:root,quiet:true})).stdout.trim())throw Error('Prüfungen haben getrackte Dateien verändert; Upload abgebrochen.');
 const {token}=await remote('lease');let activated=false;
 try{
  await remote('prepare',{token,release,guardSHA256:await guardHash()});
  log('Lade neues Release inkrementell hoch; aktive Version bleibt erhalten.');
  await run('rsync',[...uploadArgs,directory+'/',HOST+':'+REMOTE_ROOT+'/releases/'+release+'/'],{cwd:root});
  const common={token,release,manifestSHA256:pack.manifestSHA256,guardSHA256:await guardHash()};
  await remote('verify',common);log('Serverseitig alle Dateigrößen und SHA-256-Werte bestätigt.');
  // Authentication is proven against staged files BEFORE making / active.
  await unauthorizedChecks(release);
  const result=await withProbe(async credentials=>{
   for(const name of ['index.html','src/reborn/main.js','src/assets/reborn/props-3d/palm-tree.glb']){
    const {request}=await import('./uberspace/transport.mjs'),r=await request(ORIGIN+'/releases/'+release+'/'+name,{credentials,method:'HEAD'});if(r.status!==200)throw Error('Staged release unavailable before activation: '+name+' '+r.status);
   }
   await remote('activate',{...common,expected:before.current});activated=true;log('Release atomar aktiviert; prüfe echte HTTPS-Domain.');
   const health=await authenticatedChecks(credentials,release),browser=await browserCheck({baseURL:ORIGIN,credentials,release,artifacts:directory+'/qa'});
   await unauthorizedChecks(release);return {health,browser};
  });
  await remote('commit',{token,release,previous:before.current});
  const report={release,commit,branch,url:ORIGIN+'/',localBrowser,...result,previous:before.current};
  await writeFile(path.join(directory,'online-result.json'),JSON.stringify(report,null,2)+'\n');log(JSON.stringify(report));
  log('Live-Deployment und authentifizierte Browserprüfung erfolgreich.');
 }catch(error){
  // An SSH response can be lost immediately after the atomic switch. Inspect
  // the actual pointer too, rather than relying only on the client-side flag.
  let live=activated?release:null;
  try{live=(await inspect()).current;}catch{log('SSH-Zustand derzeit nicht lesbar; vorheriges Release bleibt gespeichert.');}
  if(live===release){log('Prüfung fehlgeschlagen; stelle vorheriges Release wieder her.');await remote('restore',{token,failed:release,previous:before.current,previousState:before.state});if(!cancellation.signal.aborted)await unauthorizedChecks(before.current);}

  throw error;
 }finally{await remote('unlock',{token});}
}
async function rollback(target){
 const state=await inspect(),release=target??state.state.previous;if(!validRelease(release??''))throw Error('Kein gültiges vorheriges Release vorhanden.');
 if(release===state.current)throw Error('Dieses Release ist bereits aktiv.');
 const {token}=await remote('lease');let switched=false;
 try{
  const common={token,release,guardSHA256:await guardHash()};await remote('verify',common);await unauthorizedChecks(release);
  const result=await withProbe(async credentials=>{await remote('activate',{...common,expected:state.current});switched=true;return authenticatedChecks(credentials,release);});
  await remote('commit',{token,release,previous:state.current});log('Rollback geprüft: '+JSON.stringify(result));
 }catch(error){if(switched)await remote('restore',{token,failed:release,previous:state.current,previousState:state.state});throw error;}
 finally{await remote('unlock',{token});}
}
try{
 if(mode==='--check')await status();else if(mode==='--dry-run')await deploy(true);else if(mode==='--rollback')await rollback(args[1]);else if(mode==='--deploy')await deploy();else throw Error('Usage: deploy-uberspace.mjs [--deploy|--dry-run|--check|--rollback [release-id]]');
}catch(error){console.error('[Sandforge] FEHLER: '+error.message);const reason=error.cause?.code??error.cause?.cause?.code;if(reason)console.error('[Sandforge] NETZWERKURSACHE: '+reason);process.exitCode=1;}
