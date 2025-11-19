'use client'

import { InlineModalHeader } from '@/components/Modal/InlineModal'
import { toast } from '@/components/Toast/use-toast'
import { useDuplicateProduct } from '@/hooks/queries'
import { apiErrorToast } from '@/utils/api/errors'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { useForm } from 'react-hook-form'

interface DuplicateProductModalProps {
  product: schemas['Product']
  organization: schemas['Organization']
  hide: () => void
}

interface DuplicateProductForm {
  name: string
}

export default function DuplicateProductModal({
  product,
  organization,
  hide,
}: DuplicateProductModalProps) {
  const router = useRouter()
  const duplicateProduct = useDuplicateProduct(organization)

  const form = useForm<DuplicateProductForm>({
    defaultValues: {
      name: `Copy of ${product.name}`,
    },
  })

  const { handleSubmit, formState } = form

  const onSubmit = useCallback(
    async (data: DuplicateProductForm) => {
      const { data: newProduct, error } = await duplicateProduct.mutateAsync({
        id: product.id,
        body: {
          name: data.name,
        },
      })

      if (error || !newProduct) {
        apiErrorToast(error, toast, {
          title: 'Error Duplicating Product',
        })
        return
      }

      toast({
        title: 'Product Duplicated',
        description: `${newProduct.name} was created successfully`,
      })

      hide()
      router.push(`/dashboard/${organization.slug}/products/${newProduct.id}`)
    },
    [product, organization, duplicateProduct, router, hide],
  )

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={hide}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl">Duplicate Product</h2>
        </div>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-8 p-8">
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Create a copy of <span className="font-medium">{product.name}</span>{' '}
          with all its settings, prices and benefits and metadata.
        </p>

        <Form {...form}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="max-w-[700px] space-y-6"
          >
            <FormField
              control={form.control}
              name="name"
              rules={{
                required: 'Product name is required',
                minLength: {
                  value: 3,
                  message: 'Product name must be at least 3 characters',
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-row gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={hide}
                disabled={formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={formState.isSubmitting}
                disabled={formState.isSubmitting}
              >
                Duplicate product
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
