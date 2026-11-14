import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { startBackend } from '../backend.js';
import { composePrompt, DEFAULT_PROMPT } from '../prompt.js';

const tick = () => new Promise(done => setTimeout(done, 5));
test('prompt uses optional question and allows an empty configured default', () => {
  assert.equal(composePrompt(DEFAULT_PROMPT, ''), DEFAULT_PROMPT);
  assert.equal(composePrompt('base', 'question'), 'base\n\n请围绕以下问题回答：\nquestion');
  assert.equal(composePrompt('', 'question'), 'question');
  assert.equal(composePrompt('', ''), '');
});

test('draft streaming, fixed prompt, first-step scope, lazy continuation and durable snapshots', async () => {
  const scratch = resolve(import.meta.dirname, '../../../../../.tmp/20261110-second-opinion-tests');
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(join(scratch, 'backend-'));
  const oldHome = process.env.DSH_HOME; process.env.DSH_HOME = directory;
  let configuredPrompt = 'Default';
  const routes = new Map(), cleanups = [], listeners = new Map();
  let prepares = 0, promotes = 0, restrictions = 0, guards = 0, input, disposed = 0;
  const sourceEvents = [
    {seq:0,type:'assistant/message',data:{turn:1,message:{id:'a',content:[{type:'text',text:'A'}]}}},
    {seq:1,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}},
  ];
  let events, idle;
  const tools = {
    restrict(value) { assert.deepEqual(value,{allow:[]});restrictions++;return()=>restrictions--; },
    guard(cb) { assert.ok(cb({}));guards++;return()=>guards--; },
  };
  const agent = {
    ctx:{get:key=>key==='tools'?tools:undefined,on(name,fn){listeners.set(name,fn);return()=>listeners.delete(name);}},
    session:{get seq(){return events.length;},snapshotEvents:()=>structuredClone(events)},
    followup(message){input=message;},whenIdle:()=>idle.promise,
    cancel(){events.push({seq:events.length,type:'turn/end',data:{reason:{kind:'aborted'}}});idle.resolve();},
  };
  const adapter = {
    async prepare(item){prepares++;events=structuredClone(sourceEvents);idle=Promise.withResolvers();
      item.childStartSeq=1;item.meta={parentSession:'parent'};item.inheritedEventCount=2;item.selection={provider:item.provider,model:item.model};item.sourceHeader={id:'parent'};
      return {agent,dispose:async()=>{disposed++;}};},
    async promote(item,saved){promotes++;assert.equal(saved.at(-2).data.message.content[0].text,'B opinion');return item.continuationId;},
  };
  const ctx={logger:{warn:message=>{throw Error(message);}},effect(fn){const cleanup=fn();if(cleanup)cleanups.push(cleanup);},
    connection:{fetch:{register(route){routes.set(route.path,route.fetch);return()=>routes.delete(route.path);}}},
    sessionQuery:{readSession:async()=>({header:{id:'parent'},events:sourceEvents})},
  };
  async function request(path,data,status=200){const url=`http://localhost/api/local-second-opinion/${path}`;
    const response=await routes.get(new URL(url).pathname)(new Request(url,data?{method:'POST',body:JSON.stringify(data)}:{}));
    assert.equal(response.status,status,await response.clone().text());return response.json();}
  try {
    await startBackend(ctx,{defaultPrompt:{get:()=>configuredPrompt}},adapter);
    const payload={sessionId:'parent',anchorMessageId:'a',requestId:'one',provider:'p',model:'B',instruction:'Question'};
    const first=await request('invite',payload);assert.equal(first.childSessionId,undefined);assert.equal(promotes,0);
    for(let i=0;i<100&&!input;i++)await tick();assert.ok(input);
    assert.equal(input.content[0].text,'Default\n\n请围绕以下问题回答：\nQuestion');
    configuredPrompt='Changed';assert.equal((await request('invite',payload)).promptText,input.content[0].text);assert.equal(prepares,1);
    assert.equal(restrictions,1);assert.equal(guards,1);
    const step=listeners.get('agent/pre-step');assert.equal((await step({},async()=>({kind:'enter'}))).kind,'enter');assert.equal((await step({},async()=>({kind:'enter'}))).kind,'reject');
    listeners.get('agent/assistant-stream')({frame:{type:'start'}});
    listeners.get('agent/assistant-stream')({frame:{type:'chunk',chunk:{type:'text-delta',text:'B op'}}});
    const streaming=(await request('state?sessionId=parent')).candidates[0];assert.equal(streaming.text,'B op');assert.equal(streaming.canContinue,false);assert.equal(streaming.events,undefined);assert.equal(streaming.sourceHeader,undefined);
    await request('continue',{sessionId:'parent',id:'one'},409);
    events.push({seq:2,type:'assistant/message',data:{message:{content:[{type:'text',text:'B opinion'}]}}},{seq:3,type:'turn/end',data:{reason:{kind:'completed'}}});idle.resolve();
    let result;for(let i=0;i<100;i++){result=(await request('state?sessionId=parent')).candidates[0];if(result.canContinue)break;await tick();}
    assert.equal(result.status,'completed');assert.equal(result.text,'B opinion');assert.equal(restrictions,0);assert.equal(guards,0);assert.equal(disposed,1);
    const continued=await request('continue',{sessionId:'parent',id:'one'});assert.ok(continued.sessionId);
    assert.deepEqual(await request('continue',{sessionId:'parent',id:'one'}),continued);assert.equal(promotes,1);
    const stored=JSON.parse(await readFile(join(directory,'second-opinion/candidates.json'),'utf8'));assert.equal(stored.items[0].events,undefined);assert.equal(stored.items[0].childSessionId,continued.sessionId);
    configuredPrompt='';await request('invite',{...payload,requestId:'empty',instruction:''},400);assert.equal(prepares,1);
    input=undefined;
    await request('invite',{...payload,requestId:'stop'});
    for(let i=0;i<100&&!input;i++)await tick();
    listeners.get('agent/assistant-stream')({frame:{type:'chunk',chunk:{type:'text-delta',text:'partial'}}});
    await request('cancel',{sessionId:'parent',id:'stop'});
    for(let i=0;i<100&&disposed<2;i++)await tick();
    const stopped=(await request('state?sessionId=parent')).candidates.find(c=>c.id==='stop');
    assert.equal(stopped.status,'cancelled');assert.equal(stopped.text,'partial');assert.equal(stopped.canContinue,false);
    assert.equal(restrictions,0);assert.equal(guards,0);
    input=undefined;await request('invite',{...payload,requestId:'unload'});
    for(let i=0;i<100&&!input;i++)await tick();
    for(const cleanup of cleanups.reverse())await cleanup();cleanups.length=0;
    const unloaded=JSON.parse(await readFile(join(directory,'second-opinion/candidates.json'),'utf8')).items.find(c=>c.id==='unload');
    assert.equal(unloaded.status,'interrupted');assert.equal(disposed,3);
  } finally {
    for(const cleanup of cleanups.reverse())await cleanup();
    if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome;
    await rm(directory,{recursive:true,force:true});
  }
});

