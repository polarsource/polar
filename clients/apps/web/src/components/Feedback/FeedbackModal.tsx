import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { collectClientContext } from './clientContext'
import { FeedbackForm } from './FeedbackForm'
import { QuestionFlow } from './QuestionFlow'
import { ThanksPanel } from './ThanksPanel'
import { useSubmitFeedback } from './useSubmitFeedback'

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
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  const submitFeedback = useSubmitFeedback()

  const handleHide = () => {
    hide()
    setSubmittedType(null)
    setPendingQuestion(null)
    submitFeedback.reset()
  }

  const handleEscalate = async (message: string) => {
    const { error } = await submitFeedback.mutateAsync({
      type: 'question',
      message,
      organization_id: organization.id,
      client_context: collectClientContext(),
    })
    if (error) return
    setPendingQuestion(null)
    setSubmittedType('question')
  }

  const renderContent = () => {
    if (submittedType !== null) {
      return (
        <div className="pb-8">
          <ThanksPanel type={submittedType} />
        </div>
      )
    }
    if (pendingQuestion !== null) {
      return (
        <QuestionFlow
          question={pendingQuestion}
          onEscalate={handleEscalate}
          onCancel={handleHide}
          isEscalating={submitFeedback.isPending}
        />
      )
    }
    return (
      <FeedbackForm
        organization={organization}
        onSuccess={setSubmittedType}
        onAskQuestion={setPendingQuestion}
        onCancel={handleHide}
      />
    )
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
          <div className="flex min-h-0 flex-1 flex-col px-8">
            {renderContent()}
          </div>
        </>
      }
    />
  )
}
