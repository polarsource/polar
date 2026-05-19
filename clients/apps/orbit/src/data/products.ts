import { SubscriptionIcon } from '@/components/icons/SubscriptionIcon'
import { UsageIcon } from '@/components/icons/UsageIcon'
import type { ProductIcon } from '@/components/ProductCard'

export type ProductPlan = {
  id: string
  name: string
  type: 'Subscription' | 'Usage Billing'
  icon: ProductIcon
  /** Monthly price in cents. Zero for usage-based plans. */
  priceCents: number
  /** Pricing unit copy shown next to the price. */
  priceUnit: string
  metrics: {
    revenueCents: number
    mrrCents: number
    activeSubscribers: number
    churnRatePct: number
  }
  customers: ProductCustomer[]
}

export type ProductCustomer = {
  customerId: string
  name: string
  email: string
  avatarUrl: string | null
  status: 'active' | 'trialing' | 'canceled'
  amountCents: number
  startedAt: string
}

export const PRODUCTS: ProductPlan[] = [
  {
    id: '1',
    name: 'Bitspace Pro',
    type: 'Subscription',
    icon: SubscriptionIcon,
    priceCents: 49_00,
    priceUnit: 'per month',
    metrics: {
      revenueCents: 24_500_00,
      mrrCents: 4_900_00,
      activeSubscribers: 100,
      churnRatePct: 3,
    },
    customers: [
      {
        customerId: 'cus_01',
        name: 'Birk Jernström',
        email: 'birk@polar.sh',
        avatarUrl: 'https://avatars.githubusercontent.com/u/281715?v=4',
        status: 'active',
        amountCents: 49_00,
        startedAt: '2024-02-04',
      },
    ],
  },
  {
    id: '2',
    name: 'Bitspace Go',
    type: 'Usage Billing',
    icon: UsageIcon,
    priceCents: 0,
    priceUnit: 'metered',
    metrics: {
      revenueCents: 8_240_00,
      mrrCents: 1_820_00,
      activeSubscribers: 42,
      churnRatePct: 6,
    },
    customers: [
      {
        customerId: 'cus_03',
        name: 'Frans Allonen',
        email: 'frans@example.com',
        avatarUrl: null,
        status: 'trialing',
        amountCents: 0,
        startedAt: '2026-05-01',
      },
    ],
  },
  {
    id: '3',
    name: 'Bitspace Startup',
    type: 'Subscription',
    icon: SubscriptionIcon,
    priceCents: 120_00,
    priceUnit: 'per month',
    metrics: {
      revenueCents: 14_400_00,
      mrrCents: 1_440_00,
      activeSubscribers: 12,
      churnRatePct: 8,
    },
    customers: [
      {
        customerId: 'cus_04',
        name: 'Mads Holm',
        email: 'mads@studio.dk',
        avatarUrl: null,
        status: 'canceled',
        amountCents: 120_00,
        startedAt: '2025-01-18',
      },
    ],
  },
  {
    id: '4',
    name: 'Bitspace Enterprise',
    type: 'Subscription',
    icon: SubscriptionIcon,
    priceCents: 499_00,
    priceUnit: 'per month',
    metrics: {
      revenueCents: 89_820_00,
      mrrCents: 14_970_00,
      activeSubscribers: 30,
      churnRatePct: 1,
    },
    customers: [
      {
        customerId: 'cus_02',
        name: 'Emil Widlund',
        email: 'emil@polar.sh',
        avatarUrl: null,
        status: 'active',
        amountCents: 499_00,
        startedAt: '2024-04-12',
      },
    ],
  },
  {
    id: '5',
    name: 'Bitspace Custom',
    type: 'Subscription',
    icon: SubscriptionIcon,
    priceCents: 120_00,
    priceUnit: 'per month',
    metrics: {
      revenueCents: 3_600_00,
      mrrCents: 480_00,
      activeSubscribers: 4,
      churnRatePct: 4,
    },
    customers: [
      {
        customerId: 'cus_05',
        name: 'Sigrid Lien',
        email: 'sigrid@nor.studio',
        avatarUrl: null,
        status: 'active',
        amountCents: 120_00,
        startedAt: '2025-11-04',
      },
    ],
  },
]

export const findProduct = (id: string): ProductPlan | undefined =>
  PRODUCTS.find((p) => p.id === id)
