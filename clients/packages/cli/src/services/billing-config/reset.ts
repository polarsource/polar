import { Effect, type FileSystem } from 'effect'
import type { ActiveOrganization } from '@/schemas/Auth'
import { BillingConfigError } from '@/schemas/BillingConfig'
import type { Clients } from '@/services/billing-config/api'
import { exportConfig, writeConfig } from '@/services/billing-config/init'
import {
  LANGUAGES,
  advised,
  writableLanguageOf,
} from '@/services/billing-config/languages'
import { findConfigFile } from '@/services/billing-config/load'
import { catalogs } from '@/services/billing-config/publish'

export interface ResetPending {
  readonly file: string
  readonly source: 'draft' | 'live'
}

export interface ResetResult extends ResetPending {
  readonly status: 'reset' | 'unchanged'
}

export type ApproveReset<E, R> = (
  pending: ResetPending,
) => Effect.Effect<void, E, R>

export const reset =
  (fs: FileSystem.FileSystem, clients: Clients) =>
  <E, R>(
    organization: ActiveOrganization,
    file: string | undefined,
    approve: ApproveReset<E, R>,
  ) =>
    Effect.gen(function* () {
      const path = yield* findConfigFile(fs, file)
      const language = writableLanguageOf(path)
      if (language === undefined) {
        return yield* new BillingConfigError({
          message: `${path} is not a file reset can write`,
          hint: `Use a ${LANGUAGES.map(({ extension }) => extension).join(' or ')} file.`,
        })
      }
      const { draft } = yield* catalogs(clients)(organization)
      const exported = yield* exportConfig(clients, organization, draft?.id)
      const content = yield* language
        .render(exported.config)
        .pipe(Effect.mapError(advised('Run polar update and try again.')))
      const pending: ResetPending = {
        file: path,
        source: draft === null ? 'live' : 'draft',
      }
      const current = yield* fs
        .readFileString(path)
        .pipe(Effect.orElseSucceed(() => undefined))
      if (current === content) {
        return { ...pending, status: 'unchanged' } satisfies ResetResult
      }
      yield* approve(pending)
      yield* writeConfig(fs, path, content)
      return { ...pending, status: 'reset' } satisfies ResetResult
    })
