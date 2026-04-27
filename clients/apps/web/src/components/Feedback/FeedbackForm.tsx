import { extractApiErrorMessage } from '@/utils/api/errors'
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
import { useForm } from 'react-hook-form'

import { collectClientContext } from './clientContext'
import { useSubmitFeedback } from './useSubmitFeedback'

interface FormSchema {
  type: schemas['FeedbackType']
  message: string
}

const MAX_MESSAGE_LENGTH = 5000

export const FeedbackForm = ({
  organization,
  onSuccess,
  onCancel,
}: {
  organization: schemas['Organization']
  onSuccess: (type: schemas['FeedbackType']) => void
  onCancel: () => void
}) => {
  const form = useForm<FormSchema>({
    defaultValues: {
      type: 'feedback',
      message: '',
    },
  })

  const { control, handleSubmit } = form

  const submitFeedback = useSubmitFeedback()
  const apiError = submitFeedback.data?.error
    ? extractApiErrorMessage(submitFeedback.data.error)
    : null

  const onSubmit = async (formData: FormSchema) => {
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <FormField
          control={control}
          name="type"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="dark:bg-polar-950 w-full flex-row items-center rounded-full bg-gray-100">
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {apiError && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {apiError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={submitFeedback.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitFeedback.isPending}
            disabled={submitFeedback.isPending}
          >
            {submitFeedback.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
