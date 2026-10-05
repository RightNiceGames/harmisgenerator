import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const scripts=['independent-review.mjs','independent-edge-review.mjs','revision-review.mjs','live-editor-review.mjs','selection-review.mjs','contextual-review.mjs','compact-review.mjs','flat-review.mjs','capture.mjs'];
let failed=false;
for(const script of scripts){const result=await new Promise(resolve=>{const child=spawn(process.execPath,[new URL(script,root).pathname]);let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);child.on('exit',code=>resolve({code,output}));});console.log(script+' exited '+result.code);if(result.code){failed=true;console.log(result.output);}else if(script==='capture.mjs')console.log(result.output.trim());}
const reports=['independent-review-core.json','independent-review-edge.json','revision-verification.json','live-editor-verification.json','selection-verification.json','contextual-verification.json','compact-verification.json','flat-verification.json'];
const results=[],errors=[];for(const file of reports){const report=JSON.parse(await readFile(new URL(file,root),'utf8'));results.push(...report.results);errors.push(...report.errors);}
const summary={date:new Date().toISOString(),errors,results};await writeFile(new URL('independent-review.json',root),JSON.stringify(summary,null,2)+'\n');
const failures=results.filter(r=>!r.passed);console.log(JSON.stringify({checks:results.length,errors,failures},null,2));if(failed||errors.length||failures.length)process.exitCode=1;
