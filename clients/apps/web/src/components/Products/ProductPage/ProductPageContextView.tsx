import { useBenefits, useUpdateProductBenefits } from '@/hooks/queries'

import { useUpdateProduct } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  type Benefit,
  Organization,
  Product,
  ProductUpdate,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmModal } from '../../Modal/ConfirmModal'
import { useModal } from '../../Modal/useModal'
import { getStatusRedirect } from '../../Toast/utils'
import ProductBenefitsForm from '../ProductBenefitsForm'
import ProductForm, { ProductFullMediasMixin } from '../ProductForm/ProductForm'

export interface ProductPageContextViewProps {
  organization: Organization
  product: Product
}

export const ProductPageContextView = ({
  organization,
  product,
}: ProductPageContextViewProps) => {
  const router = useRouter()
  const benefits = useBenefits(organization.id, 100)
  const organizationBenefits = useMemo(
    () => benefits.data?.items ?? [],
    [benefits],
  )

  const [enabledBenefitIds, setEnabledBenefitIds] = useState<Benefit['id'][]>(
    product.benefits.map((benefit) => benefit.id) ?? [],
  )

  const form = useForm<ProductUpdate & ProductFullMediasMixin>({
    defaultValues: {
      ...product,
      medias: product.medias.map((media) => media.id),
      full_medias: product.medias,
    },
  })

  const [isLoading, setLoading] = useState(false)

  const { handleSubmit, setError } = form

  const updateProduct = useUpdateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

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

        router.push(
          getStatusRedirect(
            `/dashboard/${organization.slug}/products`,
            'Product Updated',
            `Product ${product.name} updated successfully`,
          ),
        )
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
    (benefit: Benefit) => {
      setEnabledBenefitIds((benefitIds) => [...benefitIds, benefit.id])
    },
    [setEnabledBenefitIds],
  )

  const onRemoveBenefit = useCallback(
    (benefit: Benefit) => {
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
    router.push(`/dashboard/${organization.slug}/products`)
  }, [product, updateProduct, organization, router])

  return (
    <div className="flex h-full flex-col justify-between pt-4">
      <div className="dark:divide-polar-700 flex h-full flex-col divide-y overflow-y-auto">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-6"
          >
            <ProductForm
              organization={organization}
              update={true}
              compact={true}
            />
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
          compact={true}
        />
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
        <div className="flex flex-row items-center gap-4 p-8">
          <Button onClick={handleSubmit(onSubmit)} loading={isLoading}>
            Save Product
          </Button>
          {!product.is_archived && (
            <Button variant="secondary" onClick={showArchiveModal}>
              Archive
            </Button>
          )}
        </div>
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
    </div>
  )
}
