import openapiSchema from '@polar-sh/sdk/openapi'

type SchemaPaths = (typeof openapiSchema)['paths']
type SchemaPathKey = keyof SchemaPaths
type SchemaPathMethods<T extends SchemaPathKey> = SchemaPaths[T]
type SchemaPathMethod<T extends SchemaPathKey> = keyof SchemaPathMethods<T>

type FindMatchingPath<
  A extends string,
  B extends SchemaPathKey = SchemaPathKey,
> = B extends `${infer X}${A}${infer Y}`
  ? A extends string
    ? SchemaPathMethods<B>[SchemaPathMethod<B>]
    : never
  : never

type APIMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
interface Section {
  name: string
  endpoints: {
    name: string
    path: string
    method: APIMethod
  }[]
}

const extractEntries = <T extends {}>(obj: T) => {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}

export const buildSections = (): Section[] => {
  const sections = extractEntries(openapiSchema.paths).reduce<Section[]>(
    (acc, [path, endpoints]) => {
      const [ancestor] = path.replace('/api/v1/', '').split('/').filter(Boolean)

      for (const [method, e] of extractEntries(endpoints)) {
        const endpoint = e as FindMatchingPath<typeof path>

        const matchingAncestor = acc.find(
          (section) => section.name === ancestor.replaceAll('_', ' '),
        )

        if (!matchingAncestor) {
          acc.push({
            name: ancestor.replaceAll('_', ' '),
            endpoints: [],
          })
        } else {
          matchingAncestor.endpoints.push({
            name: endpoint.summary,
            path: path,
            method: method as APIMethod,
          })
        }
      }

      return acc
    },
    [],
  )

  return sections
}

const benefits: Section<'/api/v1/benefits'> = {
  name: 'Benefits',
  endpoints: [
    {
      name: 'Create Benefit',
      path: '/api/v1/benefits/',
      method: 'post',
    },
    {
      name: 'Update Benefit',
      path: '/api/v1/benefits/{id}',
      method: 'post',
    },
    {
      name: 'Delete Benefit',
      path: '/api/v1/benefits/{id}',
      method: 'delete',
    },
    {
      name: 'Lookup Benefit',
      path: '/api/v1/benefits/lookup',
      method: 'get',
    },
    {
      name: 'Search Benefits',
      path: '/api/v1/benefits/search',
      method: 'get',
    },
  ],
}

const subsciptions: Section<'/api/v1/subscriptions'> = {
  name: 'Subscriptions',
  endpoints: [
    {
      name: 'Search Subscription Tiers',
      path: '/api/v1/subscriptions/tiers/search',
      method: 'get',
    },
    {
      name: 'Lookup Subscription Tier',
      path: '/api/v1/subscriptions/tiers/lookup',
      method: 'get',
    },
    {
      name: 'Create Subscription Tier',
      path: '/api/v1/subscriptions/tiers/',
      method: 'post',
    },
    {
      name: 'Update Subscription Tier',
      path: '/api/v1/subscriptions/tiers/{id}',
      method: 'post',
    },
    {
      name: 'Archive Subscription Tier',
      path: '/api/v1/subscriptions/tiers/{id}/archive',
      method: 'post',
    },
    {
      name: 'Update Subscription Tier Benefits',
      path: '/api/v1/subscriptions/tiers/{id}/benefits',
      method: 'post',
    },
    {
      name: 'Create Subscribe Session',
      path: '/api/v1/subscriptions/subscribe-sessions/',
      method: 'post',
    },
    {
      name: 'Get Subscribe Session',
      path: '/api/v1/subscriptions/subscribe-sessions/{id}',
      method: 'get',
    },
    {
      name: 'Get Subscriptions Statistics',
      path: '/api/v1/subscriptions/subscriptions/statistics',
      method: 'get',
    },
    {
      name: 'Search Subscriptions',
      path: '/api/v1/subscriptions/subscriptions/search',
      method: 'get',
    },
    {
      name: 'Search Subscribed Subscriptions',
      path: '/api/v1/subscriptions/subscriptions/subscribed',
      method: 'get',
    },
    {
      name: 'Create Free Subscription',
      path: '/api/v1/subscriptions/subscriptions/',
      method: 'post',
    },
    {
      name: 'Create Email Subscription',
      path: '/api/v1/subscriptions/subscriptions/email',
      method: 'post',
    },
    {
      name: 'Import Subscriptions',
      path: '/api/v1/subscriptions/subscriptions/import',
      method: 'post',
    },
    {
      name: 'Export Subscriptions',
      path: '/api/v1/subscriptions/subscriptions/export',
      method: 'get',
    },
    {
      name: 'Upgrade Subscription',
      path: '/api/v1/subscriptions/subscriptions/{id}',
      method: 'post',
    },
    {
      name: 'Cancel Subscription',
      path: '/api/v1/subscriptions/subscriptions/{id}',
      method: 'delete',
    },
    {
      name: 'Search Subscriptions Summary',
      path: '/api/v1/subscriptions/subscriptions/summary',
      method: 'get',
    },
  ],
}

