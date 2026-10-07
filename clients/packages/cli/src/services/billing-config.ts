import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context, Effect, FileSystem, Layer } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import type {
  ActiveOrganization,
  AuthError,
  PolarEnvironment,
} from '@/schemas/Auth'
import {
  ApiError,
  type AppliedEntry,
  type ApplyResult,
  ApplyResponse,
  EntryResult,
  type PlanResult,
  PlanResponse,
  ServerError,
  BillingConfigError,
  type ConfigIssue,
  type LoadedConfig,
  type SourceLocation,
  ValidationErrors,
} from '@/schemas/BillingConfig'
import { apiUrl, describeApiFailure, withOrganization } from '@/services/api'
import { type ApiClient, authenticatedClient } from '@/services/client'

export class BillingConfig extends Context.Service<
  BillingConfig,
  {
    load: (file?: string) => Effect.Effect<LoadedConfig, BillingConfigError>
    plan: (
      config: LoadedConfig,
      organization: ActiveOrganization,
    ) => Effect.Effect<PlanResult, AuthError | BillingConfigError>
    apply: (
      config: LoadedConfig,
      organization: ActiveOrganization,
    ) => Effect.Effect<ApplyResult, AuthError | BillingConfigError>
  }
>()('BillingConfig') {}

type Path = ReadonlyArray<string | number>

const SCRIPT_EXTENSIONS = new Set([
  '.ts',
  '.mts',
  '.cts',
  '.js',
  '.mjs',
  '.cjs',
])

const DEFAULT_FILES = [
  'polar.config.ts',
  'polar.config.mts',
  'polar.config.cts',
  'polar.config.js',
  'polar.config.mjs',
  'polar.config.cjs',
  'polar.config.json',
  'polar.json',
]

const positionOf = (source: string, offset: number) => {
  const before = source.slice(0, offset)
  return {
    line: before.split('\n').length,
    column: offset - before.lastIndexOf('\n'),
  }
}

const KEY_ISSUES = new Set(['extra_forbidden'])

export const locate = (
  source: string,
  path: Path,
  target: 'key' | 'value' = 'value',
): SourceLocation | undefined => {
  let node = parseTree(source)
  if (!node) return undefined
  for (const segment of path) {
    node = findNodeAtLocation(node, [segment]) ?? node
  }
  const key = node.parent?.children?.[0]
  if (target === 'key' && node.parent?.type === 'property' && key) {
    node = key
  }
  const lineEnd = source.indexOf('\n', node.offset)
  const restOfLine = (lineEnd === -1 ? source.length : lineEnd) - node.offset
  return {
    ...positionOf(source, node.offset),
    length: Math.min(node.length, restOfLine),
  }
}

interface RawIssue {
  readonly code: string
  readonly path: Path
  readonly message: string
  readonly got?: unknown
}

const issue = (
  config: LoadedConfig,
  severity: ConfigIssue['severity'],
  raw: RawIssue,
): ConfigIssue => ({
  severity,
  code: raw.code,
  path: raw.path.join('.'),
  message: raw.message,
  got: raw.got === undefined ? undefined : JSON.stringify(raw.got),
  location: locate(
    config.source,
    raw.path,
    KEY_ISSUES.has(raw.code) ? 'key' : 'value',
  ),
})

const apiFailure = (status: number, environment: PolarEnvironment) => {
  const { message, hint } = describeApiFailure(status, environment)
  return new BillingConfigError({ message, hint })
}

