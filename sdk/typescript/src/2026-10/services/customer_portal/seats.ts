import type { ClientBase, RequestOptions } from "../../../base";
import type {
  CustomerSeat,
  CustomerSeatAssign,
  CustomerSubscription,
  ListResourceCustomerSubscription,
  SeatsList,
} from "../../models";

import {
  CustomerPortalSeatsAssignSeat400Error,
  CustomerPortalSeatsAssignSeat401Error,
  CustomerPortalSeatsAssignSeat403Error,
  CustomerPortalSeatsAssignSeat404Error,
  CustomerPortalSeatsListClaimedSubscriptions401Error,
  CustomerPortalSeatsListSeats401Error,
  CustomerPortalSeatsListSeats403Error,
  CustomerPortalSeatsListSeats404Error,
  CustomerPortalSeatsResendInvitation400Error,
  CustomerPortalSeatsResendInvitation401Error,
  CustomerPortalSeatsResendInvitation403Error,
  CustomerPortalSeatsResendInvitation404Error,
  CustomerPortalSeatsRevokeSeat401Error,
  CustomerPortalSeatsRevokeSeat403Error,
  CustomerPortalSeatsRevokeSeat404Error,
  HTTPValidationError,
} from "../../errors";

export const listSeatsSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {SeatsList}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerPortalSeatsListSeats401Error} Authentication required
   * @throws {CustomerPortalSeatsListSeats403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerPortalSeatsListSeats404Error} Subscription or order not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      subscription_id?: string | null;
      order_id?: string | null;
    },
    requestOptions?: RequestOptions,
  ): Promise<SeatsList> => {
    const pathParams = {};
    const queryParams = {
      subscription_id: query?.subscription_id,
      order_id: query?.order_id,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/seats",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<SeatsList>(response, "json", {
      401: CustomerPortalSeatsListSeats401Error,
      403: CustomerPortalSeatsListSeats403Error,
      404: CustomerPortalSeatsListSeats404Error,
      422: HTTPValidationError,
    });
  };
};
export const assignSeatSeats = (client: ClientBase) => {
  /**
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerPortalSeatsAssignSeat400Error} No available seats or customer already has a seat
   * @throws {CustomerPortalSeatsAssignSeat401Error} Authentication required
   * @throws {CustomerPortalSeatsAssignSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerPortalSeatsAssignSeat404Error} Subscription, order, or customer not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: CustomerSeatAssign,
    requestOptions?: RequestOptions,
  ): Promise<CustomerSeat> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/seats",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerSeat>(response, "json", {
      400: CustomerPortalSeatsAssignSeat400Error,
      401: CustomerPortalSeatsAssignSeat401Error,
      403: CustomerPortalSeatsAssignSeat403Error,
      404: CustomerPortalSeatsAssignSeat404Error,
      422: HTTPValidationError,
    });
  };
};
export const revokeSeatSeats = (client: ClientBase) => {
  /**
   *
   * @param seat_id
   * @param requestOptions - Request options
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerPortalSeatsRevokeSeat401Error} Authentication required
   * @throws {CustomerPortalSeatsRevokeSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerPortalSeatsRevokeSeat404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (seat_id: string, requestOptions?: RequestOptions): Promise<CustomerSeat> => {
    const pathParams = {
      seat_id: seat_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/customer-portal/seats/{seat_id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerSeat>(response, "json", {
      401: CustomerPortalSeatsRevokeSeat401Error,
      403: CustomerPortalSeatsRevokeSeat403Error,
      404: CustomerPortalSeatsRevokeSeat404Error,
      422: HTTPValidationError,
    });
  };
};
export const resendInvitationSeats = (client: ClientBase) => {
  /**
   *
   * @param seat_id
   * @param requestOptions - Request options
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerPortalSeatsResendInvitation400Error} Seat is not pending or already claimed
   * @throws {CustomerPortalSeatsResendInvitation401Error} Authentication required
   * @throws {CustomerPortalSeatsResendInvitation403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerPortalSeatsResendInvitation404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (seat_id: string, requestOptions?: RequestOptions): Promise<CustomerSeat> => {
    const pathParams = {
      seat_id: seat_id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/seats/{seat_id}/resend",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerSeat>(response, "json", {
      400: CustomerPortalSeatsResendInvitation400Error,
      401: CustomerPortalSeatsResendInvitation401Error,
      403: CustomerPortalSeatsResendInvitation403Error,
      404: CustomerPortalSeatsResendInvitation404Error,
      422: HTTPValidationError,
    });
  };
};
export const listClaimedSubscriptionsSeats = (client: ClientBase) => {
  /**
   * List all subscriptions where the authenticated customer has claimed a seat.
   *
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {ListResourceCustomerSubscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerPortalSeatsListClaimedSubscriptions401Error} Authentication required
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    query?: {
      page?: number;
      limit?: number;
    },
    requestOptions?: RequestOptions,
  ): Promise<ListResourceCustomerSubscription> => {
    const pathParams = {};
    const queryParams = {
      page: query?.page ?? 1,
      limit: query?.limit ?? 10,
    };
    const request = client.buildRequest(
      "GET",
      "/v1/customer-portal/seats/subscriptions",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<ListResourceCustomerSubscription>(response, "json", {
      401: CustomerPortalSeatsListClaimedSubscriptions401Error,
      422: HTTPValidationError,
    });
  };
};
/**
 * List all subscriptions where the authenticated customer has claimed a seat.
 *
 * **Scopes**: `customer_portal:read` `customer_portal:write`
 *
 * @param query - Query parameters
 * @param requestOptions - Request options
 * @returns {AsyncGenerator<CustomerSubscription>} A generator that yields items of type CustomerSubscription.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {CustomerPortalSeatsListClaimedSubscriptions401Error} Authentication required
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListClaimedSubscriptionsSeats = (client: ClientBase) => {
  return async function* (
    query?: {
      page?: number;
      limit?: number;
    },
    requestOptions?: RequestOptions,
  ): AsyncGenerator<CustomerSubscription> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listClaimedSubscriptionsSeats(client)(
        { ...query, page, limit },
        requestOptions,
      );
      for (const item of response.items) {
        yield item;
      }
      if (page >= response.pagination.max_page) {
        break;
      }
      page++;
    }
  };
};

export function createSeatsService(client: ClientBase) {
  return {
    listSeats: listSeatsSeats(client),
    assignSeat: assignSeatSeats(client),
    revokeSeat: revokeSeatSeats(client),
    resendInvitation: resendInvitationSeats(client),
    listClaimedSubscriptions: listClaimedSubscriptionsSeats(client),
    iterListClaimedSubscriptions: iterListClaimedSubscriptionsSeats(client),
  };
}

export type Seats = ReturnType<typeof createSeatsService>;
