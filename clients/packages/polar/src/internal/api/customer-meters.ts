import type { models, Polar } from '../../sdk'
import type { CustomerIdentifier } from './utils'

export const getCustomerMeter = async (
  sdk: Polar,
  identifier: CustomerIdentifier,
  externalMeterId: string,
): Promise<models.CustomerMeter | undefined> => {
  const { items } = await sdk.customerMeters.list({
    ...identifier,
    external_meter_id: externalMeterId,
    limit: 2,
  })
  if (items.length > 1) {
    throw new Error(
      `Meter external ID ${JSON.stringify(externalMeterId)} is ambiguous. Use an organization-scoped token.`,
    )
  }
  return items[0]
}
