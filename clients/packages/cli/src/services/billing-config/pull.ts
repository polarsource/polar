import { extname } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { Effect, type FileSystem } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  type LoadedConfig,
  type PulledConfig,
  PullResponse,
  type SaveStatus,
} from '@/schemas/BillingConfig'
import { apiUrl, withOrganization } from '@/services/api'
import {
  type Clients,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { DEFAULT_FILES } from '@/services/billing-config/load'

const DEFAULT_TARGET = 'polar.config.json'
const ESM_EXTENSIONS = new Set(['.ts', '.mts', '.js', '.mjs'])
const CJS_EXTENSIONS = new Set(['.cts', '.cjs'])

export const pull = (clients: Clients) => (organization: ActiveOrganization) =>
  Effect.gen(function* () {
    const request = HttpClientRequest.get(
      yield* apiUrl(organization.environment, '/config/'),
    ).pipe(withOrganization(organization.id))
    const response = yield* clients[organization.environment].execute(request)
    if (response.status === 200) {
      return yield* HttpClientResponse.schemaBodyJson(PullResponse)(response)
    }
    return yield* unexpected(response, organization, 'meters:read')
  }).pipe(
    Effect.scoped,
    Effect.catchTags({
      HttpClientError: transportErrors.HttpClientError,
      SchemaError: transportErrors.SchemaError,
    }),
  )

const render = (file: string, config: PulledConfig) =>
  Effect.gen(function* () {
    const json = JSON.stringify(config, null, 2)
    const extension = extname(file)
    if (extension === '.json' || extension === '') return `${json}\n`
    if (ESM_EXTENSIONS.has(extension)) return `export default ${json}\n`
    if (CJS_EXTENSIONS.has(extension)) return `module.exports = ${json}\n`
    return yield* new BillingConfigError({
      message: `Cannot write a config to ${file}`,
      hint: 'Use a .json, .ts or .js file.',
    })
  })

export const saver =
  (
    fs: FileSystem.FileSystem,
    load: (file: string) => Effect.Effect<LoadedConfig, BillingConfigError>,
  ) =>
  (
    file: string | undefined,
    config: PulledConfig,
    force: boolean,
  ): Effect.Effect<{ file: string; status: SaveStatus }, BillingConfigError> =>
    Effect.gen(function* () {
      const exists = (name: string) =>
        fs.exists(name).pipe(Effect.orElseSucceed(() => false))
      let target = file
      if (target === undefined) {
        for (const name of DEFAULT_FILES) {
          if (yield* exists(name)) {
            target = name
            break
          }
        }
      }
      target ??= DEFAULT_TARGET
      const contents = yield* render(target, config)
      if (yield* exists(target)) {
        const current = yield* load(target).pipe(
          Effect.map((loaded) => loaded.input),
          Effect.orElseSucceed(() => undefined),
        )
        if (isDeepStrictEqual(current, config)) {
          return { file: target, status: 'unchanged' }
        }
        if (!force) {
          return yield* new BillingConfigError({
            message: `${target} already exists`,
            hint: 'Run `polar config plan` to see how it differs from your organization, or pass --force to overwrite it.',
          })
        }
      }
      yield* fs
        .writeFileString(target, contents)
        .pipe(
          Effect.mapError(
            () =>
              new BillingConfigError({ message: `Could not write ${target}` }),
          ),
        )
      return { file: target, status: 'written' }
    })
