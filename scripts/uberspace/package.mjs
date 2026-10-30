import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const validRelease=id=>typeof id==='string'&&/^v-[a-z0-9]+(?:-[a-z0-9]+)+$/.exec(id)?.[0]===id&&id.length<110;
const allowedAsset=/\.(?:png|webp|svg|glb|json|wav|js)$/;
export function productionJavaScript(source,file='main.js'){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
 const result=ts.transform(tree,[context=>{
  const visit=node=>{
   if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='has'&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==='debug')return ts.factory.createFalse();
   return ts.visitEachChild(node,visit,context);
  };return root=>ts.visitNode(root,visit);
 }]);
 const text=ts.createPrinter({removeComments:true}).printFile(result.transformed[0]);result.dispose();return text;
}
export function pinRoots(text,release){
 if(!validRelease(release))throw Error('Invalid release ID');
 return text.replace(/(["'`(])\/(src\/|vendor\/|style\.css|retro-desert\.css|model-viewer\.js)/g,(_,quote,part)=>quote+'/releases/'+release+'/'+part);
}
export function moduleReferences(source){
 const refs=new Set(),tree=ts.createSourceFile('module.js',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
 const visit=node=>{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))refs.add(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(node.arguments[0]))refs.add(node.arguments[0].text);
  if(ts.isNewExpression(node)&&node.expression.getText(tree)==='URL'&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text.endsWith('.js'))refs.add(node.arguments[0].text);
  ts.forEachChild(node,visit);
 };visit(tree);return [...refs];
}
export async function listFiles(root,prefix=''){
 const result=[];for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
  const name=path.posix.join(prefix,entry.name);
  if(entry.isSymbolicLink())throw Error('Symbolic link in production payload: '+name);
  if(entry.isDirectory())result.push(...await listFiles(root,name));else if(entry.isFile())result.push(name);
 }return result.sort();
}
export async function packageProduction({root,output,release,commit,branch}){
 if(!validRelease(release))throw Error('Invalid release ID');
 const dist=path.join(root,'dist'),included=new Set(['index.html','style.css','retro-desert.css','building-art-version.json']);
 const queue=['src/reborn/main.js'];
 while(queue.length){
  const file=queue.pop();if(included.has(file))continue;
  if(!file.startsWith('src/')||!file.endsWith('.js')||file.includes('..'))throw Error('Unexpected production module: '+file);
  const source=await readFile(path.join(dist,file),'utf8');included.add(file);
  for(const ref of moduleReferences(source)){
   if(ref.startsWith('.'))queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)));
   else if(!/^https:\/\//.test(ref))throw Error('Unresolved bare module in game: '+ref);
  }
 }
 for(const file of await listFiles(path.join(dist,'src/assets/reborn')))if(allowedAsset.test(file))included.add('src/assets/reborn/'+file);
 for(const file of included){
  const target=path.join(output,file);await mkdir(path.dirname(target),{recursive:true});
  if(/\.(?:js|css|html|json|svg)$/.test(file)){
   let source=await readFile(path.join(dist,file),'utf8');
   if(file==='src/reborn/main.js')source=productionJavaScript(source);
   source=source.replace(/^\/\/# sourceMappingURL=.*$/gm,'');
   await writeFile(target,pinRoots(source,release));
  }else await copyFile(path.join(dist,file),target);
 }
 await writeFile(path.join(output,'THIRD_PARTY_NOTICES.txt'),await readFile(path.join(root,'THIRD_PARTY_NOTICES.md')));
 const files={};for(const file of await listFiles(output)){
  if(!/^[a-zA-Z0-9_./-]+$/.test(file)||file.startsWith('.')||/\.(?:map|ts|md|key|pem)$/.test(file)||/node_modules|\.git|\.env|htaccess|htpasswd/.test(file))throw Error('Nonproduction file: '+file);
  const bytes=await readFile(path.join(output,file));files[file]={size:bytes.length,sha256:sha256(bytes)};
 }
 const manifest={schema:1,release,commit,branch,createdAt:new Date().toISOString(),url:'https://nf.uber.space/',files};
 await writeFile(path.join(output,'deployment.json'),JSON.stringify(manifest,null,2)+'\n');
 await validateProduction(output,manifest);
 return {manifest,manifestSHA256:sha256(await readFile(path.join(output,'deployment.json'))),bytes:Object.values(files).reduce((n,f)=>n+f.size,0)};
}
export async function validateProduction(output,manifest){
 if(!validRelease(manifest.release)||!/^[a-f0-9]{40}$/.test(manifest.commit))throw Error('Missing release provenance');
 for(const required of ['index.html','src/reborn/main.js','src/reborn/simulation.js','src/reborn/qwen-general.worker.js','src/assets/reborn/props-3d/props.png','src/assets/reborn/props-3d/palm-tree.glb','src/assets/reborn/voices/manifest.json']){
  if(!manifest.files[required])throw Error('Missing production file: '+required);
 }
 const names=Object.keys(manifest.files);
 if(!names.some(n=>n.endsWith('/manifest.json')&&n.includes('voices'))||names.filter(n=>n.endsWith('.wav')).length<47)throw Error('Incomplete voice bank');
 if(names.filter(n=>n.endsWith('.glb')).length<40)throw Error('Incomplete GLB master pack');
 const main=await readFile(path.join(output,'src/reborn/main.js'),'utf8');
 if(/\.has\(["']debug["']\)/.test(main))throw Error('Production debug query remained active');
 for(const file of names.filter(n=>/\.(js|html|css|json|svg)$/.test(n))){
  const text=await readFile(path.join(output,file),'utf8');
  if(/(?:https?:|wss?:)\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|["'])/.test(text))throw Error('Developer URL in '+file);
  for(const match of text.matchAll(/(?:["'`(])\/(src\/[^"'`\s)<>]*|style\.css|retro-desert\.css)/g))throw Error('Unpinned root asset in '+file+': '+match[1]);
  const pinned='/releases/'+manifest.release+'/';
  for(const match of text.matchAll(/(?:["'`(])(\/releases\/v-[a-z0-9-]+\/[^"'`\s)<>]+\.(?:js|css|json|png|webp|svg|wav|glb))/g)){
   if(!match[1].startsWith(pinned)||!manifest.files[match[1].slice(pinned.length)])throw Error('Missing pinned resource in '+file+': '+match[1]);
  }
  if(file.endsWith('.js'))for(const ref of moduleReferences(text))if(ref.startsWith('.')){
   const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),ref));if(!manifest.files[target])throw Error('Missing module: '+target);
  }
  if(file.endsWith('.json')){
   const data=JSON.parse(text);
   const visit=(value,key)=>{
    if(typeof value==='string'&&['image','model'].includes(key)&&/\.(png|glb)$/.test(value)&&!value.startsWith('/')){
     const target=path.posix.join(path.posix.dirname(file),value);if(!manifest.files[target])throw Error('Missing metadata resource: '+target);
    }else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))visit(v,k);
   };visit(data,'');
  }
 }
 return true;
}
