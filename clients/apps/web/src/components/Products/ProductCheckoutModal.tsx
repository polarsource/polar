import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { useModal } from '@/components/Modal/useModal'
import {
  useCheckoutLinks,
  useCreateCheckoutLink,
  useDeleteCheckoutLink,
  useDiscounts,
  useUpdateCheckoutLink,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import { getDiscountDisplay } from '@/utils/discount'
import {
  ClearOutlined,
  CloseOutlined,
  SettingsOutlined,
} from '@mui/icons-material'
import {
  CheckoutLink,
  CheckoutLinkCreate,
  CheckoutLinkProductCreate,
  Product,
  ResponseError,
  ValidationError,
} from '@polar-sh/api'
import { Pill, Switch } from 'polarkit/components/atoms'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from 'polarkit/components/atoms/accordion'
import Button from 'polarkit/components/atoms/button'
import CopyToClipboardInput from 'polarkit/components/atoms/copy-to-clipboard-input'
import Input from 'polarkit/components/atoms/input'
import { List, ListItem } from 'polarkit/components/atoms/list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'polarkit/components/atoms/select'
import ShadowBox from 'polarkit/components/atoms/shadowbox'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/atoms/tabs'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import { Label } from 'polarkit/components/ui/label'
import { useCallback, useMemo, useState } from 'react'
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { toast } from '../Toast/use-toast'
import ProductPriceLabel from './ProductPriceLabel'

const LinkView = ({
  product,
  link,
}: {
  product: Product
  link: CheckoutLink
}) => {
  const [darkmode, setDarkmode] = useState<boolean>(true)
  const [embedType, setEmbedType] = useState<string>('link')

  const svgEmbed = useMemo(() => {
    let params = {
      organizationId: product.organization_id,
      productId: product.id,
      ...(link.product_price_id
        ? {
            product_price_id: link.product_price_id,
          }
        : {}),
    }
    const query = new URLSearchParams(params).toString()

    const addDarkmode = darkmode ? '&darkmode' : ''
    const url = `${CONFIG.FRONTEND_BASE_URL}/embed/product.svg?${query}${addDarkmode}`
    return `<a href="${link.url}"><img src="${url}" alt="${product.name}" /></a>`
  }, [link, product, darkmode])

  const checkoutEmbed = useMemo(() => {
    const theme = darkmode ? 'dark' : 'light'
    return `
<a href="${link.url}" data-polar-checkout data-polar-checkout-theme="${theme}">Purchase ${product.name}</a>
<script src="${CONFIG.CHECKOUT_EMBED_SCRIPT_SRC}" defer data-auto-init></script>
  `.trim()
  }, [link, product, darkmode])

  const showDarkmodeToggle = embedType === 'svg' || embedType === 'checkout'

  return (
    <>
      <Tabs
        defaultValue={embedType}
        onValueChange={(value) => setEmbedType(value)}
      >
        <TabsList>
          <TabsTrigger value="link">Link</TabsTrigger>
          <TabsTrigger value="checkout">Checkout Embed</TabsTrigger>
          <TabsTrigger value="svg">SVG Embed</TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <CopyToClipboardInput
            value={link.url}
            buttonLabel="Copy"
            className="bg-white"
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Checkout Link was copied to clipboard`,
              })
            }}
          />
        </TabsContent>

        <TabsContent value="checkout">
          <CopyToClipboardInput
            value={checkoutEmbed}
            buttonLabel="Copy"
            className="bg-white"
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Checkout Embed was copied to clipboard`,
              })
            }}
          />
        </TabsContent>

        <TabsContent value="svg">
          <CopyToClipboardInput
            value={svgEmbed}
            buttonLabel="Copy"
            className="bg-white"
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `SVG Embed was copied to clipboard`,
              })
            }}
          />
        </TabsContent>

        {showDarkmodeToggle && (
          <div className="mt-4 flex flex-row gap-x-2 px-4">
            <Checkbox
              id="darkmode"
              checked={darkmode}
              onCheckedChange={(checked) => {
                setDarkmode(checked === true)
              }}
            />
            <Label htmlFor="darkmode" className="grow text-xs">
              Dark Mode
            </Label>
          </div>
        )}
      </Tabs>
    </>
  )
}

