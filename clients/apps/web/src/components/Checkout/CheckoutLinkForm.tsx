import {
  useCreateCheckoutLink,
  useDeleteCheckoutLink,
  useDiscounts,
  useUpdateCheckoutLink,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { getDiscountDisplay } from '@/utils/discount'
import { ClearOutlined } from '@mui/icons-material'
import {
  CheckoutLink,
  CheckoutLinkCreate,
  CheckoutLinkProductCreate,
  Product,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
import Button from '@polar-sh/ui/components/atoms/Button'
import Input from '@polar-sh/ui/components/atoms/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/ui/components/atoms/Select'
import Switch from '@polar-sh/ui/components/atoms/Switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@polar-sh/ui/components/ui/form'
import { useCallback, useEffect } from 'react'
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form'
import { ConfirmModal } from '../Modal/ConfirmModal'
import { useModal } from '../Modal/useModal'
import ProductPriceLabel from '../Products/ProductPriceLabel'
import { toast } from '../Toast/use-toast'

type CheckoutLinksForm = Omit<
  CheckoutLinkProductCreate,
  'payment_processor' | 'metadata'
> & {
  product_price_id?: string
  metadata: { key: string; value: string | number | boolean }[]
}

export interface CheckoutLinkFormProps {
  product: Product
  checkoutLink?: CheckoutLink
  onClose: (checkoutLink: CheckoutLink) => void
}

export const CheckoutLinkForm = ({
  product,
  checkoutLink,
  onClose,
}: CheckoutLinkFormProps) => {
  const { data: discounts } = useDiscounts(product.organization_id, {
    limit: 100,
    sorting: ['name'],
  })

  const generateDefaultValues = (): CheckoutLinksForm => {
    if (checkoutLink) {
      return {
        label: checkoutLink.label ?? null,
        metadata: Object.entries(checkoutLink.metadata ?? {}).map(
          ([key, value]) => ({ key, value }),
        ),
        product_id: product.id,
        product_price_id: checkoutLink.product_price_id ?? undefined,
        allow_discount_codes: checkoutLink.allow_discount_codes ?? true,
        success_url: checkoutLink.success_url ?? '',
        discount_id: checkoutLink.discount_id ?? '',
      }
    }

    return {
      label: null,
      metadata: [],
      product_id: product.id,
      product_price_id: undefined,
      allow_discount_codes: true,
      success_url: '',
      discount_id: '',
    }
  }

  const form = useForm<CheckoutLinksForm>({
    defaultValues: generateDefaultValues(),
  })

  const { control, handleSubmit, setError, reset } = form
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'metadata',
    rules: {
      maxLength: 50,
    },
  })

  useEffect(() => {
    if (!checkoutLink) return

    const defaultValues = generateDefaultValues()
    reset(defaultValues)
  }, [checkoutLink])

  const { mutateAsync: createCheckoutLink, isPending: isCreatePending } =
    useCreateCheckoutLink()
  const { mutateAsync: updateCheckoutLink, isPending: isUpdatePending } =
    useUpdateCheckoutLink()
  const { mutateAsync: deleteCheckoutLink, isPending: isDeletePending } =
    useDeleteCheckoutLink()

  const onDelete = async () => {
    if (checkoutLink) {
      await deleteCheckoutLink(checkoutLink)
        .then(() => {
          toast({
            title: 'Checkout Link Deleted',
            description: `${
              checkoutLink?.label ? checkoutLink.label : 'Unlabeled'
            } Checkout Link  was deleted successfully`,
          })
        })
        .catch((e) => {
          toast({
            title: 'Checkout Link Deletion Failed',
            description: `Error deleting checkout link: ${e.message}`,
          })
        })
    }
  }

  const {
    isShown: isDeleteModalShown,
    show: showDeleteModal,
    hide: hideDeleteModal,
  } = useModal()

  const onSubmit: SubmitHandler<CheckoutLinksForm> = useCallback(
    async (data) => {
      try {
        const { product_price_id, product_id, ...params } = data
        if (params.discount_id === '') {
          params.discount_id = null
        }
        if (params.success_url === '') {
          params.success_url = null
        }
        const body: CheckoutLinkCreate = {
          payment_processor: 'stripe',
          ...params,
          ...(product_price_id
            ? {
                product_price_id,
              }
            : {
                product_id,
              }),
          metadata: data.metadata.reduce(
            (acc, { key, value }) => ({ ...acc, [key]: value }),
            {},
          ),
        }

        let newCheckoutLink: CheckoutLink

        if (checkoutLink) {
          newCheckoutLink = await updateCheckoutLink({
            id: checkoutLink.id,
            body,
          })

          toast({
            title: 'Checkout Link Updated',
            description: `${
              newCheckoutLink.label ? newCheckoutLink.label : 'Unlabeled'
            } Checkout Link was updated successfully`,
          })
        } else {
          newCheckoutLink = await createCheckoutLink({ body })

          toast({
            title: 'Checkout Link Created',
            description: `${
              newCheckoutLink.label ? newCheckoutLink.label : 'Unlabeled'
            } Checkout Link was created successfully`,
          })
        }

        onClose(newCheckoutLink)
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

          toast({
            title: `Checkout Link Update Failed`,
            description: `Error updating checkout link: ${e.message}`,
          })
        }
      }
    },
    [onClose, checkoutLink, createCheckoutLink, updateCheckoutLink, setError],
  )

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6"
        >
          <FormField
            control={control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Label</FormLabel>
                <FormControl>
                  <Input placeholder="" {...field} value={field.value || ''} />
                </FormControl>
                <FormDescription className="text-xs">
                  Helpful if you have multiple links - internal &amp; optional.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {((checkoutLink && checkoutLink.product_price_id) ||
            product.prices.length > 1) && (
            <FormField
              control={control}
              name="product_price_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? product.prices[0].id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select price" />
                    </SelectTrigger>
                    <SelectContent>
                      {checkoutLink &&
                        checkoutLink.product_price?.is_archived && (
                          <SelectItem
                            key={checkoutLink.product_price.id}
                            value={checkoutLink.product_price.id}
                          >
                            <div className="flex flex-row items-center">
                              <ProductPriceLabel
                                price={checkoutLink.product_price}
                              />
                              <span className="ml-2 text-xs">(Archived)</span>
                            </div>
                          </SelectItem>
                        )}
                      {product.prices.map((price) => (
                        <SelectItem key={price.id} value={price.id}>
                          <ProductPriceLabel price={price} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    Default checkout price
                  </FormDescription>
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
                <FormControl>
                  <Input
                    placeholder="https://example.com/success?checkout_id={CHECKOUT_ID}"
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription className="text-xs">
                  Include{' '}
                  <code>
                    {'{'}CHECKOUT_ID{'}'}
                  </code>{' '}
                  to receive the Checkout ID on success.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="allow_discount_codes"
            render={({ field }) => {
              return (
                <FormItem>
                  <div className="flex flex-row items-center justify-between space-x-2 space-y-0">
                    <FormLabel>Allow discount codes</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                  <FormDescription>
                    {field.value
                      ? 'Customers will be able to apply discount codes during checkout.'
                      : "Customers won't be able to apply discount codes during checkout."}
                  </FormDescription>
                </FormItem>
              )
            }}
          />
          <FormField
            control={control}
            name="discount_id"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Preset discount</FormLabel>
                  <div className="flex flex-row items-center gap-2">
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a discount" />
                      </SelectTrigger>
                      <SelectContent>
                        {discounts?.items.map((discount) => (
                          <SelectItem
                            key={discount.id}
                            value={discount.id}
                            textValue={discount.name}
                          >
                            {discount.name} ({getDiscountDisplay(discount)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value && (
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() => field.onChange(null)}
                      >
                        <ClearOutlined className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <FormItem>
            <div className="flex flex-row items-center justify-between gap-2 py-2">
              <FormLabel>Metadata</FormLabel>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                type="button"
                onClick={() => {
                  append({ key: '', value: '' })
                }}
              >
                Add Metadata
              </Button>
            </div>
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
                      <>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Key"
                          />
                        </FormControl>
                        <FormMessage />
                      </>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`metadata.${index}.value`}
                    render={({ field }) => (
                      <>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value.toString() || ''}
                            placeholder="Value"
                          />
                        </FormControl>
                        <FormMessage />
                      </>
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
            </div>
          </FormItem>

          <div className="flex flex-row gap-x-4">
            <Button
              className="self-start"
              type="submit"
              loading={isCreatePending || isUpdatePending}
            >
              {checkoutLink ? 'Save' : 'Create'}
            </Button>
            {checkoutLink && (
              <Button
                variant="secondary"
                onClick={showDeleteModal}
                disabled={isDeletePending}
                type="button"
              >
                Delete
              </Button>
            )}
          </div>
        </form>
      </Form>
      <ConfirmModal
        title="Confirm Deletion of Checkout Link"
        description="It will cause 404 responses in case the link is still in use anywhere."
        onConfirm={onDelete}
        isShown={isDeleteModalShown}
        hide={hideDeleteModal}
        destructiveText="Delete"
        destructive
      />
    </>
  )
}
