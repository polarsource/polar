'use client'

import { EventCostCreationGuideModal } from '@/components/Events/EventCostCreationGuideModal'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { schemas } from '@polar-sh/client'
import { CircleQuestionMarkIcon } from 'lucide-react'
import Link from 'next/link'

export function SpansTitle({
  organization,
}: {
  organization: schemas['Organization']
}) {
  const {
    isShown: isEventCostCreationGuideShown,
    show: showEventCostCreationGuide,
    hide: hideEventCostCreationGuide,
  } = useModal()

  return (
    <div className="flex flex-row items-center justify-between gap-1.5">
      <h2 className="text-2xl font-medium whitespace-nowrap dark:text-white">
        <Link href={`/dashboard/${organization.slug}/analytics/costs`}>
          Costs
        </Link>
      </h2>
      <button
        className="dark:text-polar-500 dark:hover:text-polar-400 flex size-6 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:text-gray-600"
        onClick={showEventCostCreationGuide}
      >
        <CircleQuestionMarkIcon className="size-4" />
      </button>
      <Modal
        title="Cost Ingestion"
        isShown={isEventCostCreationGuideShown}
        hide={hideEventCostCreationGuide}
        modalContent={<EventCostCreationGuideModal />}
      />
    </div>
  )
}
