import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useBenefits } from '@/hooks/queries'
import { useCreateProduct } from '@/hooks/queries/products'
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

interface CreateProductForm {
  name: string
  description: string
  media: string[]
  price: number
  benefits: BenefitPublicInner[]
}

export interface CreateProductModalProps {
  hide: () => void
}

export const CreateProductModal = ({ hide }: CreateProductModalProps) => {
  const [selectedBenefits, setBenefits] = useState<BenefitPublicInner[]>([])
  const { org } = useCurrentOrgAndRepoFromURL()
  const { data } = useBenefits(org?.name, 999)

  const benefits = data?.items ?? []

  const form = useForm<CreateProductForm>()

  const { handleSubmit } = form

  const { mutate: createProductMutation } = useCreateProduct(org?.name)

  const onSubmit = useCallback(
    async (createProductParams: CreateProductForm) => {
      // Execute the mutation
      await createProductMutation({
        ...createProductParams,
        benefits: selectedBenefits,
      })

      hide()
    },
    [createProductMutation, hide, selectedBenefits],
  )

  if (!org) {
    return null
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex flex-col gap-y-4">
          <InlineModalHeader hide={hide}>
            <h3>Create Product</h3>
          </InlineModalHeader>
          <p className="dark:text-polar-500 px-8 text-sm leading-relaxed text-gray-500">
            Products are benefits which can be purchased at a fixed price.
            Configure the product metadata and select benefits you want to grant
            below.
          </p>
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
                        className="resize-none rounded-2xl"
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
                        width={1280}
                        height={720}
                        onUploaded={(image) => {
                          field.onChange([image])
                        }}
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
        <Button onClick={handleSubmit(onSubmit)}>Create Product</Button>
        <Button variant="secondary" onClick={hide}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
