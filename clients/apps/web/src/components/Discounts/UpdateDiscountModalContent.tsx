import { useUpdateDiscount } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  Discount,
  DiscountUpdate,
  Organization,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
import Button from 'polarkit/components/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import DiscountForm from './DiscountForm'

interface UpdateDiscountModalContentProps {
  organization: Organization
  discount: Discount
  onDiscountUpdated: (discount: Discount) => void
  hideModal: () => void
}

const UpdateDiscountModalContent = ({
  organization,
  discount,
  onDiscountUpdated,
  hideModal,
}: UpdateDiscountModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const updateDiscount = useUpdateDiscount(discount.id)

  const form = useForm<DiscountUpdate>({
    defaultValues: {
      ...discount,
      products: discount.products.map((product) => product.id),
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const onSubmit = useCallback(
    async (discountUpdate: DiscountUpdate) => {
      try {
        setIsLoading(true)
        const discount = await updateDiscount.mutateAsync(discountUpdate)

        toast({
          title: 'Discount Updated',
          description: `Discount ${discount.code} was updated successfully`,
        })

        onDiscountUpdated(discount)
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
            title: 'Discount Update Failed',
            description: `Error updating discount: ${e.message}`,
          })
        }
      } finally {
        setIsLoading(false)
      }
    },
    [updateDiscount, onDiscountUpdated, setError],
  )

  return (
    <div className="flex flex-col gap-y-6 overflow-y-auto px-8 py-10">
      <div>
        <h2 className="text-lg">Update Discount</h2>
        <p className="dark:text-polar-500 mt-2 text-sm text-gray-500">
          Amount and options cannot be changed.
        </p>
      </div>
      <div className="flex flex-col gap-y-6">
        <Form {...form}>
          <form
            className="flex flex-col gap-y-6"
            onSubmit={handleSubmit(onSubmit)}
          >
            <DiscountForm
              organization={organization}
              update={true}
              redemptionsCount={discount.redemptions_count}
            />
            {errors.root && (
              <p className="text-destructive-foreground text-sm">
                {errors.root.message}
              </p>
            )}
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

export default UpdateDiscountModalContent
