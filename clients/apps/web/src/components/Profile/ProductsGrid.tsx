import { Organization, ProductPriceRecurringInterval } from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'
import SubscriptionTierRecurringIntervalSwitch from '../Subscriptions/SubscriptionTierRecurringIntervalSwitch'

export interface ProductsGridProps extends React.PropsWithChildren {
  className?: string
  title?: string
  organization: Organization
  recurringInterval?: ProductPriceRecurringInterval
  hasBothIntervals?: boolean
  setRecurringInterval?: (interval: ProductPriceRecurringInterval) => void
  gridClassName?: string
}

export const ProductsGrid = ({
  className,
  title,
  children,
  hasBothIntervals,
  recurringInterval,
  setRecurringInterval,
  gridClassName,
}: ProductsGridProps) => {
  return (
    <div className={twMerge('flex flex-grow flex-col gap-y-8', className)}>
      <div className="flex flex-row items-center justify-between gap-x-8">
        {title && <h2 className="text-2xl font-medium">{title}</h2>}
        {hasBothIntervals && recurringInterval && setRecurringInterval && (
          <div className="flex justify-center">
            <SubscriptionTierRecurringIntervalSwitch
              recurringInterval={recurringInterval}
              onChange={setRecurringInterval}
            />
          </div>
        )}
      </div>
      <div
        className={twMerge(
          'grid w-full grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3',
          gridClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
