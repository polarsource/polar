import { errors, type models, type Polar } from '../../sdk'
import { getDeployedMeter } from './meters'
import type { CustomerIdentifier } from './utils'

export type CustomerMeterCredit = {
  units: number
  rollover: boolean
  externalId?: string | undefined
}

export const creditCustomerMeter = async (
  sdk: Polar,
  identifier: CustomerIdentifier,
  externalMeterId: string,
  { units, rollover, externalId }: CustomerMeterCredit,
): Promise<models.MeterCreditEvent> => {
  const credit = {
    units,
    rollover,
    ...(externalId !== undefined ? { external_id: externalId } : {}),
  }
  // Polar IDs and external IDs can't be mixed in one credit request
  if ('customer_id' in identifier) {
    const meter = await getDeployedMeter(sdk, externalMeterId)
    return sdk.customerMeters.credits({
      ...identifier,
      meter_id: meter.id,
      ...credit,
    })
  }

  try {
    return await sdk.customerMeters.credits({
      ...identifier,
      external_meter_id: externalMeterId,
      ...credit,
    })
  } catch (error) {
    if (
      error instanceof errors.HTTPValidationError &&
      error.error.detail?.some(({ loc }) => loc.at(-1) === 'external_meter_id')
    ) {
      throw new Error(
        `Meter ${JSON.stringify(externalMeterId)} is not deployed in this environment.`,
      )
    }
    throw error
  }
}

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
