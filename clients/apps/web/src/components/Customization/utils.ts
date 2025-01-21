import {
  CheckoutProduct,
  CheckoutStatus,
  CustomerOrder,
  CustomerSubscription,
  Organization,
  ProductPrice,
  ProductStorefront,
} from '@polar-sh/api'
import {
  CheckoutPublic$inboundSchema,
  type CheckoutPublic,
} from '@polar-sh/sdk/models/components/checkoutpublic'

const PRODUCT_DESCRIPTION = `# Et Tritonia pectora partus praebentem
## Clipeo mentiris arquato obliqua lacerta
Lorem markdownum bifidosque tenus quod gutture parte genialiter Manto, et potuit: medio mea rogando Hector: bene? Bracchia pectus Acrisioneas adsumus? O Aeaeae flammae, est ait fleverunt illi iamdudum; captatur e. Caede et lues praecipites corrige gessit montis, aspera miserum si facit. Cum milia docta amens nec solito manifesta fitque incognita haec enim, sed resupinus enim.

### Nox flebilis torva
Repetito cum furtum altera
Mare prius gelidumque perde
Gravem colentes impetus reminiscitur invitusque blanditur ipse
Iam maiora
In quoque extulerat tale semper quidque. Fovebat heros quos gaudent et movent agmina fortis.`

export const PRODUCT_PREVIEW: ProductStorefront = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toISOString(),
  organization_id: '123',
  medias: [
    {
      id: '123',
      created_at: new Date().toISOString(),
      public_url: '/assets/docs/og/bg.jpg',
      is_uploaded: false,
      service: 'product_media',
      mime_type: 'image/png',
      organization_id: '123',
      name: 'blend.png',
      path: '/assets/docs/og/bg.png',
      size: 123,
      size_readable: '123 B',
      storage_version: '1',
      checksum_etag: '123',
      checksum_sha256_base64: '123',
      checksum_sha256_hex: '123',
      version: '1',
      last_modified_at: new Date().toISOString(),
    },
  ],
  prices: [
    {
      id: '123',
      amount_type: 'fixed',
      price_amount: 10000,
      type: 'one_time',
      price_currency: 'usd',
      is_archived: false,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      product_id: '123',
    },
  ],
  name: 'Pro Tier',
  description: PRODUCT_DESCRIPTION,
  benefits: [
    {
      id: '123',
      description: 'Premium feature',
      type: 'custom',
      created_at: new Date().toISOString(),
      modified_at: null,
      selectable: false,
      deletable: false,
      organization_id: '123',
    },
  ],
  created_at: new Date().toISOString(),
}

export const SUBSCRIPTION_PRODUCT_PREVIEW: ProductStorefront = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toISOString(),
  organization_id: '123',
  medias: [
    {
      id: '123',
      created_at: new Date().toISOString(),
      public_url: '/assets/docs/og/bg.jpg',
      is_uploaded: false,
      service: 'product_media',
      mime_type: 'image/png',
      organization_id: '123',
      name: 'blend.png',
      path: '/assets/docs/og/bg.png',
      size: 123,
      size_readable: '123 B',
      storage_version: '1',
      checksum_etag: '123',
      checksum_sha256_base64: '123',
      checksum_sha256_hex: '123',
      version: '1',
      last_modified_at: new Date().toISOString(),
    },
  ],
  prices: [
    {
      id: '123',
      amount_type: 'fixed',
      price_amount: 10000,
      type: 'recurring',
      recurring_interval: 'month',
      price_currency: 'usd',
      is_archived: false,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      product_id: '123',
    },
  ],
  name: 'Pro Tier',
  description: PRODUCT_DESCRIPTION,
  benefits: [
    {
      id: '123',
      description: 'Premium feature',
      type: 'custom',
      created_at: new Date().toISOString(),
      modified_at: null,
      selectable: false,
      deletable: false,
      organization_id: '123',
    },
  ],
  created_at: new Date().toISOString(),
}

