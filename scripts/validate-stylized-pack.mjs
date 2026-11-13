import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// An optional explicit path allows ephemeral installations without altering
// the project's runtime dependencies. The package is Khronos glTF-Validator.
const packagePath=process.env.SANDFORGE_GLTF_VALIDATOR;
const validator=packagePath?await import(pathToFileURL(resolve(packagePath)).href):await import('gltf-validator');
const api=validator.default??validator,manifest=JSON.parse(await readFile('src/assets/stylized/manifest.json','utf8'));
const reports=[];
for(const model of manifest.models){
 const bytes=await readFile('src/assets/stylized/'+model.file);
 const report=await api.validateBytes(new Uint8Array(bytes),{uri:model.file,writeTimestamp:false});
 reports.push({file:model.file,...report});
 console.log(model.file,report.issues.numErrors+' errors',report.issues.numWarnings+' warnings');
}
await mkdir('docs/stylized-reference/qa',{recursive:true});
await writeFile('docs/stylized-reference/qa/gltf-validation.json',JSON.stringify(reports,null,2)+'\n');
if(reports.some(r=>r.issues.numErrors||r.issues.numWarnings))process.exitCode=1;
