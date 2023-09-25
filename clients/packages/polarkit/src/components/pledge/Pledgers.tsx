import { Pledger } from 'polarkit/api/client'
import { useMemo } from 'react'

interface PledgersProps {
  pledgers: Pledger[]
  maxShown?: number
  size: 'xs' | 'sm' | 'md' | 'lg'
}

const Pledgers: React.FC<PledgersProps> = ({ pledgers, maxShown, size }) => {
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
        return 'h-6 w-6 text-xs'
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
        return '-ml-3 border-2'
      case 'md':
        return '-ml-3 border-2'
      case 'lg':
        return '-ml-4 border-2'
    }
  }, [size])

  return (
    <div className="mt-2 flex items-center justify-center sm:mt-0 sm:justify-end">
      {shownPledgers.map((pledger) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={pledger.name}
          src={pledger.avatar_url}
          className={`rounded-full border border-gray-50 dark:border-gray-950 ${marginClasses} ${sizeClasses}`}
          alt={pledger.name}
        />
      ))}
      {hiddenPledgersCount > 0 && (
        <div
          className={`flex aspect-square items-center justify-center rounded-full border border-gray-50 bg-blue-600 text-blue-200 dark:border-gray-950 ${marginClasses} ${sizeClasses}`}
        >
          +{hiddenPledgersCount}
        </div>
      )}
    </div>
  )
}

Pledgers.defaultProps = {
  maxShown: 3,
}

export default Pledgers
