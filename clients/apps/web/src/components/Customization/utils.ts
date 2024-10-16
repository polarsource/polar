import {
  CheckoutPublic,
  CheckoutStatus,
  Product,
  ProductPrice,
  UserOrder,
  UserSubscription,
} from '@polar-sh/sdk'

const PRODUCT_DESCRIPTION = `# Et Tritonia pectora partus praebentem
## Clipeo mentiris arquato obliqua lacerta
Lorem markdownum bifidosque tenus quod gutture parte genialiter Manto, et potuit: medio mea rogando Hector: bene? Bracchia pectus Acrisioneas adsumus? O Aeaeae flammae, est ait fleverunt illi iamdudum; captatur e. Caede et lues praecipites corrige gessit montis, aspera miserum si facit. Cum milia docta amens nec solito manifesta fitque incognita haec enim, sed resupinus enim.

### Nox flebilis torva
Repetito cum furtum altera
Mare prius gelidumque perde
Gravem colentes impetus reminiscitur invitusque blanditur ipse
Iam maiora
In quoque extulerat tale semper quidque. Fovebat heros quos gaudent et movent agmina fortis.`

export const PRODUCT_PREVIEW: Product = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toDateString(),
  organization_id: '123',
  medias: [
    {
      id: '123',
      created_at: new Date().toDateString(),
      public_url: '/assets/brand/polar_og.jpg',
      is_uploaded: false,
      service: 'product_media',
      mime_type: 'image/png',
      organization_id: '123',
      name: 'blend.png',
      path: '/assets/brand/polar_login.png',
      size: 123,
      size_readable: '123 B',
      storage_version: '1',
      checksum_etag: '123',
      checksum_sha256_base64: '123',
      checksum_sha256_hex: '123',
      version: '1',
      last_modified_at: new Date().toDateString(),
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
      created_at: new Date().toDateString(),
      modified_at: new Date().toDateString(),
      product_id: '123',
    },
  ],
  name: 'My Saas Pro Tier',
  description: PRODUCT_DESCRIPTION,
  benefits: [
    {
      id: '123',
      description: 'Weekly Newsletter',
      type: 'articles',
      created_at: new Date().toDateString(),
      modified_at: null,
      selectable: false,
      deletable: false,
      organization_id: '123',
    },
  ],
  created_at: new Date().toDateString(),
}

export const SUBSCRIPTION_PRODUCT_PREVIEW: Product = {
  id: '123',
  is_recurring: false,
  is_archived: false,
  modified_at: new Date().toDateString(),
  organization_id: '123',
  medias: [
    {
      id: '123',
      created_at: new Date().toDateString(),
      public_url: '/assets/brand/polar_og.jpg',
      is_uploaded: false,
      service: 'product_media',
      mime_type: 'image/png',
      organization_id: '123',
      name: 'blend.png',
      path: '/assets/brand/polar_login.png',
      size: 123,
      size_readable: '123 B',
      storage_version: '1',
      checksum_etag: '123',
      checksum_sha256_base64: '123',
      checksum_sha256_hex: '123',
      version: '1',
      last_modified_at: new Date().toDateString(),
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
      created_at: new Date().toDateString(),
      modified_at: new Date().toDateString(),
      product_id: '123',
    },
  ],
  name: 'My Saas Pro Tier',
  description: PRODUCT_DESCRIPTION,
  benefits: [
    {
      id: '123',
      description: 'Weekly Newsletter',
      type: 'articles',
      created_at: new Date().toDateString(),
      modified_at: null,
      selectable: false,
      deletable: false,
      organization_id: '123',
    },
  ],
  created_at: new Date().toDateString(),
}

export const createCheckoutPreview = (
  product: Product,
  price: ProductPrice,
): CheckoutPublic => {
  const amount =
    price.amount_type === 'custom'
      ? (price.minimum_amount ?? 0)
      : price.amount_type === 'fixed'
        ? price.price_amount
        : 0

  return {
    id: '123',
    created_at: new Date().toDateString(),
    modified_at: new Date().toDateString(),
    payment_processor: 'dummy' as 'stripe',
    status: CheckoutStatus.OPEN,
    expires_at: new Date().toDateString(),
    client_secret: 'CLIENT_SECRET',
    product: product,
    product_id: product.id,
    product_price: price,
    product_price_id: price.id,
    amount,
    tax_amount: null,
    total_amount: amount,
    is_payment_required: price.amount_type !== 'free',
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
  }
}

export const CHECKOUT_PREVIEW: CheckoutPublic = {
  id: '123',
  created_at: new Date().toDateString(),
  modified_at: new Date().toDateString(),
  payment_processor: 'dummy' as 'stripe',
  status: CheckoutStatus.OPEN,
  expires_at: new Date().toDateString(),
  client_secret: 'CLIENT_SECRET',
  product: PRODUCT_PREVIEW,
  product_id: PRODUCT_PREVIEW.id,
  product_price: PRODUCT_PREVIEW.prices[0],
  product_price_id: PRODUCT_PREVIEW.prices[0].id,
  amount: 10000,
  tax_amount: 2000,
  total_amount: 12000,
  is_payment_required: true,
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
}

export const ORDER_PREVIEW: UserOrder = {
  id: '123',
  amount: 10000,
  currency: 'usd',
  tax_amount: 1200,
  user_id: '123',
  product_id: PRODUCT_PREVIEW.id,
  product_price_id: PRODUCT_PREVIEW.prices[0].id,
  product_price: PRODUCT_PREVIEW.prices[0],
  subscription_id: null,
  subscription: null,
  product: PRODUCT_PREVIEW,
  created_at: new Date().toDateString(),
  modified_at: new Date().toDateString(),
}

export const SUBSCRIPTION_ORDER_PREVIEW: UserSubscription = {
  created_at: new Date().toDateString(),
  modified_at: new Date().toDateString(),
  id: '123',
  amount: 10000,
  currency: 'usd',
  recurring_interval: 'month',
  status: 'active',
  current_period_start: new Date().toDateString(),
  current_period_end: new Date(
    new Date().setMonth(new Date().getMonth() + 1),
  ).toDateString(),
  cancel_at_period_end: false,
  started_at: new Date().toDateString(),
  ended_at: null,
  user_id: '123',
  product_id: SUBSCRIPTION_PRODUCT_PREVIEW.id,
  price_id: SUBSCRIPTION_PRODUCT_PREVIEW.prices[0].id,
  checkout_id: null,
  product: SUBSCRIPTION_PRODUCT_PREVIEW,
  price: {
    id: '123',
    amount_type: 'fixed',
    price_amount: 10000,
    type: 'recurring',
    recurring_interval: 'month',
    price_currency: 'usd',
    is_archived: false,
    created_at: new Date().toDateString(),
    modified_at: new Date().toDateString(),
    product_id: '123',
  },
}
