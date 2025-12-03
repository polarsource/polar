'use client'

import { EventCostCreationGuideModal } from '@/components/Events/EventCostCreationGuideModal'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { useNavigationHistory } from '@/providers/navigationHistory'
import { schemas } from '@polar-sh/client'
import { ChevronRightIcon, CircleQuestionMarkIcon } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  DEFAULT_INTERVAL,
  getCostsSearchParams,
  getDefaultEndDate,
  getDefaultStartDate,
} from '../utils'

export function SpansTitle({
  organization,
  eventType,
}: {
  organization: schemas['Organization']
  eventType?: schemas['EventType'] | null
}) {
  const {
    isShown: isEventCostCreationGuideShown,
    show: showEventCostCreationGuide,
    hide: hideEventCostCreationGuide,
  } = useModal()

  const { withPotentialPreviousParams } = useNavigationHistory()
  const searchParams = useSearchParams()
  const startDate = searchParams.get('startDate') ?? getDefaultStartDate()
  const endDate = searchParams.get('endDate') ?? getDefaultEndDate()
  const interval = searchParams.get('interval') ?? DEFAULT_INTERVAL
  const searchString = getCostsSearchParams(startDate, endDate, interval)

  const spanIdPath = `/dashboard/${organization.slug}/analytics/costs/${eventType?.id}`
  const backLink = withPotentialPreviousParams(spanIdPath)

  return (
    <div className="flex flex-row items-center justify-between gap-1.5">
      <h2 className="flex flex-row items-center gap-1.5 text-2xl font-medium whitespace-nowrap dark:text-white">
        <Link
          href={`/dashboard/${organization.slug}/analytics/costs${searchString ? `?${searchString}` : ''}`}
        >
          Costs
        </Link>
        {eventType && (
          <>
            <ChevronRightIcon className="dark:text-polar-500 size-5 text-gray-400" />
            <Link href={backLink}>{eventType.label}</Link>
          </>
        )}
      </h2>
      {!eventType && (
        <button
          className="dark:text-polar-500 dark:hover:text-polar-400 flex size-6 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-600"
          onClick={showEventCostCreationGuide}
        >
          <CircleQuestionMarkIcon className="size-4" />
        </button>
      )}
      <Modal
        title="Cost Ingestion"
        isShown={isEventCostCreationGuideShown}
        hide={hideEventCostCreationGuide}
        modalContent={<EventCostCreationGuideModal />}
      />
    </div>
  )
}