const donations: Section<'/api/v1/donations'> = {
  name: 'Donations',
  endpoints: [
    {
      name: 'Create Payment Intent',
      path: '/api/v1/donations/payment_intent',
      method: 'post',
    },
    {
      name: 'Update Payment Intent',
      path: '/api/v1/donations/payment_intent/{id}',
      method: 'patch',
    },
    {
      name: 'Search Donations',
      path: '/api/v1/donations/search',
      method: 'get',
    },
    {
      name: 'Public Search Donations',
      path: '/api/v1/donations/public/search',
      method: 'get',
    },
    {
      name: 'Get Donation Statistics',
      path: '/api/v1/donations/statistics',
      method: 'get',
    },
  ],
}

const articles: Section<'/api/v1/articles'> = {
  name: 'Articles',
  endpoints: [
    {
      name: 'List Articles',
      path: '/api/v1/articles',
      method: 'get',
    },
    {
      name: 'Create Article',
      path: '/api/v1/articles',
      method: 'post',
    },
    {
      name: 'Get Article',
      path: '/api/v1/articles/{id}',
      method: 'get',
    },
    {
      name: 'Update Article',
      path: '/api/v1/articles/{id}',
      method: 'put',
    },
    {
      name: 'Delete Article',
      path: '/api/v1/articles/{id}',
      method: 'delete',
    },
    {
      name: 'Track Article',
      path: '/api/v1/articles/{id}/viewed',
      method: 'post',
    },
    {
      name: 'Send Article Preview',
      path: '/api/v1/articles/{id}/send_preview',
      method: 'post',
    },
    {
      name: 'Send Article',
      path: '/api/v1/articles/{id}/send',
      method: 'post',
    },
    {
      name: 'Search Articles',
      path: '/api/v1/articles/search',
      method: 'get',
    },
    {
      name: 'Lookup Article',
      path: '/api/v1/articles/lookup',
      method: 'get',
    },
    {
      name: 'Article Receivers',
      path: '/api/v1/articles/receivers',
      method: 'get',
    },
    {
      name: 'Unsubscribe from Emails',
      path: '/api/v1/articles/unsubscribe',
      method: 'get',
    },
  ],
}

const webhooks: Section<'/api/v1/webhooks'> = {
  name: 'Webhooks',
  endpoints: [
    {
      name: 'List Webhook Endpoints',
      path: '/api/v1/webhooks/endpoints',
      method: 'get',
    },
    {
      name: 'Create Webhook Endpoint',
      path: '/api/v1/webhooks/endpoints',
      method: 'post',
    },
    {
      name: 'Get Webhook Endpoint',
      path: '/api/v1/webhooks/endpoints/{id}',
      method: 'get',
    },
    {
      name: 'Delete Webhook Endpoint',
      path: '/api/v1/webhooks/endpoints/{id}',
      method: 'delete',
    },
    {
      name: 'Update Webhook Endpoint',
      path: '/api/v1/webhooks/endpoints/{id}',
      method: 'patch',
    },
    {
      name: 'Get Webhook Deliveries',
      path: '/api/v1/webhooks/deliveries',
      method: 'get',
    },
    {
      name: 'Redeliver Webhook',
      path: '/api/v1/webhooks/events/{id}/redeliver',
      method: 'post',
    },
  ],
}

export const sections = [benefits, subsciptions, donations, articles, webhooks]
