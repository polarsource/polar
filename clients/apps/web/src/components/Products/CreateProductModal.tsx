import revalidate from '@/app/actions'
import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { useStore } from '@/store'
import { setValidationErrors } from '@/utils/api/errors'
import { isFeatureEnabled } from '@/utils/feature-flags'
import {
  BenefitPublicInner,
  Organization,
  ProductCreate,
  ProductPriceRecurringInterval,
  ProductPriceType,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { isPremiumArticlesBenefit } from '../Benefit/utils'
import { InlineModalHeader } from '../Modal/InlineModal'
import ProductBenefitsForm from './ProductBenefitsForm'
import ProductForm from './ProductForm'

export interface CreateProductModalProps {
  organization: Organization
  productPriceType?: ProductPriceType
  hide: () => void
}

export const CreateProductModal = ({
  organization,
  productPriceType,
  hide,
}: CreateProductModalProps) => {
  const benefits = useBenefits(organization.id)
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  const {
    formDrafts: { ProductCreate: savedFormValues },
    saveDraft,
    clearDraft,
  } = useStore()

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    BenefitPublicInner['id'][]
    // Pre-select premium articles benefit
  >(organizationBenefits.filter(isPremiumArticlesBenefit).map(({ id }) => id))

  const form = useForm<ProductCreate>({
    defaultValues: {
      ...(savedFormValues ? savedFormValues : {}),
      organization_id: organization.id,
      prices: (!isFeatureEnabled('products') ||
      productPriceType === ProductPriceType.RECURRING
        ? [
            {
              type: ProductPriceType.RECURRING,
              recurring_interval: ProductPriceRecurringInterval.MONTH,
              price_amount: undefined,
              price_currency: 'usd',
            },
          ]
        : [
            {
              type: ProductPriceType.ONE_TIME,
              price_amount: undefined,
              price_currency: 'usd',
            },
          ]) as any,
    },
  })
  const { handleSubmit, watch, setError } = form
  const newProduct = watch()

  const createProduct = useCreateProduct(organization.id)
  const updateBenefits = useUpdateProductBenefits(organization.id)

  const onSubmit = useCallback(
    async (productCreate: ProductCreate) => {
      try {
        const product = await createProduct.mutateAsync(productCreate)
        await updateBenefits.mutateAsync({
          id: product.id,
          productBenefitsUpdate: {
            benefits: enabledBenefitIds,
          },
        })

        clearDraft('ProductCreate')

        revalidate(`products:${organization.id}:recurring`)
        revalidate(`products:${organization.id}:one_time`)

        hide()
      } catch (e) {
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
      clearDraft,
      hide,
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

  useEffect(() => {
    const pagehideListener = () => {
      saveDraft('ProductCreate', newProduct)
    }
    window.addEventListener('pagehide', pagehideListener)
    return () => window.removeEventListener('pagehide', pagehideListener)
  }, [newProduct, saveDraft])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex flex-col gap-y-4">
          <InlineModalHeader hide={hide}>
            <h3>Create Product</h3>
          </InlineModalHeader>
          <p className="dark:text-polar-500 px-8 text-sm leading-relaxed text-gray-500">
            Products are benefits which can be purchased at a fixed price.
            Configure the product metadata and select benefits you want to grant
            below.
          </p>
        </div>
        <div className="flex flex-col gap-y-8 p-8">
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-y-8"
            >
              <ProductForm update={false} />
            </form>
          </Form>
          <ProductBenefitsForm
            className="w-full"
            organization={organization}
            organizationBenefits={organizationBenefits.filter(
              (benefit) =>
                // Hide not selectable benefits unless they are already enabled
                benefit.selectable ||
                enabledBenefits.some((b) => b.id === benefit.id),
            )}
            benefits={enabledBenefits}
            onSelectBenefit={onSelectBenefit}
            onRemoveBenefit={onRemoveBenefit}
          />
        </div>
      </div>
      <div className="dark:bg-polar-900 dark:border-polar-700 flex flex-row items-center gap-2 border-t border-gray-100 bg-gray-50 p-8">
        <Button onClick={handleSubmit(onSubmit)}>Create Product</Button>
        <Button variant="ghost" onClick={hide}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
