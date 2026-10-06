import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context, Effect, FileSystem, Layer } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'
import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import type {
  ActiveOrganization,
  AuthError,
  PolarEnvironment,
} from '@/schemas/Auth'
import {
  ApiError,
  ConfigError,
  ConfigValidation,
  RequestValidationError,
  ServerIssue as ServerIssueSchema,
  type ConfigIssue,
  type LoadedConfig,
  type SourceLocation,
} from '@/schemas/Config'
import { apiUrl, describeApiFailure, withOrganization } from '@/services/api'
import { type ApiClient, authenticatedClient } from '@/services/client'

export class Config extends Context.Service<
  Config,
  {
    load: (file?: string) => Effect.Effect<LoadedConfig, ConfigError>
    validate: (
      config: LoadedConfig,
      organization: ActiveOrganization,
    ) => Effect.Effect<ConfigIssue[], AuthError | ConfigError>
  }
>()('Config') {}

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

export const locate = (
  source: string,
  path: Path,
): SourceLocation | undefined => {
  let node = parseTree(source)
  if (!node) return undefined
  for (const segment of path) {
    node = findNodeAtLocation(node, [segment]) ?? node
  }
  const lineEnd = source.indexOf('\n', node.offset)
  const restOfLine = (lineEnd === -1 ? source.length : lineEnd) - node.offset
  return {
    ...positionOf(source, node.offset),
    length: Math.min(node.length, restOfLine),
  }
}

type ServerIssue = typeof ServerIssueSchema.Type

const toConfigIssue = (
  config: LoadedConfig,
  issue: ServerIssue,
): ConfigIssue => {
  const path = issue.loc[0] === 'body' ? issue.loc.slice(1) : issue.loc
  return {
    severity: issue.severity,
    code: issue.type,
    path: path.join('.'),
    message: issue.msg,
    got: issue.input === undefined ? undefined : JSON.stringify(issue.input),
    location: locate(config.source, path),
  }
}

const apiFailure = (status: number, environment: PolarEnvironment) => {
  const { message, hint } = describeApiFailure(status, environment)
  return new ConfigError({ message, hint })
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
            () => new ConfigError({ message: `Could not read ${file}` }),
          ),
        )
      const input = yield* Effect.try({
        try: () => JSON.parse(source) as unknown,
        catch: (error) =>
          new ConfigError({
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
          new ConfigError({
            message: `Could not load ${file}`,
            hint: error instanceof Error ? error.message : String(error),
          }),
      })
      const source = JSON.stringify(exported, null, 2) as string | undefined
      if (source === undefined || !source.startsWith('{')) {
        return yield* new ConfigError({
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
    return yield* new ConfigError({
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
      return yield* new ConfigError({
        message: `${resolved} is not a supported config file`,
        hint: `Use a .json, .ts or .js file.`,
      })
    })

  const validate = (config: LoadedConfig, organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const { environment } = organization
      const request = yield* HttpClientRequest.post(
        yield* apiUrl(environment, '/config/validate'),
      ).pipe(
        withOrganization(organization.id),
        HttpClientRequest.bodyJson(config.input),
      )
      const response = yield* clients[environment].execute(request)
      if (response.status === 403) {
        const { error } = yield* HttpClientResponse.schemaBodyJson(ApiError)(
          response,
        ).pipe(Effect.orElseSucceed(() => ({ error: undefined })))
        if (error === 'ConfigAsCodeNotEnabled') {
          return yield* new ConfigError({
            message: `Config is not enabled for ${organization.name}`,
            hint: 'Ask Polar to enable it for your organization.',
          })
        }
        return yield* new ConfigError({
          message: `You do not have access to ${organization.name}`,
          hint: 'The token needs the meters:read or meters:write scope.',
        })
      }
      if (response.status === 422) {
        const { detail } = yield* HttpClientResponse.schemaBodyJson(
          RequestValidationError,
        )(response)
        return detail.map((error) =>
          toConfigIssue(config, { ...error, severity: 'error' }),
        )
      }
      if (response.status !== 200) {
        return yield* apiFailure(response.status, environment)
      }
      const { issues } =
        yield* HttpClientResponse.schemaBodyJson(ConfigValidation)(response)
      return issues.map((issue) => toConfigIssue(config, issue))
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: (error) =>
          new ConfigError({
            message: 'Could not reach the Polar API',
            hint: error.message,
          }),
        HttpBodyError: () =>
          new ConfigError({ message: 'Could not encode the config' }),
        SchemaError: () =>
          new ConfigError({
            message: 'Unexpected response from the API',
          }),
      }),
    )

  return Config.of({ load, validate })
})

export const layer = Layer.effect(Config, make)
