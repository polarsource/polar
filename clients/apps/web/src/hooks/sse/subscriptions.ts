import { queryClient } from '@/utils/api'
import { BenefitType } from '@polar-sh/sdk'

export const onSubscriptionBenefitGrantGranted = async (payload: {
  subscription_benefit_id: string
  benefit_type: BenefitType
}) => {
  // Refresh articles feed when an articles benefit is granted
  if (payload.benefit_type === 'articles') {
    await queryClient.invalidateQueries({ queryKey: ['article', 'list'] })
  }
}

export const onSubscriptionBenefitGrantRevoked = async (payload: {
  subscription_benefit_id: string
  benefit_type: BenefitType
}) => {
  // Refresh articles feed when an articles benefit is revoked
  if (payload.benefit_type === 'articles') {
    await queryClient.invalidateQueries({ queryKey: ['article', 'list'] })
  }
}
