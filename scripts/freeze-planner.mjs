import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
let server;
try{
 server=await createServer({root,configFile:false,resolve:{alias:{'@':`${root}src`}},server:{middlewareMode:true},appType:'custom'});
 const {prepareBatch}=await server.ssrLoadModule('/tests/evals/batch.ts');
 const {assertPlannerFingerprint}=await server.ssrLoadModule('/tests/evals/planner-fingerprint.ts');
 if(process.argv[2]==='verify'){
  const manifest=JSON.parse(await readFile(process.argv[3],'utf8'));await assertPlannerFingerprint(manifest.sourceHashes);
  console.log(JSON.stringify({verified:true,prompt:manifest.promptVersion,review:manifest.reviewVersion,sourceFiles:Object.keys(manifest.sourceHashes).length}));
 }else{
  if(process.argv[2])throw new Error('Usage: node scripts/freeze-planner.mjs [verify <manifest.json>]');
  const batch=await prepareBatch('pending',null);const directory=`.qa/planner-freezes/${batch.promptVersion}`;await mkdir(directory,{recursive:true});
  const output=`${directory}/${batch.runId}.json`;await writeFile(output,JSON.stringify({...batch,kind:'freeze-only-no-generation'},null,2),{flag:'wx'});
  console.log(JSON.stringify({output,prompt:batch.promptVersion,schema:batch.schemaVersion,review:batch.reviewVersion,dataset:batch.datasetVersion,rubric:batch.rubricVersion,gitCommit:batch.gitCommit,gitDirty:batch.gitDirty,generations:0}));
 }
}finally{await server?.close();}
