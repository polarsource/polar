import { operations, schemas } from '@polar-sh/client'

export type BenefitUpdate =
  operations['benefits:update']['requestBody']['content']['application/json']

export const prepareBenefitUpdatePayload = (
  benefit: schemas['Benefit'],
  benefitUpdate: BenefitUpdate,
): BenefitUpdate => {
  const payload = { ...benefitUpdate }

  if (!benefit.visibility_configurable && 'visibility' in payload) {
    delete payload.visibility
  }

  return payload
}
