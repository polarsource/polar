import { Context, Effect, FileSystem, Layer } from 'effect'
import type { ActiveOrganization, AuthError } from '@/schemas/Auth'
import type {
  ApplyResult,
  BillingConfigError,
  Catalog,
  Catalogs,
  LoadedConfig,
  PlanResult,
  PruneEntry,
} from '@/schemas/BillingConfig'
import type { CatalogOptions } from '@/services/billing-config/api'
import { apply } from '@/services/billing-config/apply'
import { disable } from '@/services/billing-config/disable'
import {
  init,
  type InitTarget,
  type NameResources,
  type Prepared,
  type Ran,
  run,
} from '@/services/billing-config/init'
import { loader } from '@/services/billing-config/load'
import { plan } from '@/services/billing-config/plan'
import { prune } from '@/services/billing-config/prune'
import { catalogs, publish } from '@/services/billing-config/publish'
import { authenticatedClient } from '@/services/client'

export type {
  InitTarget,
  NameResources,
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
      options?: CatalogOptions,
    ) => Effect.Effect<PlanResult, AuthError | BillingConfigError>
    apply: (
      config: LoadedConfig,
      organization: ActiveOrganization,
      options?: CatalogOptions,
    ) => Effect.Effect<ApplyResult, AuthError | BillingConfigError>
    init: <E, R>(
      organization: ActiveOrganization,
      target: InitTarget,
      name: NameResources<E, R>,
    ) => Effect.Effect<Prepared, AuthError | BillingConfigError | E, R>
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
    catalogs: (
      organization: ActiveOrganization,
    ) => Effect.Effect<Catalogs, AuthError | BillingConfigError>
    publish: (
      organization: ActiveOrganization,
      draft: Catalog,
    ) => Effect.Effect<Catalog, AuthError | BillingConfigError>
    disable: (
      organization: ActiveOrganization,
    ) => Effect.Effect<void, AuthError | BillingConfigError>
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
    catalogs: catalogs(clients),
    publish: publish(clients),
    disable: disable(clients),
  })
})

export const layer = Layer.effect(BillingConfig, make)
