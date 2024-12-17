import { useCreateBenefit } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitCreate,
  BenefitType,
  Organization,
  ResponseError,
  ValidationError,
  type Benefit,
} from '@polar-sh/sdk'
import { useSearchParams } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { NewBenefitForm } from '../Benefit/BenefitForm'
import { CreatableBenefit } from '../Benefit/utils'

export type CreateBenefitModalParams = {
  type?: CreatableBenefit
  description?: string
  error?: string
  guild_token?: string
}

interface CreateBenefitModalContentProps {
  organization: Organization
  onSelectBenefit: (benefit: Benefit) => void
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
  const { type, description, error, ...properties } =
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
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

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
            setValidationErrors(
              validationErrors,
              setError,
              1,
              Object.values(BenefitType),
            )
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [hideModal, onSelectBenefit, createSubscriptionBenefit, setError],
  )

  useEffect(() => {
    if (error) {
      setError('root', { message: error })
    }
  }, [error, setError])

  return (
    <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
      <div>
        <h2 className="text-lg">Create Benefit</h2>
        <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
          Created benefits will be available for use in all products of your
          organization
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form className="flex flex-col gap-y-6">
            <NewBenefitForm organization={organization} />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button
                className="self-start"
                type="button"
                loading={isLoading}
                onClick={handleSubmit(handleCreateNewBenefit)}
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
