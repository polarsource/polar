import { useCreateDiscount } from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Form } from '@polar-sh/ui/components/ui/form'
import { useCallback } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { toast } from '../Toast/use-toast'
import DiscountForm from './DiscountForm'

interface CreateDiscountModalContentProps {
  organization: schemas['Organization']
  onDiscountCreated: (discount: schemas['Discount']) => void
  hideModal: () => void
}

const CreateDiscountModalContent = ({
  organization,
  onDiscountCreated,
  hideModal,
}: CreateDiscountModalContentProps) => {
  const createDiscount = useCreateDiscount(organization.id)

  const form = useForm<schemas['DiscountCreate']>({
    defaultValues: {
      organization_id: organization.id,
      type: 'percentage',
      duration: 'once',
    },
  })

  const {
    handleSubmit,
    setError,
    formState: { errors },
  } = form

  const onSubmit: SubmitHandler<schemas['DiscountCreate']> = useCallback(
    async (discountCreate) => {
      const { data: discount, error } =
        await createDiscount.mutateAsync(discountCreate)
      if (error) {
        if (error.detail) {
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
        title: 'Discount Created',
        description: `Discount ${discount.name} was created successfully`,
      })
      onDiscountCreated(discount)
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
              <Button
                className="self-start"
                type="submit"
                loading={createDiscount.isPending}
                disabled={createDiscount.isPending}
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

export default CreateDiscountModalContent
