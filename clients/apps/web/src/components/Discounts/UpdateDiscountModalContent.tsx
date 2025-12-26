import { useUpdateDiscount } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { isValidationError, schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import DiscountForm from './DiscountForm'

interface UpdateDiscountModalContentProps {
  organization: schemas['Organization']
  discount: schemas['Discount']
  onDiscountUpdated: (discount: schemas['Discount']) => void
  hideModal: () => void
}

const UpdateDiscountModalContent = ({
  organization,
  discount,
  onDiscountUpdated,
  hideModal,
}: UpdateDiscountModalContentProps) => {
  const updateDiscount = useUpdateDiscount(discount.id)

  const form = useForm<schemas['DiscountUpdate']>({
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
    async (discountUpdate: schemas['DiscountUpdate']) => {
      const { data: discount, error } =
        await updateDiscount.mutateAsync(discountUpdate)
      if (error) {
        if (isValidationError(error.detail)) {
          setValidationErrors(error.detail, setError, 1, [
            'fixed.once_forever',
            'fixed.repeat',
            'percentage.once_forever',
            'percentage.repeat',
          ])
        }
        return
      }
      toast({
        title: 'Discount Updated',
        description: `Discount ${discount.name} was updated successfully`,
      })
      onDiscountUpdated(discount)
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
              <Button
                className="self-start"
                type="submit"
                loading={updateDiscount.isPending}
                disabled={updateDiscount.isPending}
              >
                Update
              </Button>
              <Button
                variant="ghost"
                className="self-start"
                type="button"
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
