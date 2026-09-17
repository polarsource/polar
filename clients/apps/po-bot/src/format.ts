export const n = (value: unknown) =>
  typeof value === 'number' ? Math.round(value).toLocaleString('en-US') : '–'

export const usd = (value: unknown) =>
  typeof value === 'number' ? `$${value.toFixed(5)}` : 'n/a'

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour12: false })

/** `anthropic/claude-haiku-4-5` → `claude-haiku-4-5` */
export const shortModel = (model: string) => model.split('/')[1] ?? model
