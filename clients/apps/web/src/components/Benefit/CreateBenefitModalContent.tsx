import { useCreateBenefit } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { enums, schemas } from '@polar-sh/client'
import { Button, InlineModalHeader } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { NewBenefitForm } from '../Benefit/BenefitForm'
import { CreatableBenefit, getDefaultBenefitVisibility } from '../Benefit/utils'
import { useToast } from '../Toast/use-toast'

export type CreateBenefitModalParams = {
  type?: CreatableBenefit
  description?: string
  error?: string
  guild_token?: string
  slack_integration_id?: string
}

interface CreateBenefitModalContentProps {
  organization: schemas['Organization']
  onSelectBenefit: (benefit: schemas['Benefit']) => void
  hideModal: () => void
  defaultValues?: CreateBenefitModalParams
}

const CreateBenefitModalContent = ({
  organization,
  onSelectBenefit,
  hideModal,
  defaultValues,
}: CreateBenefitModalContentProps) => {
  const searchParams = useSearchParams()
  const { type, description, error, slack_integration_id, ...properties } =
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

  const benefitType = type ? type : 'feature_flag'

  const form = useForm<schemas['BenefitCreate']>({
    defaultValues: {
      organization_id: organization.id,
      type: benefitType,
      description: description ? description : undefined,
      visibility: getDefaultBenefitVisibility(benefitType),
      properties: {
        ...properties,
        ...(slack_integration_id ? { slack_integration_id } : {}),
      },
    } as schemas['BenefitCreate'],
  })

  const { toast } = useToast()

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const handleCreateNewBenefit = useCallback(
    async (subscriptionBenefitCreate: schemas['BenefitCreate']) => {
      const { data: benefit, error } =
        await createSubscriptionBenefit.mutateAsync(subscriptionBenefitCreate)
      if (error) {
        if (error.detail) {
          setValidationErrors(
            error.detail,
            setError,
            1,
            enums.benefitTypeValues as string[],
          )
        }
        return
      }

      onSelectBenefit(benefit)
      toast({
        title: 'Benefit Created',
        description: `Benefit ${benefit.description} was created successfully`,
      })
      hideModal()
    },
    [toast, hideModal, onSelectBenefit, createSubscriptionBenefit, setError],
  )

  useEffect(() => {
    if (error) {
      setError('root', { message: error })
    }
  }, [error, setError])

  return (
    <div className="flex flex-col">
      <InlineModalHeader className="pb-2" hide={hideModal}>
        <h2 className="text-lg">Create Benefit</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-6 px-8 pb-10">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Created benefits will be available for use in all products of your
          organization
        </p>
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
                  loading={createSubscriptionBenefit.isPending}
                  disabled={createSubscriptionBenefit.isPending}
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
    </div>
  )
}

export default CreateBenefitModalContent
