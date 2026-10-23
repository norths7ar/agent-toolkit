import { randomUUID } from 'node:crypto';

export const SOURCE = 'local-latest-message-edit';

export function message(role, content, source) {
  return { id: randomUUID(), role, content, source };
}

const ordinary = event => event.type === 'user/message'
  && event.surfaceOp === 'append' && event.data.source?.kind === 'user';

// Admission removes a prompt from Inbox before user/message is committed.
// Keep that short interval distinguishable from an already-consumed request.
export function inboxState(events, inheritedEventCount = 0) {
  const queues = { 'next-turn': [], 'next-step': [] };
  const claimed = new Set();
  const admitted = new Set();
  const canceled = new Set();
  const intents = new Map();
  let latestUser;
  for (const event of events) {
    if (event.type === 'turn/start' || event.type === 'turn/end') claimed.clear();
    if (event.type === 'user/message') {
      claimed.delete(event.data.id);
      if (ordinary(event)) {
        latestUser = event;
        admitted.add(event.data.source.latestMessageEdit?.token);
      }
    }
    if (event.type !== 'agent/inbox/spliced') continue;
    const { target, start, removedCount = 0, inserted, outcome } = event.data;
    const removed = queues[target].splice(start, removedCount, ...inserted);
    if (outcome !== 'canceled') {
      for (const item of removed) if (item.source.kind === 'user') claimed.add(item.id);
    } else {
      for (const item of removed) canceled.add(item.id);
    }
    for (const input of inserted) canceled.delete(input.id);
    if (event.seq >= inheritedEventCount) for (const input of inserted) {
      const meta = input.source.kind === 'user' && input.source.latestMessageEdit;
      if (meta) {
        intents.delete(meta.token);
        intents.set(meta.token, { input, meta,
          text: input.content.filter(block => block.type === 'text').map(block => block.text).join('\n\n') });
      }
    }
  }
  const pending = [...queues['next-turn'], ...queues['next-step']];
  for (const [token, intent] of intents) Object.assign(intent, {
    admitted: admitted.has(token),
    pending: pending.some(input => input.source.latestMessageEdit?.token === token),
    claimed: claimed.has(intent.input.id),
    canceled: canceled.has(intent.input.id),
  });
  return { pending, claimed: [...claimed], intents, latestUser };
}

// Read raw history for the UI, but use the live surface for eligibility.
export function inspectHistory(events, surface) {
  const hidden = [];
  const edits = [];
  for (const event of events) {
    const source = event.type === 'user/message' ? event.data.source : event.data?.message?.source;
    const edit = source?.latestMessageEdit;
    if (source?.kind === SOURCE && event.surfaceOp?.op === 'replace') {
      const range = edit?.hiddenRange ?? { startSeq: event.surfaceOp.startSeq, endSeq: event.surfaceOp.endSeq };
      if (!hidden.some(item => item.startSeq === range.startSeq && item.endSeq === range.endSeq)) hidden.push(range);
    }
    if (ordinary(event) && edit) edits.push({ targetId: edit.targetId, newId: event.data.id, mode: edit.mode });
  }
  const target = events.findLast(ordinary);
  if (!target || !surface.includes(target.seq)) {
    return { target: null, hidden, edits };
  }
  const text = target.data.content.filter(block => block.type === 'text').map(block => block.text).join('\n\n');
  if (!text.trim()) return { target: null, hidden, edits };
  const turnStart = events.findLast(event => event.seq < target.seq && event.type === 'turn/start');
  // A steering message can belong to a turn which already performed work.
  // Calls are recorded before dispatch. Explicitly skipped calls have paired
  // ABORTED_BEFORE_DISPATCH results; they performed no operation.
  // Native approval denials carry no denial-only code; do not infer dispatch from prose.
  const skipped = new Set(events.filter(event => event.type === 'tool/result'
    && event.data.error?.code === 'ABORTED_BEFORE_DISPATCH').flatMap(event => event.sourceEventSeqs ?? []));
  const hasOperations = events.some(event => event.seq > (turnStart?.seq ?? target.seq)
    && event.type === 'tool/call' && !skipped.has(event.seq));
  return {
    target: { id: target.data.id, seq: target.seq, text, mode: hasOperations ? 'continue' : 'withdraw' },
    hidden, edits,
  };
}

export function editedContent(original, text) {
  let replaced = false;
  const content = original.flatMap(block => {
    if (block.type !== 'text') return [block];
    if (replaced) return [];
    replaced = true;
    return [{ type: 'text', text }];
  });
  if (!replaced) content.unshift({ type: 'text', text });
  return content;
}

// Keep runtime context, skills and tool-schema updates. Only withdraw the user's
// request and its replies; removing every later surface node would lose context
// which its owning plugin may consider already delivered.
export function withdrawalRanges(events, nodes, targetSeq) {
  const bySeq = new Map(events.map(event => [event.seq, event]));
  const ranges = [];
  let range;
  for (const seq of nodes) {
    const event = bySeq.get(seq);
    const remove = seq >= targetSeq && (seq === targetSeq || event?.type === 'assistant/message' || event?.type === 'tool/result');
    if (!remove) { range = undefined; continue; }
    if (!range) { range = []; ranges.push(range); }
    range.push(seq);
  }
  return ranges;
}
