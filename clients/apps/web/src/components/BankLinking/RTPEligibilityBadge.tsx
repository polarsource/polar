'use client'

import { Zap, Clock } from 'lucide-react'

interface RTPEligibilityBadgeProps {
  eligible: boolean
  size?: 'sm' | 'md' | 'lg'
  showDescription?: boolean
}

/**
 * Badge indicating Real-Time Payment (RTP) eligibility.
 *
 * Mercury-native bank accounts (Column N.A., Choice Financial) support
 * instant RTP transfers. Others use Same-Day ACH.
 */
export const RTPEligibilityBadge = ({
  eligible,
  size = 'md',
  showDescription = true,
}: RTPEligibilityBadgeProps) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  if (eligible) {
    return (
      <div className="flex flex-col gap-1">
        <div
          className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 font-medium text-white ${sizeClasses[size]}`}
        >
          <Zap className={iconSizes[size]} />
          Instant Payouts Enabled
        </div>
        {showDescription && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Your bank supports Real-Time Payments. Payouts arrive in seconds,
            24/7/365.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`dark:bg-polar-700 inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-100 font-medium text-gray-700 dark:text-gray-300 ${sizeClasses[size]}`}
      >
        <Clock className={iconSizes[size]} />
        Same-Day ACH
      </div>
      {showDescription && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Payouts arrive same business day via ACH. Switch to a Mercury bank for
          instant payouts.
        </p>
      )}
    </div>
  )
}

/**
 * Inline variant for use in tables or lists.
 */
export const RTPEligibilityBadgeInline = ({
  eligible,
}: {
  eligible: boolean
}) => {
  if (eligible) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
        <Zap className="h-3 w-3" />
        <span className="text-xs font-medium">Instant</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
      <Clock className="h-3 w-3" />
      <span className="text-xs">Same-Day</span>
    </span>
  )
}

export default RTPEligibilityBadge
