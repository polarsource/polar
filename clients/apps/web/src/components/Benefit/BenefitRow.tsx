import { Button } from 'polarkit/components/ui/atoms'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { Benefit, resolveBenefitTypeIcon } from './Benefit'
import { useBenefitActions } from './useBenefitAction'

interface BenefitRowProps {
  benefit: Benefit
  selected?: boolean
  onSelect?: (benefit: Benefit) => void
}

export const BenefitRow = ({
  benefit,
  selected,
  onSelect,
}: BenefitRowProps) => {
  const benefitActions = useBenefitActions(benefit)
  const BenefitTypeIcon = resolveBenefitTypeIcon(benefit.type)

  const handleClick = useCallback(() => {
    onSelect?.(benefit)
  }, [benefit, onSelect])

  return (
    <div
      className={twMerge(
        'dark:bg-polar-800 dark:border-polar-700 dark:hover:bg-polar-800 flex flex-row justify-between gap-x-8 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 shadow-sm transition-colors hover:bg-gray-100',
        selected &&
          'dark:bg-polar-700 border-blue-100 bg-blue-50 hover:bg-blue-100',
        onSelect && 'cursor-pointer',
      )}
      onClick={handleClick}
    >
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-blue-400">
          <span className="flex h-10 w-10 flex-row items-center justify-center rounded-full bg-blue-50 text-sm dark:bg-blue-950">
            <BenefitTypeIcon fontSize="small" />
          </span>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium capitalize">{benefit.type}</h3>
          <p className="dark:text-polar-500 flex flex-row gap-x-1 truncate text-sm text-gray-500">
            {benefit.description}
          </p>
        </div>
      </div>
      {benefitActions.length > 0 && (
        <div className="flex flex-row items-center gap-x-4">
          {benefitActions.map((action) => (
            <Button
              key={action.key}
              className="h-8 w-8 rounded-full"
              variant="secondary"
              onClick={action.onClick}
            >
              <action.icon fontSize="inherit" />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
