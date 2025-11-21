'use client'

import { Well } from '@/components/Shared/Well'
import {
  SyntaxHighlighterClient,
  SyntaxHighlighterProvider,
} from '@/components/SyntaxHighlighterShiki/SyntaxHighlighterClient'
import { useToast } from '@/components/Toast/use-toast'
import { useUpdateEventType } from '@/hooks/queries/event_types'
import { apiErrorToast, setValidationErrors } from '@/utils/api/errors'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

interface EditEventTypeModalProps {
  eventTypeId: string
  eventName: string
  currentLabel: string
  hide: () => void
}

export const EditEventTypeModal = ({
  eventTypeId,
  eventName,
  currentLabel,
  hide,
}: EditEventTypeModalProps) => {
  const { toast } = useToast()
  const updateEventType = useUpdateEventType(eventTypeId)

  const form = useForm<{ label: string }>({
    defaultValues: {
      label: currentLabel,
    },
  })

  const onSubmit = useCallback(
    async (data: { label: string }) => {
      const { error } = await updateEventType.mutateAsync({
        label: data.label.trim(),
      })

      if (error) {
        if (error.detail) {
          setValidationErrors(error.detail, form.setError)
        } else {
          apiErrorToast(error, toast)
        }
        return
      }

      toast({
        title: 'Event type updated',
        description: `Label has been updated to "${data.label.trim()}".`,
      })

      hide()
    },
    [updateEventType, form, toast, hide],
  )

  return (
    <SyntaxHighlighterProvider>
      <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
        <div>
          <h2 className="text-xl">Edit Event Type</h2>
          <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
            Update the display label for event type "{eventName}"
          </p>
        </div>

        <div className="flex flex-col gap-y-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-y-6"
            >
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input value={eventName} disabled />
              </FormItem>

              <FormField
                control={form.control}
                name="label"
                rules={{
                  required: 'Label is required',
                  minLength: {
                    value: 1,
                    message: 'Label must be at least 1 character',
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Label</FormLabel>
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-4 flex flex-row items-center gap-x-4">
                <Button
                  className="self-start"
                  type="submit"
                  loading={form.formState.isSubmitting}
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={hide}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="dark:border-polar-700 border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium">Ingesting Events</h3>
          <p className="dark:text-polar-500 mt-2 text-xs text-gray-500">
            To ingest events with this label, use the following event name:
          </p>
          <Well className="dark:bg-polar-900 mt-4 rounded-lg bg-gray-100 p-4 text-xs">
            <SyntaxHighlighterClient
              lang="typescript"
              code={`await polar.events.ingest({
  events: [{
    name: "${eventName}",
    customerId: "<value>",
    metadata: {
      // your custom properties
    },
  }],
});`}
            />
          </Well>
        </div>
      </div>
    </SyntaxHighlighterProvider>
  )
}
