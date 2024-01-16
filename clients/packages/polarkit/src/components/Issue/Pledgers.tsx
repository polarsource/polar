import { Pledger } from '@polar-sh/sdk'
import { useMemo } from 'react'

interface PledgersProps {
  pledgers: Pledger[]
  maxShown?: number
  size: 'xs' | 'sm' | 'md' | 'lg'
}

const Pledgers: React.FC<PledgersProps> = ({
  pledgers,
  size,
  maxShown = 3,
}) => {
  const shownPledgers = useMemo(
    () => pledgers.filter(({ avatar_url }) => !!avatar_url).slice(0, maxShown),
    [pledgers, maxShown],
  )
  const hiddenPledgersCount = useMemo(
    () => pledgers.length - shownPledgers.length,
    [pledgers, shownPledgers],
  )
  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'xs':
        return 'h-5 w-5 text-xs'
      case 'sm':
        return 'h-8 w-8 text-base'
      case 'md':
        return 'h-10 w-10 text-lg'
      case 'lg':
        return 'h-12 w-12 text-xl'
    }
  }, [size])
  const marginClasses = useMemo(() => {
    switch (size) {
      case 'xs':
        return '-ml-2'
      case 'sm':
        return '-ml-3'
      case 'md':
        return '-ml-3'
      case 'lg':
        return '-ml-4'
    }
  }, [size])
  const borderClasses = useMemo(() => {
    switch (size) {
      case 'xs':
        return ''
      case 'sm':
      case 'md':
      case 'lg':
        return 'border-2'
    }
  }, [size])

  /**
   * Compensate the negative margin of the leftmost avatar with an opposite padding.
   * This way, it won't mess the spacing of components using it.
   */
  const negativeMarginCompensationPadding = useMemo(() => {
    switch (size) {
      case 'xs':
        return 'pl-2'
      case 'sm':
      case 'md':
        return 'pl-3'
      case 'lg':
        return 'pl-4'
    }
  }, [size])

  return (
    <div
      className={`flex items-center pl-2 ${negativeMarginCompensationPadding}`}
    >
      {shownPledgers.map((pledger, idx) => (
        <div className={`${marginClasses} ${sizeClasses}`} key={idx}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={pledger.name}
            src={pledger.avatar_url}
            className={`dark:border-polar-950 rounded-full border border-gray-50 ${borderClasses}`}
            alt={pledger.name}
          />
        </div>
      ))}
      {hiddenPledgersCount > 0 && (
        <div
          className={`dark:border-polar-950 flex aspect-square items-center justify-center rounded-full border border-gray-50 bg-blue-500 text-blue-200 ${marginClasses} ${borderClasses} ${sizeClasses}`}
        >
          +{hiddenPledgersCount}
        </div>
      )}
    </div>
  )
}

export default Pledgers
