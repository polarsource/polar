'use client'

import { OverviewSection } from '@/components/DashboardOverview/OverviewSection'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import PaymentOnboardingStepper from '@/components/Onboarding/PaymentOnboardingStepper'
import { IOSAppBanner } from '@/components/Upsell/IOSAppBanner'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { useOrganizationPaymentStatus } from '@/hooks/queries'
import { schemas } from '@polar-sh/client'

const cellClassName =
  'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200'

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  const { data: paymentStatus } = useOrganizationPaymentStatus(organization.id)

  return (
    <DashboardBody className="gap-y-8 pb-16 md:gap-y-12">
      <IOSAppBanner />
      {paymentStatus && !paymentStatus.payment_ready && (
        <PaymentOnboardingStepper organization={organization} />
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
