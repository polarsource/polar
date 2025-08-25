import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { useMeters } from '@/hooks/queries/meters'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setValidationErrors } from '@/utils/api/errors'
import {
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
} from '@polar-sh/checkout/components'
import { schemas } from '@polar-sh/client'
import { ProductPriceCustom } from '@polar-sh/sdk/models/components/productpricecustom.js'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useContext, useMemo, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import LogoIcon from '../Brand/LogoIcon'
import { CheckoutCard } from '../Checkout/CheckoutCard'
import CheckoutProductInfo from '../Checkout/CheckoutProductInfo'
import { createCheckoutPreview } from '../Customization/utils'
import ProductBenefitsForm from '../Products/ProductBenefitsForm'
import { ProductFullMediasMixin } from '../Products/ProductForm/ProductForm'
import { ProductInfoSection } from '../Products/ProductForm/ProductInfoSection'
import { ProductMediaSection } from '../Products/ProductForm/ProductMediaSection'
import { ProductPricingSection } from '../Products/ProductForm/ProductPricingSection'
import { productCreateToProduct } from '../Products/utils'
import { Well } from '../Shared/Well'

type ProductCreateForm = Omit<schemas['ProductCreate'], 'metadata'> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

export const ProductStep = () => {
  const { organization } = useContext(OrganizationContext)
  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    schemas['Benefit']['id'][]
  >([])

  const benefits = useBenefits(organization.id, {
    limit: 200,
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
    <Form {...form}>
      <div className="dark:md:bg-polar-950 flex flex-col pt-16 md:items-center md:p-16">
        <div className="flex min-h-0 w-full flex-shrink-0 flex-col gap-12 md:max-w-xl md:p-8">
          <div className="flex flex-col items-center gap-y-8">
            <LogoIcon size={50} />
            <div className="flex flex-col gap-y-4">
              <h1 className="text-center text-3xl">Your first product</h1>
              <p className="dark:text-polar-400 text-center text-lg text-gray-600">
                Setup your first digital product to get started.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:gap-y-4">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-y-6 [&>div>*]:px-0 [&>div>:first-child]:pt-0"
            >
              <div className="flex flex-col md:gap-y-4">
                <Well className="dark:bg-polar-900 border-gray-200 bg-white md:border dark:border-none">
                  <ProductInfoSection compact />
                </Well>

                <Well className="dark:bg-polar-900 border-gray-200 bg-white md:border dark:border-none">
                  <ProductMediaSection
                    className="py-0"
                    organization={organization}
                    compact
                  />
                </Well>

                <Well className="dark:bg-polar-900 border-gray-200 bg-white md:border dark:border-none">
                  <ProductPricingSection
                    className="py-0"
                    organization={organization}
                    compact
                  />
                </Well>
              </div>
            </form>
            <Well className="dark:bg-polar-900 border-gray-200 bg-white md:border dark:border-none">
              <ProductBenefitsForm
                className="px-0 py-0"
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
            </Well>
            <div className="flex flex-col gap-y-2 p-8 md:p-0">
              <Button
                onClick={() => handleSubmit(onSubmit)()}
                disabled={!formState.isValid}
                loading={createProduct.isPending}
                size="lg"
              >
                Create Product
              </Button>
              <Link href={`/dashboard/${organization.slug}`}>
                <Button className="w-full" size="lg" variant="secondary">
                  Skip
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Form>
  )
}

interface CheckoutPreviewProps {
  enabledBenefitIds: schemas['Benefit']['id'][]
  organizationBenefits: schemas['Benefit'][]
  meters: schemas['Meter'][]
}

const CheckoutPreview = memo(
  ({
    enabledBenefitIds,
    organizationBenefits,
    meters,
  }: CheckoutPreviewProps) => {
    const { organization } = useContext(OrganizationContext)
    const { watch } = useFormContext<ProductCreateForm>()
    const createdProduct = watch()

    const newProduct = useMemo(() => {
      return productCreateToProduct(
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
        meters,
      )
    }, [
      createdProduct,
      enabledBenefitIds,
      organization,
      organizationBenefits,
      meters,
    ])

    const checkoutPreview = useMemo(() => {
      return createCheckoutPreview(newProduct, organization)
    }, [newProduct, organization])

    const themePreset = useThemePreset('polar')

    return (
      <ShadowBox className="dark:bg-polar-900 dark:border-polar-700 flex w-full flex-col gap-y-8 border border-gray-200 bg-white">
        <CheckoutProductInfo
          organization={checkoutPreview.organization}
          product={checkoutPreview.product}
        />
        <CheckoutProductSwitcher
          checkout={checkoutPreview}
          themePreset={themePreset}
        />
        {checkoutPreview.productPrice.amountType === 'custom' && (
          <CheckoutPWYWForm
            checkout={checkoutPreview}
            productPrice={checkoutPreview.productPrice as ProductPriceCustom}
            themePreset={themePreset}
            update={() => Promise.resolve(checkoutPreview)}
          />
        )}
        {checkoutPreview.product.benefits.length > 0 && (
          <CheckoutCard checkout={checkoutPreview} themePreset={themePreset} />
        )}
        <Button size="lg">
          {checkoutPreview.productPrice.amountType === 'free'
            ? 'Continue'
            : `Buy Now`}
        </Button>
      </ShadowBox>
    )
  },
)

CheckoutPreview.displayName = 'CheckoutPreview'
