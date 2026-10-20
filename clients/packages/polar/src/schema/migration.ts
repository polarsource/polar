import { Schema } from 'effect'

export const MigrationConfig = Schema.Struct({
  external_id: Schema.String.check(Schema.isMinLength(1)),
  subscriptions_of: Schema.String,
  to_catalog: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  to_product: Schema.optionalKey(Schema.String),
  at: Schema.Literal('next_period'),
})

export type MigrationConfig = typeof MigrationConfig.Type

export class SubscriptionMigration<Product extends string = string> {
  constructor(
    readonly source: Product,
    readonly catalog?: number,
    readonly target?: Product,
  ) {}

  allCustomers(): SubscriptionMigration<Product> {
    return this
  }

  toCatalog(version: number): SubscriptionMigration<Product> {
    return new SubscriptionMigration(this.source, version, this.target)
  }

  toProduct(product: Product): SubscriptionMigration<Product> {
    return new SubscriptionMigration(this.source, this.catalog, product)
  }

  atNextRenewal(): SubscriptionMigration<Product> {
    return this
  }
}

export type MigrationDefinition<Product extends string = string> =
  SubscriptionMigration<Product>

export interface MigrationHelpers<Product extends string = string> {
  readonly migrate: {
    readonly subscriptionsOf: (
      product: Product,
    ) => SubscriptionMigration<Product>
  }
}

export const migrationHelpers = <
  Product extends string,
>(): MigrationHelpers<Product> => ({
  migrate: {
    subscriptionsOf: (product) => new SubscriptionMigration(product),
  },
})

export const migrationConfig = (
  external_id: string,
  migration: MigrationDefinition,
): MigrationConfig => {
  if (migration.catalog === undefined) {
    throw new Error(
      `Migration "${external_id}" needs a target catalog. Call .toCatalog().`,
    )
  }
  return {
    external_id,
    subscriptions_of: migration.source,
    to_catalog: migration.catalog,
    ...(migration.target !== undefined && { to_product: migration.target }),
    at: 'next_period',
  }
}
