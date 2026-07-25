import { schemas } from '@polar-sh/client'
import { Button, Input, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { useFormContext } from 'react-hook-form'

const URL_VARIABLES = [
  {
    token: '{CUSTOMER_EMAIL}',
    label: 'Customer email',
    sample: 'jane@acme.com',
  },
  {
    token: '{CUSTOMER_EXTERNAL_ID}',
    label: 'External ID',
    sample: 'usr_1234',
  },
] as const

const VARIABLE_SPLIT = /(\{CUSTOMER_EMAIL\}|\{CUSTOMER_EXTERNAL_ID\})/
const VARIABLE_LIKE = /\{\w+\}/g

const findUnknownVariable = (url: string) =>
  url
    .match(VARIABLE_LIKE)
    ?.find((token) => !URL_VARIABLES.some((v) => v.token === token))

const UrlPreview = ({ url }: { url: string }) => (
  <Box
    flexDirection="column"
    rowGap="s"
    marginTop="xs"
    backgroundColor="background-card"
    borderRadius="m"
    padding="l"
  >
    <div className="flex flex-col gap-1 [overflow-wrap:anywhere]">
      <Text variant="caption" color="muted">
        Preview
      </Text>
      <Text variant="caption" monospace>
        {url
          .split(VARIABLE_SPLIT)
          .filter(Boolean)
          .map((segment, index) => {
            const variable = URL_VARIABLES.find((v) => v.token === segment)
            return (
              <Text
                key={index}
                as="span"
                variant="caption"
                monospace
                color={variable ? 'accent' : 'inherit'}
              >
                {variable ? encodeURIComponent(variable.sample) : segment}
              </Text>
            )
          })}
      </Text>
    </div>
    <Text variant="caption" color="muted">
      Customers can edit these values — don&apos;t treat them as authentication.
    </Text>
  </Box>
)

export const LinkBenefitForm = () => {
  const { control } = useFormContext<schemas['BenefitLinkCreate']>()
  const urlInputRef = useRef<HTMLInputElement | null>(null)

  const insertVariable = (
    token: string,
    value: string,
    onChange: (value: string) => void,
  ) => {
    const input = urlInputRef.current
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + token + value.slice(end))
    requestAnimationFrame(() => {
      if (!input) return
      input.focus()
      const caret = start + token.length
      input.setSelectionRange(caret, caret)
    })
  }

  return (
    <>
      <FormField
        control={control}
        name="properties.url"
        rules={{
          required: 'This field is required',
          pattern: {
            value: /^https?:\/\/.+/,
            message: 'URL must start with http:// or https://',
          },
          validate: (value) => {
            const unknown = findUnknownVariable(value ?? '')
            return unknown
              ? `Unknown variable ${unknown}. Supported variables: ${URL_VARIABLES.map(
                  (v) => v.token,
                ).join(', ')}.`
              : true
          },
        }}
        render={({ field }) => {
          const value = field.value ?? ''
          return (
            <FormItem>
              <FormLabel>URL</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  ref={(element) => {
                    field.ref(element)
                    urlInputRef.current = element
                  }}
                  value={value}
                  placeholder="https://example.com/welcome?email={CUSTOMER_EMAIL}"
                />
              </FormControl>
              <FormDescription>
                Where customers are directed after purchase.
              </FormDescription>
              <Box columnGap="xs" rowGap="xs" flexWrap="wrap" marginTop="xs">
                {URL_VARIABLES.map((variable) => (
                  <Button
                    key={variable.token}
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={value.includes(variable.token)}
                    onClick={() =>
                      insertVariable(variable.token, value, field.onChange)
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {variable.label}
                  </Button>
                ))}
              </Box>
              {VARIABLE_SPLIT.test(value) && <UrlPreview url={value} />}
              <FormMessage />
            </FormItem>
          )
        }}
      />
      <FormField
        control={control}
        name="properties.label"
        rules={{
          maxLength: {
            value: 42,
            message: 'Label length must be less than 42 characters long',
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Button label</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || null)}
                placeholder="Open App"
              />
            </FormControl>
            <FormDescription>
              Optional label of the button shown to customers. Defaults to
              &ldquo;Open link&rdquo;.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
