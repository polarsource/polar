import { operations, schemas } from '@polar-sh/client'
import { isBenefitVisibilityConfigurable } from './utils'

export type BenefitUpdate =
  operations['benefits:update']['requestBody']['content']['application/json']

export const prepareBenefitUpdatePayload = (
  benefit: schemas['Benefit'],
  benefitUpdate: BenefitUpdate,
): BenefitUpdate => {
  const payload = { ...benefitUpdate }

  if (
    !isBenefitVisibilityConfigurable(benefit.type) &&
    'visibility' in payload
  ) {
    delete payload.visibility
  }

  return payload
}
