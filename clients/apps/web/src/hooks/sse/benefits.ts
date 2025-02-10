import { components } from '@polar-sh/client'

export const onBenefitGranted = async (_: {
  subscription_benefit_id: string
  benefit_type: components['schemas']['BenefitType']
}) => {}

export const onBenefitRevoked = async (_: {
  subscription_benefit_id: string
  benefit_type: components['schemas']['BenefitType']
}) => {}
