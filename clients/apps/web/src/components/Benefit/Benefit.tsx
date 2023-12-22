import { CheckOutlined, ShortTextOutlined } from '@mui/icons-material'
import { SubscriptionBenefitType, SubscriptionTierBenefit } from '@polar-sh/sdk'

export type Benefit = SubscriptionTierBenefit

export const resolveBenefitTypeIcon = (type: SubscriptionBenefitType) => {
  switch (type) {
    case 'articles':
      return ShortTextOutlined
    default:
      return CheckOutlined
  }
}
