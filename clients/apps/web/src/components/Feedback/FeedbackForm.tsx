import { MemoizedMarkdown } from '@/components/Markdown/MemoizedMarkdown'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { Button } from '@polar-sh/orbit'
import { TextArea } from '@polar-sh/orbit'
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

import {
  ACCOUNT_REVIEW_REPLY,
  REJECTION_OFF_TOPIC_TEXT,
  REJECTION_PRE_APPROVAL_TEXT,
} from './constants'

type ValidationOutcome =
  | { kind: 'rejection'; text: string }
  | { kind: 'info'; markdown: string }

interface FormSchema {
  message: string
}

const MAX_MESSAGE_LENGTH = 5000

export const FeedbackForm = ({
  organization,
  conversationId,
  onAskQuestion,
  onCancel,
}: {
  organization: schemas['Organization']
  conversationId: string
  onAskQuestion: (message: string) => void
  onCancel: () => void
}) => {
  const form = useForm<FormSchema>({
    defaultValues: {
      message: '',
    },
  })

  const { control, handleSubmit, reset } = form

  const [isValidating, setIsValidating] = useState(false)
  const [validationOutcome, setValidationOutcome] =
    useState<ValidationOutcome | null>(null)

  const validate = async (
    message: string,
  ): Promise<ValidationStatus | null> => {
    try {
      const response = await fetch('/feedback/question/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId,
          organizationId: organization.id,
        }),
      })
      if (!response.ok) {
        return null
      }
      const { status } = (await response.json()) as {
        status: ValidationStatus
      }
      return status
    } catch {
      return null
    }
  }

  const onSubmit = async (formData: FormSchema) => {
    setValidationOutcome(null)
    setIsValidating(true)
    const status = await validate(formData.message)
    setIsValidating(false)

    switch (status) {
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
      default:
        // Fall through to the assistant on validation outage so the user
        // isn't blocked by a transient classifier failure.
        onAskQuestion(formData.message)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6 pb-8"
      >
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
            display="block"
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
            display="block"
            borderRadius="l"
            backgroundColor="background-card"
            color="text-secondary"
            padding="l"
          >
            <div className="prose prose-sm dark:prose-invert">
              <MemoizedMarkdown content={validationOutcome.markdown} />
            </div>
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
                disabled={isValidating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isValidating}
                disabled={isValidating}
              >
                Send
              </Button>
            </>
          )}
        </div>
      </form>
    </Form>
  )
}
