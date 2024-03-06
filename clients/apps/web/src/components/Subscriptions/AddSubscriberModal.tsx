import {
  Organization,
  ResponseError,
  SubscriptionCreateEmail,
  ValidationError,
} from '@polar-sh/sdk'
import { api } from 'polarkit'
import { setValidationErrors } from 'polarkit/api/errors'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { ModalHeader } from '../Modal'

const AddSubscriberModal = ({
  hide,
  organization,
}: {
  hide: (added: boolean) => void
  organization: Organization
}) => {
  const form = useForm<SubscriptionCreateEmail>()
  const { control, handleSubmit, setError } = form
  const [loading, setLoading] = useState(false)

  const onSubmit: SubmitHandler<SubscriptionCreateEmail> = useCallback(
    async (subscriptionCreateEmail) => {
      setLoading(true)
      try {
        await api.subscriptions.createEmailSubscription({
          organizationName: organization.name,
          platform: organization.platform,
          subscriptionCreateEmail,
        })
        hide(true)
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          } else if (body['detail']) {
            setError('email', { message: body['detail'] })
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [organization, hide, setError],
  )

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={() => hide(false)}>
        <h3 className="dark:text-polar-50 text-lg font-medium text-gray-950">
          Add subscriber
        </h3>
      </ModalHeader>
      <div className="overflow-scroll p-8">
        <div className="flex flex-col gap-y-6">
          <Form {...form}>
            <form
              className="flex flex-col gap-y-6"
              onSubmit={handleSubmit(onSubmit)}
            >
              <FormField
                control={control}
                name="email"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="off"
                          data-1p-ignore
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        This email will be subscribed to your Free plan.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />{' '}
              <div className="mt-4 flex flex-row items-center gap-x-4">
                <Button className="self-start" type="submit" loading={loading}>
                  Create
                </Button>
                <Button
                  variant="ghost"
                  className="self-start"
                  onClick={() => hide(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </>
  )
}

export default AddSubscriberModal
