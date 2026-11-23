// Codex bundled Artifact Tool only; no app dependency or API credential.
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
import {readFile,writeFile,mkdir,access,constants,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const moduleRoot=process.env.LIFEQUEST_ARTIFACT_MODULES??join(root,'.qa/artifact-runtime/node_modules');
const require=createRequire(join(moduleRoot,'../artifact-loader.cjs'));
const {Workbook,SpreadsheetFile,FileBlob}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const dimensions=['alignment','baseline','time','actionability','verification','sequence','reliability'];
const labels=['目标一致性','基础适配性','时间合理性','任务可执行性','完成标准可验证性','阶段逻辑合理性','无关内容与事实可靠性'];
const [mode,directory,output]=process.argv.slice(2);
const literal=v=>typeof v==='string'&&/^[=+@-]/.test(v)?`'${v}`:v;
const unliteral=v=>typeof v==='string'?v.replace(/^'(?=[=+@-])/,''):v;
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
async function absent(path){try{await access(path,constants.F_OK);throw new Error('Refusing to overwrite existing output');}catch(e){if(e.code!=='ENOENT')throw e;}}
async function load(directory){
 const batch=JSON.parse(await readFile(`${directory}/batch.json`,'utf8')),records=[];
 for(const slot of batch.slots){for(const suffix of ['.json','.started.json']){try{records.push(JSON.parse(await readFile(`${directory}/${slot.slotId}${suffix}`,'utf8')));break;}catch(e){if(e.code!=='ENOENT')throw e;}}}
 if(batch.batchVersion!==1||batch.slots.length!==60||new Set(batch.slots.map(s=>s.slotId)).size!==60)throw new Error('Invalid batch');return {batch,records};
}
const state=r=>!r?'待调用':r.status!=='finished'?'结果未确认':r.structure===true?'已返回候选':r.structure===false?'结构不通过':'调用失败';
function planText(p){return p?[`规划理由：${p.reasoning}`,`假设：${p.assumptions.join('；')||'无'}`,`警告：${p.warnings.join('；')||'无'}`,...p.stages.flatMap((s,i)=>[
 `\n第${i+1}章 ${s.title}\n里程碑：${s.milestone}\n成果检查点引用：${s.checkpointRef}`,
 ...s.tasks.map((t,j)=>`${j+1}. ${t.title}（引用${t.ref}；${t.estimatedMinutes}分钟；${t.difficulty}）\n行动：${t.description}\n完成标准：${t.doneCriteria}`)
])].join('\n\n'):'';}
function chunks(text){const result=[];let part='';for(const ch of text){if(part.length+ch.length>30000){result.push(part);part='';}part+=ch;}result.push(part);return result;}
function cell(s,a,v){s.getRange(a).values=[[literal(v)]];}
function formula(s,a,v){s.getRange(a).formulas=[[v]];}
function title(s,t,n){cell(s,'A2',t);s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:'#343466'};cell(s,'A3',n);s.getRange('A3').format.font={name:'Arial',size:10,color:'#636A7C'};}
function table(s,headers,rows,widths,name){
 const last=col(headers.length-1),end=5+Math.max(1,rows.length);s.showGridLines=false;
 s.getRange(`A5:${last}5`).values=[headers];if(rows.length)s.getRange(`A6:${last}${end}`).values=rows.map(row=>row.map(literal));
 s.getRange(`A5:${last}${end}`).format={font:{name:'Arial',size:10,color:'#20263C'},rowHeight:27,verticalAlignment:'top'};
 s.getRange(`A5:${last}5`).format={fill:'#343466',font:{name:'Arial',size:10,color:'#FFFFFF',bold:true},rowHeight:60,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
 widths.forEach((w,i)=>{s.getRange(`${col(i)}5:${col(i)}${end}`).format.columnWidth=w;});s.freezePanes.freezeRows(5);s.freezePanes.freezeColumns(1);
 if(rows.length){const t=s.tables.add(`A5:${last}${end}`,true,name);t.showFilterButton=true;s.getRange(`A6:${last}${end}`).format.fill='#FFFFFF';for(let r=6;r<=end;r+=2)s.getRange(`A${r}:${last}${r}`).format.fill='#F3F2FA';}
}
function reviewFormula(r){
 const valid=dimensions.map((_,i)=>`MOD(${col(14+i)}${r},1)=0`).join(','),evidence=dimensions.map((_,i)=>`LEN(TRIM(${col(22+i)}${r}))>0`).join(',');
 return `=IF(N${r}="待调用","待调用",IF(N${r}="结果未确认","结果未确认",IF(M${r}<>"通过","不合格",IF(COUNT(O${r}:U${r})<>7,"待评分",IF(AND(MIN(O${r}:U${r})>=1,MAX(O${r}:U${r})<=5,${valid}),IF(AND(LEN(TRIM(V${r}))>0,${evidence}),IF(AND(MIN(O${r}:U${r})>=3,O${r}>=4,R${r}>=4,S${r}>=4),"合格","不合格"),"待评分"),"评分输入有误")))))`;
}
function buildDetails(s,batch,records){
 title(s,'60组AI规划评测明细','每行一组：A:K输入前提，L生成计划，M程序通过/不通过，O:U人工评分。黄色栏由你填写；未调用的结果留空。');s.tabColor='#343466';
 const parts=batch.slots.map(s=>chunks(planText(records.find(r=>r.slotId===s.slotId)?.proposal))),extra=Math.max(0,...parts.map(c=>c.length-1));
 const headers=['样本ID','输入场景','基础层级','当前基础','成长目标','最终成功标准','每周投入（小时）','学习或执行偏好','资源与条件限制','其他具体要求','期望周期','生成的计划内容','程序检测结果（合法计划）','生成状态',...labels.map(s=>`${s}（1～5分）`),'人工评分者',...labels.map(s=>`${s}评分依据`),'主要问题','首次合格判定','模型服务商','请求模型ID','响应延迟（ms）','输入Token','输出Token','总Token','错误码','原始Record ID','原始记录路径','结构校验结果','生成时间（UTC）','费用估算（未核实留空）','评测变体',...Array.from({length:extra},(_,i)=>`生成计划内容（续${i+1}）`)];
 const rows=batch.slots.map((slot,i)=>{
  const c=batch.cases.find(c=>c.id===slot.caseId),r=records.find(r=>r.slotId===slot.slotId),v=c.input;
  return [slot.slotId,c.scenario,c.level,v.baseline,v.title,v.successCriteria,v.weeklyHours,v.preferences,v.constraints,v.requirements,c.horizon??'见其他具体要求',parts[i][0],r?.status==='finished'?(r.structure===true?'通过':'不通过'):'',state(r),...Array(7).fill(null),'',...Array(7).fill(''),'','',batch.config?.provider??(batch.source==='mock'?'mock':''),batch.config?.model??(batch.source==='mock'?'deterministic-template':''),r?.elapsedMs??null,r?.usage?.inputTokens??null,r?.usage?.outputTokens??null,r?.usage?.totalTokens??null,r?.failureCode??'',`${batch.runId}:${slot.slotId}`,r?`${directory}/${slot.slotId}${r.status==='finished'?'':'.started'}.json`:'',!r?'未运行':r.structure===true?'通过':r.structure===false?'不通过':'未观察',r?.startedAt??'',null,c.variant,...Array.from({length:extra},(_,j)=>parts[i][j+1]??'')];
 });
 table(s,headers,rows,[12,16,10,38,26,44,12,38,58,65,20,100,17,17,...Array(7).fill(17),17,...Array(7).fill(40),40,18,18,28,18,14,14,14,24,60,75,18,29,22,22,...Array(extra).fill(100)],'Eval60Details');
 s.getRange(`A6:${col(headers.length-1)}65`).format.wrapText=true;s.getRange(`A6:${col(headers.length-1)}65`).format.rowHeight=records.some(r=>r.proposal)?260:78;
 s.getRange('O6:AD65').format.fill='#FFF6D9';s.getRange('O6:AD65').format.font.color='#2457A7';s.getRange('O6:U65').dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:5}};
 for(let r=6;r<=65;r++)formula(s,`AE${r}`,reviewFormula(r));
 s.getRange('M6:M65').conditionalFormats.addCustom('M6="不通过"',{fill:'#FCE8E8',font:{color:'#A22525'}});
 s.getRange('AE6:AE65').conditionalFormats.addCustom('AE6="待评分"',{fill:'#FFF0C2',font:{color:'#805900'}});
 s.getRange('AE6:AE65').conditionalFormats.addCustom('AE6="不合格"',{fill:'#FCE8E8',font:{color:'#A22525'}});
}
function buildSummary(s,batch){
 title(s,'AI规划评测汇总',batch.cases.length===60?'60组独立输入，各请求1次。输入、输出、检测和人工分数均在评测明细同一行。':'历史批次：15组输入各请求4次，不冒称60组独立输入。');
 s.getRange('A4:B27').format={font:{name:'Arial',size:10,color:'#20263C'},rowHeight:29};s.getRange('A4:A27').format.columnWidth=29;s.getRange('B4:B27').format.columnWidth=55;
 s.getRange('A4:B9').values=[['数据集',batch.datasetVersion],['运行ID',batch.runId],['来源',batch.source],['Provider / 模型',batch.config?`${batch.config.provider} / ${batch.config.model}`:batch.source==='mock'?'Mock / deterministic-template':'待选择真实模型'],['Prompt / Schema',`${batch.promptVersion} / ${batch.schemaVersion}`],['评分规则',batch.rubricVersion]];
 ['计划请求数','已启动样本数（含未确认）','结构可判定数','结构通过数','结构未观察数','结构通过率（可判定输出）','结构通过率（已启动样本）','已完成内容评分数','已判定样本数','待判定样本数','首次合格数','已启动样本一次合格率','完整60次一次合格率'].forEach((v,i)=>cell(s,`A${i+11}`,v));
 const f={B11:'=60',B12:'=60-COUNTIF(\'评测明细\'!N6:N65,"待调用")',B13:'=COUNTIF(\'评测明细\'!AO6:AO65,"通过")+COUNTIF(\'评测明细\'!AO6:AO65,"不通过")',B14:'=COUNTIF(\'评测明细\'!AO6:AO65,"通过")',B15:'=B12-B13',B16:'=IF(B13=0,"待测",B14/B13)',B17:'=IF(B12=0,"待测",B14/B12)',B18:'=COUNTIFS(\'评测明细\'!M6:M65,"通过",\'评测明细\'!AE6:AE65,"合格")+COUNTIFS(\'评测明细\'!M6:M65,"通过",\'评测明细\'!AE6:AE65,"不合格")',B19:'=COUNTIF(\'评测明细\'!AE6:AE65,"合格")+COUNTIF(\'评测明细\'!AE6:AE65,"不合格")',B20:'=B11-B19',B21:'=COUNTIF(\'评测明细\'!AE6:AE65,"合格")',B22:'=IF(B12=0,"待测",IF(B19<>B12,"待评",B21/B12))',B23:'=IF(B19<>B11,"待完成60次",B21/B11)'};
 for(const [a,v] of Object.entries(f))formula(s,a,v);for(const a of ['B16:B17','B22:B23'])s.getRange(a).setNumberFormat('0.0%');
 cell(s,'A26','程序检测口径');cell(s,'B26','是否得到合法候选。调用失败为不通过，结构另记未观察。');cell(s,'A27','数据来源');cell(s,'B27',batch.datasetProvenance??'历史合成数据，无额外模型API调用');s.getRange('B27').format.wrapText=true;s.getRange('B27').format.rowHeight=65;
 s.getRange('D4:E4').values=[['输入场景','首次合格 / 12']];s.getRange('D4:E4').format={fill:'#343466',font:{name:'Arial',size:10,color:'#FFFFFF',bold:true},rowHeight:29};s.getRange('D4:D20').format.columnWidth=21;s.getRange('E4:E20').format.columnWidth=70;
 for(const [i,name] of [...new Set(batch.cases.map(c=>c.scenario))].entries()){const r=i+5;cell(s,`D${r}`,name);formula(s,`E${r}`,`=IF(COUNTIFS('评测明细'!B6:B65,D${r},'评测明细'!AE6:AE65,"合格")+COUNTIFS('评测明细'!B6:B65,D${r},'评测明细'!AE6:AE65,"不合格")<>12,"待评",COUNTIFS('评测明细'!B6:B65,D${r},'评测明细'!AE6:AE65,"合格")/12)`);s.getRange(`E${r}`).setNumberFormat('0.0%');}
 for(const [i,k] of ['promptHash','schemaHash','datasetHash','gitCommit'].entries()){cell(s,`D${12+i*2}`,k);cell(s,`E${12+i*2}`,batch[k]);}
}
function buildRubric(s,batch){
 title(s,'8项评分标准','第1项为程序检查，后7项由你填写分数与依据。沿用quality-1.0.0，未调用不预填结果或得分。');
 table(s,['维度','1分','2分','3分','4分','5分'],[['结构合法性','程序二元判定：通过/不通过','严格Schema、引用与真实领域导入校验。网络无输出记结构未观察。','','',''],...batch.rubricRows],[28,43,43,53,60,64],'Eval60Rubric');s.getRange('A6:F13').format.wrapText=true;s.getRange('A6:F13').format.rowHeight=95;
 const notes=[['一次合格','得到合法候选；7项均≥3，且目标一致性、任务可执行性、完成标准可验证性均≥4。评分者和7项依据必填。本项目阈值，非行业标准。'],['如何填写','在评测明细同一行查看输入和计划；O:U七项得分、V匿名评分者、W:AC七项依据，AD主要问题；AE自动判定。'],['程序通过/不通过','M表示本次调用是否得到合法候选；已结束请求填通过或不通过，未调用/中断留空。AO保留纯结构结果，调用失败为未观察，不伪造结构失败。'],['首次定义','60个固定独立输入，A01至E12每个只请求一次；不自动重试、修复或择优，真实与Mock分开。'],['完整计划','L包含理由、假设、警告、所有章节/任务、行动、估时与完成标准。超长文本放右侧续列，不丢内容；AN为原始JSON。长文本可展开编辑栏查看。'],['Key与费用','Key本机隐藏输入，仅运行内存，经本机LifeQuest发往确认的提供商；不记录到Excel/JSON/日志/环境文件，不读取或修改Codex。费用未核实留空。'],['数据来源','输入由Codex AI助手按需求编写，为合成测试夹具；未额外调用LLM API，不是真实用户数据。计划内容须等你实际调用被测模型。']];
 notes.forEach(([a,b],i)=>{cell(s,`A${16+i*2}`,a);cell(s,`B${16+i*2}`,b);});
}
async function build(batch,records){
 const wb=Workbook.create(),sheets=Object.fromEntries(['评测明细','评测汇总','评分标准'].map(n=>[n,wb.worksheets.add(n)]));for(const s of Object.values(sheets))s.showGridLines=false;
 buildDetails(sheets['评测明细'],batch,records);buildSummary(sheets['评测汇总'],batch);buildRubric(sheets['评分标准'],batch);wb.recalculate();return {wb,sheets};
}
async function verify(wb,sheets,batch){
 const s=sheets['评测明细'],sum=sheets['评测汇总'],old=s.getRange('M6:AD65').values;
 try{
  for(let r=6;r<=65;r++){cell(s,`M${r}`,'通过');cell(s,`N${r}`,'已返回候选');s.getRange(`O${r}:U${r}`).values=[Array(7).fill(r<59?4:2)];cell(s,`V${r}`,'synthetic-test-only');s.getRange(`W${r}:AC${r}`).values=[Array(7).fill('synthetic formula assertion')];}
  wb.recalculate();if(Math.abs(sum.getRange('B23').values[0][0]-53/60)>1e-9)throw new Error('Formula arithmetic failed');
  cell(s,'O6',null);wb.recalculate();if(s.getRange('AE6').values[0][0]!=='待评分'||sum.getRange('B23').values[0][0]!=='待完成60次')throw new Error('Blank score counted');
  cell(s,'O6',4.5);wb.recalculate();if(s.getRange('AE6').values[0][0]!=='评分输入有误')throw new Error('Noninteger accepted');
  cell(s,'O6',4);cell(s,'W6',' ');wb.recalculate();if(s.getRange('AE6').values[0][0]!=='待评分')throw new Error('Empty evidence accepted');
  cell(s,'M6','不通过');cell(s,'N6','调用失败');wb.recalculate();if(s.getRange('AE6').values[0][0]!=='不合格')throw new Error('Failure hidden');
 }finally{s.getRange('M6:AD65').values=old;wb.recalculate();}
 const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!',options:{useRegex:true,maxResults:20},maxChars:1500});
 if(!errors.ndjson.includes('matched 0 entries'))throw new Error('Workbook formula error scan failed');
 await writeFile(`.qa/eval60-workbook-check-${batch.runId}.json`,JSON.stringify({syntheticFormulaAssertions:'passed (not real results)',errors:errors.ndjson,summary:sum.getRange('A11:B23').values},null,2));
}
try{
 if(mode==='export'){
  if(!directory||!output)throw new Error('export requires run directory and new .xlsx path');await absent(output);
  const {batch,records}=await load(directory),{wb,sheets}=await build(batch,records);await verify(wb,sheets,batch);
  await mkdir(dirname(resolve(output)),{recursive:true});const file=await SpreadsheetFile.exportXlsx(wb);await file.save(resolve(output));
  try{await rename(`${resolve(output)}.inspect.ndjson`,`.qa/eval60-export-${batch.runId}-${randomUUID()}.inspect.ndjson`);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(process.env.LIFEQUEST_EVAL_RENDER==='true'){
   await mkdir('.qa/eval60-v2-previews',{recursive:true});for(const [name,range,suffix] of [['评测明细','A1:G8','输入'],['评测明细','L5:U7','计划与得分'],['评测汇总','A1:E27','汇总'],['评分标准','A1:F8','标准']]){const png=await wb.render({sheetName:name,range,scale:1,format:'png'});await writeFile(`.qa/eval60-v2-previews/${suffix}.png`,new Uint8Array(await png.arrayBuffer()));}
  }
  console.log(JSON.stringify({output:resolve(output),source:batch.source,actualRecords:records.length,uniqueInputs:batch.cases.length,formulaQA:'passed'}));
 }else if(mode==='reviews'){
  const {batch,records}=await load(directory),wb=await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  if(wb.worksheets.getItem('评测汇总').getRange('B5').values[0][0]!==batch.runId)throw new Error('Workbook belongs to another run');
  let rows,isV2=true;try{rows=wb.worksheets.getItem('评测明细').getRange('A6:AD65').values;}catch{isV2=false;rows=wb.worksheets.getItem('人工评分').getRange('A6:V65').values;}
  const reviews=[],seen=new Set();
  for(const row of rows){const id=unliteral(row[0]);if(seen.has(id)||!batch.slots.some(s=>s.slotId===id))throw new Error('Duplicate or unknown slot');seen.add(id);
   const si=isV2?14:6,ei=isV2?22:14,ri=isV2?21:13,ii=isV2?29:21,scores=row.slice(si,si+7),evidence=row.slice(ei,ei+7);
   if(scores.every(v=>v===null||v==='')&&evidence.every(v=>!String(v??'').trim()))continue;
   const r=records.find(r=>r.slotId===id);if(!r||r.structure!==true||r.status!=='finished')throw new Error(`Cannot score ${id}: no valid first proposal`);
   if(scores.some(v=>!Number.isInteger(v)||v<1||v>5)||evidence.some(v=>!String(v??'').trim())||!String(row[ri]??'').trim())throw new Error(`Incomplete score/evidence/reviewer: ${id}`);
   reviews.push({recordId:r.recordId,kind:'human',reviewer:String(row[ri]).trim(),rubricVersion:batch.rubricVersion,scores:Object.fromEntries(dimensions.map((d,i)=>[d,{score:scores[i],evidence:String(unliteral(evidence[i])).trim()}])),issues:String(unliteral(row[ii]??''))});
  }
  const target=`${directory}/reviews-human-${randomUUID()}.json`;await writeFile(target,JSON.stringify({runId:batch.runId,datasetVersion:batch.datasetVersion,rubricVersion:batch.rubricVersion,reviews},null,2),{flag:'wx'});console.log(JSON.stringify({output:target,reviewed:reviews.length,next:'node scripts/eval60.mjs score <run-directory> <output-review-json>'}));
 }else throw new Error('Usage: export <directory> <new.xlsx> OR reviews <directory> <scored.xlsx>');
}catch(e){console.error(e instanceof Error?e.message:'Workbook operation failed');process.exitCode=1;}
