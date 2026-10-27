import { Context, Effect, Layer } from 'effect'
import { RequestLog } from './log'
import { ToolError } from './results'
import { operationFor, redactPath, rejectedFields } from './spec'

const SANDBOX_COMPATIBILITY_DATE = '2026-10-01'

const ERROR_NAME =
  /^(?:(?:[A-Z][A-Za-z]{0,30})?Error|string|number|boolean|object|undefined|symbol|bigint|function)$/

const ENGINE_ERRORS = new Set([
  'TypeError',
  'ReferenceError',
  'SyntaxError',
  'RangeError',
])

interface SandboxCall {
  method: string
  url: string
  status: number
}

interface SandboxEntrypoint {
  evaluate(): Promise<{
    result?: string
    error?: string
    errorName?: string
    status?: number
    body?: unknown
    requests?: number
    calls?: SandboxCall[]
  }>
}

interface SandboxOptions {
  code: string
  prelude: string
  modules?: WorkerLoaderWorkerCode['modules']
  globalOutbound: Fetcher | null
  limits?: WorkerLoaderWorkerCode['limits']
  recordScriptErrors?: boolean
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
          recordScriptErrors,
        }: SandboxOptions) {
          const evaluation = yield* Effect.tryPromise({
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
let __requests = 0
const __calls = []
const fetch = async (...args) => {
  __requests++
  const [input, init] = args
  const call = {
    method: String(init?.method ?? input?.method ?? 'GET').toUpperCase(),
    url: String(input?.url ?? input),
    status: 0,
  }
  __calls.push(call)
  const response = await globalThis.fetch(...args)
  call.status = response.status
  return response
}
${prelude}

export default class Sandbox extends WorkerEntrypoint {
  async evaluate() {
    try {
      const result = await (${code})()
      return { result: JSON.stringify(result) ?? String(result), requests: __requests, calls: __calls }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        status: typeof error?.status === 'number' ? error.status : undefined,
        body: error?.body,
        requests: __requests,
        calls: __calls,
      }
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
          const { result, error, errorName, status, body, requests, calls } =
            evaluation
          const log = yield* RequestLog
          log.apiRequests = requests
          for (const call of calls ?? []) {
            if (!URL.canParse(call?.url)) {
              continue
            }
            const { pathname } = new URL(call.url)
            const operation = operationFor(call.method, pathname)
            if (operation) {
              ;(log.apiOperations ??= []).push(
                `${call.method} ${operation} ${call.status}`,
              )
            } else {
              ;(log.unexposedOperations ??= []).push(
                `${call.method} ${redactPath(pathname)}`,
              )
            }
          }
          if (error !== undefined && status !== undefined) {
            const fields = rejectedFields(body)
            return yield* new ToolError({
              message: error,
              kind: 'api',
              status,
              ...(fields && { fields }),
            })
          }
          if (error !== undefined) {
            if (errorName && ERROR_NAME.test(errorName)) {
              log.scriptError = errorName
            }
            if (recordScriptErrors && ENGINE_ERRORS.has(errorName ?? '')) {
              log.errorMessage = error
            }
            return yield* new ToolError({ message: error, kind: 'script' })
          }
          return result ?? ''
        }),
      }),
    )
  }
}