export const ORGANIZATION = {
  id: '123',
  name: 'My Organization',
  slug: 'my-organization',
  created_at: new Date().toISOString(),
  modified_at: null,
  avatar_url: '/assets/acme.jpg',
  bio: null,
  blog: null,
  company: null,
  location: null,
  email: null,
  default_upfront_split_to_contributors: null,
  feature_settings: null,
  twitter_username: null,
  pledge_minimum_amount: 2000,
  pledge_badge_show_amount: false,
  profile_settings: null,
}

export const createCheckoutPreview = (
  product: CheckoutProduct,
  price: ProductPrice,
  organization: Organization,
): CheckoutPublic => {
  const amount =
    price.amount_type === 'custom'
      ? (price.minimum_amount ?? 0)
      : price.amount_type === 'fixed'
        ? price.price_amount
        : 0

  const checkout = CheckoutPublic$inboundSchema.parse({
    id: '123',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    payment_processor: 'stripe',
    status: CheckoutStatus.OPEN,
    expires_at: new Date().toISOString(),
    client_secret: 'CLIENT_SECRET',
    product: product,
    product_id: product.id,
    product_price: price,
    product_price_id: price.id,
    amount,
    tax_amount: null,
    subtotal_amount: amount,
    total_amount: amount,
    is_discount_applicable: price.amount_type === 'fixed',
    is_free_product_price: price.amount_type === 'free',
    is_payment_required: amount > 0,
    is_payment_setup_required: price.type === 'recurring',
    is_payment_form_required: amount > 0 || price.type === 'recurring',
    currency: 'usd',
    customer_id: null,
    customer_email: 'janedoe@gmail.com',
    customer_name: 'Jane Doe',
    customer_billing_address: null,
    customer_ip_address: null,
    customer_tax_id: null,
    payment_processor_metadata: {},
    url: '/checkout/CLIENT_SECRET',
    success_url: '/checkout/CLIENT_SECRET/confirmation',
    embed_origin: null,
    organization,
    attached_custom_fields: [],
    discount: null,
    discount_id: null,
    allow_discount_codes: true,
  })

  return {
    ...checkout,
    // @ts-ignore
    paymentProcessor: 'dummy',
  }
}

export const CHECKOUT_PREVIEW: CheckoutPublic = createCheckoutPreview(
  PRODUCT_PREVIEW,
  PRODUCT_PREVIEW.prices[0],
  ORGANIZATION,
)

export const ORDER_PREVIEW: CustomerOrder = {
  id: '123',
  amount: 10000,
  currency: 'usd',
  tax_amount: 1200,
  user_id: '123',
  customer_id: '123',
  product_id: PRODUCT_PREVIEW.id,
  product_price_id: PRODUCT_PREVIEW.prices[0].id,
  product_price: PRODUCT_PREVIEW.prices[0],
  subscription_id: null,
  subscription: null,
  product: {
    ...PRODUCT_PREVIEW,
    organization: ORGANIZATION,
  },
  created_at: new Date().toISOString(),
  modified_at: new Date().toISOString(),
}

export const SUBSCRIPTION_ORDER_PREVIEW: CustomerSubscription = {
  created_at: new Date().toISOString(),
  modified_at: new Date().toISOString(),
  id: '989898989',
  amount: 10000,
  currency: 'usd',
  recurring_interval: 'month',
  status: 'active',
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(
    new Date().setMonth(new Date().getMonth() + 1),
  ).toISOString(),
  cancel_at_period_end: false,
  canceled_at: null,
  started_at: new Date().toISOString(),
  ends_at: null,
  ended_at: null,
  user_id: '123',
  customer_id: '123',
  product_id: SUBSCRIPTION_PRODUCT_PREVIEW.id,
  price_id: SUBSCRIPTION_PRODUCT_PREVIEW.prices[0].id,
  checkout_id: null,
  product: {
    ...SUBSCRIPTION_PRODUCT_PREVIEW,
    organization: ORGANIZATION,
  },
  price: {
    id: '123',
    amount_type: 'fixed',
    price_amount: 10000,
    type: 'recurring',
    recurring_interval: 'month',
    price_currency: 'usd',
    is_archived: false,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    product_id: '123',
  },
  discount_id: null,
  customer_cancellation_comment: null,
  customer_cancellation_reason: null,
}
