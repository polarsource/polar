import { Context, Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization, AuthError } from '@/schemas/Auth'
import type {
  ApplyResult,
  BillingConfigError,
  LoadedConfig,
  PlanResult,
} from '@/schemas/BillingConfig'
import { apply } from '@/services/billing-config/apply'
import { loader } from '@/services/billing-config/load'
import { plan } from '@/services/billing-config/plan'
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
  }
>()('BillingConfig') {}

export const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const clients = {
    sandbox: yield* authenticatedClient('sandbox'),
    production: yield* authenticatedClient('production'),
  }
  return BillingConfig.of({
    load: loader(fs),
    plan: plan(clients),
    apply: apply(clients),
  })
})

export const layer = Layer.effect(BillingConfig, make)
