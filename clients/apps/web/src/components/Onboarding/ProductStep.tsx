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
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useContext, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { FadeUp } from '../Animated/FadeUp'
import LogoIcon from '../Brand/LogoIcon'
import ProductBenefitsForm from '../Products/ProductBenefitsForm'
import { ProductFullMediasMixin } from '../Products/ProductForm/ProductForm'
import { ProductInfoSection } from '../Products/ProductForm/ProductInfoSection'
import { ProductMediaSection } from '../Products/ProductForm/ProductMediaSection'
import { ProductPricingSection } from '../Products/ProductForm/ProductPricingSection'
import { AssistantStep } from './AssistantStep'

type ProductCreateForm = Omit<schemas['ProductCreate'], 'metadata'> &
  ProductFullMediasMixin & {
    metadata: { key: string; value: string | number | boolean }[]
  }

export const ProductStep = () => {
  const [isConversationActive, setIsConversationActive] = useState(true)

  return (
    <div className="dark:md:bg-polar-950 flex flex-col pt-16 md:items-center md:p-16">
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ duration: 1, staggerChildren: 0.3 }}
        className="flex min-h-0 w-full shrink-0 flex-col gap-12 md:max-w-xl md:p-8"
      >
        <FadeUp className="flex flex-col items-center gap-y-8">
          <LogoIcon size={50} />
          <div className="flex flex-col gap-y-4">
            <h1 className="text-center text-3xl">Your first product</h1>
            <p className="dark:text-polar-400 text-center text-lg text-gray-600">
              Setup your first digital product to get started.
            </p>
          </div>
        </FadeUp>

        <AssistantStep
          onConversationActive={() => setIsConversationActive(true)}
        />

        <FadeUp>
          <span className="dark:text-polar-500 mx-auto flex w-full justify-center text-center text-sm text-gray-500">
            or configure manually
          </span>
        </FadeUp>

        <ProductForm />
      </motion.div>
    </div>
  )
}

const ProductForm = () => {
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
          <Link href={`/dashboard/${organization.slug}`}>
            <Button className="w-full" size="lg" variant="secondary">
              Skip
            </Button>
          </Link>
        </FadeUp>
      </div>
    </Form>
  )
}
