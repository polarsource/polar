import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
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

export interface CreateProductPageProps {
  organization: schemas['Organization']
  productPriceType?: schemas['ProductPriceType']
}

export const CreateProductPage = ({ organization }: CreateProductPageProps) => {
  const router = useRouter()
  const benefits = useBenefits(organization.id, {
    limit: 200,
  })
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    schemas['Benefit']['id'][]
  >([])

  const form = useForm<ProductCreateForm>({
    defaultValues: {
      recurring_interval: null,
      ...{
        prices: [
          {
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
      metadata: [],
    },
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

      router.push(
        getStatusRedirect(
          `/dashboard/${organization.slug}/products`,
          'Product Created',
          `Product ${product.name} was created successfully`,
        ),
      )
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
    <DashboardBody
      title="Create Product"
      wrapperClassName="!max-w-screen-md"
      className="gap-y-16"
    >
      <div className="rounded-4xl dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-200 border border-gray-200">
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