const LinkList = ({
  links,
  current,
  onSelect,
  onSelectCreate,
}: {
  links: CheckoutLink[]
  current: string | undefined
  onSelect: (link: CheckoutLink, showForm: boolean) => void
  onSelectCreate: () => void
}) => {
  return (
    <div>
      <div className="mb-4 flex flex-row">
        <h2 className="grow">Links</h2>
        <div className="pr-4">
          <Button size="sm" onClick={onSelectCreate}>
            New Link
          </Button>
        </div>
      </div>
      <List size="small">
        {links.map((link) => {
          const url = new URL(link.url)
          return (
            <ListItem
              size="small"
              className="justify-between gap-x-6 whitespace-nowrap px-4 py-3 text-sm"
              inactiveClassName="dark:text-polar-500 text-gray-500"
              selectedClassName="text-black dark:text-white"
              key={link.id}
              selected={current === link.id}
              onSelect={() => onSelect(link, false)}
            >
              <p
                className={twMerge(
                  'overflow-hidden text-ellipsis',
                  !link.label && 'italic',
                )}
              >
                {link.label || 'No label'}
              </p>
              <div className="flex grow flex-row items-center justify-end gap-x-6">
                {link.success_url && (
                  <Pill color="blue" className="truncate">
                    {url.host}
                  </Pill>
                )}
                {link.product_price && !link.product_price.is_archived && (
                  <ProductPriceLabel price={link.product_price} />
                )}
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(link, true)
                  }}
                >
                  <SettingsOutlined fontSize="inherit" />
                </Button>
              </div>
            </ListItem>
          )
        })}
      </List>
    </div>
  )
}

export interface ProductCheckoutModalProps {
  product: Product
}

type ProductCheckoutForm = Omit<
  CheckoutLinkProductCreate,
  'payment_processor' | 'metadata'
> & {
  product_price_id?: string
  metadata: { key: string; value: string | number | boolean }[]
}

