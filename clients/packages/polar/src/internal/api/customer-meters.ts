import type { models, Polar } from '../../sdk'
import type { CustomerIdentifier } from './utils'

export type CreditedMeter = {
  id: string
  externalId: string
}

export type CustomerMeterCredit = {
  units: number
  rollover: boolean
  externalId?: string | undefined
}

export const creditCustomerMeter = (
  sdk: Polar,
  identifier: CustomerIdentifier,
  meter: CreditedMeter,
  { units, rollover, externalId }: CustomerMeterCredit,
): Promise<models.MeterCreditEvent> =>
  sdk.customerMeters.credits({
    // Polar IDs and external IDs can't be mixed in one credit request
    ...('customer_id' in identifier
      ? { ...identifier, meter_id: meter.id }
      : { ...identifier, external_meter_id: meter.externalId }),
    units,
    rollover,
    ...(externalId !== undefined ? { external_id: externalId } : {}),
  })
