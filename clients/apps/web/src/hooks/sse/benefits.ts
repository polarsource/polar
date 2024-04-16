import { queryClient } from '@/utils/api'
import { BenefitType } from '@polar-sh/sdk'

export const onBenefitGranted = async (payload: {
  subscription_benefit_id: string
  benefit_type: BenefitType
}) => {
  // Refresh articles feed when an articles benefit is granted
  if (payload.benefit_type === 'articles') {
    await queryClient.invalidateQueries({ queryKey: ['article', 'list'] })
  }
}

export const onBenefitRevoked = async (payload: {
  subscription_benefit_id: string
  benefit_type: BenefitType
}) => {
  // Refresh articles feed when an articles benefit is revoked
  if (payload.benefit_type === 'articles') {
    await queryClient.invalidateQueries({ queryKey: ['article', 'list'] })
  }
}
