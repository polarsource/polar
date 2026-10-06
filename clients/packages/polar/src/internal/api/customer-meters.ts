import type { models, Polar } from '../../sdk'
import type { CustomerIdentifier } from './utils'

export const getCustomerMeter = async (
  sdk: Polar,
  identifier: CustomerIdentifier,
  meterId: string,
): Promise<models.CustomerMeter | undefined> => {
  const response = await sdk.customerMeters.list({
    ...identifier,
    meter_id: meterId,
  })

  return response.items[0]
}
