import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {emitKeypressEvents} from 'node:readline';
// Reuse the Vite runtime already installed by Vitest; no new dependency/server listener.
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const [mode,first,second]=process.argv.slice(2);
async function credential(){
 if(!process.stdin.isTTY)throw new Error('Real mode requires an interactive local terminal');
 process.stdout.write('OpenAI Key (hidden; memory only; real calls may cost money): ');
 emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let secret='';function finish(){process.stdin.off('keypress',onKey);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}function onKey(text,key){if(key.name==='return'){finish();resolve(secret);secret='';}else if(key.ctrl&&key.name==='c'){finish();secret='';reject(new Error('Cancelled'));}else if(key.name==='backspace')secret=secret.slice(0,-1);else if(text&&!key.ctrl)secret+=text;}process.stdin.on('keypress',onKey);});
}
let server;
try{
 if(!['mock','real','score'].includes(mode))throw new Error('Usage: node scripts/evaluate-planner.mjs mock|real [caseId] OR score <run-directory> <reviews.json>');
 let key=mode==='real'?await credential():'';
 server=await createServer({root,configFile:false,resolve:{alias:{'@':`${root}src`}},server:{middlewareMode:true},appType:'custom'});
 const runner=await server.ssrLoadModule('/tests/evals/runner.ts');
 const result=mode==='score'?await runner.score(first,second):await runner.run(mode,key,first);key='';
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}catch{process.stderr.write('Evaluation failed. Check mode, local dev service, case ID or review file. No credentials or raw error details are printed.\n');process.exitCode=1;}
finally{await server?.close();}
