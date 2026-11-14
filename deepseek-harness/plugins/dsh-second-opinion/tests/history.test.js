import assert from 'node:assert/strict';
import test from 'node:test';
import { forkBoundary, opinionResult } from '../history.js';

const reply = (seq, id, text, turn = 1, extra = {}) => ({ seq, type: 'assistant/message', data: {
  turn, message: { id, content: [{ type: 'text', text }] }, ...extra,
} });
const end = (seq, turn = 1, kind = 'completed') => ({ seq, type: 'turn/end', data: { turn, reason: { kind } } });

test('fork anchors to its own completed turn, not later conversation', () => {
  const events = [reply(1, 'a', 'first'), end(2), reply(3, 'b', 'later', 2), end(4, 2)];
  assert.equal(forkBoundary(events, 'a'), 2);
  assert.equal(forkBoundary(events, 'b'), 4);
});

test('fork rejects missing, unfinished, non-final, and interrupted replies', () => {
  assert.throws(() => forkBoundary([], 'missing'));
  assert.throws(() => forkBoundary([reply(1, 'a', 'pending')], 'a'));
  assert.throws(() => forkBoundary([reply(1, 'a', 'tool step'), reply(2, 'b', 'final'), end(3)], 'a'));
  assert.throws(() => forkBoundary([reply(1, 'a', 'partial', 1, { interrupted: true }), end(2, 1, 'aborted')], 'a'));
});

test('result excludes inherited history and honors caller-frozen inclusive cut', () => {
  const events = [reply(2, 'old', 'inherited'), reply(4, 'opinion', 'opinion'), end(5),
    reply(7, 'continued', 'later conversation', 2), end(8, 2)];
  const frozen = events.filter(event => event.seq <= 5);
  assert.deepEqual(opinionResult(frozen, 2), { text: 'opinion', failed: false, cancelled: false });
});

test('only text blocks contribute to a result', () => {
  const message = reply(1, 'a', 'one');
  message.data.message.content.push({ type: 'reasoning', text: 'private reasoning' }, { type: 'text', text: ' two' });
  assert.equal(opinionResult([message, end(2)], 0).text, 'one two');
});

test('empty results and attempts after a reply fail; a successful retry recovers', () => {
  const attempt = { seq: 2, type: 'assistant/attempt', data: { turn: 1 } };
  assert.equal(opinionResult([end(1)], 0).failed, true);
  assert.equal(opinionResult([reply(1, 'a', 'text'), attempt, end(3, 1, 'error')], 0).failed, true);
  assert.deepEqual(opinionResult([attempt, reply(3, 'b', 'recovered'), end(4)], 0),
    { text: 'recovered', failed: false, cancelled: false });
});

test('native cancellation preserves partial text without claiming completion', () => {
  const result = opinionResult([reply(1, 'a', 'partial', 1, { interrupted: true }), end(2, 1, 'aborted')], 0);
  assert.equal(result.text, 'partial');
  assert.equal(result.cancelled, true);
  assert.equal(result.failed, true);
});

test('error and max-token endings fail even with nonempty text', () => {
  for (const kind of ['error', 'max-tokens']) {
    const result = opinionResult([reply(1, 'a', 'partial'), end(2, 1, kind)], 0);
    assert.equal(result.failed, true, kind);
    assert.equal(result.cancelled, false, kind);
  }
});

test('failed opinions retain the host error instead of hiding it behind a generic message', () => {
  const event = end(2, 1, 'error');
  event.data.reason.error = { message: 'session "opinion-example" is not live in this store', code: 'UNKNOWN' };
  assert.equal(opinionResult([event], 0).error, event.data.reason.error.message);
  event.data.reason.error = { message: 'Provider rejected the request', code: 'INVALID_REQUEST' };
  assert.equal(opinionResult([event], 0).error, 'Provider rejected the request (INVALID_REQUEST)');
});
