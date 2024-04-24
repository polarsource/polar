import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useBenefits } from '@/hooks/queries'
import { Product, useUpdateProduct } from '@/hooks/queries/products'
import { BenefitPublicInner } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import MoneyInput from 'polarkit/components/ui/atoms/moneyinput'
import TextArea from 'polarkit/components/ui/atoms/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import ImageUpload from '../Form/ImageUpload'
import { InlineModalHeader } from '../Modal/InlineModal'
import ProductBenefitsSelector from './ProductBenefitsSelector'

interface EditProductForm {
  id: string
  name: string
  description: string
  media: string[]
  price: number
  benefits: BenefitPublicInner[]
}

export interface EditProductModalProps {
  product: Product
  hide: () => void
}

export const EditProductModal = ({ product, hide }: EditProductModalProps) => {
  const [selectedBenefits, setBenefits] = useState<BenefitPublicInner[]>(
    product.benefits,
  )
  const { org } = useCurrentOrgAndRepoFromURL()
  const { data } = useBenefits(org?.name, 999)

  const benefits = data?.items ?? []

  const form = useForm<EditProductForm>({
    defaultValues: {
      ...product,
    },
  })

  const { handleSubmit } = form

  const { mutate: editProductMutation } = useUpdateProduct(org?.name)

  const onSubmit = useCallback(
    async (editProductParams: EditProductForm) => {
      // Execute the mutation
      await editProductMutation({
        id: editProductParams.id,
        productUpdate: {
          ...editProductParams,
          benefits: selectedBenefits,
        },
      })

      hide()
    },
    [editProductMutation, hide, selectedBenefits],
  )

  if (!org) {
    return null
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex flex-col gap-y-4">
          <InlineModalHeader hide={hide}>
            <h3>Edit Product</h3>
          </InlineModalHeader>
        </div>
        <div className="flex flex-col p-8">
          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-y-8"
            >
              <FormField
                control={form.control}
                name="name"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Name</FormLabel>
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Description</FormLabel>
                    </div>
                    <FormControl>
                      <TextArea
                        className="min-h-44 resize-none rounded-2xl"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                rules={{
                  required: 'This field is required',
                }}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Pricing</FormLabel>
                    </div>
                    <FormControl>
                      <MoneyInput
                        id="pricing"
                        placeholder={0}
                        {...field}
                        onChange={(e) => {
                          field.onChange(parseFloat(e.target.value) * 100)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="media"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <div className="flex flex-row items-center justify-between">
                      <FormLabel>Media</FormLabel>
                    </div>
                    <FormControl>
                      <ImageUpload
                        width={1000}
                        height={1000}
                        onUploaded={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ProductBenefitsSelector
                organization={org}
                selectedBenefits={selectedBenefits}
                benefits={benefits}
                onSelectBenefit={(benefit) =>
                  setBenefits((benefits) => [...benefits, benefit])
                }
                onRemoveBenefit={(benefit) => {
                  setBenefits((benefits) =>
                    benefits.filter((b) => b.id !== benefit.id),
                  )
                }}
              />
            </form>
          </Form>
        </div>
      </div>
      <div className="dark:bg-polar-900 dark:border-polar-700 flex flex-row items-center gap-2 border-t border-gray-100 bg-gray-50 p-8">
        <Button onClick={handleSubmit(onSubmit)}>Save Product</Button>
        <Button variant="secondary" onClick={hide}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
