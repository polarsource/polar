import { useAlertIfUnsaved } from '@/hooks/editor'
import {
  useBenefits,
  useUpdateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setProductValidationErrors } from '@/utils/api/errors'
import { ProductEditOrCreateForm } from '@/utils/product'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DashboardBody } from '../Layout/DashboardLayout'
import { getStatusRedirect } from '../Toast/utils'
import { Benefits } from './Benefits/Benefits'
import ProductForm from './ProductForm/ProductForm'

export interface EditProductPageProps {
  organization: schemas['Organization']
  product: schemas['Product']
}

export const EditProductPage = ({
  organization,
  product,
}: EditProductPageProps) => {
  const router = useRouter()
  const benefitsQuery = useBenefits(organization.id, {
    limit: 200,
  })
  const organizationBenefits = useMemo(
    () => benefitsQuery.data?.items ?? [],
    [benefitsQuery],
  )
  const totalBenefitCount = benefitsQuery.data?.pagination?.total_count ?? 0

  // Store full benefit objects instead of just IDs to avoid lookup issues
  const [enabledBenefits, setEnabledBenefits] = useState<schemas['Benefit'][]>(
    product.benefits ?? [],
  )

  // Derive IDs from the benefit objects
  const enabledBenefitIds = useMemo(
    () => enabledBenefits.map((b) => b.id),
    [enabledBenefits],
  )

  const form = useForm<ProductEditOrCreateForm>({
    defaultValues: {
      ...product,
      medias: product.medias.map((media) => media.id),
      full_medias: product.medias,
      metadata: Object.entries(product.metadata).map(([key, value]) => ({
        key,
        value,
      })),
    },
  })
  const { handleSubmit, setError, formState } = form

  const originalBenefitIds = useMemo(
    () => product.benefits.map((b) => b.id),
    [product.benefits],
  )

  const hasBenefitsChanged = useMemo(
    () =>
      enabledBenefitIds.length !== originalBenefitIds.length ||
      enabledBenefitIds.some((id, index) => id !== originalBenefitIds[index]),
    [enabledBenefitIds, originalBenefitIds],
  )

  const alertOnUnsavedChanges = useAlertIfUnsaved()

  useEffect(() => {
    alertOnUnsavedChanges(formState.isDirty || hasBenefitsChanged)
  }, [formState.isDirty, hasBenefitsChanged, alertOnUnsavedChanges])

  const updateProduct = useUpdateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

  const onSubmit = useCallback(
    async (productUpdate: ProductEditOrCreateForm) => {
      const { full_medias, metadata, ...productUpdateRest } = productUpdate

      const { data: updatedProduct, error } = await updateProduct.mutateAsync({
        id: product.id,
        body: {
          ...productUpdateRest,
          medias: full_medias.map((media) => media.id),
          metadata: metadata.reduce(
            (acc, { key, value }) => ({ ...acc, [key]: value }),
            {},
          ),
        },
      })

      if (error) {
        if (isValidationError(error.detail)) {
          setProductValidationErrors(error.detail, setError)
        }
        return
      }

      if (hasBenefitsChanged) {
        await updateBenefits.mutateAsync({
          id: product.id,
          body: {
            benefits: enabledBenefitIds,
          },
        })
      }

      router.push(
        getStatusRedirect(
          `/dashboard/${organization.slug}/products/${product.id}`,
          'Product Updated',
          `Product ${updatedProduct.name} was updated successfully`,
        ),
      )
    },
    [
      product,
      organization,
      enabledBenefitIds,
      hasBenefitsChanged,
      updateProduct,
      updateBenefits,
      setError,
      router,
    ],
  )

  const onSelectBenefit = useCallback((benefit: schemas['Benefit']) => {
    console.log({ benefit })
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

  const isLoading = updateProduct.isPending || updateBenefits.isPending

  return (
    <DashboardBody
      title="Edit Product"
      wrapperClassName="max-w-(--breakpoint-md)!"
      className="gap-y-16"
      header={
        <Button
          onClick={handleSubmit(onSubmit)}
          loading={isLoading}
          disabled={isLoading}
        >
          Update Product
        </Button>
      }
    >
      <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-200 rounded-4xl border border-gray-200">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-6"
          >
            <ProductForm organization={organization} update={true} />
          </form>
        </Form>
        <Benefits
          organization={organization}
          benefits={organizationBenefits}
          totalBenefitCount={totalBenefitCount}
          selectedBenefits={enabledBenefits}
          onSelectBenefit={onSelectBenefit}
          onRemoveBenefit={onRemoveBenefit}
          onReorderBenefits={onReorderBenefits}
        />
      </div>
      {(benefitsAdded.length > 0 || benefitsRemoved.length > 0) && (
        <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-500 dark:bg-yellow-950">
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
              {benefitsRemoved.map((benefit) => benefit.description).join(', ')}
            </>
          )}
          .
        </div>
      )}
      <div className="flex flex-row items-center gap-2 pb-12">
        <Button
          onClick={handleSubmit(onSubmit)}
          loading={isLoading}
          disabled={isLoading}
        >
          Update Product
        </Button>
      </div>
    </DashboardBody>
  )
}
