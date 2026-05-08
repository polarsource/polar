'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { useOrganizationKYC } from '@/hooks/queries/org'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { isValidationError, schemas } from '@polar-sh/client'
import { Text, type TextColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { Form, FormField, FormMessage } from '@polar-sh/ui/components/ui/form'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { SectionLayout } from './SectionLayout'

const MIN_LENGTH = 30
const MAX_LENGTH = 3000

interface Props {
  organization: schemas['Organization']
}

interface FormValues {
  product_description: string
}

export const ProductDescriptionSection = ({ organization }: Props) => {
  const updateOrganization = useUpdateOrganization()
  const { data: kycData, isLoading: isKYCLoading } = useOrganizationKYC(
    organization.id,
  )

  const form = useForm<FormValues>({
    defaultValues: { product_description: '' },
  })
  const { control, handleSubmit, setError, formState, reset } = form
  const productDescription = useWatch({ control, name: 'product_description' })

  useEffect(() => {
    if (kycData?.details) {
      reset({
        product_description: kycData.details.product_description ?? '',
      })
    }
  }, [kycData, reset])

  const onSubmit = async ({ product_description }: FormValues) => {
    const { error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        details: {
          ...kycData?.details,
          product_description,
          switching: kycData?.details?.switching ?? false,
        },
      },
    })

    if (error) {
      if (isValidationError(error.detail)) {
        setValidationErrors(error.detail, setError)
      } else {
        toast({
          title: 'Failed to update product description',
          description:
            typeof error.detail === 'string'
              ? error.detail
              : 'Please try again.',
        })
      }
      return
    }

    reset({ product_description })
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
    getQueryClient().invalidateQueries({
      queryKey: ['organizations', organization.id, 'kyc'],
    })
  }

  if (isKYCLoading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        paddingVertical="xl"
      >
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </Box>
    )
  }

  const charCount = productDescription?.length ?? 0
  const getCounterColor = (): TextColor => {
    if (charCount > MAX_LENGTH) return 'danger'
    if (charCount > 0 && charCount < MIN_LENGTH) return 'warning'
    return 'muted'
  }
  const counterColor = getCounterColor()

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SectionLayout
          description="Describe what your product is and does, who it's for, and your pricing model."
          footerStart={
            <Text variant="caption" color={counterColor}>
              {charCount}/{MAX_LENGTH} (min {MIN_LENGTH})
            </Text>
          }
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
            name="product_description"
            rules={{
              required: 'Please describe what you sell',
              minLength: {
                value: MIN_LENGTH,
                message: `Please provide at least ${MIN_LENGTH} characters`,
              },
              maxLength: {
                value: MAX_LENGTH,
                message: `Please keep under ${MAX_LENGTH} characters`,
              },
            }}
            render={({ field }) => (
              <Box>
                <TextArea
                  {...field}
                  rows={4}
                  placeholder="SaaS project management tool for distributed teams. Subscription pricing at $29/month per user."
                  className="resize-none"
                />
                <FormMessage />
              </Box>
            )}
          />
        </SectionLayout>
      </form>
    </Form>
  )
}
