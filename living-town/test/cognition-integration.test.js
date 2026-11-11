"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {tempDir,freePort,spawnServer,waitForStart,stop,connectClient,until,cleanup}=require('./helpers');
test.after(cleanup);
test('real server uses validated local plans and persists executive memory',async()=>{
 const model=http.createServer((req,res)=>{
  let body='';req.on('data',c=>body+=c);req.on('end',()=>{
   const request=JSON.parse(body);const context=JSON.parse(request.messages[1].content);
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:{content:JSON.stringify({steps:[context.choices[0].id]})}}));
  });
 });
 await new Promise(resolve=>model.listen(0,'127.0.0.1',resolve));
 const data=tempDir('little-town-cognition-');const port=await freePort();
 const clockFile=path.join(data,'test-clock.cjs');
 fs.writeFileSync(clockFile, `const RealDate=Date; const offset=new RealDate('2026-10-11T16:30:00').getTime()-RealDate.now(); global.Date=class extends RealDate { constructor(...args){super(...(args.length?args:[RealDate.now()+offset]));} static now(){return RealDate.now()+offset;} };`);
 const server=spawnServer(data,port,{LIVING_TOWN_NPC_AI:'on',LIVING_TOWN_OLLAMA_URL:`http://127.0.0.1:${model.address().port}`,LIVING_TOWN_MRE_AI:'off'},['--require',clockFile,'server.js']);
 try{
  await waitForStart(server);const client=await connectClient(port);
  await until(()=>client.messages.some(m=>m.town?.npcBrain?.accepted>0),'model-selected plan arrives',20000);
  const planned=[...client.residents.values()].find(r=>r.cognition?.source==='local AI');
  assert.ok(planned);assert.ok(planned.cognition.plan.length);
  client.ws.close();await stop(server);
  const saved=JSON.parse(fs.readFileSync(path.join(data,'town-state.json'),'utf8'));
  assert.ok(saved.residents.some(r=>r.cognition?.plan?.source==='local AI'));
 }finally{if(server.exitCode===null)await stop(server);model.closeAllConnections();await new Promise(resolve=>model.close(resolve));}
});
