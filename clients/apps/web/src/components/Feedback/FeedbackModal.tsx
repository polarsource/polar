import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { FeedbackForm } from './FeedbackForm'
import { ThanksPanel } from './ThanksPanel'

export const FeedbackModal = ({
  isShown,
  hide,
  organization,
}: {
  isShown: boolean
  hide: () => void
  organization: schemas['Organization']
}) => {
  const [submittedType, setSubmittedType] = useState<
    schemas['FeedbackType'] | null
  >(null)

  const handleHide = () => {
    hide()
    setSubmittedType(null)
  }

  return (
    <InlineModal
      isShown={isShown}
      hide={handleHide}
      modalContent={
        <>
          <InlineModalHeader hide={handleHide}>
            <h2 className="text-xl">Share feedback</h2>
          </InlineModalHeader>
          <div className="flex flex-col gap-y-8 p-8">
            {submittedType === null ? (
              <FeedbackForm
                organization={organization}
                onSuccess={setSubmittedType}
                onCancel={handleHide}
              />
            ) : (
              <ThanksPanel type={submittedType} />
            )}
          </div>
        </>
      }
    />
  )
}
