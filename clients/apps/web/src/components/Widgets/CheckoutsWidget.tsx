import { useCheckouts } from '@/hooks/queries/checkouts'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { Card } from '@polar-sh/ui/components/atoms/Card'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface CheckoutsWidgetProps {
  className?: string
}

const CheckoutsWidget = ({ className }: CheckoutsWidgetProps) => {
  const { organization } = useContext(OrganizationContext)
  const { resolvedTheme } = useTheme()

  const isDark = resolvedTheme === 'dark'

  const checkoutsInitiated = useCheckouts(organization.id, {
    limit: 1,
  })
  const checkoutsExpired = useCheckouts(organization.id, {
    limit: 1,
    status: 'expired',
  })
  const checkoutsSucceeded = useCheckouts(organization.id, {
    limit: 1,
    status: 'succeeded',
  })
  const checkoutsFailed = useCheckouts(organization.id, {
    limit: 1,
    status: 'failed',
  })

  const stages = [
    {
      name: 'Initiated',
      value: checkoutsInitiated.data?.pagination.total_count ?? 0,
      percentage: 100,
      color: 'dark:bg-polar-600 bg-gray-300',
      status: null,
    },
    {
      name: 'Expired',
      value: checkoutsExpired.data?.pagination.total_count ?? 0,
      percentage:
        ((checkoutsExpired.data?.pagination.total_count ?? 0) /
          (checkoutsInitiated.data?.pagination.total_count ?? 1)) *
        100,
      color: 'dark:bg-indigo-500 bg-indigo-300',
      status: 'expired',
    },
    {
      name: 'Failed',
      value: checkoutsFailed.data?.pagination.total_count ?? 0,
      percentage:
        ((checkoutsFailed.data?.pagination.total_count ?? 0) /
          (checkoutsInitiated.data?.pagination.total_count ?? 1)) *
        100,
      color: 'dark:bg-red-500 bg-red-300',
      status: 'failed',
    },
    {
      name: 'Succeeded',
      value: checkoutsSucceeded.data?.pagination.total_count ?? 0,
      percentage:
        ((checkoutsSucceeded.data?.pagination.total_count ?? 0) /
          (checkoutsInitiated.data?.pagination.total_count ?? 1)) *
        100,
      color: 'dark:bg-emerald-400 bg-emerald-300',
      status: 'succeeded',
    },
  ] as const

  return (
    <Card
      className={twMerge(
        'dark:bg-polar-800 flex h-full w-full flex-col gap-y-6 bg-gray-100 p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl">Conversion Funnel</h2>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-x-2">
            <h3 className="text-5xl font-light">
              {checkoutsInitiated.data?.pagination.total_count.toLocaleString(
                'en-US',
                {
                  style: 'decimal',
                  compactDisplay: 'short',
                  notation: 'compact',
                },
              )}
            </h3>
            <span className="text-lg">
              {checkoutsInitiated.data?.pagination.total_count === 1
                ? 'Checkout'
                : 'Checkouts'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid h-full grid-cols-1 gap-8 lg:grid-cols-4">
        {stages.map((stage) => (
          <Link
            key={stage.name}
            className="flex h-full flex-col gap-y-2"
            href={
              stage.status
                ? `/dashboard/${organization.slug}/sales/checkouts?status=${stage.status}`
                : `/dashboard/${organization.slug}/sales/checkouts`
            }
          >
            <div
              className="relative h-full min-h-48 overflow-hidden rounded-2xl"
              style={{
                backgroundImage: `repeating-linear-gradient(
              45deg,
              ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'},
              ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} 10px,
              transparent 10px,
              transparent 20px
            )`,
              }}
            >
              <div
                className={twMerge(
                  'absolute bottom-0 w-full rounded-2xl transition-opacity hover:opacity-80',
                  stage.color,
                )}
                style={{ height: `${stage.percentage}%` }}
              />
            </div>
            <div className="flex flex-col">
              <span>{stage.name}</span>
              <span className="dark:text-polar-500 text-sm text-gray-500">
                {isNaN(stage.percentage) ? 0 : stage.percentage.toFixed(1)}% —{' '}
                {stage.value.toLocaleString('en-US')}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}

export default CheckoutsWidget
