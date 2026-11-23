import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {createInterface,emitKeypressEvents} from 'node:readline';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const [mode,directory]=process.argv.slice(2);
function ask(q){const rl=createInterface({input:process.stdin,output:process.stdout});return new Promise(r=>rl.question(q,a=>{rl.close();r(a.trim());}));}
async function credential(){
 process.stdout.write('Relay/provider API Key (hidden, memory only): ');emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let secret='';const finish=()=>{process.stdin.off('keypress',onKey);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};function onKey(text,key={}){if(key.name==='return'){finish();resolve(secret);secret='';}else if(key.ctrl&&key.name==='c'){finish();secret='';reject(new Error('Cancelled'));}else if(key.name==='backspace')secret=secret.slice(0,-1);else if(text&&!key.ctrl)secret+=text;}process.stdin.on('keypress',onKey);});
}
let server,key='';
try{
 if(!['preview','real'].includes(mode)||!directory)throw new Error('Invalid command');
 server=await createServer({root,configFile:false,resolve:{alias:{'@':`${root}src`}},server:{middlewareMode:true},appType:'custom'});
 const api=await server.ssrLoadModule('/tests/evals/retry.ts');const prepared=await api.prepareRetry(directory,'real');
 const ids=prepared.batch.slots.map(s=>s.caseId);process.stdout.write(JSON.stringify({retryOf:prepared.batch.retryOf,selectedIds:ids,maximumCalls:ids.length,config:prepared.batch.config,originalFilesUnchanged:true},null,2)+'\n');
 if(mode==='real'){
  if(!process.stdin.isTTY)throw new Error('Interactive terminal required');
  process.stdout.write('Each selected failure is retried ONCE, may cost money, same 120-second server limit. Results are separate retry JSON files, not replacements for the first-attempt Excel. Keep the local development server running.\n');
  if(await ask(`Type RETRY ${ids.length} to continue: `)!==`RETRY ${ids.length}`)throw new Error('Cancelled');key=await credential();
  const result=await api.runRetry(prepared,key,{onProgress:n=>process.stdout.write(`Saved retry ${n}/${ids.length} (${ids[n-1]})\n`)});key='';process.stdout.write(JSON.stringify(result,null,2)+'\n');
 }
}catch{process.stderr.write('Retry not completed. Check parent batch, unchanged Prompt/Schema, local dev service and interactive input. Existing records are preserved. No credentials/raw errors are printed.\n');process.exitCode=1;}
finally{key='';await server?.close();}
