import {
  useCheckoutLinks,
  useCreateCheckoutLink,
  useUpdateCheckoutLink,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
import { ClearOutlined } from '@mui/icons-material'
import { SettingsOutlined } from '@mui/icons-material';
import {
  CheckoutLink,
  CheckoutLinkCreate,
  Product,
  ResponseError,
  ValidationError,
} from '@polar-sh/sdk'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import { Switch } from 'polarkit/components/ui/atoms'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from 'polarkit/components/ui/form'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'polarkit/components/ui/atoms/tabs'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Label } from 'polarkit/components/ui/label'
import { useCallback, useState, useMemo, useEffect } from 'react'
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form'
import ProductPriceLabel from './ProductPriceLabel'

const LinkView = ({
  product,
  link,
}: {
  product: Product,
  link: CheckoutLink,
}) => {
  const [darkmode, setDarkmode] = useState<boolean>(true)
  const [embedType, setEmbedType] = useState<string>('link')

  const svgURL = useMemo(() => {
    const query = new URLSearchParams({
      organizationId: product.organization_id,
      productId: product.id,
      productPriceId: link.product_price_id,
    }).toString()

    const addDarkmode = darkmode ? '&darkmode' : ''
    const url = `${CONFIG.FRONTEND_BASE_URL}/embed/product.svg?${query}${addDarkmode}`
    return url
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
      <Tabs defaultValue={embedType} onValueChange={(value) => setEmbedType(value)}>
        <TabsList>
          <TabsTrigger value="link">Link</TabsTrigger>
          <TabsTrigger value="checkout">Checkout Embed</TabsTrigger>
          <TabsTrigger value="svg">Product Card</TabsTrigger>
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
            value={svgURL}
            buttonLabel="Copy"
            className="bg-white"
          />
        </TabsContent>

        {showDarkmodeToggle && (
          <div className="flex flex-row gap-x-2 mt-4 px-4">
            <Checkbox
              id="darkmode"
              checked={darkmode}
              onCheckedChange={(checked) => {
                setDarkmode(checked === true)
              }}
            />
            <Label htmlFor="darkmode" className="grow text-xs">Dark Mode</Label>
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
  onSelectCreate
}: {
  links: CheckoutLink[]
  current: string | undefined
  onSelect: (link: CheckoutLink, showForm: boolean) => void
  onSelectCreate: () => void
}) => {
  return (
    <div>
      <div className="flex flex-row mb-4">
        <h2 className="grow">Links</h2>
        <div className="pr-4">
          <Button variant="secondary" onClick={onSelectCreate}>
              +
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
              <ProductPriceLabel price={link.product_price} />
              {link.success_url && (
                <Pill color="blue" className="truncate">
                  {url.host}
                </Pill>
              )}
              <Button size="sm" variant="secondary" onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect(link, true)
              }}>
               <SettingsOutlined fontSize="inherit" className="text-gray-500" />
              </Button>
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
  CheckoutLinkCreate,
  'payment_processor' | 'metadata'
> & { metadata: { key: string; value: string }[] }

export const ProductCheckoutModal = ({
  product,
}: ProductCheckoutModalProps) => {
  const { data: checkoutLinks, isFetched } = useCheckoutLinks(product.organization_id, {
    productId: product.id,
  })

  const generateDefaultValues = () => {
    return {
      product_price_id: product.prices[0].id,
      metadata: [],
    }
  }

  const form = useForm<ProductCheckoutForm>({
    defaultValues: generateDefaultValues()
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
  const [showForm, setShowForm] = useState<boolean>(true)

  const showCreateForm = () => {
    setSelectedLink(null)
    setShowForm(true)
    reset(generateDefaultValues())
  }

  const onSelectLink = useCallback(
    (link: CheckoutLink, showForm: boolean) => {
      console.log('select', link, showForm)
      setSelectedLink(link)
      reset({
        ...link,
        metadata: Object.entries(link.metadata).map(([key, value]) => ({
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
        <h1 className="text-xl font-medium">
          Share &rsaquo; {product.name}
        </h1>
        <p className="dark:text-polar-500 text-gray-500">
          Checkout Links &amp; Embeds to easily integrate or share directly with your audience.
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
          {selectedLink && !showForm && <LinkView product={product} link={selectedLink} />}
        </>
      )}

      {showForm && (
        <Form {...form}>
          <h2>{selectedLink ? 'Edit Link' : 'Create Link'}</h2>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-y-6"
          >
            {!selectedLink && product.prices.length > 1 && (
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
      )}
    </div>
  )
}
