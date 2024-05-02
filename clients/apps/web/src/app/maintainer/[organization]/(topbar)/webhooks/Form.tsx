import {
  WebhookEndpointCreate,
  WebhookEndpointUpdate,
  WebhookEventType,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'

import Link from 'next/link'
import { useFormContext } from 'react-hook-form'

type CreateOrUpdate = WebhookEndpointCreate | WebhookEndpointUpdate

export const FieldUrl = () => {
  const { control } = useFormContext<CreateOrUpdate>()

  return (
    <FormField
      control={control}
      name="url"
      rules={{
        required: 'This field is required',
        validate: (value) => {
          if (!value) {
            return false
          }
          if (!value.startsWith('https://')) {
            return false
          }
          return true
        },
      }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>URL</FormLabel>
          </div>
          <FormControl>
            <Input {...field} placeholder="https://..." />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const FieldSecret = ({ isUpdate }: { isUpdate: boolean }) => {
  const form = useFormContext<CreateOrUpdate>()

  const generateSecret = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const id = window.crypto.randomUUID()
    form.setValue('secret', id.replaceAll('-', ''))
  }

  return (
    <FormField
      control={form.control}
      name="secret"
      rules={
        isUpdate
          ? undefined
          : {
              required: 'This field is required',
            }
      }
      render={({ field }) => {
        return (
          <FormItem className="flex flex-col gap-1">
            <div className="flex flex-row items-center justify-between">
              <FormLabel>Secret</FormLabel>
            </div>
            <div className="flex flex-row items-center gap-2">
              <FormControl>
                <Input
                  {...field}
                  placeholder={
                    isUpdate
                      ? 'Changing the secret will override your existing signing key...'
                      : undefined
                  }
                />
              </FormControl>
              <Button onClick={generateSecret}>Generate</Button>
            </div>
            <div className="text-xs text-gray-500">
              Polar will sign all webhook payloads with this secret (following
              the{' '}
              <a
                href="https://www.standardwebhooks.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium"
              >
                Standard Webhooks
              </a>{' '}
              specification) so that you can validate that the request is coming
              from us.
            </div>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export const FieldEvents = () => {
  const form = useFormContext<CreateOrUpdate>()
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Events
      </h2>

      {Object.values(WebhookEventType).map((event) => (
        <FormField
          key={event}
          control={form.control}
          name="events"
          render={({ field }) => {
            const docsKey = event.replaceAll('.', '_')

            // Example: https://api.polar.sh/docs#/webhooks/subscription_tier_updatedsubscription_tier_updated_post
            // yes, docsKey is repeated twice
            const href = `https://api.polar.sh/docs#/webhooks/${docsKey}${docsKey}_post`

            return (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    defaultChecked={field.value && field.value.includes(event)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        field.onChange([...(field.value || []), event])
                      } else {
                        field.onChange(
                          (field.value || []).filter((v) => v !== event),
                        )
                      }
                    }}
                  />
                </FormControl>
                <FormLabel className="text-sm leading-none">{event}</FormLabel>
                <Link className="text-xs text-blue-400" href={href}>
                  Schema
                </Link>
                <FormMessage />
              </FormItem>
            )
          }}
        />
      ))}
    </div>
  )
}
