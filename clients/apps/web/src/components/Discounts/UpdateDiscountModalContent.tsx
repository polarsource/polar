import { useUpdateDiscount } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import {
  Discount,
  DiscountUpdate,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Form } from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import DiscountForm from './DiscountForm'

interface UpdateDiscountModalContentProps {
  discount: Discount
  onDiscountUpdated: (discount: Discount) => void
  hideModal: () => void
}

const UpdateDiscountModalContent = ({
  discount,
  onDiscountUpdated,
  hideModal,
}: UpdateDiscountModalContentProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const updateDiscount = useUpdateDiscount(discount.id)

  const form = useForm<DiscountUpdate>({
    defaultValues: {
      ...discount,
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
            <DiscountForm update={true} />
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
