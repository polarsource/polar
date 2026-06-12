import { useUpdateBenefit } from '@/hooks/queries'
import { extractApiErrorMessage, setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { UpdateBenefitForm } from '../Benefit/BenefitForm'
import {
  BenefitUpdate,
  prepareBenefitUpdatePayload,
} from '../Benefit/updateBenefitPayload'
import { isBenefitVisibilityConfigurable } from '../Benefit/utils'
import { toast } from '../Toast/use-toast'

interface UpdateBenefitModalContentProps {
  organization: schemas['Organization']
  benefit: schemas['Benefit']
  hideModal: () => void
  requestClose: () => void
  onDirtyChange?: (dirty: boolean) => void
}

const UpdateBenefitModalContent = ({
  organization,
  benefit,
  hideModal,
  requestClose,
  onDirtyChange,
}: UpdateBenefitModalContentProps) => {
  const router = useRouter()
  const defaultValues = useMemo((): BenefitUpdate => {
    if (!isBenefitVisibilityConfigurable(benefit.type)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { visibility, ...values } = benefit
      return values
    }
    return benefit
  }, [benefit])
  const form = useForm<BenefitUpdate>({
    defaultValues,
  })
  const { setError } = form

  const [isUploading, setIsUploading] = useState(false)
  const { isDirty } = form.formState
  useEffect(() => {
    onDirtyChange?.(isDirty || isUploading)
  }, [isDirty, isUploading, onDirtyChange])

  const updateSubscriptionBenefit = useUpdateBenefit(organization.id)
  const handleUpdateNewBenefit = useCallback(
    async (benefitUpdate: BenefitUpdate) => {
      const payload = prepareBenefitUpdatePayload(benefit, benefitUpdate)
      const { error } = await updateSubscriptionBenefit.mutateAsync({
        id: benefit.id,
        body: payload,
      })
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError)
        } else {
          setError('root', { message: error.detail })
        }
        toast({
          title: 'Benefit Update Failed',
          description: `Error updating benefit ${benefit.description}: ${extractApiErrorMessage(error)}`,
        })
        return
      }

      toast({
        title: 'Benefit Updated',
        description: `Benefit ${benefit.description} updated successfully`,
      })
      router.refresh()
      hideModal()
    },
    [hideModal, router, updateSubscriptionBenefit, benefit, setError],
  )

  const onCancel = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    requestClose()
  }

  const { handleSubmit } = form

  return (
    <div className="flex flex-col gap-y-6 px-8 py-10">
      <div>
        <h2 className="text-lg">Update Benefit</h2>
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
              benefitId={benefit.id}
              onUploadingChange={setIsUploading}
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
