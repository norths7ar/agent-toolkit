import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, isAbsolute } from 'node:path';
import test from 'node:test';
import { CandidateStore } from '../store.js';

const scratch = fileURLToPath(new URL('../../../../../.tmp/20261110-second-opinion-tests/', import.meta.url));

async function fixture(t) {
  await mkdir(scratch, { recursive: true });
  const directory = await mkdtemp(join(scratch, 'store-'));
  t.after(async () => {
    const child = relative(resolve(scratch), resolve(directory));
    assert.ok(child && !child.startsWith('..') && !isAbsolute(child), 'cleanup stays within test scratch');
    await rm(directory, { recursive: true, force: true });
  });
  const path = join(directory, 'candidates.json');
  return { path, store: new CandidateStore(path) };
}

test('missing store loads empty', async t => {
  const { store } = await fixture(t);
  await store.load();
  assert.deepEqual(store.items, []);
});

test('queued and running restore as interrupted without changing settled candidates', async t => {
  const { path, store } = await fixture(t);
  const statuses = ['queued', 'running', 'completed', 'cancelled', 'error', 'interrupted'];
  await writeFile(path, JSON.stringify({ version: 1, items: statuses.map((status, id) => ({ id, status, resultThroughSeq: 9 })) }));
  await store.load();
  assert.deepEqual(store.items.map(item => item.status), ['interrupted', 'interrupted', ...statuses.slice(2)]);
  assert.ok(store.items[0].error);
  assert.ok(store.items[1].error);
  assert.ok(store.items.every(item => item.resultThroughSeq === 9));
  await store.save();
  const reloaded = new CandidateStore(path);
  await reloaded.load();
  assert.deepEqual(reloaded.items, store.items);
});

test('concurrent save requests serialize captured snapshots in invocation order', async t => {
  const { path, store } = await fixture(t);
  store.items = [{ id: 'one', status: 'queued' }];
  const first = store.save();
  store.items[0].status = 'running';
  const second = store.save();
  store.items[0].status = 'completed';
  const third = store.save();
  store.items[0].status = 'not-saved';
  await Promise.all([first, second, third]);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), {
    version: 1, items: [{ id: 'one', status: 'completed' }],
  });
});

test('malformed and unsupported store contents reject rather than silently reset', async t => {
  const { path, store } = await fixture(t);
  for (const content of ['not json', '{"version":2,"items":[]}', '{"version":1,"items":{}}']) {
    await writeFile(path, content);
    await assert.rejects(store.load());
  }
});

test('draft base is separate from checkpoint tails and interrupted text restores', async t => {
  const {path,store}=await fixture(t);
  const item={id:'draft',sessionId:'parent',status:'running',text:''};store.items=[item];
  const base=[{seq:0,type:'user/message',data:{text:'large inherited history'}}];
  await store.saveDraft(item,base,true);await store.save();
  const initial=await readFile(store.draftPath(item,'base'),'utf8');
  item.text='partial reply';
  const tail={seq:1,type:'assistant/message',data:{text:'partial reply'}};
  const end={seq:2,type:'turn/end',data:{reason:{kind:'completed'}}};
  await store.saveDraft(item,[...base,tail,end]);
  assert.equal(await readFile(store.draftPath(item,'base'),'utf8'),initial);
  const restored=new CandidateStore(path);await restored.load();
  assert.equal(restored.items[0].status,'interrupted');assert.equal(restored.items[0].text,'partial reply');assert.equal(restored.items[0].hasReply,true);
  assert.deepEqual(await restored.readDraft(restored.items[0]),[...base,tail,end]);
  assert.equal(JSON.parse(await readFile(path,'utf8')).items[0].events,undefined);
});

test('cancel recovery keeps newer index text while recovering a closed reply from its tail', async t => {
  const {path,store}=await fixture(t);
  const item={id:'cancelled',sessionId:'parent',status:'cancelled',text:'old',streamRevision:1};store.items=[item];
  await store.saveDraft(item,[],true);
  await store.saveDraft(item,[{seq:0,type:'assistant/message',data:{turn:1}},{seq:1,type:'turn/end',data:{turn:1}}]);
  item.text='newer partial text';item.streamRevision=2;await store.save();
  const restored=new CandidateStore(path);await restored.load();
  assert.equal(restored.items[0].text,'newer partial text');assert.equal(restored.items[0].hasReply,true);assert.equal(restored.items[0].status,'cancelled');
});
