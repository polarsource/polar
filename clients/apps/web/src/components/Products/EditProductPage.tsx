import revalidate from '@/app/actions'
import {
  useBenefits,
  useUpdateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitPublicInner,
  Organization,
  Product,
  ProductUpdate,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { CheckoutInfo } from '../Checkout/CheckoutInfo'
import { createCheckoutPreview } from '../Customization/utils'
import { DashboardBody } from '../Layout/DashboardLayout'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import ProductBenefitsForm from './ProductBenefitsForm'
import ProductForm, { ProductFullMediasMixin } from './ProductForm/ProductForm'
import { productUpdateToProduct } from './utils'

export interface EditProductPageProps {
  organization: Organization
  product: Product
}

export const EditProductPage = ({
  organization,
  product,
}: EditProductPageProps) => {
  const router = useRouter()
  const benefits = useBenefits(organization.id)
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<
    BenefitPublicInner['id'][]
  >(product.benefits.map((benefit) => benefit.id) ?? [])

  const form = useForm<ProductUpdate & ProductFullMediasMixin>({
    defaultValues: {
      ...product,
      medias: product.medias.map((media) => media.id),
      full_medias: product.medias,
    },
  })

  const [isLoading, setLoading] = useState(false)

  const { handleSubmit, setError, watch } = form

  const updateProduct = useUpdateProduct(organization?.id)
  const updateBenefits = useUpdateProductBenefits(organization.id)

  const updatedProduct = watch()
  const reconciledProduct = productUpdateToProduct(
    updatedProduct,
    enabledBenefitIds
      .map((id) => organizationBenefits.find((b) => b.id === id))
      .filter(Boolean) as BenefitPublicInner[],
    product,
  )

  const onSubmit = useCallback(
    async (productUpdate: ProductUpdate & ProductFullMediasMixin) => {
      try {
        setLoading(true)
        const { full_medias, ...productUpdateRest } = productUpdate
        await updateProduct.mutateAsync({
          id: product.id,
          body: {
            ...productUpdateRest,
            medias: full_medias.map((media) => media.id),
          },
        })
        await updateBenefits.mutateAsync({
          id: product.id,
          body: {
            benefits: enabledBenefitIds,
          },
        })

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
      product,
      enabledBenefitIds,
      updateProduct,
      updateBenefits,
      setError,
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
      setEnabledBenefitIds((benefits) =>
        benefits.filter((b) => b !== benefit.id),
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

  const benefitsAdded = useMemo(
    () =>
      enabledBenefits.filter(
        (benefit) => !product.benefits.some(({ id }) => id === benefit.id),
      ),
    [enabledBenefits, product],
  )

  const benefitsRemoved = useMemo(
    () =>
      product.benefits.filter(
        (benefit) => !enabledBenefits.some(({ id }) => id === benefit.id),
      ),
    [enabledBenefits, product],
  )

  const {
    isShown: isArchiveModalShown,
    hide: hideArchiveModal,
    show: showArchiveModal,
  } = useModal()

  const handleArchiveProduct = useCallback(async () => {
    await updateProduct.mutateAsync({
      id: product.id,
      body: { is_archived: true },
    })

    revalidate(`products:${organization.id}:recurring`)
    revalidate(`products:${organization.id}:one_time`)

    router.push(`/dashboard/${organization.slug}/products`)
  }, [product, updateProduct, organization, router])

  return (
    <DashboardBody
      title="Edit Product"
      contextView={
        <div className="flex h-full flex-col justify-between">
          <div className="flex h-full flex-col overflow-y-auto p-8 py-12">
            <CheckoutInfo
              className="md:w-full md:p-0"
              organization={organization}
              checkout={createCheckoutPreview(
                reconciledProduct,
                reconciledProduct.prices[0],
              )}
            />
          </div>
          {organization.profile_settings?.enabled && (
            <div className="dark:border-polar-700 flex flex-row items-center gap-x-4 border-t border-gray-200 p-8">
              <Link
                href={`/${organization.slug}/products/${product.id}`}
                target="_blank"
              >
                <Button>View Product Page</Button>
              </Link>
            </div>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-y-12">
        <div className="flex flex-col divide-y">
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-y-6"
            >
              <ProductForm organization={organization} update={true} />
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
          <ConfirmModal
            title="Archive Product"
            description="Archiving a product will not affect its current customers, only prevent new subscribers and purchases."
            onConfirm={handleArchiveProduct}
            isShown={isArchiveModalShown}
            hide={hideArchiveModal}
            destructiveText="Archive"
            destructive
          />
        </div>
        {(benefitsAdded.length > 0 || benefitsRemoved.length > 0) && (
          <div className="rounded-2xl bg-yellow-50 p-8 px-4 py-3 text-sm text-yellow-500 dark:bg-yellow-950">
            Existing customers will immediately{' '}
            {benefitsAdded.length > 0 && (
              <>
                get access to{' '}
                {benefitsAdded.map((benefit) => benefit.description).join(', ')}
              </>
            )}
            {benefitsRemoved.length > 0 && (
              <>
                {benefitsAdded.length > 0 && ' and '}lose access to{' '}
                {benefitsRemoved
                  .map((benefit) => benefit.description)
                  .join(', ')}
              </>
            )}
            .
          </div>
        )}
        <div className="flex flex-row items-center gap-4">
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={isLoading}
            size="lg"
          >
            Save Product
          </Button>
          <Button variant="destructive" size="lg" onClick={showArchiveModal}>
            Archive
          </Button>
        </div>
      </div>
    </DashboardBody>
  )
}
