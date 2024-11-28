'use client'

import { useAuth } from '@/hooks'
import { useMemo, useState } from 'react'
import { BenefitActivityItem } from './BenefitActivityItem'
import { benefitActivityLogEvents } from './BenefitActivityLog.fixture'
import { BenefitActivityLogType } from './BenefitActivityLog.types'

export const BenefitActivityLog = () => {
  const { currentUser } = useAuth()
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})

  const events = useMemo(
    () => (currentUser ? benefitActivityLogEvents(currentUser) : []),
    [currentUser],
  )

  return (
    <div className="flex flex-grow flex-col gap-y-8">
      <div className="flex flex-row gap-x-8">
        <div className="dark:bg-polar-800 flex flex-1 flex-col gap-y-2 rounded-2xl bg-white p-6">
          <h3 className="dark:text-polar-500 text-gray-500">Events</h3>
          <span className="text-2xl">{events.length}</span>
        </div>
        <div className="dark:bg-polar-800 flex flex-1 flex-col gap-y-2 rounded-2xl bg-white p-6">
          <h3 className="dark:text-polar-500 text-gray-500">Benefit Grants</h3>
          <span className="text-2xl">
            {
              events.filter((v) => v.type === BenefitActivityLogType.GRANTED)
                .length
            }
          </span>
        </div>

        <div className="dark:bg-polar-800 flex flex-1 flex-col gap-y-2 rounded-2xl bg-white p-6">
          <h3 className="dark:text-polar-500 text-gray-500">
            Benefit Revocations
          </h3>
          <span className="text-2xl">
            {
              events.filter((v) => v.type === BenefitActivityLogType.REVOKED)
                .length
            }
          </span>
        </div>
      </div>

      <div className="relative">
        {events.map((event, index) => (
          <BenefitActivityItem
            key={event.id}
            event={event}
            index={index}
            eventsLength={events.length}
            expanded={expandedMap[event.id] ?? false}
            onToggle={(event) =>
              setExpandedMap((prev) => ({
                ...prev,
                [event.id]: !prev[event.id],
              }))
            }
          />
        ))}
      </div>
    </div>
  )
}
