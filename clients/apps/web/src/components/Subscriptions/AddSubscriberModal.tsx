import { useFreeTier } from '@/hooks/queries'
import { api } from '@/utils/api'
import { setValidationErrors } from '@/utils/api/errors'
import { Organization, ResponseError, ValidationError } from '@polar-sh/sdk'
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
  const { data: freeTier } = useFreeTier(organization.id)
  const form = useForm<{ email: string }>()
  const { control, handleSubmit, setError } = form
  const [loading, setLoading] = useState(false)

  const onSubmit: SubmitHandler<{ email: string }> = useCallback(
    async (formData) => {
      if (!freeTier) {
        return
      }

      setLoading(true)
      try {
        await api.subscriptions.createSubscription({
          subscriptionCreateEmail: {
            ...formData,
            product_id: freeTier.id,
          },
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
    [freeTier, hide, setError],
  )

  return (
    <>
      <ModalHeader className="px-8 py-4" hide={() => hide(false)}>
        <h3 className="text-lg font-medium text-gray-950 dark:text-white">
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
