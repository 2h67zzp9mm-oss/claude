"use strict";
const assert=require("assert"),fs=require("fs"),os=require("os"),path=require("path");
const {spawn}=require("child_process"); const WebSocket=require("ws");
const root=path.resolve(__dirname,".."),dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"living-town-auth-"));
const port=44500+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`,wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){const end=Date.now()+6000;while(Date.now()<end){const value=check();if(value)return value;await wait(50)}throw new Error(`timeout: ${label}`)}
function connect(cookie=""){return new Promise((resolve,reject)=>{const ws=new WebSocket(`${base.replace("http","ws")}/ws`,{headers:cookie?{Cookie:cookie}:{}}),client={ws,latest:null};ws.on("message",raw=>{const msg=JSON.parse(raw);if(msg.type==="state")client.latest=msg.state});ws.once("open",()=>resolve(client));ws.once("error",reject)})}
(async()=>{
 const child=spawn(process.execPath,["server.js"],{cwd:root,env:{...process.env,HOST:"127.0.0.1",PORT:String(port),LIVING_TOWN_DATA_DIR:dataDir},stdio:["ignore","pipe","pipe"]});let output="";child.stdout.on("data",c=>output+=c);child.stderr.on("data",c=>output+=c);await until(()=>output.includes("Living Town server running"),"server start");
 let response=await fetch(`${base}/api/auth/status`);assert.strictEqual((await response.json()).initialized,false);
 response=await fetch(`${base}/api/auth/setup`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:"2468"})});assert.strictEqual(response.status,200);const seanCookie=response.headers.get("set-cookie").split(";")[0];assert.ok(!fs.readFileSync(path.join(dataDir,"player-accounts.json"),"utf8").includes("2468"),"PIN must be hashed");
 response=await fetch(`${base}/api/auth/profiles`,{method:"POST",headers:{"Content-Type":"application/json",Cookie:seanCookie},body:JSON.stringify({name:"Olive",residentId:"olive",pin:"1357",look:{hair:"long",accessory:"star",shirt:"#a98cff"}})});assert.strictEqual(response.status,201);
 response=await fetch(`${base}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId:"bad",pin:"0000"})});assert.strictEqual(response.status,401);
 const status=await(await fetch(`${base}/api/auth/status`)).json(),oliveProfile=status.profiles.find(p=>p.residentId==="olive");response=await fetch(`${base}/api/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profileId:oliveProfile.id,pin:"1357"})});assert.strictEqual(response.status,200);const oliveCookie=response.headers.get("set-cookie").split(";")[0];
 const anonymous=await connect(),sean=await connect(seanCookie),olive=await connect(oliveCookie);await until(()=>anonymous.latest&&sean.latest&&olive.latest,"initial states");
 anonymous.ws.send(JSON.stringify({type:"control",residentId:"dad",x:888,y:444}));await wait(1200);assert.notStrictEqual(anonymous.latest.residents.find(r=>r.id==="dad").targetX,888);
 sean.ws.send(JSON.stringify({type:"control",residentId:"dad",x:700,y:400}));await until(()=>anonymous.latest.residents.find(r=>r.id==="dad").targetX===700,"owner controls Sean");
 sean.ws.send(JSON.stringify({type:"control",residentId:"olive",x:810,y:300}));await wait(1200);assert.notStrictEqual(anonymous.latest.residents.find(r=>r.id==="olive").targetX,810);
 olive.ws.send(JSON.stringify({type:"control",residentId:"olive",x:810,y:300}));await until(()=>anonymous.latest.residents.find(r=>r.id==="olive").targetX===810,"Olive controls Olive");
 anonymous.ws.close();sean.ws.close();olive.ws.close();child.kill("SIGTERM");await new Promise(resolve=>child.once("exit",resolve));
 assert.ok(fs.existsSync(path.join(root,"public","assets","town-map.png")));assert.ok(fs.readFileSync(path.join(root,"public","index.html"),"utf8").includes("viewport-fit=cover"));console.log("PASS: PIN hashing, owner setup, player creation, login, resident ownership, mobile shell, and pixel-art map");
})().catch(error=>{console.error(error);process.exit(1)});
