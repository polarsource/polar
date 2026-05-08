import { extractApiErrorMessage } from '@/utils/api/errors'
import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { schemas } from '@polar-sh/client'
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
import { useForm, useWatch } from 'react-hook-form'

import { collectClientContext } from './clientContext'
import {
  ACCOUNT_REVIEW_REPLY,
  REJECTION_OFF_TOPIC_TEXT,
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
  onSuccess,
  onAskQuestion,
  onCancel,
}: {
  organization: schemas['Organization']
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
  const selectedType = useWatch({ control, name: 'type' })

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
          body: JSON.stringify({ message: formData.message }),
        })
        if (!response.ok) {
          // Fall through to the assistant on validation outage so the user
          // isn't blocked by a transient classifier failure.
          onAskQuestion(formData.message)
          return
        }
        const { status } = (await response.json()) as {
          status: 'answerable' | 'unclear' | 'off_topic' | 'account_review'
        }
        if (status === 'unclear') {
          setValidationOutcome({
            kind: 'rejection',
            text: REJECTION_UNCLEAR_TEXT,
          })
          return
        }
        if (status === 'off_topic') {
          setValidationOutcome({
            kind: 'rejection',
            text: REJECTION_OFF_TOPIC_TEXT,
          })
          return
        }
        if (status === 'account_review') {
          setValidationOutcome({
            kind: 'info',
            markdown: ACCOUNT_REVIEW_REPLY,
          })
          return
        }
        onAskQuestion(formData.message)
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
                  onChange={(event) => {
                    field.onChange(event)
                    if (validationOutcome) setValidationOutcome(null)
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.metaKey || event.ctrlKey) &&
                      event.key === 'Enter'
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
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {validationOutcome.text}
          </div>
        )}

        {validationOutcome?.kind === 'info' && (
          <div className="prose prose-sm dark:prose-invert rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200 dark:text-white">
            <MemoizedMarkdown content={validationOutcome.markdown} />
          </div>
        )}

        {apiError && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {apiError}
          </div>
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
                {submitFeedback.isPending
                  ? 'Sending…'
                  : isValidating
                    ? 'Checking…'
                    : selectedType === 'question'
                      ? 'Ask'
                      : 'Send'}
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  )
}
