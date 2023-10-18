import { Business, Stream, Verified } from '@mui/icons-material'
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
  /**
   * Naive approach considering we know by advance the icons we use.
   *
   * A better approach would be to use the full Material Symbol Web Font,
   * so we could set any icon dynamically.
   */
  const IconComponent = useMemo(() => {
    switch (type) {
      case SubscriptionTierType.HOBBY:
        return Stream
      case SubscriptionTierType.PRO:
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
      className={`inline-flex items-center text-[--var-icon-color]`}
      style={style}
    >
      <IconComponent className={twMerge('!h-5 !w-5', className)} />
    </div>
  ) : null
}

export default SubscriptionGroupIcon
