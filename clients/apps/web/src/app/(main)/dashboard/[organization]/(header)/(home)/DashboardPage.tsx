'use client'

import { OverviewSection } from '@/components/DashboardOverview/OverviewSection'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { IOSAppBanner } from '@/components/Upsell/IOSAppBanner'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { useOrganizationPaymentStatus } from '@/hooks/queries'
import { CONFIG } from '@/utils/config'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { ConstructionIcon } from 'lucide-react'
import Link from 'next/link'

const cellClassName =
  'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200'

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: paymentStatus, isLoading } = useOrganizationPaymentStatus(
    organization.id,
  )

  return (
    <DashboardBody className="gap-y-8 pb-16 md:gap-y-12" title={null}>
      <IOSAppBanner />
      {!CONFIG.IS_SANDBOX &&
        paymentStatus?.organization_status === 'created' &&
        !isLoading && (
          <div className="dark:bg-polar-800 flex flex-col justify-between gap-4 rounded-2xl bg-gray-100 p-4 md:flex-row md:p-6">
            <div className="flex flex-col gap-y-2 text-sm">
              <div className="flex flex-row items-center gap-x-3">
                <ConstructionIcon className="h-4 w-4 shrink-0" />
                <h3 className="font-medium">Your account is in test mode</h3>
              </div>
              <div>
                <p className="dark:text-polar-500 max-w-4xl text-gray-500">
                  Set up your products and integrate into your app. Test the
                  full flow with 100% discount codes.
                </p>
                <p className="dark:text-polar-500 text-gray-500">
                  When you&rsquo;re ready, go live to start accepting payments
                  from your customers.
                </p>
              </div>
            </div>
            <Link href={`/dashboard/${organization.slug}/finance/account`}>
              <Button>Go Live</Button>
            </Link>
          </div>
        )}
      <OverviewSection organization={organization} />

      <div className="dark:border-polar-700 overflow-hidden rounded-xl border border-gray-200">
        <div className="grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-3">
          <RevenueWidget className={cellClassName} />
          <OrdersWidget className={cellClassName} />
          <AccountWidget className={cellClassName} />
        </div>
      </div>
    </DashboardBody>
  )
}
