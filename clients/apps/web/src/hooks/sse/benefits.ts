import { BenefitType } from '@polar-sh/sdk'

export const onBenefitGranted = async (_: {
  subscription_benefit_id: string
  benefit_type: BenefitType
}) => {}

export const onBenefitRevoked = async (_: {
  subscription_benefit_id: string
  benefit_type: BenefitType
}) => {}
