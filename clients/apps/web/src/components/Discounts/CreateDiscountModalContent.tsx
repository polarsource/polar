import { useCreateDiscount } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  Discount,
  DiscountCreate,
  DiscountDuration,
  DiscountType,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import DiscountForm from './DiscountForm'

interface CreateDiscountModalContentProps {
  organization: Organization
  onDiscountCreated: (discount: Discount) => void
  hideModal: () => void
}

const CreateDiscountModalContent = ({
  organization,
  onDiscountCreated,
  hideModal,
}: CreateDiscountModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const createDiscount = useCreateDiscount(organization.id)

  const form = useForm<DiscountCreate>({
    defaultValues: {
      organization_id: organization.id,
      type: DiscountType.PERCENTAGE,
      duration: DiscountDuration.ONCE,
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const onSubmit: SubmitHandler<DiscountCreate> = useCallback(
    async (discountCreate) => {
      try {
        setIsLoading(true)
        const discount = await createDiscount.mutateAsync(discountCreate)

        toast({
          title: 'Discount Created',
          description: `Discount ${discount.code} was created successfully`,
        })

        onDiscountCreated(discount)
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError, 1, [
              'fixed.once_forever',
              'fixed.repeat',
              'percentage.once_forever',
              'percentage.repeat',
            ])
          }

          toast({
            title: 'Discount Creation Failed',
            description: `Error creating discount: ${e.message}`,
          })
        }
      } finally {
        setIsLoading(false)
      }
    },
    [createDiscount, onDiscountCreated, setError],
  )

  return (
    <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
      <div>
        <h2 className="text-lg">Create Discount</h2>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <DiscountForm organization={organization} update={false} />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
            <div className="mt-4 flex flex-row items-center gap-x-4">
              <Button className="self-start" type="submit" loading={isLoading}>
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

export default CreateDiscountModalContent
