import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { PropsWithChildren } from 'react'
import { CustomerStatBox, CustomerStatBoxProps } from './CustomerStatBox'

export interface CustomerTrendStatBoxProps extends CustomerStatBoxProps {
  trend?: {
    value: number
    direction: 'up' | 'down' | 'none'
  }
  period?: string
}

export const CustomerTrendStatBox = ({
  title,
  children,
  className,
  valueClassName,
  size = 'sm',
  trend,
  period,
}: PropsWithChildren<CustomerTrendStatBoxProps>) => {
  return (
    <CustomerStatBox
      title={title}
      className={className}
      valueClassName={valueClassName}
      size={size}
    >
      <div className="flex flex-col gap-2">
        <span>{children}</span>
        {trend && (
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1 text-sm ${
                trend.direction === 'up'
                  ? 'text-emerald-500'
                  : trend.direction === 'down'
                    ? 'text-red-500'
                    : 'dark:text-polar-500 text-gray-500'
              }`}
            >
              {trend.direction === 'up' ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : trend.direction === 'down' ? (
                <ArrowDownRight className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
            </div>
            {period && (
              <span className="dark:text-polar-500 text-xs text-gray-500">
                {period}
              </span>
            )}
          </div>
        )}
      </div>
    </CustomerStatBox>
  )
}
