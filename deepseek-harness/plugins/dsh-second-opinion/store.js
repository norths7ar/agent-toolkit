import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { hasClosedReply } from './history.js';

// The small index and per-opinion snapshots have separate write paths. A large
// inherited history is written once, never once per streamed token.
export class CandidateStore {
  constructor(path) { this.path = path; this.items = []; this.queue = Promise.resolve(); }
  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.items)) throw new Error('第二意见记录格式不受支持');
      this.items = data.items;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const item of this.items) {
      if (['queued', 'running'].includes(item.status)) {
        item.status = 'interrupted';
        item.error = '上次生成被中断，已保留收到的内容。';
      }
      if (item.draft && ['interrupted', 'cancelled', 'error'].includes(item.status)) {
        try {
          const tail = JSON.parse(await readFile(this.draftPath(item, 'tail'), 'utf8'));
          if ((tail.streamRevision ?? 0) >= (item.streamRevision ?? 0)) {
            item.text = tail.text;
            item.streamRevision = tail.streamRevision ?? 0;
          }
          item.hasReply = hasClosedReply(tail.events);
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
  }
  draftPath(item, part) {
    const key = createHash('sha256').update(`${item.sessionId}\0${item.id}`).digest('hex');
    return join(dirname(this.path), 'opinions', `${key}.${part}.json`);
  }
  saveDraft(item, events, initial = false) {
    if (initial) { item.baseCount = events.length; item.draft = true; }
    const path = this.draftPath(item, initial ? 'base' : 'tail');
    const content = JSON.stringify(initial ? events : { events: events.slice(item.baseCount), text: item.text, streamRevision: item.streamRevision ?? 0 });
    const pending = this.queue.then(async () => {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(`${path}.tmp`, content, 'utf8');
      await rename(`${path}.tmp`, path);
    });
    this.queue = pending.catch(() => {});
    return pending;
  }
  async readDraft(item) {
    await this.queue;
    const base = JSON.parse(await readFile(this.draftPath(item, 'base'), 'utf8'));
    let tail = [];
    try { tail = JSON.parse(await readFile(this.draftPath(item, 'tail'), 'utf8')).events; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return [...base, ...tail];
  }
  save() {
    const content = JSON.stringify({ version: 1, items: this.items }, null, 2);
    const pending = this.queue.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(`${this.path}.tmp`, content, 'utf8');
      await rename(`${this.path}.tmp`, this.path);
    });
    this.queue = pending.catch(() => {});
    return pending;
  }
}
