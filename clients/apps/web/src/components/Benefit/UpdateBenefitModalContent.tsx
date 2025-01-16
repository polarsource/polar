import { useUpdateBenefit } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  type Benefit,
  type BenefitUpdate,
  BenefitType,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { MouseEvent, useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { UpdateBenefitForm } from '../Benefit/BenefitForm'
import { toast } from '../Toast/use-toast'

interface UpdateBenefitModalContentProps {
  organization: Organization
  benefit: Benefit
  hideModal: () => void
}

const UpdateBenefitModalContent = ({
  organization,
  benefit,
  hideModal,
}: UpdateBenefitModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<BenefitUpdate>({
    defaultValues: benefit,
  })
  const { setError } = form

  const updateSubscriptionBenefit = useUpdateBenefit(organization.id)
  const handleUpdateNewBenefit = useCallback(
    async (benefitUpdate: BenefitUpdate) => {
      try {
        setIsLoading(true)
        await updateSubscriptionBenefit.mutateAsync({
          id: benefit.id,
          // @ts-ignore
          body: {
            ...benefitUpdate,
          },
        })

        toast({
          title: 'Benefit Updated',
          description: `Benefit ${benefit.description} updated successfully`,
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

          toast({
            title: 'Benefit Update Failed',
            description: `Error updating benefit ${benefit.description}: ${e.message}`,
          })
        }
      } finally {
        setIsLoading(false)
      }
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
              <Button className="self-start" type="submit" loading={isLoading}>
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
