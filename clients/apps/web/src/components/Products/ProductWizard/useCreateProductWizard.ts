'use client'

import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  type Benefit,
  Organization,
  Product,
  ProductCreate,
  ProductPriceType,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ProductFullMediasMixin } from '../ProductForm/ProductForm'

export const useCreateProductWizard = (
  organization: Organization,
  onSuccess?: (product: Product) => void,
) => {
  const benefits = useBenefits(organization.id)
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    Benefit['id'][]
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

  const createProduct = useCreateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

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

        onSuccess?.(product)
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
          }
        }
      } finally {
        setLoading(false)
      }
    },
    [enabledBenefitIds, createProduct, updateBenefits, setError, onSuccess],
  )

  const onSelectBenefit = useCallback(
    (benefit: Benefit) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: Benefit) => {
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

  return {
    form,
    handleSubmit,
    control,
    isLoading,
    onSubmit,
    onSelectBenefit,
    onRemoveBenefit,
    enabledBenefits,
    organizationBenefits,
    benefits,
  }
}
