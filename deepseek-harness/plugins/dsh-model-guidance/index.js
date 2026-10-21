import z from '@deepseek-ai/schemastery';

export const name = 'model-guidance';
export const inject = ['systemPrompt'];

// One volatile value makes a GUI save of the text and its bindings atomic.
export const Config = z.object({
  data: z.object({
    guides: z.dict(z.object({
      name: z.string().required(),
      text: z.string().required(),
    })).default({}),
    bindings: z.dict(z.dict(z.string())).default({}),
  }).default({ guides: {}, bindings: {} }).volatile(),
});

export function apply(ctx, config) {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });

  // Wrap the built-in selection listener: its result contains the same route
  // snapshot that agent/request will use, unlike agent.options during a switch.
  ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const data = config.data.get();
    const assembled = await next();
    const { provider, model } = assembled.variables;
    if (!Object.hasOwn(data.bindings, provider)) return assembled;
    const models = data.bindings[provider];
    if (!Object.hasOwn(models, model)) return assembled;
    const guideId = models[model];
    if (!Object.hasOwn(data.guides, guideId)) return assembled;
    const text = data.guides[guideId].text;
    // An unfinished, empty guide leaves DSH's existing persona in place.
    if (!text.trim()) return assembled;
    return {
      ...assembled,
      sections: assembled.sections.map(section => section.name === 'deployment:persona-prefix'
        ? { ...section, text, interpolate: false }
        : section),
    };
  }, { prepend: true });
}
