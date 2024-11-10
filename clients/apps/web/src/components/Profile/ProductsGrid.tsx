import { Organization, SubscriptionRecurringInterval } from '@polar-sh/sdk'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import { twMerge } from 'tailwind-merge'
import SubscriptionTierRecurringIntervalSwitch from '../Subscriptions/SubscriptionTierRecurringIntervalSwitch'

export interface ProductsGridProps extends React.PropsWithChildren {
  className?: string
  title?: string
  organization: Organization
  recurringInterval?: SubscriptionRecurringInterval
  hasBothIntervals?: boolean
  setRecurringInterval?: (interval: SubscriptionRecurringInterval) => void
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
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        {title && <h2 className="text-2xl font-medium">{title}</h2>}
        {hasBothIntervals && recurringInterval && setRecurringInterval && (
          <>
            <div className="hidden justify-center md:flex">
              <SubscriptionTierRecurringIntervalSwitch
                value={recurringInterval}
                onChange={setRecurringInterval}
              />
            </div>
            <div className="flex md:hidden">
              <Select
                onValueChange={setRecurringInterval}
                value={recurringInterval}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SubscriptionRecurringInterval.MONTH}>
                    <span className="whitespace-nowrap">Monthly</span>
                  </SelectItem>
                  <SelectItem value={SubscriptionRecurringInterval.YEAR}>
                    <span className="whitespace-nowrap">Yearly</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
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
