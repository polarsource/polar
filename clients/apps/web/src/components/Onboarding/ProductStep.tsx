import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { useMeters } from '@/hooks/queries/meters'
import { OrganizationContext } from '@/providers/maintainerOrganization'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useThemePreset } from '@polar-sh/ui/hooks/theming'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useContext, useMemo, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import LogoIcon from '../Brand/LogoIcon'
import { createCheckoutPreview } from '../Customization/utils'
import ProductBenefitsForm from '../Products/ProductBenefitsForm'
import { ProductFullMediasMixin } from '../Products/ProductForm/ProductForm'
import { ProductInfoSection } from '../Products/ProductForm/ProductInfoSection'
import { ProductPricingSection } from '../Products/ProductForm/ProductPricingSection'
import { productCreateToProduct } from '../Products/utils'

import {
  CheckoutProductSwitcher,
  CheckoutPWYWForm,
} from '@polar-sh/checkout/components'
import { ProductPriceCustom } from '@polar-sh/sdk/models/components/productpricecustom.js'
import Link from 'next/link'
import { CheckoutCard } from '../Checkout/CheckoutCard'
import CheckoutProductInfo from '../Checkout/CheckoutProductInfo'
import { ProductMediaSection } from '../Products/ProductForm/ProductMediaSection'
type ProductCreateForm = Omit<schemas['ProductCreate'], 'metadata'> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

export default function ProductStep() {
  const { organization } = useContext(OrganizationContext)
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
        `/dashboard/${organization.slug}/onboarding/integrate/${product.id}`,
      )
    },
    [enabledBenefitIds, createProduct, updateBenefits, setError, organization],
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
      <div className="flex h-full flex-col gap-12 lg:flex-row">
        <div className="flex h-full min-h-0 max-w-lg flex-col gap-12 overflow-y-auto p-12">
          <div className="flex flex-col gap-y-12">
            <LogoIcon size={50} />
            <div className="flex flex-col gap-y-4">
              <h1 className="text-3xl">Your first product</h1>
              <p className="dark:text-polar-400 text-lg text-gray-600">
                Setup your first digital product to get started.
              </p>
            </div>
          </div>
          <div className="flex flex-row gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className={twMerge(
                  'dark:bg-polar-700 flex h-2 flex-1 rounded-full bg-gray-300',
                  index < 2 && 'bg-black dark:bg-white',
                )}
              />
            ))}
          </div>
          <div className="flex flex-col">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-y-6 [&>div>*]:px-0 [&>div>*]:py-6 [&>div>:first-child]:pt-0"
            >
              <div className="flex flex-col">
                <ProductInfoSection compact />
                <ProductMediaSection organization={organization} compact />
                <ProductPricingSection organization={organization} compact />
              </div>
            </form>
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
            <div className="flex flex-row gap-x-4">
              <Button
                className="self-start"
                onClick={() => handleSubmit(onSubmit)()}
                disabled={!formState.isValid}
                loading={createProduct.isPending}
              >
                Create Product
              </Button>
              <Link href={`/dashboard/${organization.slug}`}>
                <Button variant="secondary">Cancel</Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="dark:bg-polar-800 rounded-4xl mx-4 flex flex-1 flex-grow flex-col items-center gap-12 overflow-y-auto bg-gray-100 p-16 md:my-8 md:mr-8">
          <div className="flex w-full max-w-6xl flex-col items-center gap-y-12">
            <div className="flex flex-col items-center gap-y-4 text-center">
              <h1 className="text-3xl">Product Preview</h1>
              <p className="dark:text-polar-500 text-lg text-gray-500">
                Product information will be shown on the checkout page.
              </p>
            </div>

            <CheckoutPreview
              enabledBenefitIds={enabledBenefitIds}
              organizationBenefits={organizationBenefits}
              meters={meters.data?.items ?? []}
            />
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
      <ShadowBox className="dark:bg-polar-900 flex w-full max-w-xl flex-col gap-y-8 bg-white">
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
