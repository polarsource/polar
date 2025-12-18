import { Upload } from '@/components/FileUpload/Upload'
import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import { setProductValidationErrors } from '@/utils/api/errors'
import { ProductEditOrCreateForm, productToCreateForm } from '@/utils/product'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DashboardBody } from '../Layout/DashboardLayout'
import { getStatusRedirect } from '../Toast/utils'
import { Benefits } from './Benefits/Benefits'
import ProductForm from './ProductForm/ProductForm'

const reuploadMedia = async (
  media: schemas['ProductMediaFileRead'],
  organization: schemas['Organization'],
): Promise<schemas['ProductMediaFileRead']> => {
  const response = await fetch(media.public_url)
  const blob = await response.blob()
  const file = new File([blob], media.name, { type: media.mime_type })

  return new Promise((resolve, reject) => {
    const upload = new Upload({
      organization,
      service: 'product_media',
      file,
      onFileProcessing: () => {},
      onFileCreate: () => {},
      onFileUploadProgress: () => {},
      onFileUploaded: (response) =>
        resolve(response as schemas['ProductMediaFileRead']),
    })
    upload.run().catch(reject)
  })
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
    sourceProduct?.benefits ?? [],
  )

  // Derive IDs from the benefit objects
  const enabledBenefitIds = useMemo(
    () => enabledBenefits.map((b) => b.id),
    [enabledBenefits],
  )

  const getDefaultValues = () => {
    if (sourceProduct) {
      return productToCreateForm(sourceProduct)
    }

    return {
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
    }
  }

  const form = useForm<ProductEditOrCreateForm>({
    defaultValues: getDefaultValues(),
  })
  const { handleSubmit, setError } = form

  const createProduct = useCreateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

  const onSubmit = useCallback(
    async (productCreate: ProductEditOrCreateForm) => {
      const { full_medias, metadata, ...productCreateRest } = productCreate

      // When duplicating, re-upload medias to create new files
      let mediaIds = full_medias.map((media) => media.id)
      if (sourceProduct && full_medias.length > 0) {
        const reuploadedMedias = await Promise.all(
          full_medias.map((media) => reuploadMedia(media, organization)),
        )
        mediaIds = reuploadedMedias.map((media) => media.id)
      }

      const { data: product, error } = await createProduct.mutateAsync({
        ...productCreateRest,
        medias: mediaIds,
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
      sourceProduct,
      enabledBenefitIds,
      createProduct,
      updateBenefits,
      setError,
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
