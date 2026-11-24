import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const evidencePath=process.argv[2];
const evidence=evidencePath?await read(evidencePath):null;
const dataset=await read('tests/evals/scenarios60.v2.json');
const dims=['alignment','baseline','time','actionability','verification','sequence','reliability'];
const critical=['alignment','actionability','verification'];
const assert=(v,message)=>{if(!v)throw Error(message);};
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
assert(dataset.cases.length===60&&new Set(dataset.cases.map(c=>c.id)).size===60,'Expected 60 fixed inputs');
let evidenceSummary=null;
if(evidence){
assert(evidence.cases.length===60&&new Set(evidence.cases.map(c=>c.caseId)).size===60,'Expected 60 unique cases');
assert(evidence.dataset.version===dataset.datasetVersion,'Dataset version differs');
let firstStructure=0,observed=0,firstQualified=0,latestQualified=0,calls=0;
for(const c of evidence.cases){
 const original=dataset.cases.find(x=>x.id===c.caseId);
 assert(original&&JSON.stringify(original.input)===JSON.stringify(c.input),`Fixed input differs: ${c.caseId}`);
 assert(sha(c.input)===c.inputHash&&sha(c.proposal)===c.proposalHash,`Input/plan fingerprint differs: ${c.caseId}`);
 assert(c.humanReview===null&&c.aiReview.kind==='ai-assisted','Review type changed');
 assert(c.attempts[0].attempt==='first','Missing first attempt');
 for(let i=1;i<c.attempts.length;i++)assert(c.attempts[i].parentRecordId===c.attempts[i-1].recordId&&c.attempts[i-1].structure!==true,'Invalid retry chain');
 const selected=c.attempts.find(a=>a.structure===true);
 assert(selected?.recordId===c.selectedRecordId,'Selection must use earliest valid result');
 for(const d of dims){const v=c.aiReview.scores[d];assert(v&&Number.isInteger(v.score)&&v.score>=1&&v.score<=5&&v.evidence.trim(),`Missing score or evidence: ${c.caseId}/${d}`);}
 const qualified=dims.every(d=>c.aiReview.scores[d].score>=3)&&critical.every(d=>c.aiReview.scores[d].score>=4);
 assert(qualified===c.aiReview.qualified,'Content qualification differs');
 const a=c.attempts[0];firstStructure+=a.structure===true?1:0;observed+=a.structure!==null?1:0;
 firstQualified+=a.structure===true&&qualified?1:0;latestQualified+=qualified?1:0;calls+=c.attempts.length;
 assert(c.automaticCheck.structure&&c.automaticCheck.domainImport&&c.automaticCheck.browserImport===null,'Automatic check scope differs');
}
const s=evidence.summary;
assert(firstStructure===s.firstStructurePassed&&observed===s.firstStructureObserved&&firstQualified===s.firstAIReferenceQualified&&latestQualified===s.latestAIReferenceQualified&&calls===s.totalRequests,'Summary does not reconcile');
const prohibited=/(?:apiKey|authorization|sourcePath|directory|baseUrl|accessToken|password|api_key)/i;
const walk=(v)=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){assert(!prohibited.test(k),`Unapproved publication field: ${k}`);walk(x);}};
walk(evidence);
const evidenceText=JSON.stringify(evidence);
assert(!/[A-Za-z]:[\\/]|C:\\Users\\|D:\\SCNU\\/.test(evidenceText),'Local absolute path in public evidence');
evidenceSummary={cases:60,calls,firstStructure,firstQualified,latestQualified,scoreEvidenceCells:60*7};
}
async function markdownFiles(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isDirectory()&&e.name!=='archive'&&e.name!=='media')out.push(...await markdownFiles(`${dir}/${e.name}`));else if(e.isFile()&&e.name.endsWith('.md'))out.push(`${dir}/${e.name}`);}return out;}
const files=['README.md','AGENTS.md',...await markdownFiles('docs'),'docs/media/README.md'];
let links=0;
for(const f of files){const text=await fs.readFile(f,'utf8');for(const m of text.matchAll(/(?:!?\[[^\]]*\]\(([^)]+)\)|<img\b[^>]*src="([^"]+)"[^>]*>)/g)){let target=m[1]??m[2];if(/^(?:https?:|#|mailto:)/.test(target))continue;target=decodeURIComponent(target.split('#')[0].replace(/^<|>$/g,''));if(!target)continue;await fs.access(path.resolve(path.dirname(f),target));links++;}}
console.log(JSON.stringify({fixedInputs:60,evidenceChecked:!!evidence,evidenceSummary,markdownFiles:files.length,localLinks:links}));
