import { env } from 'cloudflare:workers'

const SANDBOX_COMPATIBILITY_DATE = '2026-10-01'
const MAX_RESULT_CHARS = 24_000

interface SandboxEntrypoint {
  evaluate(): Promise<{ result?: string; error?: string }>
}

interface SandboxOptions {
  code: string
  prelude: string
  modules?: WorkerLoaderWorkerCode['modules']
  globalOutbound: Fetcher | null
  limits?: WorkerLoaderWorkerCode['limits']
}

export const runInSandbox = async ({
  code,
  prelude,
  modules,
  globalOutbound,
  limits,
}: SandboxOptions): Promise<string> => {
  const worker = env.LOADER.get(`polar-mcp-${crypto.randomUUID()}`, () => ({
    compatibilityDate: SANDBOX_COMPATIBILITY_DATE,
    globalOutbound,
    limits,
    mainModule: 'worker.js',
    modules: {
      ...modules,
      'worker.js': `
import { WorkerEntrypoint } from 'cloudflare:workers'
${prelude}

export default class Sandbox extends WorkerEntrypoint {
  async evaluate() {
    try {
      const result = await (${code})()
      return { result: JSON.stringify(result, null, 2) ?? String(result) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
}
`,
    },
  }))

  const entrypoint = worker.getEntrypoint() as unknown as SandboxEntrypoint
  const { result, error } = await entrypoint.evaluate()
  if (error !== undefined) {
    throw new Error(error)
  }
  return truncate(result ?? '')
}

const truncate = (text: string) =>
  text.length <= MAX_RESULT_CHARS
    ? text
    : `${text.slice(0, MAX_RESULT_CHARS)}\n\n--- TRUNCATED ---\nThe result was ${text.length} characters (limit ${MAX_RESULT_CHARS}). Return fewer fields or items.`

export const toolResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
})

export const toolError = (error: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: `Error: ${error instanceof Error ? error.message : String(error)}`,
    },
  ],
  isError: true,
})
