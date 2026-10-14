import { Context, Effect, Layer } from 'effect'
import { RequestLog } from './log'
import { ToolError } from './results'

const SANDBOX_COMPATIBILITY_DATE = '2026-10-01'

interface SandboxEntrypoint {
  evaluate(): Promise<{ result?: string; error?: string; requests?: number }>
}

interface SandboxOptions {
  code: string
  prelude: string
  modules?: WorkerLoaderWorkerCode['modules']
  globalOutbound: Fetcher | null
  limits?: WorkerLoaderWorkerCode['limits']
}

export class Sandbox extends Context.Service<
  Sandbox,
  {
    readonly run: (
      options: SandboxOptions,
    ) => Effect.Effect<string, ToolError, RequestLog>
  }
>()('mcp/Sandbox') {
  static layer(loader: Env['LOADER']) {
    return Layer.succeed(
      Sandbox,
      Sandbox.of({
        run: Effect.fn('Sandbox.run')(function* ({
          code,
          prelude,
          modules,
          globalOutbound,
          limits,
        }: SandboxOptions) {
          const { result, error, requests } = yield* Effect.tryPromise({
            try: () => {
              const worker = loader.get(
                // The loader caches isolates by name and globalOutbound carries the user's
                // token, so a reused name would serve one user's isolate to another.
                `polar-mcp-${crypto.randomUUID()}`,
                () => ({
                  compatibilityDate: SANDBOX_COMPATIBILITY_DATE,
                  globalOutbound,
                  limits,
                  mainModule: 'worker.js',
                  modules: {
                    ...modules,
                    'worker.js': `
import { WorkerEntrypoint } from 'cloudflare:workers'
let __requests = 0
const fetch = (...args) => {
  __requests++
  return globalThis.fetch(...args)
}
${prelude}

export default class Sandbox extends WorkerEntrypoint {
  async evaluate() {
    try {
      const result = await (${code})()
      return { result: JSON.stringify(result) ?? String(result), requests: __requests }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), requests: __requests }
    }
  }
}
`,
                  },
                }),
              )
              const entrypoint =
                worker.getEntrypoint() as unknown as SandboxEntrypoint
              return entrypoint.evaluate()
            },
            catch: (cause) => ToolError.fromCause(cause, 'sandbox'),
          })
          const log = yield* RequestLog
          log.apiRequests = requests
          if (error !== undefined) {
            return yield* new ToolError({ message: error, kind: 'script' })
          }
          return result ?? ''
        }),
      }),
    )
  }
}
