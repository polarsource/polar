'use client'

import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'

import { components } from '@polar-sh/client'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ProductFullMediasMixin } from '../ProductForm/ProductForm'

export const useCreateProductWizard = (
  organization: components['schemas']['Organization'],
  onSuccess?: (product: components['schemas']['Product']) => void,
) => {
  const benefits = useBenefits(organization.id)
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    components['schemas']['Benefit']['id'][]
  >([])

  const form = useForm<
    components['schemas']['ProductCreate'] & ProductFullMediasMixin
  >({
    defaultValues: {
      ...{
        prices: [
          {
            type: 'one_time',
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
    async (
      productCreate: components['schemas']['ProductCreate'] &
        ProductFullMediasMixin,
    ) => {
      const { full_medias, ...productCreateRest } = productCreate
      const { data: product, error } = await createProduct.mutateAsync({
        ...productCreateRest,
        medias: full_medias.map((media) => media.id),
      })
      if (error) {
        if (error.detail) {
          setValidationErrors(error.detail, setError)
        }
        return
      }

      await updateBenefits.mutateAsync({
        id: product.id,
        body: {
          benefits: enabledBenefitIds,
        },
      })

      onSuccess?.(product)
    },
    [enabledBenefitIds, createProduct, updateBenefits, setError, onSuccess],
  )

  const onSelectBenefit = useCallback(
    (benefit: components['schemas']['Benefit']) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: components['schemas']['Benefit']) => {
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
    isLoading: createProduct.isPending || updateBenefits.isPending,
    onSubmit,
    onSelectBenefit,
    onRemoveBenefit,
    enabledBenefits,
    organizationBenefits,
    benefits,
  }
}
