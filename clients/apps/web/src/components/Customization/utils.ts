import { schemas } from '@polar-sh/client'
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

const PRODUCT_PREVIEW: schemas['ProductStorefront'] = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toISOString(),
  organization_id: '123',
  recurring_interval: null,
  recurring_interval_count: null,
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
      source: 'catalog',
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
  trial_interval: null,
  trial_interval_count: null,
}

const ORGANIZATION: schemas['CustomerOrganization'] = {
  id: '123',
  name: 'My Organization',
  slug: 'my-organization',
  created_at: new Date().toISOString(),
  modified_at: null,
  avatar_url: '/assets/acme.jpg',
  proration_behavior: 'prorate',
  allow_customer_updates: true,
  // @ts-expect-error - deprecated hidden fields
  website: null,
  socials: [],
  status: 'active',
  details_submitted_at: null,
  email: null,
  feature_settings: null,
  subscription_settings: {
    allow_multiple_subscriptions: true,
    allow_customer_updates: true,
    proration_behavior: 'invoice',
    benefit_revocation_grace_period: 0,
  },
  notification_settings: {
    new_order: true,
    new_subscription: true,
  },
  customer_email_settings: {
    order_confirmation: true,
    subscription_cancellation: true,
    subscription_confirmation: true,
    subscription_cycled: true,
    subscription_past_due: true,
    subscription_revoked: true,
    subscription_uncanceled: true,
    subscription_updated: true,
  },
}

export const createCheckoutPreview = (
  product: schemas['CheckoutProduct'],
  organization: schemas['CustomerOrganization'],
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
    prices: {
      [productWithPrices.id]: prices,
    },
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
    active_trial_interval: null,
    active_trial_interval_count: null,
    trial_end: null,
    return_url: null,
    organization_id: organization.id,
    allow_trial: true,
  })

  return {
    ...checkout,
    // @ts-expect-error - dummy
    paymentProcessor: 'dummy',
  }
}

export const CHECKOUT_PREVIEW = createCheckoutPreview(
  PRODUCT_PREVIEW,
  ORGANIZATION,
)
