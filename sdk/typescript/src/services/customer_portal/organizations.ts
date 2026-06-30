import { ClientBase } from "../../base";
import type { CustomerOrganizationData } from "../../models/outputs";
import { HTTPValidationError, ResourceNotFound } from "../../errors";

export const getOrganizations = (client: ClientBase) => {
  /**
   * Get a customer portal's organization by slug.
   *
   * @param slug - The organization slug.
   * @returns {CustomerOrganizationData}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResourceNotFound} Organization not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (slug: string): Promise<CustomerOrganizationData> => {
    const pathParams = {
      slug: slug,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/organizations/{slug}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerOrganizationData>(response, "json", {
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createOrganizationsService(client: ClientBase) {
  return {
    get: getOrganizations(client),
  };
}

export type Organizations = ReturnType<typeof createOrganizationsService>;
