import { Effect } from 'effect'
import { HttpClientRequest, HttpClientResponse } from 'effect/http'
import type { ActiveOrganization } from '@/schemas/Auth'
import {
  BillingConfigError,
  Catalog,
  CatalogList,
  type Catalogs,
} from '@/schemas/BillingConfig'
import {
  type Clients,
  transportErrors,
  unexpected,
} from '@/services/billing-config/api'
import { apiUrl, withOrganization } from '@/services/api'

const requestErrors = {
  HttpClientError: transportErrors.HttpClientError,
  SchemaError: transportErrors.SchemaError,
}

const execute = (
  clients: Clients,
  organization: ActiveOrganization,
  request: HttpClientRequest.HttpClientRequest,
) =>
  clients[organization.environment].execute(
    request.pipe(withOrganization(organization.id)),
  )

export const catalogs =
  (clients: Clients) => (organization: ActiveOrganization) =>
    Effect.gen(function* () {
      const url = yield* apiUrl(organization.environment, '/catalogs/')
      const response = yield* execute(
        clients,
        organization,
        HttpClientRequest.get(url).pipe(
          HttpClientRequest.setUrlParams([
            ['organization_id', organization.id],
            ['status', 'draft'],
            ['status', 'live'],
          ]),
        ),
      )
      if (response.status !== 200) {
        return yield* unexpected(response, organization, ['products:read'])
      }
      const { items } =
        yield* HttpClientResponse.schemaBodyJson(CatalogList)(response)
      const find = (status: string) => {
        const catalog = items.find((item) => item.status === status)
        return catalog ? { id: catalog.id, name: catalog.name } : null
      }
      return { live: find('live'), draft: find('draft') } satisfies Catalogs
    }).pipe(Effect.scoped, Effect.catchTags(requestErrors))

export const publish =
  (clients: Clients) => (organization: ActiveOrganization, draft: Catalog) =>
    Effect.gen(function* () {
      const url = yield* apiUrl(
        organization.environment,
        `/catalogs/${draft.id}/publish`,
      )
      const response = yield* execute(
        clients,
        organization,
        HttpClientRequest.post(url),
      )
      if (response.status === 200) {
        return yield* HttpClientResponse.schemaBodyJson(Catalog)(response)
      }
      // The API answers 404 both for a discarded draft and for a caller without products:manage
      const gone =
        response.status === 409 ||
        (response.status === 404 &&
          (yield* catalogs(clients)(organization)).draft?.id !== draft.id)
      if (gone) {
        return yield* new BillingConfigError({
          message: 'The draft was published or discarded in the meantime',
          hint: 'Run polar config publish again.',
        })
      }
      if (response.status === 404) {
        return yield* new BillingConfigError({
          message: `You cannot publish the draft of ${organization.name}`,
          hint: 'Publishing needs permission to manage products in this organization.',
        })
      }
      return yield* unexpected(response, organization, ['products:write'])
    }).pipe(Effect.scoped, Effect.catchTags(requestErrors))
