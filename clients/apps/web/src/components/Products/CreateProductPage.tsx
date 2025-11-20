import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setProductValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DashboardBody } from '../Layout/DashboardLayout'
import { getStatusRedirect } from '../Toast/utils'
import ProductBenefitsForm from './ProductBenefitsForm'
import ProductForm, { ProductFullMediasMixin } from './ProductForm/ProductForm'

type ProductCreateForm = Omit<schemas['ProductCreate'], 'metadata'> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

// Helper to convert a Product to ProductCreateForm
const productToCreateForm = (
  product: schemas['Product'],
): ProductCreateForm => {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // Spread the product, removing fields that don't exist on ProductCreate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    id,
    created_at,
    modified_at,
    is_archived,
    is_recurring,
    benefits,
    medias,
    prices,
    attached_custom_fields,
    metadata,
    ...productRest
  } = product as any

  // Map prices to remove extra fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedPrices = product.prices.map((price: any) => {
    const {
      id,
      created_at,
      modified_at,
      product_id,
      is_archived,
      source,
      ...priceRest
    } = price
    return priceRest
  })
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return {
    ...productRest,
    name: `Copy of ${product.name}`,
    full_medias: product.medias,
    prices: mappedPrices,
    attached_custom_fields: product.attached_custom_fields.map((field) => ({
      custom_field_id: field.custom_field_id,
      required: field.required,
    })),
    metadata: Object.entries(product.metadata).map(([key, value]) => ({
      key,
      value,
    })),
  }
}

export interface CreateProductPageProps {
  organization: schemas['Organization']
  sourceProduct?: schemas['Product']
}

export const CreateProductPage = ({
  organization,
  sourceProduct,
}: CreateProductPageProps) => {
  const router = useRouter()
  const benefits = useBenefits(organization.id, {
    limit: 200,
  })
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  // Get initial form values
  const getDefaultValues = (): ProductCreateForm => {
    if (!sourceProduct) {
      return {
        recurring_interval: null,
        prices: [
          {
            price_amount: undefined,
            price_currency: 'usd',
          },
        ],
        medias: [],
        full_medias: [],
        organization_id: organization.id,
        metadata: [],
      } as unknown as ProductCreateForm
    }

    return productToCreateForm(sourceProduct)
  }

  const [benefitIds, setBenefitIds] = useState<schemas['Benefit']['id'][]>(
    sourceProduct ? sourceProduct.benefits.map((b) => b.id) : [],
  )

  const form = useForm<ProductCreateForm>({
    defaultValues: getDefaultValues(),
  })
  const { handleSubmit, setError } = form

  const createProduct = useCreateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

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
      } as schemas['ProductCreate'])

      if (error) {
        if (error.detail) {
          setProductValidationErrors(error.detail, setError)
        }
        return
      }

      await updateBenefits.mutateAsync({
        id: product.id,
        body: {
          benefits: benefitIds,
        },
      })

      router.push(
        getStatusRedirect(
          `/dashboard/${organization.slug}/products`,
          'Product Created',
          `Product ${product.name} was created successfully`,
        ),
      )
    },
    [organization, benefitIds, createProduct, updateBenefits, setError, router],
  )

  const onSelectBenefit = useCallback((benefit: schemas['Benefit']) => {
    setBenefitIds((ids) => [...ids, benefit.id])
  }, [])

  const onRemoveBenefit = useCallback((benefit: schemas['Benefit']) => {
    setBenefitIds((ids) => ids.filter((b) => b !== benefit.id))
  }, [])

  const onReorderBenefits = useCallback((benefits: schemas['Benefit'][]) => {
    setBenefitIds(benefits.map((b) => b.id))
  }, [])

  const enabledBenefits = useMemo(
    () =>
      benefitIds
        .map((id) => organizationBenefits.find((benefit) => benefit.id === id))
        .filter(
          (benefit): benefit is schemas['Benefit'] => benefit !== undefined,
        ),
    [organizationBenefits, benefitIds],
  )

  return (
    <DashboardBody
      title={sourceProduct ? 'Duplicate Product' : 'Create Product'}
      wrapperClassName="max-w-(--breakpoint-md)!"
      className="gap-y-16"
    >
      <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-200 rounded-4xl border border-gray-200">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-6"
          >
            <ProductForm organization={organization} update={false} />
          </form>
        </Form>
        <ProductBenefitsForm
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
          onReorderBenefits={onReorderBenefits}
        />
      </div>
      <div className="flex flex-row items-center gap-2 pb-12">
        <Button
          onClick={handleSubmit(onSubmit)}
          loading={createProduct.isPending || updateBenefits.isPending}
          disabled={createProduct.isPending || updateBenefits.isPending}
        >
          Create Product
        </Button>
      </div>
    </DashboardBody>
  )
}
