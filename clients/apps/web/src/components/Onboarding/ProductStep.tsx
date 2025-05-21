import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { useMeters } from '@/hooks/queries/meters'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import ProductBenefitsForm from '../Products/ProductBenefitsForm'
import { ProductFullMediasMixin } from '../Products/ProductForm/ProductForm'
import { ProductInfoSection } from '../Products/ProductForm/ProductInfoSection'
import { ProductPricingSection } from '../Products/ProductForm/ProductPricingSection'
import { productCreateToProduct } from '../Products/utils'

type ProductCreateForm = Omit<schemas['ProductCreate'], 'metadata'> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

export interface ProductStepProps {
  organization: schemas['Organization']
  onCreate: (product: schemas['Product']) => void
}

export default function ProductStep({
  organization,
  onCreate,
}: ProductStepProps) {
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    schemas['Benefit']['id'][]
  >([])

  const benefits = useBenefits(organization.id, {
    limit: 100,
  })
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )
  const meters = useMeters(organization.id, {
    sorting: ['name'],
  })

  const form = useForm<ProductCreateForm>({
    defaultValues: {
      recurring_interval: null,
      ...{
        prices: [
          {
            amount_type: 'fixed',
            price_amount: 1000,
            price_currency: 'usd',
          },
        ],
      },
      ...{
        medias: [],
        full_medias: [],
      },
      organization_id: organization.id,
      metadata: [],
    },
  })
  const { handleSubmit, watch, setError } = form
  const newProduct = watch()

  const createProduct = useCreateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

  const createdProduct = watch()
  const reconciledProduct = productCreateToProduct(
    organization.id,
    {
      ...createdProduct,
      metadata: createdProduct.metadata.reduce(
        (acc, { key, value }) => ({ ...acc, [key]: value }),
        {},
      ),
    },
    enabledBenefitIds
      .map((id) => organizationBenefits.find((b) => b.id === id))
      .filter(Boolean) as schemas['Benefit'][],
    meters.data?.items ?? [],
  )

  const onSubmit = useCallback(
    async (productCreate: ProductCreateForm) => {
      const { full_medias, metadata, ...productCreateRest } = productCreate

      const { data: product, error } = await createProduct.mutateAsync({
        ...productCreateRest,
        medias: full_medias.map((media) => media.id),
        metadata: metadata.reduce(
          (acc, { key, value }) => ({ ...acc, [key]: value }),
          {},
        ),
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

      onCreate(product)
    },
    [enabledBenefitIds, createProduct, updateBenefits, setError, onCreate],
  )

  const onSelectBenefit = useCallback(
    (benefit: schemas['Benefit']) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: schemas['Benefit']) => {
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

  return (
    <div className="dark:divide-polar-700 flex flex-col divide-y">
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6 [&>div>*]:px-0 [&>div>*]:py-12 [&>div>:first-child]:pt-0"
        >
          <div className="dark:divide-polar-700 flex flex-col divide-y">
            <ProductInfoSection compact />
            <ProductPricingSection organization={organization} compact />
          </div>
        </form>
      </Form>
      <ProductBenefitsForm
        className="px-0"
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
      <Button
        className="self-start"
        onClick={() => onSubmit(newProduct)}
        loading={createProduct.isPending}
      >
        Create Product
      </Button>
    </div>
  )
}
