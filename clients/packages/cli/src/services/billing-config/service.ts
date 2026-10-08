import { Context, Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization, AuthError } from '@/schemas/Auth'
import type {
  ApplyResult,
  BillingConfigError,
  LoadedConfig,
  PlanResult,
  PullResult,
} from '@/schemas/BillingConfig'
import { apply } from '@/services/billing-config/apply'
import { loader } from '@/services/billing-config/load'
import { plan } from '@/services/billing-config/plan'
import { pull } from '@/services/billing-config/pull'
import { authenticatedClient } from '@/services/client'

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
    pull: (
      organization: ActiveOrganization,
      file: string | undefined,
      force: boolean,
    ) => Effect.Effect<PullResult, AuthError | BillingConfigError>
  }
>()('BillingConfig') {}

export const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const clients = {
    sandbox: yield* authenticatedClient('sandbox'),
    production: yield* authenticatedClient('production'),
  }
  const load = loader(fs)
  return BillingConfig.of({
    load,
    plan: plan(clients),
    apply: apply(clients),
    pull: pull(fs, load, clients),
  })
})

export const layer = Layer.effect(BillingConfig, make)
