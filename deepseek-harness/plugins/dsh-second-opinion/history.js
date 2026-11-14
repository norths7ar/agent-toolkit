export function forkBoundary(events, messageId) {
  const index = events.findIndex(event => event.type === 'assistant/message'
    && event.data.message?.id === messageId);
  if (index < 0) throw new Error('找不到这条回复，请刷新会话。');
  const anchor = events[index];
  if (anchor.data.interrupted) throw new Error('这条回复已中断，请选择完整回复。');
  const end = events.slice(index + 1).find(event => event.type === 'turn/end'
    && event.data.turn === anchor.data.turn);
  if (!end) throw new Error('请等待这一轮回复结束后再邀请其他模型。');
  const later = events.slice(index + 1).filter(event => event.seq <= end.seq);
  if (later.some(event => event.type === 'assistant/message')) {
    throw new Error('请选择这一轮最后一条回复。');
  }
  return end.seq;
}

export function opinionResult(events, afterSeq) {
  const own = events.filter(event => event.seq > afterSeq);
  const replies = own.filter(event => event.type === 'assistant/message');
  const text = replies.map(event => (event.data.message?.content ?? [])
    .filter(block => block.type === 'text').map(block => block.text).join('')).join('\n\n');
  const failure = own.findLast(event => event.type === 'assistant/attempt');
  const end = own.findLast(event => event.type === 'turn/end');
  const cancelled = end?.data.reason?.kind === 'aborted';
  const reason = end?.data.reason;
  const streamFailure = failure?.data.stream?.findLast(entry => entry.chunk?.type === 'finish')?.chunk.reason?.failure;
  const detail = reason?.kind === 'error' ? reason.error : undefined;
  const message = detail?.message || (failure?.seq > (replies.at(-1)?.seq ?? -1) ? streamFailure?.message : undefined);
  const code = detail?.code || streamFailure?.code;
  const error = message ? (code && code !== 'UNKNOWN' ? `${message} (${code})` : message)
    : reason?.kind === 'max-tokens' ? '回复达到模型输出长度限制，已保留收到的内容。' : undefined;
  return { text, cancelled, failed: !text || cancelled || replies.some(event => event.data.interrupted)
    || ['error', 'max-tokens'].includes(end?.data.reason?.kind)
    || !!failure && failure.seq > (replies.at(-1)?.seq ?? -1), ...(error ? { error } : {}) };
}

export function hasClosedReply(events, afterSeq = -1) {
  const reply = events.findLast(event => event.seq > afterSeq && event.type === 'assistant/message');
  return !!reply && events.some(event => event.seq > reply.seq && event.type === 'turn/end'
    && event.data.turn === reply.data.turn);
}
