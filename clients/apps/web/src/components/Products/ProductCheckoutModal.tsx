import {
  useCheckoutLinks,
  useCreateCheckoutLink,
  useUpdateCheckoutLink,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { twMerge } from 'tailwind-merge'
import { CONFIG } from '@/utils/config'
import { ClearOutlined, SettingsOutlined } from '@mui/icons-material'
import {
  CheckoutLink,
  CheckoutLinkCreate,
  CheckoutLinkProductCreate,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form'
import ProductPriceLabel from './ProductPriceLabel'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

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
      ...(link.product_price_id ? {
        product_price_id: link.product_price_id
      } : {})
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
          />
        </TabsContent>

        <TabsContent value="checkout">
          <CopyToClipboardInput
            value={checkoutEmbed}
            buttonLabel="Copy"
            className="bg-white"
          />
        </TabsContent>

        <TabsContent value="svg">
          <CopyToClipboardInput
            value={svgEmbed}
            buttonLabel="Copy"
            className="bg-white"
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
          let displayLabel = link.label
          if (displayLabel && displayLabel.length > 20) {
            displayLabel = displayLabel.slice(0, 20) + '...'
          }

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
              <p className={twMerge(
                !link.label && "text-xxs",
              )}>
                {link.label ? displayLabel : 'No label'}
              </p>
              <div className="flex flex-row justify-end grow items-center gap-x-6">
                {link.success_url && (
                  <Pill color="blue" className="truncate">
                    {url.host}
                  </Pill>
                )}
                {link.product_price && (
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
                  <SettingsOutlined
                    fontSize="inherit"
                  />
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

  const generateDefaultValues = () => {
    return {
      label: null,
      metadata: [],
      product_id: product.id,
      product_price_id: undefined,
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

  const showCreateForm = () => {
    setSelectedLink(null)
    setShowForm(true)
    reset(generateDefaultValues())
  }

  const onSelectLink = useCallback(
    (link: CheckoutLink, showForm: boolean) => {
      setSelectedLink(link)
      let { product_price_id, ...data } = link
      reset({
        ...data,
        ...(product_price_id ? {
          product_price_id
        } : {}),
        metadata: Object.entries(data.metadata).map(([key, value]) => ({
          key,
          value,
        })),
      })
      setShowForm(showForm)
    },
    [reset],
  )

  useEffect(() => {
    if (checkoutLinks && checkoutLinks.items.length > 0) {
      setSelectedLink(checkoutLinks.items[0])
      setShowForm(false)
    }
  }, [isFetched, checkoutLinks, setSelectedLink])

  const { mutateAsync: createCheckoutLink, isPending: isCreatePending } =
    useCreateCheckoutLink()
  const { mutateAsync: updateCheckoutLink, isPending: isUpdatePending } =
    useUpdateCheckoutLink()
  const onSubmit: SubmitHandler<ProductCheckoutForm> = useCallback(
    async (data) => {
      try {
        const { product_price_id, product_id, ...params } = data
        const body: CheckoutLinkCreate = {
          payment_processor: 'stripe',
          ...params,
          ...(product_price_id ? {
            product_price_id,
          } : {
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
        } else {
          checkoutLink = await createCheckoutLink({ body })
          setSelectedLink(checkoutLink)
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
        <ShadowBox className="dark:bg-polar-800 bg-white flex flex-col gap-y-6 p-6 rounded-xl">
          <Form {...form}>
            <h2>{selectedLink ? 'Edit Link' : 'Create Link'}</h2>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-y-6"
            >
              {((selectedLink && selectedLink.product_price_id) || product.prices.length > 1) && (
                <FormField
                  control={control}
                  name="product_price_id"
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
                        <FormDescription className="text-xs">
                          By default the first price will be used.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                      Helpful if you have multiple links - internal &amp; optional.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

              <div className="flex flex-row gap-x-4">
                <Button
                  className="self-start"
                  type="submit"
                  loading={isCreatePending || isUpdatePending}
                >
                  {selectedLink ? 'Save' : 'Create'}
                </Button>
                {selectedLink && (
                  <Button
                    className="self-start"
                    variant="secondary"
                    onClick={() => {
                      setShowForm(false)
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </ShadowBox>
      )}
    </div>
  )
}
