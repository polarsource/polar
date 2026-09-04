import type { models, Polar } from '@polar-sh/sdk/2026-04'
import type { AuthContext, BetterAuthPlugin } from 'better-auth'
import {
  type OrganizationOptions,
  getOrgAdapter,
} from 'better-auth/plugins/organization'
import type {
  BetterAuthOrganizationMemberMirror,
  PolarOrganizationOptions,
  SelectSeatProductsForMember,
  SelectSeatProductsForMemberInput,
} from './types'

type BetterAuthOrganizationPlugin = BetterAuthPlugin & {
  id: 'organization'
  options: OrganizationOptions
}

export const MANAGED_SUBSCRIPTION_STATUSES: ReadonlySet<
  models.Subscription['status']
> = new Set(['active', 'trialing', 'past_due'])
const ACTIVE_SEAT_STATUSES = new Set(['pending', 'claimed'])
const PRODUCT_LOOKUP_CONCURRENCY = 5
const MEMBER_SELECTOR_CONCURRENCY = 5

const mapWithConcurrency = async <Input, Output>(
  items: readonly Input[],
  concurrency: number,
  map: (item: Input) => Promise<Output>,
): Promise<Output[]> => {
  const results = new Array<Output>(items.length)
  let nextIndex = 0
  let failed = false

  const worker = async () => {
    while (!failed) {
      const index = nextIndex++
      if (index >= items.length) return
      try {
        results[index] = await map(items[index] as Input)
      } catch (error) {
        // A selector or SDK failure stops new work and propagates unchanged.
        failed = true
        throw error
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  )
  return results
}

export const getBetterAuthOrganizationOptions = (
  authContext: AuthContext,
): OrganizationOptions => {
  const plugin =
    authContext.getPlugin<BetterAuthOrganizationPlugin>('organization')
  if (!plugin) {
    throw new Error(
      "Polar organization support requires Better Auth's organization plugin",
    )
  }
  return plugin.options
}

export const getOrganizationRoster = async (
  authContext: AuthContext,
  organizationOptions: OrganizationOptions,
  organizationId: string,
  excludedUserId?: string,
): Promise<BetterAuthOrganizationMemberMirror[]> => {
  const organizationAdapter = getOrgAdapter(authContext, organizationOptions)
  let result = await organizationAdapter.listMembers({ organizationId })
  if (result.members.length < result.total) {
    result = await organizationAdapter.listMembers({
      organizationId,
      limit: result.total,
    })
  }
  if (result.members.length < result.total) {
    throw new Error(
      `Better Auth returned only ${result.members.length} of ${result.total} members for organization "${organizationId}"`,
    )
  }

  const members = result.members.filter(
    (member) => member.userId !== excludedUserId,
  )
  if (members.length === 0) return []

  const users = await authContext.adapter.findMany<
    BetterAuthOrganizationMemberMirror['user']
  >({
    model: 'user',
    where: [
      {
        field: 'id',
        operator: 'in',
        value: members.map((member) => member.userId),
      },
    ],
    limit: members.length,
  })
  const usersById = new Map(users.map((user) => [user.id, user]))
  return members.map((member) => {
    const user = usersById.get(member.userId)
    if (!user) {
      throw new Error(
        `Better Auth user "${member.userId}" for organization "${organizationId}" was not found`,
      )
    }
    return {
      ...member,
      user: {
        ...member.user,
        ...user,
      },
    }
  })
}

export const getOrganization = async (
  authContext: AuthContext,
  organizationId: string,
) => {
  const organization = await authContext.adapter.findOne<
    SelectSeatProductsForMemberInput['organization']
  >({
    model: 'organization',
    where: [{ field: 'id', value: organizationId }],
  })
  if (!organization) {
    throw new Error(
      `Better Auth organization "${organizationId}" was not found`,
    )
  }
  return organization
}

const getMinimumSeats = (
  prices: models.Product['prices'],
  productId: string,
): number => {
  const minimums = prices.flatMap((price) =>
    price.amount_type === 'seat_based' ? [price.seat_tiers.minimum_seats] : [],
  )
  if (minimums.length === 0) {
    throw new Error(
      `Polar seat product "${productId}" has no seat-based price with a minimum quantity`,
    )
  }
  return Math.max(...minimums)
}

interface ManagedSeatProduct {
  product: models.Product
  minimumSeats: number
}

const toManagedSeatProduct = (
  product: models.Product,
  prices: models.Product['prices'] = product.prices,
): ManagedSeatProduct => ({
  product,
  minimumSeats: getMinimumSeats(prices, product.id),
})

const isRecurringSeatProduct = (product: models.Product): boolean =>
  product.is_recurring &&
  product.prices.some((price) => price.amount_type === 'seat_based')

export const getCheckoutSeatProducts = async (
  client: Polar,
  productIds: readonly string[],
): Promise<ManagedSeatProduct[]> => {
  const products = await mapWithConcurrency(
    productIds,
    PRODUCT_LOOKUP_CONCURRENCY,
    (id) => client.products.get(id),
  )
  return products
    .filter(isRecurringSeatProduct)
    .map((product) => toManagedSeatProduct(product))
}

const listSeatSubscriptions = async (
  client: Polar,
  organizationId: string,
): Promise<models.Subscription[]> => {
  const subscriptions: models.Subscription[] = []
  for (let page = 1; ; page++) {
    const response = await client.subscriptions.list({
      external_customer_id: organizationId,
      status: [...MANAGED_SUBSCRIPTION_STATUSES],
      limit: 100,
      page,
    })
    subscriptions.push(...response.items)
    if (page >= response.pagination.max_page) break
  }
  return subscriptions.filter(
    (subscription) =>
      subscription.seats != null &&
      MANAGED_SUBSCRIPTION_STATUSES.has(subscription.status),
  )
}

const selectMemberProductIds = async (
  input: SelectSeatProductsForMemberInput,
  selector?: SelectSeatProductsForMember,
): Promise<readonly string[]> => {
  const resolved = selector
    ? await selector(input)
    : input.products.map((product) => product.id)
  const candidates = new Set(input.products.map((product) => product.id))
  const unique = new Set<string>()
  for (const productId of resolved) {
    if (!candidates.has(productId)) {
      throw new Error(
        `Seat product selector returned unknown candidate product ID "${productId}" for organization "${input.organization.id}" and member "${input.member.userId}"`,
      )
    }
    unique.add(productId)
  }
  return [...unique]
}

interface ProductSeatAllocation {
  memberIds: ReadonlySet<string>
  minimumSeats: number
}

export const resolveRosterProductAllocations = async (input: {
  organization: SelectSeatProductsForMemberInput['organization']
  roster: readonly BetterAuthOrganizationMemberMirror[]
  products: readonly ManagedSeatProduct[]
  selector?: SelectSeatProductsForMember
}): Promise<Map<string, ProductSeatAllocation>> => {
  const candidateProducts = input.products.map(({ product }) => product)
  const selectedByProduct = new Map(
    candidateProducts.map((product) => [product.id, new Set<string>()]),
  )

  await mapWithConcurrency(
    input.roster,
    MEMBER_SELECTOR_CONCURRENCY,
    async (member) => {
      const selected = await selectMemberProductIds(
        {
          organization: input.organization,
          member,
          user: member.user,
          products: candidateProducts,
        },
        input.selector,
      )
      for (const productId of selected) {
        selectedByProduct.get(productId)?.add(member.userId)
      }
    },
  )

  return new Map(
    input.products.map(({ product, minimumSeats }) => {
      const memberIds = selectedByProduct.get(product.id) ?? new Set<string>()
      return [product.id, { memberIds, minimumSeats }]
    }),
  )
}

const findActiveSeatForMember = (
  seats: readonly models.CustomerSeat[],
  externalMemberId: string,
): models.CustomerSeat | undefined =>
  seats.find(
    (seat) =>
      ACTIVE_SEAT_STATUSES.has(seat.status) &&
      seat.member?.external_id === externalMemberId,
  )

const assignSubscriptionSeat = async (
  client: Polar,
  subscriptionId: string,
  externalMemberId: string,
  seats: readonly models.CustomerSeat[],
): Promise<void> => {
  if (findActiveSeatForMember(seats, externalMemberId)) return
  await client.customerSeats.assignSeat({
    subscription_id: subscriptionId,
    external_member_id: externalMemberId,
    immediate_claim: true,
  })
}

const updateSubscriptionSeatCount = async (
  client: Polar,
  subscriptionId: string,
  seats: number,
): Promise<void> => {
  await client.subscriptions.update(subscriptionId, { seats })
}

const synchronizeOrganizationSubscriptionSeats = async (
  client: Polar,
  subscription: models.Subscription,
  allocation: ProductSeatAllocation,
): Promise<void> => {
  const currentQuantity = subscription.seats ?? 0
  const targetQuantity = Math.max(
    allocation.memberIds.size,
    allocation.minimumSeats,
  )
  if (targetQuantity > currentQuantity) {
    await updateSubscriptionSeatCount(client, subscription.id, targetQuantity)
  }

  const { seats } = await client.customerSeats.listSeats({
    subscription_id: subscription.id,
  })
  for (const seat of seats) {
    const externalMemberId = seat.member?.external_id
    if (
      ACTIVE_SEAT_STATUSES.has(seat.status) &&
      (!externalMemberId || !allocation.memberIds.has(externalMemberId))
    ) {
      await client.customerSeats.revokeSeat(seat.id)
    }
  }
  for (const memberId of allocation.memberIds) {
    await assignSubscriptionSeat(client, subscription.id, memberId, seats)
  }

  if (targetQuantity < currentQuantity) {
    await updateSubscriptionSeatCount(client, subscription.id, targetQuantity)
  }
}

export const synchronizeOrganizationSeats = async (input: {
  authContext: AuthContext
  client: Polar
  organizationId: string
  organizationOptions: PolarOrganizationOptions
  betterAuthOrganizationOptions?: OrganizationOptions
  excludedUserId?: string
  subscriptions?: readonly models.Subscription[]
}): Promise<void> => {
  if (!input.organizationOptions.syncSeats) return

  const subscriptions =
    input.subscriptions ??
    (await listSeatSubscriptions(input.client, input.organizationId))
  const managedSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.seats != null &&
      MANAGED_SUBSCRIPTION_STATUSES.has(subscription.status),
  )
  if (managedSubscriptions.length === 0) return

  const betterAuthOrganizationOptions =
    input.betterAuthOrganizationOptions ??
    getBetterAuthOrganizationOptions(input.authContext)
  const [organization, roster] = await Promise.all([
    getOrganization(input.authContext, input.organizationId),
    getOrganizationRoster(
      input.authContext,
      betterAuthOrganizationOptions,
      input.organizationId,
      input.excludedUserId,
    ),
  ])
  const products = managedSubscriptions.map((subscription) =>
    toManagedSeatProduct(subscription.product, subscription.prices),
  )
  const allocations = await resolveRosterProductAllocations({
    organization,
    roster,
    products,
    selector: input.organizationOptions.selectSeatProductsForMember,
  })

  for (const subscription of managedSubscriptions) {
    const allocation = allocations.get(subscription.product_id)
    if (allocation) {
      await synchronizeOrganizationSubscriptionSeats(
        input.client,
        subscription,
        allocation,
      )
    }
  }
}