test('legacy opinions retain their existing branch and frozen preview', async () => {
  const scratch=resolve(import.meta.dirname,'../../../../../.tmp/20261110-second-opinion-tests');
  await mkdir(scratch,{recursive:true});const directory=await mkdtemp(join(scratch,'legacy-'));
  const oldHome=process.env.DSH_HOME;process.env.DSH_HOME=directory;
  const routes=new Map(),cleanups=[];
  const events=[{seq:2,type:'assistant/message',data:{message:{content:[{type:'text',text:'Original opinion'}]}}},{seq:3,type:'turn/end',data:{reason:{kind:'completed'}}},{seq:4,type:'assistant/message',data:{message:{content:[{type:'text',text:'Later follow-up'}]}}}];
  const ctx={logger:{warn:()=>{}},effect(fn){const dispose=fn();if(dispose)cleanups.push(dispose);},connection:{fetch:{register(route){routes.set(route.path,route.fetch);return()=>{};}}},sessionQuery:{readSession:async()=>({events})}};
  try {
    await mkdir(join(directory,'second-opinion'),{recursive:true});
    await writeFile(join(directory,'second-opinion/candidates.json'),JSON.stringify({version:1,items:[{id:'old',sessionId:'parent',childSessionId:'existing-child',childStartSeq:1,resultThroughSeq:3,status:'completed'}]}));
    await startBackend(ctx,{}, {prepare(){throw Error('unexpected');},promote(){throw Error('unexpected');}});
    const state=await (await routes.get('/api/local-second-opinion/state')(new Request('http://local/api/local-second-opinion/state?sessionId=parent'))).json();
    assert.equal(state.candidates[0].text,'Original opinion');assert.equal(state.candidates[0].canContinue,true);
    const result=await (await routes.get('/api/local-second-opinion/continue')(new Request('http://local/api/local-second-opinion/continue',{method:'POST',body:JSON.stringify({sessionId:'parent',id:'old'})}))).json();
    assert.deepEqual(result,{sessionId:'existing-child'});
  } finally {
    for(const cleanup of cleanups.reverse())await cleanup();
    if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome;
    await rm(directory,{recursive:true,force:true});
  }
});
