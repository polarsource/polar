import { queryClient } from '@/utils/api'
import { SubscriptionBenefitType } from '@polar-sh/sdk'

export const onSubscriptionBenefitGrantGranted = async (payload: {
  subscription_benefit_id: string
  subscription_benefit_type: SubscriptionBenefitType
}) => {
  // Refresh articles feed when an articles benefit is granted
  if (payload.subscription_benefit_type === 'articles') {
    await queryClient.invalidateQueries({ queryKey: ['article', 'list'] })
  }
}

export const onSubscriptionBenefitGrantRevoked = async (payload: {
  subscription_benefit_id: string
  subscription_benefit_type: SubscriptionBenefitType
}) => {
  // Refresh articles feed when an articles benefit is revoked
  if (payload.subscription_benefit_type === 'articles') {
    await queryClient.invalidateQueries({ queryKey: ['article', 'list'] })
  }
}
