import { basename, dirname, extname, join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { Effect, type FileSystem } from 'effect'
import { HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  type LoadedConfig,
  type PruneEntry,
  PruneResponse,
} from '@/schemas/BillingConfig'
import {
  type Clients,
  post,
  requiredScopes,
  SECTIONS,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import type { loader } from '@/services/billing-config/load'
import {
  type Removal,
  removeFromJson,
  removeFromScript,
} from '@/services/billing-config/remove'
import { removable } from '@/utils/billing-config/prune'

const check = (
  clients: Clients,
  config: LoadedConfig,
  organization: ActiveOrganization,
) =>
  Effect.gen(function* () {
    const response = yield* post(clients, '/config/prune', config, organization)
    if (response.status === 200) {
      const body =
        yield* HttpClientResponse.schemaBodyJson(PruneResponse)(response)
      return body.entries
    }
    if (response.status === 422) {
      return yield* new BillingConfigError({
        message: `${config.file} is not a valid config`,
        hint: 'Run polar config plan to see what to fix.',
      })
    }
    return yield* unexpected(
      response,
      organization,
      requiredScopes(config, 'read'),
    )
  }).pipe(Effect.scoped, Effect.catchTags(transportErrors))

const writeConfig = (
  fs: FileSystem.FileSystem,
  file: string,
  content: string,
) =>
  fs.writeFileString(file, content).pipe(
    Effect.mapError(
      (error) =>
        new BillingConfigError({
          message: `Could not write ${file}`,
          hint: error.message,
        }),
    ),
  )

const withoutRemovals = (input: unknown, removals: ReadonlyArray<Removal>) =>
  Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([section, items]) => [
      section,
      Array.isArray(items)
        ? items.filter(
            (item: { external_id?: unknown }) =>
              !removals.some(
                (removal) =>
                  removal.section === section &&
                  removal.id === item?.external_id,
              ),
          )
        : items,
    ]),
  )

// Loads the edited script from a sibling file, so relative imports resolve and the module cache can't return the old config
const loadEdited = (
  fs: FileSystem.FileSystem,
  load: ReturnType<typeof loader>,
  config: LoadedConfig,
  source: string,
) =>
  Effect.gen(function* () {
    if (!config.generated) {
      return yield* Effect.try({
        try: () => JSON.parse(source) as unknown,
        catch: (error) => new BillingConfigError({ message: String(error) }),
      })
    }
    const extension = extname(config.file)
    const draft = join(
      dirname(config.file),
      `.${basename(config.file, extension)}.prune-${Date.now()}${extension}`,
    )
    yield* writeConfig(fs, draft, source)
    const edited = yield* load(draft).pipe(
      Effect.ensuring(fs.remove(draft, { force: true }).pipe(Effect.ignore)),
    )
    return edited.input
  })

const remove = (
  fs: FileSystem.FileSystem,
  load: ReturnType<typeof loader>,
  config: LoadedConfig,
  entries: ReadonlyArray<PruneEntry>,
) =>
  Effect.gen(function* () {
    const removals = entries.map((entry) => ({
      section: SECTIONS[entry.resource],
      id: entry.external_id,
    }))
    const { source, missing } = config.generated
      ? removeFromScript(config.source, removals)
      : removeFromJson(config.source, config.input, removals)
    if (missing.length > 0) {
      return yield* new BillingConfigError({
        message: `Could not find ${missing.map(({ id }) => id).join(', ')} in ${config.file}, nothing removed`,
        hint: 'Remove the entries by hand.',
      })
    }
    const unsafe = new BillingConfigError({
      message: `Could not remove ${removals.map(({ id }) => id).join(', ')} from ${config.file} safely, nothing removed`,
      hint: 'Remove the entries by hand.',
    })
    const edited = yield* loadEdited(fs, load, config, source).pipe(
      Effect.mapError(() => unsafe),
    )
    if (!isDeepStrictEqual(edited, withoutRemovals(config.input, removals))) {
      return yield* unsafe
    }
    const current = yield* fs
      .readFileString(config.file)
      .pipe(Effect.orElseSucceed(() => undefined))
    if (current !== config.source) {
      return yield* new BillingConfigError({
        message: `${config.file} changed while pruning, nothing removed`,
        hint: 'Run prune again.',
      })
    }
    yield* writeConfig(fs, config.file, source)
  })

/**
 * Removes the deprecated entries no customer uses from the config file, after
 * `confirm` sees every deprecated entry. `confirm` fails to cancel.
 */
export const prune =
  (
    fs: FileSystem.FileSystem,
    load: ReturnType<typeof loader>,
    clients: Clients,
  ) =>
  <R>(
    config: LoadedConfig,
    organization: ActiveOrganization,
    confirm: (
      entries: ReadonlyArray<PruneEntry>,
    ) => Effect.Effect<void, BillingConfigError, R>,
  ) =>
    Effect.gen(function* () {
      const entries = yield* check(clients, config, organization)
      const unused = entries.filter(removable)
      if (unused.length === 0) return { entries, removed: false }
      yield* confirm(entries)
      yield* remove(fs, load, config, unused)
      return { entries, removed: true }
    })
