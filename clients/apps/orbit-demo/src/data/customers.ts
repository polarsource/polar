export type CustomerStatus = 'active' | 'trial' | 'churned'

export type CustomerSubscription = {
  id: string
  product: string
  status: 'active' | 'canceled' | 'trialing'
  amountCents: number
  cadence: 'monthly' | 'annual'
  startedAt: string
}

export type CustomerOrder = {
  id: string
  product: string
  amountCents: number
  createdAt: string
}

export type Customer = {
  id: string
  name: string
  email: string
  country: string
  createdAt: string
  totalSpendCents: number
  totalOrders: number
  status: CustomerStatus
  avatarUrl: string | null
  subscriptions: CustomerSubscription[]
  orders: CustomerOrder[]
}

export const CUSTOMERS: Customer[] = [
  {
    id: 'cus_01',
    name: 'Birk Jernström',
    email: 'birk@polar.sh',
    country: 'SE',
    createdAt: '2024-02-04',
    totalSpendCents: 492_00,
    totalOrders: 12,
    status: 'active',
    avatarUrl:
      'https://avatars.githubusercontent.com/u/281715?v=4',
    subscriptions: [
      {
        id: 'sub_01',
        product: 'Bitspace Pro',
        status: 'active',
        amountCents: 49_00,
        cadence: 'monthly',
        startedAt: '2024-02-04',
      },
    ],
    orders: [
      {
        id: 'ord_01',
        product: 'Bitspace Pro',
        amountCents: 49_00,
        createdAt: '2026-05-04',
      },
      {
        id: 'ord_02',
        product: 'Bitspace Pro',
        amountCents: 49_00,
        createdAt: '2026-04-04',
      },
    ],
  },
  {
    id: 'cus_02',
    name: 'Emil Widlund',
    email: 'emil@polar.sh',
    country: 'SE',
    createdAt: '2024-04-12',
    totalSpendCents: 1488_00,
    totalOrders: 24,
    status: 'active',
    avatarUrl: null,
    subscriptions: [
      {
        id: 'sub_02',
        product: 'Bitspace Enterprise',
        status: 'active',
        amountCents: 499_00,
        cadence: 'monthly',
        startedAt: '2024-04-12',
      },
    ],
    orders: [],
  },
  {
    id: 'cus_03',
    name: 'Frans Allonen',
    email: 'frans@example.com',
    country: 'FI',
    createdAt: '2025-09-30',
    totalSpendCents: 99_00,
    totalOrders: 1,
    status: 'trial',
    avatarUrl: null,
    subscriptions: [
      {
        id: 'sub_03',
        product: 'Bitspace Go',
        status: 'trialing',
        amountCents: 0,
        cadence: 'monthly',
        startedAt: '2026-05-01',
      },
    ],
    orders: [],
  },
  {
    id: 'cus_04',
    name: 'Mads Holm',
    email: 'mads@studio.dk',
    country: 'DK',
    createdAt: '2025-01-18',
    totalSpendCents: 720_00,
    totalOrders: 6,
    status: 'churned',
    avatarUrl: null,
    subscriptions: [
      {
        id: 'sub_04',
        product: 'Bitspace Startup',
        status: 'canceled',
        amountCents: 120_00,
        cadence: 'monthly',
        startedAt: '2025-01-18',
      },
    ],
    orders: [],
  },
  {
    id: 'cus_05',
    name: 'Sigrid Lien',
    email: 'sigrid@nor.studio',
    country: 'NO',
    createdAt: '2025-11-04',
    totalSpendCents: 240_00,
    totalOrders: 2,
    status: 'active',
    avatarUrl: null,
    subscriptions: [],
    orders: [
      {
        id: 'ord_03',
        product: 'Bitspace Custom',
        amountCents: 120_00,
        createdAt: '2026-04-22',
      },
      {
        id: 'ord_04',
        product: 'Bitspace Custom',
        amountCents: 120_00,
        createdAt: '2026-03-22',
      },
    ],
  },
]

export const findCustomer = (id: string): Customer | undefined =>
  CUSTOMERS.find((c) => c.id === id)

export const formatCurrency = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
