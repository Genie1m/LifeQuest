import {realpath,access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function artifactRuntime(){
 try{
  const modules=await realpath(process.env.LIFEQUEST_ARTIFACT_MODULES??join(root,'.qa/artifact-runtime/node_modules'));
  const executable=process.env.LIFEQUEST_ARTIFACT_NODE??join(dirname(modules),'bin',process.platform==='win32'?'node.exe':'node');
  await access(join(modules,'@oai/artifact-tool/package.json'));await access(executable);
  return {modules,executable};
 }catch{throw new Error('Excel runtime missing. Configure Codex bundled LIFEQUEST_ARTIFACT_MODULES / LIFEQUEST_ARTIFACT_NODE before running; no paid request has started.');}
}
export async function exportWorkbook(runtime,directory,output){
 await new Promise((resolve,reject)=>{
  const child=spawn(runtime.executable,[join(root,'scripts/eval-workbook.mjs'),'export',directory,output],{cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,LIFEQUEST_ARTIFACT_MODULES:runtime.modules}});
  child.once('error',()=>reject(new Error('Excel export failed. JSON records preserved.')));
  child.once('exit',code=>code===0?resolve():reject(new Error('Excel export failed. JSON records preserved.')));
 });
}
