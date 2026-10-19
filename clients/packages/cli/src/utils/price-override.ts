import { Effect } from 'effect'
import { BillingConfigError, type LoadedConfig } from '@/schemas/BillingConfig'
import { minorUnits, record } from '@/utils/billing-config/describe'

const SET = /^([^=]+)\.([a-z]{3})=(\d+(?:\.\d+)?)$/i

const items = (input: unknown, key: string) => {
  const value = record(input)?.[key]
  return (Array.isArray(value) ? value : [])
    .map(record)
    .filter((item) => item !== undefined)
}

export const setPrices = (
  config: LoadedConfig,
  sets: ReadonlyArray<string>,
): Effect.Effect<LoadedConfig, BillingConfigError> =>
  Effect.gen(function* () {
    const input = structuredClone(config.input)
    for (const set of sets) {
      const match = SET.exec(set)
      if (match === null) {
        return yield* new BillingConfigError({
          message: `Invalid --set "${set}"`,
          hint: 'Use the form product.currency=amount, e.g. --set starter.usd=15',
        })
      }
      const [, id = '', currency = '', amount = ''] = match
      const code = currency.toUpperCase()
      const product = items(input, 'products').find(
        (item) => item['external_id'] === id,
      )
      if (product === undefined) {
        return yield* new BillingConfigError({
          message: `${config.file} has no product "${id}"`,
        })
      }
      const price = items(product, 'prices').find(
        (item) =>
          item['amount_type'] === 'fixed' &&
          String(item['price_currency']).toUpperCase() === code,
      )
      if (price === undefined) {
        return yield* new BillingConfigError({
          message: `${id} has no fixed ${code} price in ${config.file}`,
        })
      }
      price['price_amount'] = Math.round(
        Number(amount) * 10 ** minorUnits(code),
      )
    }
    return { ...config, input }
  })
