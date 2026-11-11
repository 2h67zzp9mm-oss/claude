"use strict";
// Idempotent local-only model installer and readiness check. launchd retries if
// interrupted; Ollama resumes already-downloaded model layers.
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://127.0.0.1:11435';
const model = 'qwen3.5:9b';
const statusFile = path.join(process.env.HOME, 'Library/Application Support/LittleTown/ai-status.json');
function status(value) {
  fs.writeFileSync(statusFile, JSON.stringify({ ...value, model, updatedAt: new Date().toISOString() }, null, 2));
}
(async () => {
  status({ phase: 'downloading' });
  const pull = await fetch(`${base}/api/pull`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model, stream:true}) });
  if (!pull.ok) throw new Error(`Model download: HTTP ${pull.status}`);
  let buffer = '', lastProgress = 0;
  for await (const chunk of pull.body) {
    buffer += Buffer.from(chunk).toString('utf8');
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0,newline); buffer = buffer.slice(newline+1);
      if (!line) continue;
      const info = JSON.parse(line);
      if (info.error) throw new Error(info.error);
      if (Date.now()-lastProgress > 10000 || info.status==='success') {
        status({ phase:'downloading', progress:info.status, bytes:info.completed, total:info.total });
        lastProgress=Date.now();
      }
    }
  }
  status({phase:'verifying'});
  const started=Date.now();
  const response=await fetch(`${base}/api/chat`, {method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(180000),body:JSON.stringify({model,stream:false,think:false,keep_alive:'20m',options:{num_ctx:8192,num_predict:100,temperature:0},format:{type:'object',properties:{steps:{type:'array',items:{type:'string',enum:['eat','rest','play']}}},required:['steps']},messages:[{role:'system',content:'Choose a plan using the provided IDs. Return JSON only.'},{role:'user',content:'A resident is very hungry. Choose eat first, then rest or play.'}]})});
  if(!response.ok)throw new Error(`Inference: HTTP ${response.status}`);
  const result=await response.json();
  const plan=JSON.parse(result.message?.content||'{}');
  if(!Array.isArray(plan.steps)||plan.steps[0]!=='eat'||plan.steps.some(id=>!['eat','rest','play'].includes(id)))throw new Error('Model failed planning smoke test');
  status({phase:'ready',latencyMs:Date.now()-started,validated:true});
  console.log('Local NPC model downloaded and planning smoke test passed.');
})().catch(error=>{status({phase:'retrying',error:error.message});console.error(error.message);process.exitCode=1;});
