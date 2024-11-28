import { useUpdateBenefit } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  BenefitPublicInner,
  BenefitType,
  BenefitUpdate,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { UpdateBenefitForm } from '../Benefit/BenefitForm'

interface UpdateBenefitModalContentProps {
  organization: Organization
  benefit: BenefitPublicInner
  hideModal: () => void
}

const UpdateBenefitModalContent = ({
  organization,
  benefit,
  hideModal,
}: UpdateBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<Omit<BenefitUpdate, 'type'>>({
    defaultValues: benefit,
  })
  const { setError } = form

  const updateSubscriptionBenefit = useUpdateBenefit(organization.id)
  const handleUpdateNewBenefit = useCallback(
    async (benefitUpdate: Omit<BenefitUpdate, 'type'>) => {
      try {
        setIsLoading(true)
        await updateSubscriptionBenefit.mutateAsync({
          id: benefit.id,
          body: {
            type: benefit.type,
            ...benefitUpdate,
          },
        })

        hideModal()
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
          } else {
            setError('root', { message: e.message })
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [hideModal, updateSubscriptionBenefit, benefit, setError],
  )

  const { handleSubmit } = form

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Update Benefit</h2>
        <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
          Tax applicability and Benefit type cannot be updated
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(handleUpdateNewBenefit)}
          >
            <UpdateBenefitForm
              organization={organization}
              type={benefit.type}
            />
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button className="self-start" type="submit" loading={isLoading}>
                Update
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

export default UpdateBenefitModalContent
