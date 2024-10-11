import revalidate from '@/app/actions'
import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { useStore } from '@/store'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitPublicInner,
  Organization,
  ProductCreate,
  ProductPriceType,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { CheckoutInfo } from '../Checkout/CheckoutInfo'
import { createCheckoutPreview } from '../Customization/utils'
import { DashboardBody } from '../Layout/DashboardLayout'
import ProductBenefitsForm from './ProductBenefitsForm'
import ProductForm, { ProductFullMediasMixin } from './ProductForm/ProductForm'
import { productCreateToProduct } from './utils'

export interface CreateProductPageProps {
  organization: Organization
  productPriceType?: ProductPriceType
}

export const CreateProductPage = ({ organization }: CreateProductPageProps) => {
  const router = useRouter()
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
      ...(savedFormValues ? savedFormValues : {}),
      organization_id: organization.id,
    },
  })
  const { handleSubmit, watch, setError } = form
  const newProduct = watch()

  const createProduct = useCreateProduct(organization.id)
  const updateBenefits = useUpdateProductBenefits(organization.id)

  const createdProduct = watch()
  const reconciledProduct = productCreateToProduct(
    organization.id,
    createdProduct,
    enabledBenefitIds
      .map((id) => organizationBenefits.find((b) => b.id === id))
      .filter(Boolean) as BenefitPublicInner[],
  )

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

        clearDraft('ProductCreate')

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
      clearDraft,
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

  useEffect(() => {
    const pagehideListener = () => {
      saveDraft('ProductCreate', newProduct)
    }
    window.addEventListener('pagehide', pagehideListener)
    return () => window.removeEventListener('pagehide', pagehideListener)
  }, [newProduct, saveDraft])

  return (
    <DashboardBody
      title="Create Product"
      className="gap-y-16"
      contextView={
        <div className="flex h-full flex-col justify-between p-8 py-12">
          <CheckoutInfo
            className="md:w-full md:p-0"
            organization={organization}
            checkout={createCheckoutPreview(
              reconciledProduct,
              reconciledProduct.prices[0],
            )}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-y-8 divide-y">
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
      <div className="flex flex-row items-center gap-2">
        <Button onClick={handleSubmit(onSubmit)} loading={isLoading}>
          Create Product
        </Button>
      </div>
    </DashboardBody>
  )
}
