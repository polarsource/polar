import { Organization, ProductPriceRecurringInterval } from '@polar-sh/sdk'
import SubscriptionTierRecurringIntervalSwitch from '../Subscriptions/SubscriptionTierRecurringIntervalSwitch'

export interface ProductsGridProps extends React.PropsWithChildren {
  title?: string
  organization: Organization
  recurringInterval?: ProductPriceRecurringInterval
  hasBothIntervals?: boolean
  setRecurringInterval?: (interval: ProductPriceRecurringInterval) => void
}

export const ProductsGrid = ({
  title,
  children,
  hasBothIntervals,
  recurringInterval,
  setRecurringInterval,
}: ProductsGridProps) => {
  return (
    <div className="flex flex-grow flex-col gap-y-8">
      <div className="flex flex-row items-center justify-between gap-x-8">
        {title && <h2 className="text-2xl">{title}</h2>}
        {hasBothIntervals && recurringInterval && setRecurringInterval && (
          <div className="flex justify-center">
            <SubscriptionTierRecurringIntervalSwitch
              recurringInterval={recurringInterval}
              onChange={setRecurringInterval}
            />
          </div>
        )}
      </div>
      <div className="grid w-full grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  )
}
