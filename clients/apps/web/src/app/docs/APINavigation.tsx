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
    ? {
        name: string
        path: `${X}${A}${Y}`
        method: SchemaPathMethod<B>
      }
    : never
  : never

interface Section<T extends string> {
  name: string
  endpoints: FindMatchingPath<T>[]
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
  ],
}

type a = FindMatchingPath<'/api/v1/webhooks'>

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

export const sections = [benefits, donations, articles, webhooks]
