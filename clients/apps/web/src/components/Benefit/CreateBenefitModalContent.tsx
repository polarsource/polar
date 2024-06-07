import { useCreateBenefit } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitCreate,
  BenefitPublicInner,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { NewBenefitForm } from '../Benefit/BenefitForm'
import { CreatableBenefit } from '../Benefit/utils'

export type CreateBenefitModalParams = {
  type?: CreatableBenefit
  description?: string
  guild_token?: string
}

interface CreateBenefitModalContentProps {
  organization: Organization
  onSelectBenefit: (benefit: BenefitPublicInner) => void
  hideModal: () => void
  defaultValues?: CreateBenefitModalParams
}

const CreateBenefitModalContent = ({
  organization,
  onSelectBenefit,
  hideModal,
  defaultValues,
}: CreateBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const { type, description, ...properties } =
    useMemo<CreateBenefitModalParams>(() => {
      if (defaultValues) {
        return defaultValues
      }

      if (!searchParams) {
        return {}
      }
      return Object.fromEntries(searchParams.entries())
    }, [searchParams, defaultValues])

  const createSubscriptionBenefit = useCreateBenefit(organization.id)

  const form = useForm<BenefitCreate>({
    defaultValues: {
      organization_id: organization.id,
      type: type ? type : 'custom',
      description: description ? description : undefined,
      properties: {
        ...(properties as any),
      },
      is_tax_applicable: false,
    },
  })

  const { handleSubmit, setError } = form

  const handleCreateNewBenefit = useCallback(
    async (subscriptionBenefitCreate: BenefitCreate) => {
      try {
        setIsLoading(true)
        const benefit = await createSubscriptionBenefit.mutateAsync(
          subscriptionBenefitCreate,
        )

        if (benefit) {
          onSelectBenefit(benefit)
          hideModal()
        }
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError, 2)
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [hideModal, onSelectBenefit, createSubscriptionBenefit, setError],
  )

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Create Benefit</h2>
        <p className="dark:text-white0 mt-2 text-sm text-gray-500">
          Created benefits will be available for use in all products of your
          organization
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(handleCreateNewBenefit)}
          >
            <NewBenefitForm organization={organization} />
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="submit"
                loading={isLoading}
                disabled={!form.formState.isValid}
              >
                Create
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                onClick={hideModal}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default CreateBenefitModalContent
