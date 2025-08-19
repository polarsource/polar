'use client'

import { DashboardBody } from '@/components/Layout/DashboardLayout'
import {
  Well,
  WellContent,
  WellFooter,
  WellHeader,
} from '@/components/Shared/Well'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'

const tiles = [
  {
    title: 'Total Requests',
    value: 100,
    description: 'Total number of requests',
  },
  {
    title: 'Completion Tokens',
    value: 100,
    description: 'Total number of completion tokens',
  },
  {
    title: 'Cost Estimate',
    value: formatCurrencyAndAmount(1238913, 'USD'),
    description: 'Estimated cost of your requests',
  },
  {
    title: 'Credits',
    value: 100,
    description: 'Total number of credits',
  },
]

export default function OverviewPage() {
  return (
    <DashboardBody className="flex flex-col gap-y-12">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Well
            key={tile.title}
            className="flex flex-col gap-y-4 rounded-2xl p-6"
          >
            <WellHeader>
              <h2>{tile.title}</h2>
            </WellHeader>
            <WellContent>
              <p className="text-3xl">{tile.value}</p>
            </WellContent>
            <WellFooter>
              <span className="dark:text-polar-500 text-sm text-gray-500">
                {tile.description}
              </span>
            </WellFooter>
          </Well>
        ))}
      </div>
    </DashboardBody>
  )
}
