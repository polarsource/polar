'use client'

import { ChipSelect } from '@/components/Form/ChipSelect'
import { AUPBlocker } from '@/components/Onboarding/AUPBlocker'
import { toast } from '@/components/Toast/use-toast'
import { usePostHog } from '@/hooks/posthog'
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
import { AlertTriangleIcon, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import {
  FollowUpQuestionField,
  type FollowUpStatus,
} from './FollowUpQuestionField'
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
  const posthog = usePostHog()
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

  const aup = useAupValidation({ followUpEnabled: true })
  const [submitting, setSubmitting] = useState<SubmittingState>(null)

  const initializedRef = useRef(false)
  useEffect(() => {
    if (!initializedRef.current && kycData?.details) {
      initializedRef.current = true
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

  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({})
  const answersDirty =
    JSON.stringify(aup.answers) !== JSON.stringify(savedAnswers)

  const buildFinalDescription = (
    description: string,
    questions: typeof aup.questions,
    answers: typeof aup.answers,
  ): string => {
    const sections = questions
      .map((question) => {
        const answer = answers[question.id]
        if (!answer) return null
        return `${question.label}\n${answer}`
      })
      .filter((section): section is string => section !== null)

    if (sections.length === 0) return description
    return `${description}\n\n${sections.join('\n\n')}`
  }

  const persistDetails = async (
    values: FormValues,
    apiDescription: string,
    snapshotAnswers: Record<string, string>,
  ) => {
    const { error } = await updateOrganization.mutateAsync({
      id: organization.id,
      body: {
        details: {
          ...kycData?.details,
          product_description: apiDescription,
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
    setSavedAnswers({ ...snapshotAnswers })
    getQueryClient().invalidateQueries({
      queryKey: ['organizationReviewState', organization.id],
    })
    getQueryClient().invalidateQueries({
      queryKey: ['organizations', organization.id, 'kyc'],
    })
    return true
  }

  const onSubmit = async (values: FormValues) => {
    posthog.capture('dashboard:organizations:account_review_section:submit', {
      organization_id: organization.id,
      section: 'product_description',
    })

    const pendingQuestions = aup.questions
    const pendingAnswers = aup.answers

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

    if (result.verdict !== 'APPROVE') return

    const finalDescription = buildFinalDescription(
      values.product_description,
      pendingQuestions,
      pendingAnswers,
    )

    setSubmitting('submitting')
    await persistDetails(values, finalDescription, pendingAnswers)
    setSubmitting(null)
  }

  const onContinueAnyway = async () => {
    setSubmitting('submitting-anyway')
    const values = form.getValues()
    const finalDescription = buildFinalDescription(
      values.product_description,
      aup.questions,
      aup.answers,
    )
    await persistDetails(values, finalDescription, aup.answers)
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

  const statusFor = (questionId: string): FollowUpStatus => {
    if (aup.verdict === 'DENY') return 'denied'
    if (aup.evaluations[questionId]?.is_relevant) return 'approved'
    return 'pending'
  }

  const hasUnansweredRequired = aup.questions.some((question) => {
    if (!question.required) return false
    const answer = aup.answers[question.id]
    return !answer || answer.trim().length === 0
  })

  const hasIrrelevantAnswer = aup.questions.some(
    (question) => aup.evaluations[question.id]?.is_relevant === false,
  )

  const hasChanges = formState.isDirty || answersDirty

  const submitDisabled =
    submitting === 'submitting-anyway' ||
    blockedSelected.length > 0 ||
    hasUnansweredRequired ||
    (!hasChanges && !aup.verdict && !hasIrrelevantAnswer)

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
                  <TextArea {...field} rows={4} className="resize-none" />
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

            {aup.verdict === 'INSUFFICIENT' && aup.message && (
              <Box
                display="flex"
                flexDirection="column"
                rowGap="xs"
                borderRadius="m"
                backgroundColor="background-warning"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-warning"
                padding="l"
              >
                <Box display="flex" alignItems="center" columnGap="xs">
                  <Box color="text-warning" display="inline-flex">
                    <AlertTriangleIcon className="h-3.5 w-3.5" />
                  </Box>
                  <Text variant="label" color="warning">
                    More detail needed
                  </Text>
                </Box>
                <Text variant="caption" color="muted">
                  {aup.message}
                </Text>
              </Box>
            )}

            {aup.questions.length > 0 && (
              <Box
                display="flex"
                flexDirection="column"
                rowGap="xl"
                borderRadius="m"
                borderWidth={1}
                borderStyle="solid"
                borderColor="border-primary"
                padding="l"
              >
                {aup.verdict === 'DENY' && (
                  <Box display="flex" flexDirection="column" rowGap="xs">
                    <Box display="flex" alignItems="center" columnGap="xs">
                      <Box color="text-danger" display="inline-flex">
                        <AlertTriangleIcon className="h-3.5 w-3.5" />
                      </Box>
                      <Text variant="label" color="danger">
                        Use case not supported
                      </Text>
                    </Box>
                    {aup.message && (
                      <Text variant="caption" color="muted">
                        {aup.message}
                      </Text>
                    )}
                  </Box>
                )}
                <Box display="flex" flexDirection="column" rowGap="xl">
                  {aup.questions.map((question) => {
                    const status = statusFor(question.id)
                    const evaluation = aup.evaluations[question.id]
                    const reason =
                      status === 'pending' && evaluation?.is_relevant === false
                        ? evaluation.reason
                        : null
                    return (
                      <FollowUpQuestionField
                        key={question.id}
                        question={question}
                        value={aup.answers[question.id]}
                        onChange={(value) => aup.setAnswer(question.id, value)}
                        status={status}
                        reason={reason}
                      />
                    )
                  })}
                </Box>
              </Box>
            )}

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
          </Box>
        </SectionLayout>
      </form>
    </Form>
  )
}
