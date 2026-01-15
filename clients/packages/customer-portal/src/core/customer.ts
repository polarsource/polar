import type { PortalClient } from './client'
import type {
  CustomerPortalCustomer,
  CustomerPortalCustomerUpdate,
} from './types'

export function createCustomerMethods(portalClient: PortalClient) {
  return {
    getCustomer: async (): Promise<CustomerPortalCustomer> => {
      return portalClient.request((client) =>
        client.GET('/v1/customer-portal/customers/me'),
      )
    },

    updateCustomer: async (
      data: CustomerPortalCustomerUpdate,
    ): Promise<CustomerPortalCustomer> => {
      return portalClient.request((client) =>
        client.PATCH('/v1/customer-portal/customers/me', {
          body: data,
        }),
      )
    },
  }
}
