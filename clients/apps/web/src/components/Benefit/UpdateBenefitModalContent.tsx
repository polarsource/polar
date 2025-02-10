import { useUpdateBenefit } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { components, isValidationError, operations } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { MouseEvent, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { UpdateBenefitForm } from '../Benefit/BenefitForm'
import { toast } from '../Toast/use-toast'

interface UpdateBenefitModalContentProps {
  organization: components['schemas']['Organization']
  benefit: components['schemas']['Benefit']
  hideModal: () => void
}

type BenefitUpdate =
  operations['benefits:update']['requestBody']['content']['application/json']

const UpdateBenefitModalContent = ({
  organization,
  benefit,
  hideModal,
}: UpdateBenefitModalContentProps) => {
  const form = useForm<BenefitUpdate>({
    defaultValues: benefit,
  })
  const { setError } = form

  const updateSubscriptionBenefit = useUpdateBenefit(organization.id)
  const handleUpdateNewBenefit = useCallback(
    async (benefitUpdate: BenefitUpdate) => {
      const { error } = await updateSubscriptionBenefit.mutateAsync({
        id: benefit.id,
        body: benefitUpdate,
      })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        toast({
          title: 'Benefit Update Failed',
          description: `Error updating benefit ${benefit.description}: ${error.detail}`,
        })
        return
      }

      toast({
        title: 'Benefit Updated',
        description: `Benefit ${benefit.description} updated successfully`,
      })
      hideModal()
    },
    [hideModal, updateSubscriptionBenefit, benefit, setError],
  )

  const onCancel = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    hideModal()
  }

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
              <Button
                className="self-start"
                type="submit"
                loading={updateSubscriptionBenefit.isPending}
                disabled={updateSubscriptionBenefit.isPending}
              >
                Update
              </Button>
              <Button variant="ghost" className="self-start" onClick={onCancel}>
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
