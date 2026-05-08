'use client'

import { ChipSelect } from '@/components/Form/ChipSelect'
import { AUPBlocker } from '@/components/Onboarding/AUPBlocker'
import { toast } from '@/components/Toast/use-toast'
import { useUpdateOrganization } from '@/hooks/queries'
import { useOrganizationKYC } from '@/hooks/queries/org'
import { useAupValidation } from '@/hooks/useAupValidation'
import { setValidationErrors } from '@/utils/api/errors'
import { getQueryClient } from '@/utils/api/query'
import { PRICING_MODELS, SELLING_CATEGORIES } from '@/utils/productCategories'
import { isValidationError, schemas } from '@polar-sh/client'
import { Text, type TextColor } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import Button from '@polar-sh/ui/components/atoms/Button'
import TextArea from '@polar-sh/ui/components/atoms/TextArea'
import { Form, FormField, FormMessage } from '@polar-sh/ui/components/ui/form'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { SectionLayout } from './SectionLayout'

const MIN_LENGTH = 30
const MAX_LENGTH = 3000

type SubmittingState = 'submitting' | 'submitting-anyway' | null

interface Props {
  organization: schemas['Organization']
}

interface FormValues {
  product_description: string
  selling_categories: string[]
  pricing_models: string[]
}

export const ProductDescriptionSection = ({ organization }: Props) => {
  const updateOrganization = useUpdateOrganization()
  const { data: kycData, isLoading: isKYCLoading } = useOrganizationKYC(
    organization.id,
  )

  const form = useForm<FormValues>({
    defaultValues: {
      product_description: '',
      selling_categories: [],
      pricing_models: [],
    },
  })
  const { control, handleSubmit, setError, formState, reset, setValue } = form
  const productDescription = useWatch({ control, name: 'product_description' })
  const sellingCategories = useWatch({ control, name: 'selling_categories' })
  const pricingModels = useWatch({ control, name: 'pricing_models' })

  const aup = useAupValidation()
  const [submitting, setSubmitting] = useState<SubmittingState>(null)

  useEffect(() => {
    if (kycData?.details) {
      reset({
        product_description: kycData.details.product_description ?? '',
        selling_categories: kycData.details.selling_categories ?? [],
        pricing_models: kycData.details.pricing_models ?? [],
      })
    }
  }, [kycData, reset])

  const blockedSelected = useMemo(
    () =>
      sellingCategories.filter((name) =>
        SELLING_CATEGORIES.some((c) => c.name === name && c.prohibited),
      ),
    [sellingCategories],
  )

  const persistDetails = async (values: FormValues) => {
    const { error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        details: {
          ...kycData?.details,
          product_description: values.product_description,
          selling_categories: values.selling_categories,
          pricing_models: values.pricing_models,
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
      return false
    }

    reset(values)
    aup.reset()
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
    getQueryClient().invalidateQueries({
      queryKey: ['organizations', organization.id, 'kyc'],
    })
    return true
  }

  const onSubmit = async (values: FormValues) => {
    const result = await aup.validate({
      product_description: values.product_description,
      selling_categories: values.selling_categories,
      pricing_models: values.pricing_models,
    })

    if (!result.ok) {
      toast({
        title: 'Validation failed',
        description: 'Something went wrong, please try again.',
      })
      return
    }

    if (result.verdict === 'DENY' || result.verdict === 'CLARIFY') return

    setSubmitting('submitting')
    await persistDetails(values)
    setSubmitting(null)
  }

  const onContinueAnyway = async () => {
    setSubmitting('submitting-anyway')
    await persistDetails(form.getValues())
    setSubmitting(null)
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

  const showContinueAnyway =
    aup.verdict === 'CLARIFY' &&
    aup.history.length >= 3 &&
    productDescription.trim().length > 30 &&
    !aup.isValidating

  const submitDisabled =
    submitting === 'submitting-anyway' ||
    blockedSelected.length > 0 ||
    (!formState.isDirty && !aup.verdict)

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <SectionLayout
          description="Describe what your product is and does, who it's for, and your pricing model."
          footerEnd={
            <Box display="flex" alignItems="center" columnGap="s">
              {showContinueAnyway && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onContinueAnyway}
                  loading={submitting === 'submitting-anyway'}
                  disabled={submitting === 'submitting'}
                >
                  Continue without review
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                onClick={() => form.clearErrors()}
                loading={aup.isValidating || submitting === 'submitting'}
                disabled={submitDisabled}
              >
                {aup.verdict ? 'Review again' : 'Save'}
              </Button>
            </Box>
          }
        >
          <Box display="flex" flexDirection="column" rowGap="xl">
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
                <Box display="flex" flexDirection="column" rowGap="xs">
                  <TextArea
                    {...field}
                    rows={4}
                    placeholder="SaaS project management tool for distributed teams. Subscription pricing at $29/month per user."
                    className="resize-none"
                  />
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="between"
                    columnGap="s"
                  >
                    <FormMessage />
                    <Text variant="caption" color={counterColor}>
                      {charCount}/{MAX_LENGTH} (min {MIN_LENGTH})
                    </Text>
                  </Box>
                </Box>
              )}
            />

            <Box display="flex" flexDirection="column" rowGap="m">
              <Text variant="label" color="default">
                What are you selling?
              </Text>
              <ChipSelect
                options={SELLING_CATEGORIES.map((c) => c.name)}
                selected={sellingCategories}
                onChange={(val) =>
                  setValue('selling_categories', val, {
                    shouldDirty: true,
                  })
                }
              />
              {blockedSelected.length > 0 && (
                <AUPBlocker categories={blockedSelected} />
              )}
            </Box>

            <Box display="flex" flexDirection="column" rowGap="m">
              <Text variant="label" color="default">
                Pricing model
              </Text>
              <ChipSelect
                options={PRICING_MODELS}
                selected={pricingModels}
                onChange={(val) =>
                  setValue('pricing_models', val, { shouldDirty: true })
                }
              />
            </Box>

            {aup.verdict && (
              <Box
                display="flex"
                flexDirection="column"
                rowGap="s"
                borderRadius="m"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-warning"
                backgroundColor="background-warning"
                padding="l"
              >
                <Text variant="label" color="warning">
                  {aup.verdict === 'CLARIFY'
                    ? 'Please clarify your use case'
                    : 'Use case not supported'}
                </Text>
                {aup.message && (
                  <Text variant="caption" color="warning">
                    {aup.message}
                  </Text>
                )}
              </Box>
            )}
          </Box>
        </SectionLayout>
      </form>
    </Form>
  )
}
