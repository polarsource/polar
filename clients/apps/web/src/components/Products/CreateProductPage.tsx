import { Upload } from '@/components/FileUpload/Upload'
import { useToast } from '@/components/Toast/use-toast'
import {
  useBenefits,
  useCreateProduct,
  useUpdateProductBenefits,
} from '@/hooks/queries'
import {
  findFirstErrorMessage,
  setProductValidationErrors,
} from '@/utils/api/errors'
import { ProductEditOrCreateForm, productToCreateForm } from '@/utils/product'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import type { FieldErrors } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { DashboardBody } from '../Layout/DashboardLayout'
import { getStatusRedirect } from '../Toast/utils'
import { Benefits } from './Benefits/Benefits'
import ProductForm from './ProductForm/ProductForm'
import { Wand2Icon } from 'lucide-react'

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
      onFileUploadError: (_fileId, error) => reject(error),
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
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      visibility: 'public' as const,
      prices: [
        {
          amount_type: 'fixed' as const,
          price_amount: 0,
          price_currency:
            organization.default_presentment_currency as schemas['PresentmentCurrency'],
        },
      ],
      medias: [],
      full_medias: [],
      organization_id: organization.id,
      metadata: [],
    }
  }

  const form = useForm<ProductEditOrCreateForm>({
    defaultValues: getDefaultValues(),
  })
  const { handleSubmit, setError } = form

  const onInvalid = useCallback(
    (errors: FieldErrors<ProductEditOrCreateForm>) => {
      const message =
        findFirstErrorMessage(errors) ?? 'Please check the form for errors'
      toast({ title: 'Validation Error', description: message })
    },
    [toast],
  )

  const createProduct = useCreateProduct(organization)
  const updateBenefits = useUpdateProductBenefits(organization)

  const onSubmit = useCallback(
    async (productCreate: ProductEditOrCreateForm) => {
      setIsSubmitting(true)
      try {
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
          if (isValidationError(error.detail)) {
            setProductValidationErrors(error.detail, setError)
            toast({
              title: 'Error',
              description: error.detail[0]?.msg || 'An error occurred',
            })
          } else {
            toast({
              title: 'Error',
              description: String(error.detail || 'An error occurred'),
            })
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
      } catch (e) {
        toast({
          title: 'Error',
          description:
            e instanceof Error ? e.message : 'An unexpected error occurred',
        })
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      sourceProduct,
      createProduct,
      updateBenefits,
      enabledBenefitIds,
      router,
      organization,
      setError,
      toast,
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
      header={
        <>
          {!sourceProduct && (
            <Link href={`/dashboard/${organization.slug}/products/new/ai`}>
              <Button variant="secondary">
                <Wand2Icon className="mr-2" />
                Create with AI
              </Button>
            </Link>
          )}
        </>
      }
    >
      <div className="dark:border-polar-700 dark:divide-polar-700 flex flex-col divide-y divide-gray-200 rounded-4xl border border-gray-200">
        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            className="flex flex-col gap-y-6"
          >
            <ProductForm
              organization={organization}
              update={false}
              benefitsSlot={
                <Benefits
                  organization={organization}
                  benefits={organizationBenefits}
                  totalBenefitCount={totalBenefitCount}
                  selectedBenefits={enabledBenefits}
                  onSelectBenefit={onSelectBenefit}
                  onRemoveBenefit={onRemoveBenefit}
                  onReorderBenefits={onReorderBenefits}
                />
              }
            />
          </form>
        </Form>
      </div>
      <div className="flex flex-row items-center gap-2 pb-12">
        <Button
          onClick={handleSubmit(onSubmit, onInvalid)}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Create Product
        </Button>
      </div>
    </DashboardBody>
  )
}
