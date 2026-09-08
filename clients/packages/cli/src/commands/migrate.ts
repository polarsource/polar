import { Effect } from 'effect'
import { Command, Flag, Prompt } from 'effect/unstable/cli'
import {
  apiKeyPrompt,
  migrationPrompt,
  providerPrompt,
  storePrompt,
} from '../prompts/migration'
import { organizationPrompt } from '../prompts/organizations'
import {
  MigrationContext,
  MigrationDestination,
  MigrationOrigin,
} from '../schemas/Migration'
import * as LemonSqueezy from '../services/migration/lemon/provider'
import * as Migration from '../services/migration/migrate'

export const migrate = Command.make('migrate', {}, () =>
  Effect.gen(function* () {
    const provider = yield* Prompt.all([providerPrompt, apiKeyPrompt]).pipe(
      Prompt.run,
      Effect.flatMap(([provider, apiKey]) => resolveProvider(provider, apiKey)),
    )

    const migration = yield* Migration.Migration

    const storeToMigrate = yield* storePrompt(provider)
    const entitiesToMigrate = yield* migrationPrompt
    const organizationId = yield* organizationPrompt()

    const migrationContext = MigrationContext.make({
      from: MigrationOrigin.make(storeToMigrate),
      to: MigrationDestination.make(organizationId),
    })

    yield* Effect.all(
      {
        products: entitiesToMigrate.includes('products')
          ? migration.products(provider, migrationContext)
          : Effect.succeed([]),
        customers: entitiesToMigrate.includes('customers')
          ? migration.customers(provider, migrationContext)
          : Effect.succeed([]),
      },
      {
        concurrency: 'unbounded',
      },
    )
  }),
)

export const LemonSqueezyAPIKey = Flag.redacted('lemonSqueezyAPIKey')

const resolveProvider = (
  provider: 'lemonSqueezy' | 'paddle' | 'stripe',
  apiKey: string,
) => {
  switch (provider) {
    case 'lemonSqueezy':
      return LemonSqueezy.make(apiKey)
    default:
      return Effect.die('Unsupported Migration Provider')
  }
}
