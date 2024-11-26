'use client'

import { useAuth } from '@/hooks'
import { useMemo, useState } from 'react'
import { BenefitActivityItem } from './BenefitActivityItem'
import { benefitActivityLogEvents } from './BenefitActivityLog.fixture'

export const BenefitActivityLog = () => {
  const { currentUser } = useAuth()
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})

  const events = useMemo(
    () => (currentUser ? benefitActivityLogEvents(currentUser) : []),
    [currentUser],
  )

  return (
    <div className="flex flex-grow flex-col">
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
