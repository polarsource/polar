'use client'

import revalidate from '@/app/actions'
import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitPublicInner,
  Organization,
  ProductCreate,
  ProductPrice,
  ProductPriceType,
  ResponseError,
  SubscriptionRecurringInterval,
  ValidationError,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { ProductFullMediasMixin } from '../ProductForm'

export const useCreateProductWizard = (organization: Organization) => {
  const router = useRouter()
  const benefits = useBenefits(organization.id)
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    BenefitPublicInner['id'][]
  >([])

  const [isLoading, setLoading] = useState(false)

  const form = useForm<ProductCreate & ProductFullMediasMixin>({
    defaultValues: {
      ...{
        prices: [
          {
            type: ProductPriceType.ONE_TIME,
            price_amount: undefined,
            price_currency: 'usd',
          },
        ],
      },
      ...{
        medias: [],
        full_medias: [],
      },
      organization_id: organization.id,
    },
  })
  const { handleSubmit, control, setError } = form

  const createProduct = useCreateProduct(organization.id)
  const updateBenefits = useUpdateProductBenefits(organization.id)

  const onSubmit = useCallback(
    async (productCreate: ProductCreate & ProductFullMediasMixin) => {
      try {
        setLoading(true)
        const { full_medias, ...productCreateRest } = productCreate
        const product = await createProduct.mutateAsync({
          ...productCreateRest,
          medias: full_medias.map((media) => media.id),
        })
        await updateBenefits.mutateAsync({
          id: product.id,
          body: {
            benefits: enabledBenefitIds,
          },
        })

        revalidate(`products:${organization.id}:recurring`)
        revalidate(`products:${organization.id}:one_time`)

        router.push(`/dashboard/${organization.slug}/products`)
      } catch (e) {
        setLoading(false)
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          }
        }
      }
    },
    [
      organization,
      enabledBenefitIds,
      createProduct,
      updateBenefits,
      setError,
      router,
    ],
  )

  const onSelectBenefit = useCallback(
    (benefit: BenefitPublicInner) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: BenefitPublicInner) => {
      setEnabledBenefitIds((benefitIds) =>
        benefitIds.filter((b) => b !== benefit.id),
      )
    },
    [setEnabledBenefitIds],
  )

  const enabledBenefits = useMemo(
    () =>
      organizationBenefits.filter((benefit) =>
        enabledBenefitIds.includes(benefit.id),
      ),
    [organizationBenefits, enabledBenefitIds],
  )

  const pricesFieldArray = useFieldArray({
    control,
    name: 'prices',
  })
  const { fields: prices, append, replace } = pricesFieldArray

  const hasMonthlyPrice = useMemo(
    () =>
      (prices as ProductPrice[]).some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === SubscriptionRecurringInterval.MONTH,
      ),
    [prices],
  )
  const hasYearlyPrice = useMemo(
    () =>
      (prices as ProductPrice[]).some(
        (price) =>
          price.type === 'recurring' &&
          price.recurring_interval === SubscriptionRecurringInterval.YEAR,
      ),
    [prices],
  )

  const [pricingType, setPricingType] = useState<ProductPriceType | undefined>(
    hasMonthlyPrice || hasYearlyPrice
      ? ProductPriceType.RECURRING
      : ProductPriceType.ONE_TIME,
  )

  const [amountType, setAmountType] = useState<'fixed' | 'custom' | 'free'>(
    prices.length > 0 && (prices as ProductPrice[])[0].amount_type
      ? (prices as ProductPrice[])[0].amount_type
      : 'fixed',
  )

  useEffect(() => {
    if (pricingType === ProductPriceType.ONE_TIME) {
      if (amountType === 'fixed') {
        replace([
          {
            type: 'one_time',
            amount_type: 'fixed',
            price_currency: 'usd',
            price_amount: 0,
          },
        ])
      } else if (amountType === 'custom') {
        replace([
          {
            type: 'one_time',
            amount_type: 'custom',
            price_currency: 'usd',
          },
        ])
      } else {
        replace([
          {
            type: 'one_time',
            amount_type: 'free',
          },
        ])
      }
    } else if (pricingType === ProductPriceType.RECURRING) {
      if (amountType === 'fixed') {
        replace([
          {
            type: 'recurring',
            amount_type: 'fixed',
            recurring_interval: SubscriptionRecurringInterval.MONTH,
            price_currency: 'usd',
            price_amount: 0,
          },
        ])
      } else if (amountType === 'free') {
        replace([
          {
            type: 'recurring',
            amount_type: 'free',
            recurring_interval: SubscriptionRecurringInterval.MONTH,
          },
        ])
      } else {
        setAmountType('fixed')
      }
    }
  }, [pricingType, replace, amountType])

  return {
    form,
    handleSubmit,
    control,
    isLoading,
    onSubmit,
    onSelectBenefit,
    onRemoveBenefit,
    enabledBenefits,
    prices,
    append,
    pricingType,
    setPricingType,
    amountType,
    setAmountType,
    hasMonthlyPrice,
    hasYearlyPrice,
    pricesFieldArray,
  }
}
