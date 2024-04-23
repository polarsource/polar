import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useBenefits } from '@/hooks/queries'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import MoneyInput from 'polarkit/components/ui/atoms/moneyinput'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Textarea } from 'polarkit/components/ui/textarea'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import ImageUpload from '../Form/ImageUpload'
import { InlineModalHeader } from '../Modal/InlineModal'
import ProductBenefitsSelector from './ProductBenefitsSelector'

interface CreateProductForm {
  name: string
  description: string
  media?: string
  price: number
  benefitIds: string[]
}

export interface CreateProductModalProps {
  hide: () => void
}

export const CreateProductModal = ({ hide }: CreateProductModalProps) => {
  const [benefitIds, setBenefitIds] = useState<string[]>([])
  const { org } = useCurrentOrgAndRepoFromURL()
  const { data } = useBenefits(org?.name, 999)

  const benefits = data?.items ?? []

  const form = useForm<CreateProductForm>()

  const { handleSubmit } = form

  const onSubmit = useCallback(
    async (createProductParams: CreateProductForm) => {
      // Execute the mutation
      console.log(createProductParams)
    },
    [],
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
            Products are benefits that can be purchased at a fixed price.
            Configure the product metadata and select the benefits you want to
            grant below.
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
                      <Textarea
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
                rules={{
                  required: 'This field is required',
                }}
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
                selectedBenefits={benefits.filter((b) =>
                  benefitIds.includes(b.id),
                )}
                benefits={benefits}
                onSelectBenefit={(benefit) =>
                  setBenefitIds((benefitIds) => [
                    ...new Set([...benefitIds, benefit.id]).values(),
                  ])
                }
                onRemoveBenefit={(benefit) => {
                  setBenefitIds((benefitIds) =>
                    benefitIds.filter((b) => b !== benefit.id),
                  )
                }}
              />
            </form>
          </Form>
        </div>
      </div>
      <div className="flex flex-row items-center gap-2 border-t border-gray-100 bg-gray-50 p-8">
        <Button>Create Product</Button>
        <Button variant="secondary" onClick={hide}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
