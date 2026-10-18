import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const name = 'claude-replay-guard';
export const inject = ['llm'];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]),
  );
  return value;
}
export function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function matches(options) {
  return options.provider === 'opencodex' && /^(?:[^/]+\/)?claude-/i.test(options.model ?? '')
    && typeof options.sessionId === 'string' && Array.isArray(options.messages);
}
export function contextDigest(options) {
  const first = options.messages[0];
  const system = options.system ?? (first?.role === 'system'
    ? first.content.filter(block => block.type === 'text').map(block => block.text).join('\n') : '');
  return digest({ provider: options.provider, model: options.model, system, tools: options.tools ?? [] });
}
function signatureKey(block) {
  return block?.type === 'reasoning' && typeof block.thinkingSignature === 'string'
    ? digest(block.thinkingSignature) : undefined;
}
function plainMessage(message) {
  return {
    role: message.role, toolCallId: message.toolCallId, isError: message.isError,
    content: message.content.filter(block => block.type !== 'reasoning'),
  };
}

// Request copies only: durable messages and their replay metadata are never mutated.
export function filterRequest(options, state) {
  const context = contextDigest(options);
  const prefix = [];
  let changed = false;
  let removed = 0;
  const messages = options.messages.map(message => {
    const source = message.source;
    const replay = source?.replayState;
    const eligible = message.role === 'assistant' && source?.provider === options.provider
      && source?.model === options.model && replay?.kind !== 'foreign'
      && replay?.response?.kind === 'pi-ai' && replay?.response?.api === 'openai-responses'
      && replay.blocks?.length === message.content.length;
    const before = digest(prefix);
    let result = message;
    if (eligible) {
      let invalid = false;
      const keys = replay.blocks.map(signatureKey).filter(Boolean);
      for (const key of keys) {
        const binding = state.bindings[key];
        if (binding?.invalid || (binding && (binding.context !== context
          || (binding.prefix !== undefined && binding.prefix !== before)))) invalid = true;
        if (!binding && state.context !== undefined && state.context !== context) invalid = true;
      }
      if (invalid && keys.length) {
        const keep = message.content.map((block, index) => block.type !== 'reasoning' ? index : -1).filter(index => index >= 0);
        result = Object.freeze({ ...message, content: Object.freeze(keep.map(index => message.content[index])), source: Object.freeze({
          ...source, replayState: Object.freeze({ ...replay, blocks: Object.freeze(keep.map(index => replay.blocks[index])) }),
        }) });
        for (const key of keys) state.bindings[key] = { invalid: true };
        removed += message.content.length - keep.length;
        changed = true;
      } else {
        // An unseen pre-installation signature establishes a baseline, never an excuse to drop it.
        for (const key of keys) state.bindings[key] = { context, prefix: before };
      }
    }
    // Omit reasoning-only turns from both the outgoing history and the prefix fingerprint.
    const plain = plainMessage(result);
    if (plain.content.length) prefix.push(plain);
    return result;
  }).filter(message => message.content.length > 0);
  state.context = context;
  return { options: changed ? Object.freeze({ ...options, messages: Object.freeze(messages) }) : options, context,
    prefix: digest(prefix), removed };
}

export class ReplayGuard {
  constructor(directory) { this.directory = directory; this.busy = new Set(); }
  file(options) { return join(this.directory, `${digest([options.sessionId, options.provider, options.model])}.json`); }
  load(options) {
    try {
      const state = JSON.parse(readFileSync(this.file(options), 'utf8'));
      if (state.version !== 1 || !state.bindings || typeof state.bindings !== 'object') throw new Error('Invalid replay guard state');
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, bindings: {} };
      throw error;
    }
  }
  save(options, state) {
    mkdirSync(this.directory, { recursive: true });
    const file = this.file(options), temporary = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, file);
  }
  async *stream(options, dispatch) {
    const key = this.file(options);
    if (this.busy.has(key)) throw new Error('Claude replay guard: concurrent requests for the same session are not supported');
    this.busy.add(key);
    try {
      const state = this.load(options);
      const filtered = filterRequest(options, state);
      this.save(options, state);
      for await (const chunk of dispatch(filtered.options)) {
        // Commit the binding before the caller persists the response in its session.
        if (chunk.type === 'finish' && chunk.replayState?.response?.api === 'openai-responses') {
          for (const block of chunk.replayState.blocks ?? []) {
            const signature = signatureKey(block);
            if (signature) state.bindings[signature] = { context: filtered.context, prefix: filtered.prefix };
          }
          this.save(options, state);
        }
        yield chunk;
      }
    } finally { this.busy.delete(key); }
  }
}

export function apply(ctx) {
  const guard = new ReplayGuard(join(homedir(), '.dsh', 'claude-replay-guard'));
  attach(ctx, guard);
}

export function attach(ctx, guard) {
  const forwarded = new WeakSet();
  ctx.on('llm/stream', (options, next) => {
    if (!matches(options) || forwarded.has(options)) return next();
    return guard.stream(options, filtered => {
      if (filtered === options) return next();
      // Cordis next() cannot replace its frozen request. Redispatch a copy through the public
      // LLM service; the identity guard prevents recursively filtering that copy.
      forwarded.add(filtered);
      return ctx.llm.stream(filtered);
    });
  });
}
