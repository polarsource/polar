import { ClientBase } from "../base";
import type {
  CustomerSessionCustomerExternalIDCreate,
  CustomerSessionCustomerIDCreate,
} from "../models/inputs";
import type { CustomerSession } from "../models/outputs";
import { HTTPValidationError } from "../errors";

export const createCustomerSessions = (client: ClientBase) => {
  /**
   * Create a customer session.
   *
   * For organizations with `member_model_enabled`, this will automatically
   * create a member session for the owner member of the customer.
   *
   * **Scopes**: `customer_sessions:write`
   *
   * @param body - Request body
   * @returns {CustomerSession}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: CustomerSessionCustomerIDCreate | CustomerSessionCustomerExternalIDCreate,
  ): Promise<CustomerSession> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-sessions/",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSession>(response, "json", {
      422: HTTPValidationError,
    });
  };
};

export function createCustomerSessionsService(client: ClientBase) {
  return {
    create: createCustomerSessions(client),
  };
}

export type CustomerSessions = ReturnType<typeof createCustomerSessionsService>;
