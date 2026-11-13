import { dirname, join, relative, resolve } from 'node:path'
import { Effect, type FileSystem, Schema } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  type ConfigDocument,
  ConfigExport,
  DEFAULT_CONFIG_FILES,
  type ExternalIdAssignment,
  type Format,
  ValidationErrors,
} from '@/schemas/BillingConfig'
import { apiUrl, withOrganization } from '@/services/api'
import {
  type Clients,
  importCatalogHint,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { type Unkeyed, unkeyed } from '@/utils/billing-config/keys'
import {
  exists,
  type Language,
  languageFor,
  LANGUAGES,
  projectRootFor,
  projectsAt,
  writableLanguageOf,
} from '@/services/billing-config/languages'

export interface InitTarget {
  readonly directory: string
  readonly file: string | undefined
  readonly format: Format | undefined
}

export interface Prepared {
  readonly file: string
  readonly format: Format
  readonly imported: Record<'meters' | 'benefits' | 'products', number>
  readonly keyed: ReadonlyArray<ExternalIdAssignment>
  readonly skipped: ConfigExport['skipped']
  readonly install: ReadonlyArray<string> | undefined
  readonly installDirectory: string | undefined
  readonly already_enabled: boolean
}

const EXPORT_SCOPES = [
  'organizations:read',
  'meters:read',
  'benefits:read',
  'products:read',
]

const UnsupportedResources = Schema.Struct({
  error: Schema.Literal('ConfigUnsupportedResources'),
  detail: Schema.String,
})

const unsupportedResources = (
  response: HttpClientResponse.HttpClientResponse,
  organization: ActiveOrganization,
) =>
  HttpClientResponse.schemaBodyJson(UnsupportedResources)(response).pipe(
    Effect.map(
      ({ detail }) =>
        new BillingConfigError({
          message: `Config cannot manage everything in ${organization.name} yet`,
          hint: detail,
        }),
    ),
    Effect.option,
  )

const exportConfig = (clients: Clients, organization: ActiveOrganization) =>
  Effect.gen(function* () {
    const response = yield* clients[organization.environment].execute(
      HttpClientRequest.get(
        yield* apiUrl(organization.environment, '/config/'),
      ).pipe(withOrganization(organization.id)),
    )
    if (response.status === 409) {
      const unsupported = yield* unsupportedResources(response, organization)
      if (unsupported._tag === 'Some') return yield* unsupported.value
    }
    if (response.status !== 200) {
      return yield* unexpected(response, organization, EXPORT_SCOPES)
    }
    return yield* HttpClientResponse.schemaBodyJson(ConfigExport)(response)
  }).pipe(
    Effect.scoped,
    Effect.catchTags({
      HttpClientError: transportErrors.HttpClientError,
      SchemaError: transportErrors.SchemaError,
    }),
  )

const SECTION_SCOPES = {
  meter: 'meters:write',
  benefit: 'benefits:write',
  product: 'products:write',
} as const

const rejected = (
  response: HttpClientResponse.HttpClientResponse,
  assignments: ReadonlyArray<ExternalIdAssignment>,
) =>
  HttpClientResponse.schemaBodyJson(ValidationErrors)(response).pipe(
    Effect.map(
      ({ detail }) =>
        new BillingConfigError({
          message: 'Could not save the external IDs',
          hint: detail
            .map(({ loc, msg }) => {
              const assignment =
                typeof loc[2] === 'number' ? assignments[loc[2]] : undefined
              return assignment
                ? `${assignment.external_id} (${assignment.resource} ${assignment.name}): ${msg}`
                : msg
            })
            .join(' '),
        }),
    ),
    Effect.orElseSucceed(
      () =>
        new BillingConfigError({ message: 'Could not save the external IDs' }),
    ),
  )

const enableConfig = (
  clients: Clients,
  organization: ActiveOrganization,
  assignments: ReadonlyArray<ExternalIdAssignment> = [],
) =>
  Effect.gen(function* () {
    const request = yield* HttpClientRequest.post(
      yield* apiUrl(organization.environment, '/config/init'),
    ).pipe(
      withOrganization(organization.id),
      HttpClientRequest.bodyJson({
        external_ids: assignments.map(({ resource, id, external_id }) => ({
          resource,
          id,
          external_id,
        })),
      }),
    )
    const response = yield* clients[organization.environment].execute(request)
    if (response.status === 422) {
      return yield* yield* rejected(response, assignments)
    }
    if (response.status === 409) {
      const unsupported = yield* unsupportedResources(response, organization)
      if (unsupported._tag === 'Some') return yield* unsupported.value
    }
    if (response.status !== 204) {
      return yield* unexpected(response, organization, [
        'organizations:write',
        ...new Set(assignments.map(({ resource }) => SECTION_SCOPES[resource])),
      ])
    }
  }).pipe(
    Effect.scoped,
    Effect.catchTags({
      HttpClientError: transportErrors.HttpClientError,
      HttpBodyError: transportErrors.HttpBodyError,
    }),
  )

const count = (document: ConfigDocument, section: string) => {
  const entries = document[section]
  return Array.isArray(entries) ? entries.length : 0
}

const display = (path: string) => relative(process.cwd(), path) || '.'

const alreadyExists = (path: string, organization: ActiveOrganization) =>
  new BillingConfigError({
    message: `${display(path)} already exists`,
    hint: importCatalogHint(organization),
  })

const resolveTarget = (
  fs: FileSystem.FileSystem,
  target: InitTarget,
  organization: ActiveOrganization,
) =>
  Effect.gen(function* () {
    if (target.file !== undefined) {
      const language = writableLanguageOf(target.file)
      if (language === undefined) {
        return yield* new BillingConfigError({
          message: `${target.file} is not a file init can write`,
          hint: `Use a ${LANGUAGES.map(({ extension }) => extension).join(', ')} path.`,
        })
      }
      if (target.format !== undefined && target.format !== language.format) {
        return yield* new BillingConfigError({
          message: `${target.file} is a ${language.extension} file, but --format is ${target.format}`,
          hint: 'Drop --format or change the file extension.',
        })
      }
      return { path: resolve(target.file), language }
    }
    for (const existing of DEFAULT_CONFIG_FILES) {
      const path = join(target.directory, existing)
      if (yield* exists(fs, path)) {
        return yield* alreadyExists(path, organization)
      }
    }
    const language =
      target.format !== undefined
        ? languageFor(target.format)
        : ((yield* projectsAt(fs, target.directory))[0]?.language ??
          languageFor('json'))
    return {
      path: join(target.directory, language.defaultFiles[0]!),
      language,
    }
  })

const write = (fs: FileSystem.FileSystem, path: string, content: string) =>
  fs.makeDirectory(dirname(path), { recursive: true }).pipe(
    Effect.andThen(fs.writeFileString(path, content)),
    Effect.mapError(
      (error) =>
        new BillingConfigError({
          message: `Could not write ${display(path)}`,
          hint:
            error.cause instanceof Error ? error.cause.message : error.message,
        }),
    ),
  )

const packageToInstall = (
  fs: FileSystem.FileSystem,
  language: Language,
  path: string,
) =>
  Effect.gen(function* () {
    const none = { install: undefined, installDirectory: undefined }
    const { installer } = language
    if (installer === undefined) return none
    const root = yield* projectRootFor(fs, dirname(path), language)
    if (root === undefined || (yield* installer.installed(fs, root))) {
      return none
    }
    return {
      install: yield* installer.command(fs, root),
      installDirectory: root,
    }
  })

export type NameResources<E, R> = (
  resources: ReadonlyArray<Unkeyed>,
  catalog: ConfigExport,
) => Effect.Effect<ReadonlyArray<ExternalIdAssignment>, E, R>

export const init =
  (fs: FileSystem.FileSystem, clients: Clients) =>
  <E, R>(
    organization: ActiveOrganization,
    target: InitTarget,
    name: NameResources<E, R>,
  ) =>
    Effect.gen(function* () {
      const { path, language } = yield* resolveTarget(fs, target, organization)
      if (yield* exists(fs, path)) {
        return yield* alreadyExists(path, organization)
      }
      let exported = yield* exportConfig(clients, organization)
      const alreadyEnabled = exported.enabled
      const keyed = yield* name(
        unkeyed(exported.config, exported.skipped),
        exported,
      )
      if (!alreadyEnabled || keyed.length > 0) {
        yield* enableConfig(clients, organization, keyed)
      }
      if (keyed.length > 0) {
        exported = yield* exportConfig(clients, organization)
      }
      yield* write(fs, path, yield* language.render(exported.config))
      return {
        file: display(path),
        format: language.format,
        imported: {
          meters: count(exported.config, 'meters'),
          benefits: count(exported.config, 'benefits'),
          products: count(exported.config, 'products'),
        },
        keyed,
        skipped: exported.skipped.filter(({ reason }) => reason !== 'archived'),
        already_enabled: alreadyEnabled,
        ...(yield* packageToInstall(fs, language, path)),
      } satisfies Prepared
    })
