import { enums, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import { Checkbox } from '@polar-sh/ui/components/ui/checkbox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, type MouseEvent } from 'react'
import { useFormContext } from 'react-hook-form'

type CreateOrUpdate =
  | schemas['WebhookEndpointCreate']
  | schemas['WebhookEndpointUpdate']

const isPrivateIP = (hostname: string): boolean => {
  const parts = hostname.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number)
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 100 && b >= 64 && b <= 127) return true
  }
  if (hostname.includes(':')) {
    if (/^f[cd][0-9a-f]{2}:/i.test(hostname)) return true
    if (/^fe[89ab][0-9a-f]:/i.test(hostname)) return true
  }
  return false
}

export const FieldName = () => {
  const { control } = useFormContext<CreateOrUpdate>()

  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>Name</FormLabel>
          </div>
          <FormControl>
            <Input
              {...field}
              value={field.value || ''}
              placeholder="My Webhook (optional)"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

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
          try {
            const url = new URL(value)
            const hostname = url.hostname.toLowerCase()
            const localhostHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']
            if (localhostHosts.includes(hostname)) {
              return 'Webhook URLs cannot point to localhost or private IP addresses.'
            }
            if (isPrivateIP(hostname)) {
              return 'Webhook URLs cannot point to localhost or private IP addresses.'
            }
          } catch {
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
            <Input
              {...field}
              value={field.value || ''}
              placeholder="https://..."
              onBlur={(e) => field.onChange(e.target.value.trim())}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const FieldFormat = () => {
  const { control, watch, setValue } = useFormContext<CreateOrUpdate>()

  const url = watch('url')
  useEffect(() => {
    if (!url) {
      return
    }
    if (url.startsWith('https://discord.com/api/webhooks')) {
      setValue('format', 'discord')
    } else if (url.startsWith('https://hooks.slack.com/services/')) {
      setValue('format', 'slack')
    }
  }, [url, setValue])

  return (
    <FormField
      control={control}
      name="format"
      rules={{
        required: 'This field is required',
      }}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1">
          <div className="flex flex-row items-center justify-between">
            <FormLabel>Format</FormLabel>
          </div>
          <FormControl>
            <Select
              {...field}
              value={field.value || undefined}
              onValueChange={field.onChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a payload format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">Raw</SelectItem>
                <SelectItem value="discord">Discord</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const FieldEvents = () => {
  const { control, setValue, watch } = useFormContext<CreateOrUpdate>()

  const allEvents = useMemo(
    () => Object.values(enums.webhookEventTypeValues),
    [],
  )

  const currentEvents = watch('events')

  const allSelected = useMemo(
    () => allEvents.every((event) => currentEvents?.includes(event)),
    [currentEvents, allEvents],
  )

  const onToggleAll = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()

      let values: Array<schemas['WebhookEventType']> = []
      if (!allSelected) {
        values = allEvents
      }
      setValue('events', values)
    },
    [setValue, allSelected, allEvents],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row items-center">
        <h2 className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Events
        </h2>

        <div className="flex-auto text-right">
          <Button onClick={onToggleAll} variant="secondary" size="sm">
            {!allSelected ? 'Select All' : 'Unselect All'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-y-2">
        {allEvents.map((event) => (
          <FormField
            key={event}
            control={control}
            name="events"
            render={({ field }) => {
              const href = `https://polar.sh/docs/api-reference/webhooks/${event}`

              return (
                <FormItem className="flex flex-row items-center space-y-0 space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={
                        field.value ? field.value.includes(event) : false
                      }
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
                  <FormLabel className="text-sm leading-none">
                    {event}
                  </FormLabel>
                  <Link
                    className="text-xs text-blue-400"
                    href={href}
                    target="_blank"
                  >
                    Schema
                  </Link>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
        ))}
      </div>
    </div>
  )
}
