import z from '@deepseek-ai/schemastery';
import { startBackend } from './backend.js';
import { createAdapter } from './adapter.js';
import { DEFAULT_PROMPT } from './prompt.js';

export const name = 'second-opinion';
export const inject = ['agents', 'agentLoop', 'sessions', 'sessionQuery', 'sessionController', 'connection', 'llm'];
export const Config = z.object({ defaultPrompt: z.string().default(DEFAULT_PROMPT).volatile() });

export async function apply(ctx, config) {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
  return startBackend(ctx, config, createAdapter(ctx));
}
