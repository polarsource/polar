/** Client-safe constants: no server imports, so both the browser and the
 * server may read them. */

/** The one organization this demo runs on. */
export const ORG = 'acme'

/** The models an agent can be pinned to. */
export const MODELS = [
  'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-5',
  'openai/gpt-5-mini',
] as const
