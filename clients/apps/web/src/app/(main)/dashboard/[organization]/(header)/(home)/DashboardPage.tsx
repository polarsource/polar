'use client'

import { OverviewSection } from '@/components/DashboardOverview/OverviewSection'
import { CompassBox } from '@/components/Compass/CompassBox'
import { CompassWidget } from '@/components/Compass/CompassWidget'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { PlanUpsell } from '@/components/Upsell/PlanUpsell'
import { AccountWidget } from '@/components/Widgets/AccountWidget'
import { OrdersWidget } from '@/components/Widgets/OrdersWidget'
import RevenueWidget from '@/components/Widgets/RevenueWidget'
import { schemas } from '@polar-sh/client'
import { DisputesBanner } from './DisputesBanner'
import { OrganizationStatusBanner } from './OrganizationStatusBanner'

const cellClassName =
  'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200'

interface OverviewPageProps {
  organization: schemas['Organization']
}

export default function OverviewPage({ organization }: OverviewPageProps) {
  return (
    <DashboardBody
      className="gap-y-8 md:gap-y-16"
      wrapperClassName={
        // Room for the sticky Compass box; without it the page would end in
        // a large blank strip for organizations without the feature.
        organization.feature_settings?.compass_enabled
          ? 'pb-40 md:pb-48'
          : undefined
      }
      title={null}
    >
      <PlanUpsell organization={organization} />
      <OrganizationStatusBanner organization={organization} />
      <DisputesBanner organization={organization} />
      <CompassWidget organization={organization} limit={3} hideWhenEmpty />
      <OverviewSection organization={organization} />
      <CompassWidget organization={organization} limit={3} hideWhenEmpty />

      <div className="dark:border-polar-700 overflow-hidden rounded-xl border border-gray-200">
        <div className="grid grid-cols-1 [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-3">
          <RevenueWidget className={cellClassName} />
          <OrdersWidget className={cellClassName} />
          <AccountWidget className={cellClassName} />
        </div>
      </div>
      {organization.feature_settings?.compass_enabled && (
        <CompassBox organization={organization} />
      )}
    </DashboardBody>
  )
}
