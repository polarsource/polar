'use client'

import { isFeatureEnabled } from '@/utils/feature-flags'
import { twMerge } from 'tailwind-merge'

const CampaignsSummary = () => {
  if (!isFeatureEnabled('subscriptions')) {
    return null
  }

  return (
    <div className="hidden flex-col gap-y-4 md:flex">
      <div className="flex flex-row items-start justify-between">
        <h3>Campaigns</h3>
        <h3>3</h3>
      </div>
      <div className="flex flex-col flex-wrap gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={twMerge(
              'dark:border-polar-700 flex flex-col gap-y-4 rounded-2xl border border-gray-200 p-4',
              i === 0 && 'dark:bg-polar-800 border-blue-100 bg-blue-50',
            )}
          >
            <h4 className="text-sm font-medium">Campaign v{i + 1}</h4>
            <div
              style={{
                display: 'flex',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${80 / (i * 2 + 1)}%`,
                  height: '4px',
                  backgroundColor: '#4667CA', // blue-600
                  transitionProperty: 'all',
                  transitionDuration: '200ms',
                }}
              />
              <div
                className="dark:bg-polar-700 bg-gray-200"
                style={{
                  flexGrow: '1',
                  height: '4px',
                }}
              ></div>
            </div>
            <h4 className="text-xs text-blue-500">View Campaign</h4>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CampaignsSummary
