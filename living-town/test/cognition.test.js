"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const brain = require("../lib/cognition");
const mind = require("../lib/mind");
const life = require("../lib/life");
const { places } = require("../shared/world");
const at = new Date("2026-10-11T16:30:00").getTime();
function fixture() {
  const state = { residents: ["olive", "hazel", "dad"].map(id => ({ id, name: life.profiles[id].name,
    x: 240, y: 105, place: "park", path: [], needs: { hunger: 70, energy: 80, social: 50, fun: 65 },
    memories: [], relationships: {}, lastTalk: 0, mind: {}, mood: { label: "content" } })) };
  life.hydrateLifeState(state, at);
  state.residents.forEach(mind.ensureMind);
  const ctx = { mindFor: mind.mindFor, scorePlaces: mind.scorePlaces, activities: mind.activities,
    isAsleepTime: mind.isAsleepTime, obligation: mind.activeObligation, isControlled: () => false,
    sameSpot: () => true, atPlace: () => true, approach: () => {}, social: () => ({ accepted: true }) };
  return { state, ctx, r: state.residents[0] };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test("planner creates bounded persistent plans for every resident", () => {
  const {state,ctx} = fixture();
  brain.createCognition(ctx).maintain(state,at);
  for (const r of state.residents) {
    assert.ok(brain.current(r));
    assert.ok(r.cognition.plan.steps.length <= 3);
    assert.ok(places[brain.current(r).place]);
    const roundtrip = JSON.parse(JSON.stringify(r));
    assert.deepEqual(brain.publicView(roundtrip), brain.publicView(r));
  }
});

test("critical needs, duties, sleep and player control override plans", () => {
  for (const reason of ["control","sleep","duty","critical","invitation"]) {
    const {state,ctx,r} = fixture();
    if(reason === "control") ctx.isControlled = () => true;
    if(reason === "sleep") ctx.isAsleepTime = () => true;
    if(reason === "duty") ctx.obligation = () => ({place:"square"});
    if(reason === "critical") r.needs.hunger=4;
    if(reason === "invitation") brain.ensure(r).pauseUntil=at+60000;
    brain.createCognition(ctx).maintain(state,at);
    assert.equal(brain.current(r),null,reason);
  }
});

test("memories are bounded, relevant, deduplicated and never from the future", () => {
  const {r} = fixture();
  for(let i=0;i<90;i++) brain.remember(r,{at:at-i*60000,text:`Experience ${i}`,about:'hazel',importance:1});
  brain.remember(r,{at:at+60000,text:'Future event',about:'hazel'});
  assert.equal(r.cognition.episodes.length,64);
  const recalled=brain.retrieve(r,{targetId:'hazel',now:at},5);
  assert.equal(recalled.length,5);
  assert.ok(!recalled.some(m=>m.text==='Future event'));
});

test("observation is local: cannot know a distant resident's mood or plans", () => {
  const {state,ctx,r}=fixture();
  state.residents[1].x=900;
  ctx.sameSpot=(a,b)=>b.id!=='dad';
  brain.createCognition(ctx).maintain(state,at);
  assert.deepEqual(r.cognition.observations,{});
  assert.ok(!brain.candidates(state,r,at,ctx).some(o=>o.targetId));
});

test("completed activities learn from real changes and advance the plan", () => {
  const {state,ctx,r}=fixture();
  const action=brain.candidates(state,r,at,ctx).find(o=>o.place==='park' && o.kind==='activity');
  brain.installPlan(r,[action],at,'adaptive planner');
  const engine=brain.createCognition(ctx);
  engine.maintain(state,at);
  r.needs.fun+=10;
  engine.maintain(state,at+action.duration+1);
  assert.equal(r.cognition.completed,1);
  assert.ok(r.cognition.learned[action.id].value>0);
  assert.equal(r.cognition.episodes[0].success,true);
});

test("model IDs are validated, stale replies cannot overwrite player decisions", async () => {
  for (const scenario of ['valid','invented','duplicate','controlled','deleted','expired']) {
    const {state,ctx,r}=fixture();
    let resolve;
    const generate=()=>new Promise(done=>{resolve=done;});
    const engine=brain.createCognition(ctx,{generate,now:()=>at});
    engine.maintain(state,at);
    const options=brain.candidates(state,r,at,ctx);
    const pending=engine.request(state,r,options,at);
    if(scenario==='controlled')ctx.isControlled=()=>true;
    if(scenario==='deleted')state.residents=state.residents.filter(x=>x!==r);
    if(scenario==='expired')r.cognition.plan=null;
    resolve({steps:scenario==='invented'?['run arbitrary code']:scenario==='duplicate'?[options[0].id,options[0].id]:[options[0].id]});
    await pending;
    assert.equal(engine.status().accepted,scenario==='valid'?1:0,scenario);
    engine.close();
  }
});

test("one inference at a time and unavailable models leave working fallback", async () => {
  const {state,ctx}=fixture(); let calls=0,resolve;
  const engine=brain.createCognition(ctx,{generate:()=>{calls++;return new Promise(done=>{resolve=done;});},now:()=>at});
  engine.tick(state,at);engine.tick(state,at+10000);
  assert.equal(calls,1);
  resolve({steps:['invalid']});await settle();
  assert.ok(state.residents.every(r=>brain.current(r)));
  assert.equal(engine.status().rejected,1);
  engine.close();
});

test("inference timeout recovers without freezing the simulation", async()=>{
  const {state,ctx,r}=fixture();
  const engine=brain.createCognition(ctx,{generate:()=>new Promise(()=>{}),now:()=>at,timeoutMs:10});
  engine.maintain(state,at);
  await engine.request(state,r,brain.candidates(state,r,at,ctx),at);
  assert.equal(engine.status().busy,false);
  assert.equal(engine.status().rejected,1);
  assert.ok(brain.current(r));engine.close();
});

test("NPCs in different rooms do not converse through walls",()=>{
  const {state}=fixture();mind.setRandom(()=>0);
  try{assert.equal(mind.socialTick(state,at,()=>"park",()=>false).length,0);}finally{mind.setRandom();}
});


test("declined invitations get space instead of an immediate repeat",()=>{
 const {state,ctx,r}=fixture();
 r.memories=[{at:at-60000,about:'hazel',tone:'declined',text:'Hazel wanted some time alone.'}];
 brain.createCognition(ctx).maintain(state,at);
 assert.ok(!brain.candidates(state,r,at,ctx).some(o=>o.targetId==='hazel'));
});
