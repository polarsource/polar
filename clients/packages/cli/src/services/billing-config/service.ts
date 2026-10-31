import { Context, Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization, AuthError } from '@/schemas/Auth'
import type {
  ApplyResult,
  BillingConfigError,
  LoadedConfig,
  PlanResult,
  PruneEntry,
} from '@/schemas/BillingConfig'
import { apply } from '@/services/billing-config/apply'
import {
  init,
  type InitTarget,
  type Prepared,
  type Ran,
  run,
} from '@/services/billing-config/init'
import { loader } from '@/services/billing-config/load'
import { plan } from '@/services/billing-config/plan'
import { prune } from '@/services/billing-config/prune'
import { authenticatedClient } from '@/services/client'

export type {
  InitTarget,
  Prepared,
  Ran,
  Run,
} from '@/services/billing-config/init'

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
    init: (
      organization: ActiveOrganization,
      target: InitTarget,
    ) => Effect.Effect<Prepared, AuthError | BillingConfigError>
    install: (
      command: ReadonlyArray<string>,
      directory: string,
    ) => Effect.Effect<Ran>
    prune: <R>(
      config: LoadedConfig,
      organization: ActiveOrganization,
      confirm: (
        entries: ReadonlyArray<PruneEntry>,
      ) => Effect.Effect<void, BillingConfigError, R>,
    ) => Effect.Effect<
      { entries: ReadonlyArray<PruneEntry>; removed: boolean },
      AuthError | BillingConfigError,
      R
    >
  }
>()('BillingConfig') {}

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const clients = {
    sandbox: yield* authenticatedClient('sandbox'),
    production: yield* authenticatedClient('production'),
    local: yield* authenticatedClient('local'),
  }
  const load = loader(fs)
  return BillingConfig.of({
    load,
    plan: plan(clients),
    apply: apply(clients),
    init: init(fs, clients),
    install: run,
    prune: prune(fs, load, clients),
  })
})

export const layer = Layer.effect(BillingConfig, make)
