"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {ollamaGenerator}=require('../lib/mre');
test('local generator sends bounded structured requests',async()=>{
 let received;
 const server=http.createServer((req,res)=>{let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{
   received=JSON.parse(raw);
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:{content:'{"steps":["rest"]}'}}));
 });});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
   const generate=ollamaGenerator({url:`http://127.0.0.1:${server.address().port}`,model:'test-model',numCtx:8192,numPredict:180,temperature:0.35});
   const result=await generate('system','context',{type:'object'});
   assert.deepEqual(result,{steps:['rest']});assert.equal(received.think,false);
   assert.equal(received.options.num_ctx,8192);assert.equal(received.options.num_predict,180);
   assert.equal(received.stream,false);assert.deepEqual(received.format,{type:'object'});
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('local generator aborts a stalled model request',async()=>{
 const server=http.createServer(()=>{});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
   const generate=ollamaGenerator({url:`http://127.0.0.1:${server.address().port}`,timeoutMs:20});
   await assert.rejects(generate('system','context',{}),error=>error.name==='AbortError');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
