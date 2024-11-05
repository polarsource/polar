import {
  useCheckoutLinks,
  useCreateCheckoutLink,
  useUpdateCheckoutLink,
} from '@/hooks/queries'
import { setValidationErrors } from '@/utils/api/errors'
import { CONFIG } from '@/utils/config'
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
import { useCallback, useMemo, useState } from 'react'
import { SubmitHandler, useFieldArray, useForm } from 'react-hook-form'
import ProductPriceLabel from './ProductPriceLabel'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'

const LinkView = ({
  product,
  link,
}: {
  product: Product,
  link: CheckoutLink,
}) => {
  const [embedSVG, setEmbedSVG] = useState(true)
  const [darkmode, setDarkmode] = useState(true)
  const [embedCheckout, setEmbedCheckout] = useState(false)

  const generateSVG = (link: CheckoutLink, product: Product, darkmode: boolean) => {
    const query = new URLSearchParams({
      organizationId: product.organization_id,
      productId: product.id,
      productPriceId: link.product_price_id,
    }).toString()

    const addDarkmode = darkmode ? '&darkmode' : ''
    return `<img src="${CONFIG.FRONTEND_BASE_URL}/embed/product.svg?${query}${addDarkmode}" alt="Purchase ${product.name}" />`
  }

  const generateCheckoutEmbed = (link: CheckoutLink, content: string, darkmode: boolean) => {
    const theme = darkmode ? 'dark' : 'light'
    return `
<a href="${link.url}" data-polar-checkout data-polar-checkout-theme="${theme}">${content}</a>
<script src="${CONFIG.CHECKOUT_EMBED_SCRIPT_SRC}" defer data-auto-init></script>
  `.trim()
  }

  const embedCode = useMemo(() => {
    if (!link || !product) return ''

    let content = `Purchase ${product.name}`
    if (embedSVG) {
      content = generateSVG(link, product, darkmode)
    }

    if (embedCheckout) {
      return generateCheckoutEmbed(link, content, darkmode)
    }

    return `<a href="${link.url}">${content}</a>`
  }, [link, product, embedSVG, darkmode, embedCheckout])

  return (
    <>
      <Tabs defaultValue="link">
        <TabsList>
          <TabsTrigger value="link">Link</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <CopyToClipboardInput
            value={link.url}
            buttonLabel="Copy URL"
            className="bg-white"
          />
        </TabsContent>

        <TabsContent value="embed">
          <CopyToClipboardInput
            value={embedCode}
            buttonLabel="Copy Code"
            className="bg-white"
          />
          <div>
            <div className="flex flex-row items-center px-4">
              <label htmlFor="embed-svg" className="grow">Product Card (SVG)</label>
              <Switch
                id="embed-svg"
                checked={embedSVG}
                onCheckedChange={(checked) => {
                  setEmbedSVG(checked)
                }}
              />
            </div>
            <div className="flex flex-row items-center px-4">
              <label htmlFor="darkmode" className="grow">Dark Mode</label>
              <Switch
                id="darkmode"
                checked={darkmode}
                onCheckedChange={(checked) => {
                  setDarkmode(checked)
                }}
              />
            </div>
            <div className="flex flex-row items-center px-4">
              <label htmlFor="embed-checkout" className="grow">Checkout Embed</label>
              <Switch
                id="embed-checkout"
                checked={embedCheckout}
                onCheckedChange={(checked) => {
                  setEmbedCheckout(checked)
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}

const LinkList = ({
  links,
  current,
  onSelect
}: {
  links: CheckoutLink[]
  current: string | undefined
  onSelect: (link: CheckoutLink) => void
}) => {
  return (
    <>
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
              onSelect={() => onSelect(link)}
            >
              <ProductPriceLabel price={link.product_price} />
              {link.success_url && (
                <Pill color="blue" className="truncate">
                  {url.host}
                </Pill>
              )}
            </ListItem>
          )
        })}
      </List>
    </>
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
          navigator.clipboard.writeText(checkoutLink.url)
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
        <h3 className="text-xl font-medium">
          Share
        </h3>
        <p className="dark:text-polar-500 text-gray-500">
          Checkout Links &amp; Embeds to easily integrate or share directly with your audience.
        </p>
      </div>
      <h1 className="text-xl">{product.name}</h1>
      {checkoutLinks && checkoutLinks.items.length > 0 && (
        <>
          <LinkList links={checkoutLinks.items} current={selectedLink?.id} onSelect={onSelectLink} />
          {selectedLink && <LinkView product={product} link={selectedLink} />}
        </>
      )}

      <ShadowBoxOnMd>
        <Form {...form}>
          <h2 className="mb-4">
            {selectedLink ? 'Update Current Link' : 'Create New Link'}
          </h2>
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
            <Button
              className="self-start"
              type="submit"
              loading={isCreatePending || isUpdatePending}
            >
              {selectedLink ? 'Update Link' : 'Generate Link'}
            </Button>
          </form>
        </Form>
      </ShadowBoxOnMd>
    </div>
  )
}
