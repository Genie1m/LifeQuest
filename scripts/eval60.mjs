import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {emitKeypressEvents,createInterface} from 'node:readline';
import {artifactRuntime,exportWorkbook} from './eval-artifact-runtime.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const [mode,arg,arg2]=process.argv.slice(2);
const modes=['prepare','mock','real','score'];
function ask(question){const rl=createInterface({input:process.stdin,output:process.stdout});return new Promise(r=>rl.question(question,a=>{rl.close();r(a.trim());}));}
async function credential(){
 if(!process.stdin.isTTY)throw new Error('Interactive terminal required');
 process.stdout.write('API Key (hidden, memory only; never paste into chat): ');
 emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let secret='';function finish(){process.stdin.off('keypress',onKey);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}function onKey(text,key={}){if(key.name==='return'){finish();resolve(secret);secret='';}else if(key.ctrl&&key.name==='c'){finish();secret='';reject(new Error('Cancelled'));}else if(key.name==='backspace')secret=secret.slice(0,-1);else if(text&&!key.ctrl)secret+=text;}process.stdin.on('keypress',onKey);});
}
let server,key='',freeze=null;
try{
 if(!modes.includes(mode))throw new Error('Usage: node scripts/eval60.mjs prepare|mock|real <config.json>|score <directory> <reviews.json>');
 server=await createServer({root,configFile:false,resolve:{alias:{'@':`${root}src`}},server:{middlewareMode:true},appType:'custom'});
 const api=await server.ssrLoadModule('/tests/evals/batch.ts');
 if(mode==='score'){
  const {batch,records}=await api.loadBatch(arg);const reviews=JSON.parse(await readFile(arg2,'utf8'));
  if(reviews.runId!==batch.runId||reviews.datasetVersion!==batch.datasetVersion||reviews.rubricVersion!==batch.rubricVersion||!Array.isArray(reviews.reviews))throw new Error('Review version/run mismatch');
  const map=new Map();for(const r of reviews.reviews){if(map.has(r.recordId)||!records.some(v=>v.recordId===r.recordId&&v.structure===true))throw new Error('Unknown/duplicate review');map.set(r.recordId,r);}
  const summary=api.summarizeBatch(batch,records,map);const output=`${arg}/scored-${randomUUID()}.json`;await writeFile(output,JSON.stringify({runId:batch.runId,...summary},null,2),{flag:'wx'});process.stdout.write(JSON.stringify({output,...summary},null,2)+'\n');
 }else{
  // Preflight Excel dependencies before accepting a key or making billable calls.
  const runtime=await artifactRuntime();
  const config=mode==='real'?api.validateConfig(JSON.parse(await readFile(arg,'utf8'))):null;
  if(mode==='real'&&arg2){
   freeze=JSON.parse(await readFile(arg2,'utf8'));
   const {assertPlannerFingerprint}=await server.ssrLoadModule('/tests/evals/planner-fingerprint.ts');
   await assertPlannerFingerprint(freeze.sourceHashes);
   const current=await api.prepareBatch('pending',config);
   for(const k of ['promptHash','schemaHash','reviewHash','datasetHash','rubricVersion'])if(freeze[k]!==current[k])throw new Error('Planner freeze differs; start a separate study');
  }
  if(mode==='real'){
   if(!process.stdin.isTTY)throw new Error('Real mode requires local interactive terminal');
   process.stdout.write(`Provider: ${config.provider}; model: ${config.model}; local service: ${config.origin}\nEndpoint: ${config.connection?.baseUrl??'official OpenAI'}\n60 unique synthetic inputs (A01-E12), one first attempt each; no retries. Price is unverified; charges may apply. Key and case text pass through your local LifeQuest server to this provider. Results automatically export to evaluation.xlsx; human scores stay blank.\n`);
   if(await ask('Type RUN 60 to authorize up to 60 billable generations: ')!=='RUN 60')throw new Error('Cancelled');
   key=await credential();
  }
  const batch=await api.prepareBatch(mode==='prepare'?'pending':mode,config);const directory=`.qa/evals60/${batch.runId}`;
  if(freeze){const {assertPlannerFingerprint}=await server.ssrLoadModule('/tests/evals/planner-fingerprint.ts');await assertPlannerFingerprint(freeze.sourceHashes);batch.freezeId=freeze.runId;}
  if(mode==='prepare'){await mkdir(directory,{recursive:true});await writeFile(`${directory}/batch.json`,JSON.stringify(batch,null,2),{flag:'wx'});process.stdout.write(JSON.stringify({directory,planned:60,uniqueInputs:60,source:'pending'})+'\n');}
  else{const result=await api.collectBatch(directory,batch,key,{onProgress:n=>process.stdout.write(`Saved ${n}/60\n`)});key='';process.stdout.write(JSON.stringify(result,null,2)+'\n');}
  key='';await exportWorkbook(runtime,directory,`${directory}/evaluation.xlsx`);
 }
}catch(e){
 // Never print raw transport/provider errors or any string containing the credential.
 const allowed=['Usage:','Review version','Unknown/duplicate','Interactive','Real mode','Cancelled','Invalid configuration','Invalid provider/model','Loopback','Official provider','Invalid connection','Excel runtime missing.','Excel export failed.','Planner freeze differs','Planner files changed','Planner fingerprint paths'];
 const safe=e instanceof Error&&allowed.some(p=>e.message.startsWith(p))?e.message:'Evaluation stopped. Check local service, config, batch/review file and directory. Existing records were preserved.';
 process.stderr.write((key&&safe.includes(key)?'Evaluation stopped.':safe)+'\n');process.exitCode=1;
}finally{key='';await server?.close();}