export const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const clients: Record<PolarEnvironment, ApiClient> = {
    sandbox: yield* authenticatedClient('sandbox'),
    production: yield* authenticatedClient('production'),
  }

  const loadJson = (file: string) =>
    Effect.gen(function* () {
      const source = yield* fs
        .readFileString(file)
        .pipe(
          Effect.mapError(
            () => new BillingConfigError({ message: `Could not read ${file}` }),
          ),
        )
      const input = yield* Effect.try({
        try: () => JSON.parse(source) as unknown,
        catch: (error) =>
          new BillingConfigError({
            message: `${file} is not valid JSON`,
            hint: error instanceof Error ? error.message : String(error),
          }),
      })
      return { file, source, input, generated: false }
    })

  const loadScript = (file: string) =>
    Effect.gen(function* () {
      const exported = yield* Effect.tryPromise({
        try: async () => {
          const module = (await import(pathToFileURL(resolve(file)).href)) as {
            default?: unknown
          }
          return typeof module.default === 'function'
            ? ((await module.default()) as unknown)
            : module.default
        },
        catch: (error) =>
          new BillingConfigError({
            message: `Could not load ${file}`,
            hint: error instanceof Error ? error.message : String(error),
          }),
      })
      const source = JSON.stringify(exported, null, 2) as string | undefined
      if (source === undefined || !source.startsWith('{')) {
        return yield* new BillingConfigError({
          message: `${file} does not default export a billing config`,
          hint: 'Export the config object or a function returning it with `export default`.',
        })
      }
      return {
        file,
        source,
        input: JSON.parse(source) as unknown,
        generated: true,
      }
    })

  const findDefault = Effect.gen(function* () {
    for (const name of DEFAULT_FILES) {
      if (yield* fs.exists(name).pipe(Effect.orElseSucceed(() => false))) {
        return name
      }
    }
    return yield* new BillingConfigError({
      message: 'No billing config file found in the current directory',
      hint: `Looked for ${DEFAULT_FILES.join(', ')}. Pass a path to use another file.`,
    })
  })

  const load = (file?: string) =>
    Effect.gen(function* () {
      const resolved = file ?? (yield* findDefault)
      const extension = extname(resolved)
      if (SCRIPT_EXTENSIONS.has(extension)) return yield* loadScript(resolved)
      if (extension === '.json' || extension === '') {
        return yield* loadJson(resolved)
      }
      return yield* new BillingConfigError({
        message: `${resolved} is not a supported config file`,
        hint: `Use a .json, .ts or .js file.`,
      })
    })

  const issues = (config: LoadedConfig, detail: (typeof ServerError.Type)[]) =>
    detail.map((error) =>
      issue(config, error.severity ?? 'error', {
        code: error.type,
        path: error.loc[0] === 'body' ? error.loc.slice(1) : error.loc,
        message: error.msg,
        got: error.input,
      }),
    )

  const entries = (
    section: string,
    results: ReadonlyArray<typeof EntryResult.Type>,
  ) =>
    results.map(
      (entry): AppliedEntry => ({
        section,
        id: entry.external_id ?? section,
        action: entry.action,
      }),
    )

  const post = (
    path: string,
    config: LoadedConfig,
    organization: ActiveOrganization,
  ) =>
    Effect.gen(function* () {
      const request = yield* HttpClientRequest.post(
        yield* apiUrl(organization.environment, path),
      ).pipe(
        withOrganization(organization.id),
        HttpClientRequest.bodyJson(config.input),
      )
      return yield* clients[organization.environment].execute(request)
    })

  const errorName = (response: HttpClientResponse.HttpClientResponse) =>
    HttpClientResponse.schemaBodyJson(ApiError)(response).pipe(
      Effect.map(({ error }) => error),
      Effect.orElseSucceed(() => undefined),
    )

  const unexpected = (
    response: HttpClientResponse.HttpClientResponse,
    organization: ActiveOrganization,
    scope: string,
  ) =>
    Effect.gen(function* () {
      const error = yield* errorName(response)
      if (response.status === 409) {
        return yield* new BillingConfigError({
          message: 'Another request changed this config at the same time',
          hint: 'Run the command again.',
        })
      }
      if (response.status === 403 && error === 'ConfigAsCodeNotEnabled') {
        return yield* new BillingConfigError({
          message: `Config is not enabled for ${organization.name}`,
          hint: 'Ask Polar to enable it for your organization.',
        })
      }
      if (response.status === 403) {
        return yield* new BillingConfigError({
          message: `You do not have access to ${organization.name}`,
          hint: `The token needs the ${scope} scope.`,
        })
      }
      if (response.status === 404) {
        return yield* new BillingConfigError({
          message: `Config commands are not available in ${organization.environment} yet`,
          hint: 'The API is still rolling out. Try again later.',
        })
      }
      return yield* apiFailure(response.status, organization.environment)
    })

  const plan = (config: LoadedConfig, organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const response = yield* post('/config/plan', config, organization)
      if (response.status === 200) {
        const body =
          yield* HttpClientResponse.schemaBodyJson(PlanResponse)(response)
        return {
          entries: entries('meters', body.changes),
          issues: issues(config, [...body.issues]),
        } satisfies PlanResult
      }
      if (response.status === 422) {
        const { detail } =
          yield* HttpClientResponse.schemaBodyJson(ValidationErrors)(response)
        return {
          entries: [],
          issues: issues(config, [...detail]),
        } satisfies PlanResult
      }
      return yield* unexpected(response, organization, 'meters:read')
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: (error) =>
          new BillingConfigError({
            message: 'Could not reach the Polar API',
            hint: error.message,
          }),
        HttpBodyError: () =>
          new BillingConfigError({ message: 'Could not encode the config' }),
        SchemaError: () =>
          new BillingConfigError({
            message: 'Unexpected response from the API',
          }),
      }),
    )

  const apply = (config: LoadedConfig, organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const response = yield* post('/config/apply', config, organization)
      if (response.status === 200) {
        const sections =
          yield* HttpClientResponse.schemaBodyJson(ApplyResponse)(response)
        return {
          status: 'applied',
          entries: Object.entries(sections).flatMap(([section, result]) =>
            entries(section, Array.isArray(result) ? result : [result]),
          ),
        } satisfies ApplyResult
      }
      const invalid =
        response.status === 422 ||
        (response.status === 409 &&
          (yield* errorName(response)) === 'ConfigInvalid')
      if (invalid) {
        const { detail } =
          yield* HttpClientResponse.schemaBodyJson(ValidationErrors)(response)
        return {
          status: 'rejected',
          issues: issues(config, [...detail]),
        } satisfies ApplyResult
      }
      return yield* unexpected(response, organization, 'meters:write')
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: (error) =>
          new BillingConfigError({
            message: 'Could not reach the Polar API',
            hint: error.message,
          }),
        HttpBodyError: () =>
          new BillingConfigError({ message: 'Could not encode the config' }),
        SchemaError: () =>
          new BillingConfigError({
            message: 'Unexpected response from the API',
          }),
      }),
    )

  return BillingConfig.of({ load, plan, apply })
})

export const layer = Layer.effect(BillingConfig, make)
