import { Context, Effect, Layer } from 'effect'
import { ToolError } from './results'

const SANDBOX_COMPATIBILITY_DATE = '2026-10-01'

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

export class Sandbox extends Context.Service<
  Sandbox,
  {
    readonly run: (options: SandboxOptions) => Effect.Effect<string, ToolError>
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
          const { result, error } = yield* Effect.tryPromise({
            try: () => {
              const worker = loader.get(
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
                }),
              )
              const entrypoint =
                worker.getEntrypoint() as unknown as SandboxEntrypoint
              return entrypoint.evaluate()
            },
            catch: ToolError.fromCause,
          })
          if (error !== undefined) {
            return yield* new ToolError({ message: error })
          }
          return result ?? ''
        }),
      }),
    )
  }
}
