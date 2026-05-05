'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { useOrganizationKYC } from '@/hooks/queries/org'
import { getQueryClient } from '@/utils/api/query'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { Form, FormField, FormMessage } from '@polar-sh/ui/components/ui/form'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'

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
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-y-3">
        <p className="dark:text-polar-400 text-xs text-gray-600">
          Describe what your product is and does, who it&rsquo;s for, and your
          pricing model.
        </p>
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
            <div>
              <TextArea
                {...field}
                rows={4}
                placeholder="SaaS project management tool for distributed teams. Subscription pricing at $29/month per user."
                className="resize-none"
              />
              <div className="mt-1 flex items-center justify-between">
                <FormMessage />
                <span className="text-xs text-gray-500">
                  {productDescription?.length ?? 0}/{MAX_LENGTH} characters (min{' '}
                  {MIN_LENGTH})
                </span>
              </div>
            </div>
          )}
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={updateOrganization.isPending}
            disabled={!formState.isDirty || updateOrganization.isPending}
          >
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}
