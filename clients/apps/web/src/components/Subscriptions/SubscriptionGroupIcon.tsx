import { Business, Stream, Verified } from '@mui/icons-material'
import { useMemo } from 'react'

interface SubscriptionGroupIconProps {
  icon: string
  color: string
  size?: number
}

const SubscriptionGroupIcon: React.FC<SubscriptionGroupIconProps> = ({
  icon,
  color,
  size = 6,
}) => {
  /**
   * Naive approach considering we know by advance the icons we use.
   *
   * A better approach would be to use the full Material Symbol Web Font,
   * so we could set any icon dynamically.
   */
  const IconComponent = useMemo(() => {
    switch (icon) {
      case 'material-symbols/stream':
        return Stream
      case 'material-symbols/verified':
        return Verified
      case 'material-symbols/business':
        return Business
      default:
        return undefined
    }
  }, [icon])

  const style = { '--var-icon-color': color } as React.CSSProperties

  return IconComponent ? (
    <div
      className={`inline-flex items-center text-[--var-icon-color]`}
      style={style}
    >
      <IconComponent className={`!h-${size} !w-${size}`} />
    </div>
  ) : null
}

export default SubscriptionGroupIcon
