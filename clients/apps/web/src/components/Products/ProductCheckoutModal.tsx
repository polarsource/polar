import {
  useCheckoutLinks,
  useCreateCheckoutLink,
  useUpdateCheckoutLink,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { ClearOutlined } from '@mui/icons-material'
import {
  CheckoutLink,
  CheckoutLinkCreate,
  Product,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import Input from 'polarkit/components/ui/atoms/input'
import { List, ListItem } from 'polarkit/components/ui/atoms/list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/ui/atoms/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { useCallback, useState } from 'react'
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form'
import ProductPriceLabel from './ProductPriceLabel'

export interface ProductCheckoutModalProps {
  product: Product
}

type ProductCheckoutForm = Omit<
  CheckoutLinkCreate,
  'payment_processor' | 'metadata'
> & { metadata: { key: string; value: string }[] }

export const ProductCheckoutModal = ({
  product,
}: ProductCheckoutModalProps) => {
  const { data: checkoutLinks } = useCheckoutLinks(product.organization_id, {
    productId: product.id,
  })

  const form = useForm<ProductCheckoutForm>({
    defaultValues: {
      product_price_id: product.prices[0].id,
      metadata: [],
    },
  })
  const { control, handleSubmit, setError, reset } = form
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metadata',
    rules: {
      maxLength: 50,
    },
  })

  const [selectedLink, setSelectedLink] = useState<CheckoutLink | null>(null)
  const onSelectLink = useCallback(
    (link: CheckoutLink) => {
      setSelectedLink(link)
      reset({
        ...link,
        metadata: Object.entries(link.metadata).map(([key, value]) => ({
          key,
          value,
        })),
      })
    },
    [reset],
  )

  const [newLinkSuccess, setNewLinkSuccess] = useState(false)

  const { mutateAsync: createCheckoutLink, isPending: isCreatePending } =
    useCreateCheckoutLink()
  const { mutateAsync: updateCheckoutLink, isPending: isUpdatePending } =
    useUpdateCheckoutLink()
  const onSubmit: SubmitHandler<ProductCheckoutForm> = useCallback(
    async (data) => {
      try {
        const body: CheckoutLinkCreate = {
          payment_processor: 'stripe',
          ...data,
          metadata: data.metadata.reduce(
            (acc, { key, value }) => ({ ...acc, [key]: value }),
            {},
          ),
        }
        let checkoutLink: CheckoutLink
        if (selectedLink) {
          checkoutLink = await updateCheckoutLink({
            id: selectedLink.id,
            body,
          })
          setNewLinkSuccess(false)
        } else {
          checkoutLink = await createCheckoutLink({ body })
          setSelectedLink(checkoutLink)
          navigator.clipboard.writeText(checkoutLink.url)
          setNewLinkSuccess(true)
        }
      } catch (e) {
        if (e instanceof ResponseError) {
          const body = await e.response.json()
          if (e.response.status === 422) {
            const validationErrors = body['detail'] as ValidationError[]
            setValidationErrors(validationErrors, setError)
            validationErrors.forEach((error) => {
              if (error.loc[1] === 'metadata') {
                const metadataKey = error.loc[2]
                const metadataIndex = data.metadata.findIndex(
                  ({ key }) => key === metadataKey,
                )
                if (metadataIndex > -1) {
                  const field = error.loc[3] === '[key]' ? 'key' : 'value'
                  setError(`metadata.${metadataIndex}.${field}`, {
                    message: error.msg,
                  })
                }
              }
            })
          } else {
            setError('root', { message: e.message })
          }
        }
      }
    },
    [selectedLink, createCheckoutLink, updateCheckoutLink, setError],
  )

  return (
    <div className="flex flex-col gap-y-8 overflow-y-auto p-12">
      <div className="flex flex-col gap-y-2">
        <h3 className="text-xl font-medium">Checkout Link</h3>
        <p className="dark:text-polar-500 text-gray-500">
          Generate a product-link which you can share to your customers or
          integrate in your own product
        </p>
      </div>
      <h1 className="text-xl">{product.name}</h1>
      {checkoutLinks && checkoutLinks.items.length > 0 && (
        <List size="small">
          {checkoutLinks.items.map((checkoutLink) => {
            const url = new URL(checkoutLink.url)
            return (
              <ListItem
                size="small"
                className="justify-between gap-x-6 whitespace-nowrap px-4 py-3 text-sm"
                inactiveClassName="dark:text-polar-500 text-gray-500"
                selectedClassName="text-black dark:text-white"
                key={checkoutLink.id}
                selected={selectedLink?.id === checkoutLink.id}
                onSelect={() => onSelectLink(checkoutLink)}
              >
                <ProductPriceLabel price={checkoutLink.product_price} />
                {checkoutLink.success_url && (
                  <Pill color="blue" className="truncate">
                    {url.host}
                  </Pill>
                )}
              </ListItem>
            )
          })}
        </List>
      )}

      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          {product.prices.length > 1 && (
            <FormField
              control={control}
              name="product_price_id"
              rules={{ required: 'This field is required' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a price" />
                    </SelectTrigger>
                    <SelectContent>
                      {product.prices.map((price) => (
                        <SelectItem key={price.id} value={price.id}>
                          <ProductPriceLabel price={price} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={control}
            name="success_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Success URL</FormLabel>
                <p className="dark:text-polar-500 text-xs text-gray-500">{`Include "checkout_id={CHECKOUT_ID}" as query parameter if you want to receive the checkout ID in the callback`}</p>
                <FormControl>
                  <Input
                    placeholder="https://example.com/success?checkout_id={CHECKOUT_ID}"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>Metadata</FormLabel>
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-row items-center gap-2"
                >
                  <FormField
                    control={control}
                    name={`metadata.${index}.key`}
                    render={({ field }) => (
                      <div className="flex flex-col">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Key"
                          />
                        </FormControl>
                        <FormMessage />
                      </div>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`metadata.${index}.value`}
                    render={({ field }) => (
                      <div className="flex flex-col">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Value"
                          />
                        </FormControl>
                        <FormMessage />
                      </div>
                    )}
                  />
                  <Button
                    className={
                      'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'
                    }
                    size="icon"
                    variant="secondary"
                    type="button"
                    onClick={() => remove(index)}
                  >
                    <ClearOutlined fontSize="inherit" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                type="button"
                onClick={() => {
                  append({ key: '', value: '' })
                }}
              >
                Add metadata
              </Button>
            </div>
          </FormItem>
          {selectedLink && <CopyToClipboardInput value={selectedLink?.url} />}
          <Button
            className="self-start"
            type="submit"
            loading={isCreatePending || isUpdatePending}
          >
            {selectedLink ? 'Update Link' : 'Generate Link'}
          </Button>
          {newLinkSuccess && selectedLink && (
            <Input
              value={selectedLink.url}
              readOnly
              className="border border-green-100 dark:border-green-900"
            />
          )}
        </form>
      </Form>
    </div>
  )
}