export const ProductCheckoutModal = ({
  product,
}: ProductCheckoutModalProps) => {
  const [selectedLink, setSelectedLink] = useState<CheckoutLink | null>(null)
  const [showForm, setShowForm] = useState<boolean>(true)

  const { data: checkoutLinks, isFetched } = useCheckoutLinks(
    product.organization_id,
    {
      productId: product.id,
    },
  )

  const { data: discounts } = useDiscounts(product.organization_id, {
    limit: 100,
    sorting: ['name'],
  })

  const generateDefaultValues = (): ProductCheckoutForm => {
    return {
      label: null,
      metadata: [],
      product_id: product.id,
      product_price_id: undefined,
      allow_discount_codes: true,
    }
  }

  const form = useForm<ProductCheckoutForm>({
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

  const {
    isShown: isDeleteModalShown,
    hide: hideDeleteModal,
    show: showDeleteModal,
  } = useModal()

  const { mutateAsync: deleteCheckoutLink, isPending: isDeletePending } =
    useDeleteCheckoutLink()
  const { mutateAsync: createCheckoutLink, isPending: isCreatePending } =
    useCreateCheckoutLink()
  const { mutateAsync: updateCheckoutLink, isPending: isUpdatePending } =
    useUpdateCheckoutLink()

  const showCreateForm = () => {
    setSelectedLink(null)
    setShowForm(true)
    reset(generateDefaultValues())
  }

  const onDelete = async () => {
    if (selectedLink) {
      const wasLast = (checkoutLinks?.items?.length || 0) == 1
      await deleteCheckoutLink(selectedLink)
        .then(() => {
          toast({
            title: 'Checkout Link Deleted',
            description: `Checkout Link ${selectedLink.label} was deleted successfully`,
          })
        })
        .catch((e) => {
          toast({
            title: 'Checkout Link Deletion Failed',
            description: `Error deleting checkout link: ${e.message}`,
          })
        })
      if (wasLast) {
        showCreateForm()
      }
    }
  }

  const onSelectLink = useCallback(
    (link: CheckoutLink, showForm: boolean) => {
      setSelectedLink(link)
      let { product_price_id, ...data } = link
      reset({
        ...data,
        ...(product_price_id
          ? {
              product_price_id,
            }
          : {}),
        metadata: Object.entries(data.metadata).map(([key, value]) => ({
          key,
          value,
        })),
      })
      setShowForm(showForm)
    },
    [reset],
  )

  const onSubmit: SubmitHandler<ProductCheckoutForm> = useCallback(
    async (data) => {
      try {
        const { product_price_id, product_id, ...params } = data
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

        let checkoutLink: CheckoutLink
        if (selectedLink) {
          checkoutLink = await updateCheckoutLink({
            id: selectedLink.id,
            body,
          })

          toast({
            title: 'Checkout Link Updated',
            description: `Checkout Link ${selectedLink.label} was updated successfully`,
          })
        } else {
          checkoutLink = await createCheckoutLink({ body })
          setSelectedLink(checkoutLink)

          toast({
            title: 'Checkout Link Created',
            description: `Checkout Link ${checkoutLink.label} was created successfully`,
          })
        }
        setShowForm(false)
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
            title: 'Checkout Link Update Failed',
            description: `Error updating checkout link: ${e.message}`,
          })
        }
      }
    },
    [selectedLink, createCheckoutLink, updateCheckoutLink, setError],
  )

  const hasCheckoutLinks = checkoutLinks && checkoutLinks.items.length > 0

  if (!isFetched) {
    return <></>
  }

  return (
    <div className="flex flex-col gap-y-8 overflow-y-auto p-12">
      <div className="flex flex-col gap-y-2">
        <h1 className="text-xl font-medium">{product.name}</h1>
        <p className="dark:text-polar-500 text-gray-500">
          Checkout Links &amp; Embeds to easily integrate or share directly with
          your audience.
        </p>
      </div>

      {hasCheckoutLinks && (
        <>
          <LinkList
            links={checkoutLinks.items}
            current={selectedLink?.id}
            onSelect={onSelectLink}
            onSelectCreate={showCreateForm}
          />
          {selectedLink && !showForm && (
            <LinkView product={product} link={selectedLink} />
          )}
        </>
      )}

      {showForm && (
        <ShadowBox className="dark:bg-polar-800 flex flex-col gap-y-6 rounded-xl p-6">
          <Form {...form}>
            <div className="flex flex-row items-center">
              <h2 className="grow">
                {selectedLink ? 'Edit Link' : 'Create Link'}
              </h2>
              {selectedLink && (
                <button type="button" onClick={() => setShowForm(false)}>
                  <CloseOutlined fontSize="inherit" />
                </button>
              )}
            </div>
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
                      <Input
                        placeholder=""
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Helpful if you have multiple links - internal &amp;
                      optional.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {((selectedLink && selectedLink.product_price_id) ||
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
                          {selectedLink &&
                            selectedLink.product_price?.is_archived && (
                              <SelectItem
                                key={selectedLink.product_price.id}
                                value={selectedLink.product_price.id}
                              >
                                <div className="flex flex-row items-center">
                                  <ProductPriceLabel
                                    price={selectedLink.product_price}
                                  />
                                  <span className="ml-2 text-xs">
                                    (Archived)
                                  </span>
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
              <Accordion
                type="single"
                collapsible
                className="flex flex-col gap-y-6"
              >
                <AccordionItem
                  value="discounts"
                  className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    Discounts
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-y-6">
                    <FormField
                      control={control}
                      name="allow_discount_codes"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <div className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel>Allow discount codes</FormLabel>
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
                                      {discount.name} (
                                      {getDiscountDisplay(discount)})
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
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem
                  value="advanced"
                  className="dark:border-polar-700 rounded-xl border border-gray-200 px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    Advanced
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-y-6">
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
                                      value={field.value.toString() || ''}
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex flex-row gap-x-4">
                <Button
                  className="self-start"
                  type="submit"
                  loading={isCreatePending || isUpdatePending}
                >
                  {selectedLink ? 'Save' : 'Create'}
                </Button>
                {selectedLink && (
                  <>
                    <Button
                      className="self-start"
                      variant="secondary"
                      loading={isDeletePending}
                      onClick={(e) => {
                        e.preventDefault()
                        showDeleteModal()
                      }}
                    >
                      Delete
                    </Button>
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
                )}
              </div>
            </form>
          </Form>
        </ShadowBox>
      )}
    </div>
  )
}
