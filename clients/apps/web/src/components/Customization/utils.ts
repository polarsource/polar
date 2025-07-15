import { schemas } from '@polar-sh/client'
import {
  type CheckoutPublic,
  CheckoutPublic$inboundSchema,
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

const PRODUCT_PREVIEW: schemas['ProductStorefront'] = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toISOString(),
  organization_id: '123',
  recurring_interval: null,
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
      price_currency: 'usd',
      is_archived: false,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      product_id: '123',
      // Legacy deprecated field
      type: 'one_time',
      recurring_interval: null,
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

const SUBSCRIPTION_PRODUCT_PREVIEW: schemas['ProductStorefront'] = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toISOString(),
  organization_id: '123',
  recurring_interval: 'month',
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
      price_currency: 'usd',
      is_archived: false,
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      product_id: '123',
      // Legacy deprecated field
      type: 'recurring',
      recurring_interval: 'month',
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

const ORGANIZATION: schemas['Organization'] = {
  id: '123',
  name: 'My Organization',
  slug: 'my-organization',
  created_at: new Date().toISOString(),
  modified_at: null,
  avatar_url: '/assets/acme.jpg',
  website: null,
  socials: [],
  details_submitted_at: null,
  email: null,
  feature_settings: null,
  subscription_settings: {
    allow_multiple_subscriptions: true,
    allow_customer_updates: true,
    proration_behavior: 'invoice',
  },
  notification_settings: {
    new_order: true,
    new_subscription: true,
  },
}

export const createCheckoutPreview = (
  product: schemas['CheckoutProduct'],
  organization: schemas['Organization'],
): CheckoutPublic => {
  const prices = product.prices.map((price, index) => ({
    ...price,
    id: `price_${index}`,
  }))
  const staticPrice = prices.find((price) =>
    ['fixed', 'custom', 'free'].includes(price.amount_type),
  )
  const price = staticPrice ?? prices[0]
  const productWithPrices = {
    ...product,
    prices,
  }

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
    status: 'open',
    expires_at: new Date().toISOString(),
    client_secret: 'CLIENT_SECRET',
    products: [productWithPrices],
    product: productWithPrices,
    product_id: productWithPrices.id,
    product_price: price,
    product_price_id: price.id,
    amount,
    tax_amount: null,
    discount_amount: 0,
    net_amount: 0,
    subtotal_amount: amount,
    total_amount: amount,
    is_discount_applicable: price.amount_type === 'fixed',
    is_free_product_price: price.amount_type === 'free',
    is_payment_required: amount > 0,
    is_payment_setup_required: price.type === 'recurring',
    is_payment_form_required: amount > 0 || price.type === 'recurring',
    currency: 'usd',
    is_business_customer: false,
    customer_id: null,
    customer_email: 'janedoe@gmail.com',
    customer_name: 'Jane Doe',
    customer_billing_name: null,
    customer_billing_address: null,
    customer_ip_address: null,
    customer_tax_id: null,
    payment_processor_metadata: {},
    url: '/checkout/CLIENT_SECRET',
    success_url: '/checkout/CLIENT_SECRET/confirmation',
    embed_origin: null,
    organization: organization,
    attached_custom_fields: [],
    discount: null,
    discount_id: null,
    allow_discount_codes: true,
    require_billing_address: false,
    customer_billing_address_fields: {
      country: true,
      state: false,
      city: false,
      postal_code: false,
      line1: false,
      line2: false,
    },
    billing_address_fields: {
      country: 'required',
      state: 'disabled',
      city: 'disabled',
      postal_code: 'disabled',
      line1: 'disabled',
      line2: 'disabled',
    },
  })

  return {
    ...checkout,
    // @ts-ignore
    paymentProcessor: 'dummy',
  }
}

export const CHECKOUT_PREVIEW = createCheckoutPreview(
  PRODUCT_PREVIEW,
  ORGANIZATION,
)

export const ORDER_PREVIEW: schemas['CustomerOrder'] = {
  id: '123',
  created_at: new Date().toISOString(),
  modified_at: new Date().toISOString(),
  billing_reason: 'subscription_create',
  billing_name: null,
  billing_address: null,
  is_invoice_generated: false,
  status: 'paid',
  paid: true,
  amount: 10000,
  subtotal_amount: 10000,
  discount_amount: 0,
  net_amount: 10000,
  tax_amount: 1200,
  total_amount: 11200,
  refunded_amount: 0,
  refunded_tax_amount: 0,
  currency: 'usd',
  user_id: '123',
  customer_id: '123',
  product_id: PRODUCT_PREVIEW.id,
  subscription_id: null,
  subscription: null,
  product: {
    ...PRODUCT_PREVIEW,
    organization: ORGANIZATION,
  },
  items: [
    {
      created_at: new Date().toISOString(),
      modified_at: null,
      id: '123',
      label: '',
      amount: 10000,
      tax_amount: 1200,
      proration: false,
      product_price_id: PRODUCT_PREVIEW.prices[0].id,
    },
  ],
  discount_id: null,
  checkout_id: CHECKOUT_PREVIEW.id,
}

export const SUBSCRIPTION_ORDER_PREVIEW: schemas['CustomerSubscription'] = {
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
  customer_id: '123',
  product_id: SUBSCRIPTION_PRODUCT_PREVIEW.id,
  prices: SUBSCRIPTION_PRODUCT_PREVIEW.prices,
  checkout_id: null,
  product: {
    ...SUBSCRIPTION_PRODUCT_PREVIEW,
    organization: ORGANIZATION,
  },
  discount_id: null,
  customer_cancellation_comment: null,
  customer_cancellation_reason: null,
  meters: [],
}
