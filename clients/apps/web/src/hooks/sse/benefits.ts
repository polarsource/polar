import { schemas } from '@polar-sh/client'

export const onBenefitGranted = async (_: {
  subscription_benefit_id: string
  benefit_type: schemas['BenefitType']
}) => {}

export const onBenefitRevoked = async (_: {
  subscription_benefit_id: string
  benefit_type: schemas['BenefitType']
}) => {}
