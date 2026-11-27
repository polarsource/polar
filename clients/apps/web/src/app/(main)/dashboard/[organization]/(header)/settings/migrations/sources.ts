import { schemas } from '@polar-sh/client'

export type MigrationSource = schemas['MerchantMigrationSourcePlatform']
export type ConnectableSource = Extract<
  MigrationSource,
  'stripe' | 'lemon_squeezy'
>

export const SOURCE_LABELS: Record<MigrationSource, string> = {
  stripe: 'Stripe',
  lemon_squeezy: 'Lemon Squeezy',
  paddle: 'Paddle',
}

export const CONNECTABLE_SOURCES: ConnectableSource[] = [
  'stripe',
  'lemon_squeezy',
]

export function sourceAccountLabel(
  migration: schemas['MerchantMigration'],
): string | undefined {
  const source = migration.source
  if (!source) {
    return undefined
  }
  if (migration.source_platform === 'lemon_squeezy') {
    return (source.store_name ?? source.store_id) as string | undefined
  }
  return source.stripe_user_id as string | undefined
}
