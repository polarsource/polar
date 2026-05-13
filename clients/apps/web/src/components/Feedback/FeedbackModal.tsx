import { InlineModal, InlineModalHeader } from '@/components/Modal/InlineModal'
import { schemas } from '@polar-sh/client'
import { useState } from 'react'
import { collectClientContext } from './clientContext'
import { FeedbackForm } from './FeedbackForm'
import { QuestionFlow } from './QuestionFlow'
import { ThanksPanel } from './ThanksPanel'
import { useSubmitFeedback } from './useSubmitFeedback'

const generateConversationId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

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
  const [conversationId, setConversationId] = useState<string>(
    generateConversationId,
  )

  const submitFeedback = useSubmitFeedback()

  const handleHide = () => {
    hide()
    setSubmittedType(null)
    setPendingQuestion(null)
    // Reset so the next time the modal opens, it starts a new conversation
    // trace.
    setConversationId(generateConversationId())
    submitFeedback.reset()
  }

  const handleEscalate = async (
    message: string,
    type: schemas['FeedbackType'],
  ) => {
    const { error } = await submitFeedback.mutateAsync({
      type,
      message,
      organization_id: organization.id,
      client_context: collectClientContext(),
    })
    if (error) return
    setPendingQuestion(null)
    setSubmittedType(type)
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
          conversationId={conversationId}
          organizationId={organization.id}
          onEscalate={handleEscalate}
          onCancel={handleHide}
          isEscalating={submitFeedback.isPending}
        />
      )
    }
    return (
      <FeedbackForm
        organization={organization}
        conversationId={conversationId}
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
            <h2 className="text-xl">Reach out to Polar</h2>
          </InlineModalHeader>
          <div className="flex min-h-0 flex-1 flex-col px-8">
            {renderContent()}
          </div>
        </>
      }
    />
  )
}
