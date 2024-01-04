import { Bookmark, Business, Verified } from '@mui/icons-material'
import { SubscriptionTierType } from '@polar-sh/sdk'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { getSubscriptionColorByType } from './utils'

interface SubscriptionGroupIconProps {
  className?: string
  type?: SubscriptionTierType
}

const SubscriptionGroupIcon: React.FC<SubscriptionGroupIconProps> = ({
  className,
  type,
}) => {
  const IconComponent = useMemo(() => {
    switch (type) {
      case SubscriptionTierType.FREE:
        return Bookmark
      case SubscriptionTierType.INDIVIDUAL:
        return Verified
      case SubscriptionTierType.BUSINESS:
        return Business
      default:
        return undefined
    }
  }, [type])

  const style = {
    '--var-icon-color': getSubscriptionColorByType(type),
  } as React.CSSProperties

  return IconComponent ? (
    <div
      className={twMerge(
        `inline-flex items-center text-[--var-icon-color]`,
        className,
      )}
      style={style}
    >
      <IconComponent fontSize="inherit" />
    </div>
  ) : null
}

export default SubscriptionGroupIcon
