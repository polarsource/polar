'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { useURLValidation } from '@/hooks/useURLValidation'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { isValidationError, schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import { Form, FormField, FormMessage } from '@polar-sh/ui/components/ui/form'
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { SectionLayout } from './SectionLayout'

interface Props {
  organization: schemas['Organization']
}

interface FormValues {
  website: string
}

export const ProductUrlSection = ({ organization }: Props) => {
  const updateOrganization = useUpdateOrganization()
  const { status: urlStatus, validateURL } = useURLValidation({
    organizationId: organization.id,
  })

  const form = useForm<FormValues>({
    defaultValues: { website: organization.website ?? '' },
  })
  const { control, handleSubmit, setError, formState, reset } = form

  const onSubmit = async ({ website }: FormValues) => {
    const { data, error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: { website },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        toast({
          title: 'Failed to update website',
          description:
            typeof error.detail === 'string'
              ? error.detail
              : 'Please try again.',
        })
      }
      return
    }

    reset({ website: data.website ?? '' })
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SectionLayout
          description="Add the public URL where customers can learn about your product or buy it. We will verify that the page loads."
          footerEnd={
            <Button
              type="submit"
              size="sm"
              loading={updateOrganization.isPending}
              disabled={!formState.isDirty || updateOrganization.isPending}
            >
              Save
            </Button>
          }
        >
          <FormField
            control={control}
            name="website"
            rules={{
              required: 'Product website is required',
              validate: (value) => {
                if (!value) return 'Product website is required'
                if (!value.startsWith('https://')) {
                  return 'Website must start with https://'
                }
                try {
                  new URL(value)
                  return true
                } catch {
                  return 'Please enter a valid URL'
                }
              },
            }}
            render={({ field }) => (
              <Box>
                <Input
                  type="url"
                  {...field}
                  value={field.value || ''}
                  placeholder="https://acme.com"
                  onChange={(e) => {
                    let value = e.target.value
                    if (value.startsWith('http://')) {
                      value = value.replace('http://', 'https://')
                    }
                    const hasProtocol = value.startsWith('https://')
                    const isTypingProtocol =
                      'https://'.startsWith(value) ||
                      'http://'.startsWith(value)
                    if (!hasProtocol && !isTypingProtocol) {
                      value = 'https://' + value
                    }
                    field.onChange(value)
                  }}
                  onBlur={(e) => {
                    field.onBlur()
                    void validateURL(e.target.value)
                  }}
                  postSlot={
                    urlStatus === 'validating' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : urlStatus === 'valid' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : urlStatus === 'invalid' ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : null
                  }
                />
                <FormMessage />
                {urlStatus === 'invalid' && (
                  <Box marginTop="xs">
                    <Text variant="caption" color="warning">
                      Website appears to be unreachable
                    </Text>
                  </Box>
                )}
              </Box>
            )}
          />
        </SectionLayout>
      </form>
    </Form>
  )
}
