import { extractApiErrorMessage } from '@/utils/api/errors'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import type { ValidationStatus } from '@/app/(main)/feedback/question/validation'

import { collectClientContext } from './clientContext'
import {
  ACCOUNT_REVIEW_REPLY,
  REJECTION_OFF_TOPIC_TEXT,
  REJECTION_PRE_APPROVAL_TEXT,
  REJECTION_UNCLEAR_TEXT,
} from './constants'
import { useSubmitFeedback } from './useSubmitFeedback'

type ValidationOutcome =
  | { kind: 'rejection'; text: string }
  | { kind: 'info'; markdown: string }

interface FormSchema {
  type: schemas['FeedbackType']
  message: string
}

const MAX_MESSAGE_LENGTH = 5000

export const FeedbackForm = ({
  organization,
  conversationId,
  onSuccess,
  onAskQuestion,
  onCancel,
}: {
  organization: schemas['Organization']
  conversationId: string
  onSuccess: (type: schemas['FeedbackType']) => void
  onAskQuestion: (message: string) => void
  onCancel: () => void
}) => {
  const form = useForm<FormSchema>({
    defaultValues: {
      type: 'question',
      message: '',
    },
  })

  const { control, handleSubmit, reset } = form

  const submitFeedback = useSubmitFeedback()
  const apiError = submitFeedback.data?.error
    ? extractApiErrorMessage(submitFeedback.data.error)
    : null

  const [isValidating, setIsValidating] = useState(false)
  const [validationOutcome, setValidationOutcome] =
    useState<ValidationOutcome | null>(null)

  const onSubmit = async (formData: FormSchema) => {
    if (formData.type === 'question') {
      setValidationOutcome(null)
      setIsValidating(true)
      try {
        const response = await fetch('/feedback/question/validate', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: formData.message,
            conversationId,
            organizationId: organization.id,
          }),
        })
        if (!response.ok) {
          // Fall through to the assistant on validation outage so the user
          // isn't blocked by a transient classifier failure.
          onAskQuestion(formData.message)
          return
        }
        const { status } = (await response.json()) as {
          status: ValidationStatus
        }
        switch (status) {
          case 'unclear':
            setValidationOutcome({
              kind: 'rejection',
              text: REJECTION_UNCLEAR_TEXT,
            })
            return
          case 'off_topic':
            setValidationOutcome({
              kind: 'rejection',
              text: REJECTION_OFF_TOPIC_TEXT,
            })
            return
          case 'pre_approval':
            setValidationOutcome({
              kind: 'rejection',
              text: REJECTION_PRE_APPROVAL_TEXT,
            })
            return
          case 'account_review':
            setValidationOutcome({
              kind: 'info',
              markdown: ACCOUNT_REVIEW_REPLY,
            })
            return
          case 'answerable':
            onAskQuestion(formData.message)
            return
        }
      } finally {
        setIsValidating(false)
      }
      return
    }

    const { error } = await submitFeedback.mutateAsync({
      type: formData.type,
      message: formData.message,
      organization_id: organization.id,
      client_context: collectClientContext(),
    })
    if (error) {
      return
    }
    onSuccess(formData.type)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6 pb-8"
      >
        <FormField
          control={control}
          name="type"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="dark:bg-polar-950 w-full flex-row items-center rounded-full bg-gray-100">
                    <TabsTrigger
                      value="question"
                      className="dark:data-[state=active]:bg-polar-800 grow rounded-full! data-[state=active]:bg-white"
                    >
                      Question
                    </TabsTrigger>
                    <TabsTrigger
                      value="feedback"
                      className="dark:data-[state=active]:bg-polar-800 grow rounded-full! data-[state=active]:bg-white"
                    >
                      Feedback
                    </TabsTrigger>
                    <TabsTrigger
                      value="bug"
                      className="dark:data-[state=active]:bg-polar-800 grow rounded-full! data-[state=active]:bg-white"
                    >
                      Bug
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="message"
          rules={{
            required: 'Message is required',
            minLength: { value: 10, message: 'At least 10 characters' },
            maxLength: { value: 5000, message: 'At most 5000 characters' },
          }}
          render={({ field }) => (
            <FormItem className="w-full">
              <div className="flex flex-row items-center justify-between">
                <FormLabel>Message</FormLabel>
                <span className="dark:text-polar-400 text-sm text-gray-400">
                  {(field.value ?? '').length} / {MAX_MESSAGE_LENGTH}
                </span>
              </div>
              <FormControl>
                <TextArea
                  {...field}
                  placeholder="Tell us what's on your mind..."
                  readOnly={validationOutcome?.kind === 'info'}
                  onChange={(event) => {
                    field.onChange(event)
                    if (validationOutcome?.kind === 'rejection') {
                      setValidationOutcome(null)
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.altKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault()
                      handleSubmit(onSubmit)()
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {validationOutcome?.kind === 'rejection' && (
          <Box
            borderRadius="l"
            backgroundColor="background-warning"
            color="text-warning"
            padding="l"
          >
            <p className="text-sm">{validationOutcome.text}</p>
          </Box>
        )}

        {validationOutcome?.kind === 'info' && (
          <Box
            borderRadius="l"
            backgroundColor="background-pending"
            color="text-pending"
            padding="l"
          >
            <div className="prose prose-sm dark:prose-invert">
              <MemoizedMarkdown content={validationOutcome.markdown} />
            </div>
          </Box>
        )}

        {apiError && (
          <Box
            borderRadius="l"
            backgroundColor="background-danger"
            color="text-danger"
            padding="l"
          >
            {apiError}
          </Box>
        )}

        <div className="flex justify-end gap-2">
          {validationOutcome?.kind === 'info' ? (
            <Button
              type="button"
              onClick={() => {
                setValidationOutcome(null)
                reset()
              }}
            >
              I understand
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={submitFeedback.isPending || isValidating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitFeedback.isPending || isValidating}
                disabled={submitFeedback.isPending || isValidating}
              >
                {submitFeedback.isPending ? 'Sending…' : 'Send'}
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  )
}
