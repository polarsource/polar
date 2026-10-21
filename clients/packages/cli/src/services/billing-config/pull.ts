import { dirname } from 'node:path'
import { Effect, type FileSystem } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  type ConfigDocument,
  ConfigExport,
  DEFAULT_CONFIG_FILES,
  type PullResult,
} from '@/schemas/BillingConfig'
import { apiUrl, withOrganization } from '@/services/api'
import {
  type Clients,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import type { loader } from '@/services/billing-config/load'
import {
  differences,
  externalIdOf,
  sectionsOf,
  settingsOf,
} from '@/utils/billing-config/compare'
import { record } from '@/utils/billing-config/describe'
import { renderDocument } from '@/utils/billing-config/document'

const IGNORED_KEYS = new Set(['organization_id'])

const DEFAULT_FILE = 'polar.config.ts'

type Loader = ReturnType<typeof loader>

const exportConfig = (clients: Clients, organization: ActiveOrganization) =>
  Effect.gen(function* () {
    const response = yield* clients[organization.environment].execute(
      HttpClientRequest.get(
        yield* apiUrl(organization.environment, '/config/'),
      ).pipe(withOrganization(organization.id)),
    )
    if (response.status !== 200) {
      return yield* unexpected(response, organization)
    }
    return yield* HttpClientResponse.schemaBodyJson(ConfigExport)(response)
  })

const loadDocument = (
  load: Loader,
  fs: FileSystem.FileSystem,
  file: string,
): Effect.Effect<ConfigDocument | undefined, BillingConfigError> =>
  Effect.gen(function* () {
    const exists = yield* fs
      .exists(file)
      .pipe(Effect.orElseSucceed(() => false))
    if (!exists) return undefined
    const config = yield* load(file)
    const input = config.input
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return yield* new BillingConfigError({
        message: `${file} does not contain a config object`,
        hint: 'Fix or remove the file, or pass --force to overwrite it.',
      })
    }
    const unexpected = Object.entries(input)
      .filter(
        ([key, value]) =>
          !Array.isArray(value) && key !== 'settings' && !IGNORED_KEYS.has(key),
      )
      .map(([key]) => key)
    if (unexpected.length > 0) {
      return yield* new BillingConfigError({
        message: `${file} has ${unexpected.length === 1 ? 'a field' : 'fields'} that ${unexpected.length === 1 ? 'is' : 'are'} not a config section: ${unexpected.join(', ')}`,
        hint: 'Fix or remove the file, or pass --force to overwrite it.',
      })
    }
    return Object.fromEntries(
      Object.entries(input).filter(
        ([key, items]) => Array.isArray(items) || key === 'settings',
      ),
    ) as ConfigDocument
  })

const settingsDocument = (settings: unknown): unknown => {
  const set = Object.entries(record(settings) ?? {}).flatMap(([key, value]) => {
    const kept = record(value) === undefined ? value : settingsDocument(value)
    return kept === null || kept === undefined ? [] : [[key, kept] as const]
  })
  return set.length > 0 ? Object.fromEntries(set) : undefined
}

const write = (fs: FileSystem.FileSystem, file: string, content: string) =>
  fs.makeDirectory(dirname(file), { recursive: true }).pipe(
    Effect.andThen(fs.writeFileString(file, content)),
    Effect.mapError(
      (error) =>
        new BillingConfigError({
          message: `Could not write ${file}`,
          hint:
            error.cause instanceof Error ? error.cause.message : error.message,
        }),
    ),
  )

const resolveFile = (fs: FileSystem.FileSystem) =>
  Effect.gen(function* () {
    for (const name of DEFAULT_CONFIG_FILES) {
      if (yield* fs.exists(name).pipe(Effect.orElseSucceed(() => false))) {
        return name
      }
    }
    return DEFAULT_FILE
  })

const entries = (document: ConfigDocument) => [
  ...Object.keys(settingsOf(document) ?? {}).map((group) => ({
    section: 'settings',
    id: group,
  })),
  ...sectionsOf(document).flatMap(([section, items]) =>
    items.map((item) => ({ section, id: externalIdOf(item) ?? section })),
  ),
]

export const pull =
  (fs: FileSystem.FileSystem, load: Loader, clients: Clients) =>
  (
    organization: ActiveOrganization,
    target: string | undefined,
    force: boolean,
  ) =>
    Effect.gen(function* () {
      const file = target ?? (yield* resolveFile(fs))
      const local = force ? undefined : yield* loadDocument(load, fs, file)
      const exported = yield* exportConfig(clients, organization)
      const settings = settingsDocument(exported.settings)
      const remote: ConfigDocument = {
        ...(settings !== undefined && { settings }),
        ...exported.config,
      }
      const differing = local === undefined ? [] : differences(local, remote)
      if (differing.length > 0) {
        return {
          status: 'conflict',
          file,
          entries: differing,
        } satisfies PullResult
      }
      yield* write(fs, file, yield* renderDocument(file, remote))
      return {
        status: 'written',
        file,
        entries: entries(remote),
        skipped: exported.skipped,
      } satisfies PullResult
    }).pipe(
      Effect.scoped,
      Effect.catchTags({
        HttpClientError: transportErrors.HttpClientError,
        SchemaError: transportErrors.SchemaError,
      }),
    )
