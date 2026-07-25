import { schemas } from '@polar-sh/client'
import { Input } from '@polar-sh/orbit'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useFormContext } from 'react-hook-form'

export const LinkBenefitForm = () => {
  const { control } = useFormContext<schemas['BenefitLinkCreate']>()

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
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>URL</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                placeholder="https://example.com/welcome?email={CUSTOMER_EMAIL}"
              />
            </FormControl>
            <FormDescription>
              Where customers are directed after purchase. The{' '}
              {'{CUSTOMER_EMAIL}'} and {'{CUSTOMER_EXTERNAL_ID}'} placeholders
              are replaced with the customer&apos;s values — useful to prefill
              your signup form, but don&apos;t treat them as authentication.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
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
