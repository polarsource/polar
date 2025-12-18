import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { FadeUp } from '../Animated/FadeUp'
import { Benefits } from '../Products/Benefits/Benefits'
import { ProductFullMediasMixin } from '../Products/ProductForm/ProductForm'
import { ProductInfoSection } from '../Products/ProductForm/ProductInfoSection'
import { ProductMediaSection } from '../Products/ProductForm/ProductMediaSection'
import { ProductPricingSection } from '../Products/ProductForm/ProductPricingSection'

type ProductCreateForm = Omit<schemas['ProductCreate'], 'metadata'> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

export const ProductStep = () => {
  const { organization } = useContext(OrganizationContext)
  // Store full benefit objects instead of just IDs to avoid lookup issues
  const [enabledBenefits, setEnabledBenefits] = useState<schemas['Benefit'][]>(
    [],
  )

  // Derive IDs from the benefit objects
  const enabledBenefitIds = useMemo(
    () => enabledBenefits.map((b) => b.id),
    [enabledBenefits],
  )

  const benefitsQuery = useBenefits(organization.id, {
    limit: 200,
  })

  const organizationBenefits = useMemo(
    () => benefitsQuery.data?.items ?? [],
    [benefitsQuery],
  )

  const totalBenefitCount = benefitsQuery.data?.pagination?.total_count ?? 0

  const form = useForm<ProductCreateForm>({
    defaultValues: {
      recurring_interval: 'month',
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
  const { handleSubmit, setError, formState } = form

  const createProduct = useCreateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

  const router = useRouter()

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
        `/dashboard/${organization.slug}/onboarding/integrate?productId=${product.id}`,
      )
    },
    [
      enabledBenefitIds,
      createProduct,
      updateBenefits,
      setError,
      organization,
      router,
    ],
  )

  const onSelectBenefit = useCallback((benefit: schemas['Benefit']) => {
    setEnabledBenefits((benefits) => [...benefits, benefit])
  }, [])

  const onRemoveBenefit = useCallback((benefit: schemas['Benefit']) => {
    setEnabledBenefits((benefits) =>
      benefits.filter((b) => b.id !== benefit.id),
    )
  }, [])

  const onReorderBenefits = useCallback((benefits: schemas['Benefit'][]) => {
    setEnabledBenefits(benefits)
  }, [])

  return (
    <Form {...form}>
      <div className="flex flex-col md:gap-y-4">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6 [&>div>*]:px-0 [&>div>:first-child]:pt-0"
        >
          <div className="flex flex-col md:gap-y-4">
            <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
              <ProductInfoSection compact />
            </FadeUp>

            <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
              <ProductMediaSection
                className="py-0"
                organization={organization}
                compact
              />
            </FadeUp>

            <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
              <ProductPricingSection
                className="py-0"
                organization={organization}
                compact
              />
            </FadeUp>
          </div>
        </form>
        <FadeUp className="dark:bg-polar-900 flex flex-col gap-y-4 rounded-3xl border-gray-200 bg-white p-6 md:border dark:border-none">
          <Benefits
            className="px-0 py-0"
            organization={organization}
            benefits={organizationBenefits}
            totalBenefitCount={totalBenefitCount}
            selectedBenefits={enabledBenefits}
            onSelectBenefit={onSelectBenefit}
            onRemoveBenefit={onRemoveBenefit}
            onReorderBenefits={onReorderBenefits}
          />
        </FadeUp>
        <FadeUp className="flex flex-col gap-y-2 p-8 md:p-0">
          <Button
            onClick={() => handleSubmit(onSubmit)()}
            disabled={!formState.isValid}
            loading={createProduct.isPending}
            size="lg"
          >
            Create Product
          </Button>
        </FadeUp>
      </div>
    </Form>
  )
}
