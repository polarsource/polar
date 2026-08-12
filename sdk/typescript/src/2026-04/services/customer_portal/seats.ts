import type { ClientBase } from "../../../base";
import type {
  CustomerSeat,
  CustomerSeatAssign,
  CustomerSubscription,
  ListResourceCustomerSubscription,
  SeatsList,
} from "../../models";

import {
  HTTPValidationError,
  SeatsAssignSeat400Error,
  SeatsAssignSeat401Error,
  SeatsAssignSeat403Error,
  SeatsAssignSeat404Error,
  SeatsListClaimedSubscriptions401Error,
  SeatsListSeats401Error,
  SeatsListSeats403Error,
  SeatsListSeats404Error,
  SeatsResendInvitation400Error,
  SeatsResendInvitation401Error,
  SeatsResendInvitation403Error,
  SeatsResendInvitation404Error,
  SeatsRevokeSeat401Error,
  SeatsRevokeSeat403Error,
  SeatsRevokeSeat404Error,
} from "../../errors";

export const listSeatsSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {SeatsList}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {SeatsListSeats401Error} Authentication required
   * @throws {SeatsListSeats403Error} Not permitted or seat-based pricing not enabled
   * @throws {SeatsListSeats404Error} Subscription or order not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    subscription_id?: string | null;
    order_id?: string | null;
  }): Promise<SeatsList> => {
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
    const response = await client.sendRequest(request);
    return client.parseResponse<SeatsList>(response, "json", {
      401: SeatsListSeats401Error,
      403: SeatsListSeats403Error,
      404: SeatsListSeats404Error,
      422: HTTPValidationError,
    });
  };
};
export const assignSeatSeats = (client: ClientBase) => {
  /**
   *
   * @param body - Request body
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {SeatsAssignSeat400Error} No available seats or customer already has a seat
   * @throws {SeatsAssignSeat401Error} Authentication required
   * @throws {SeatsAssignSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {SeatsAssignSeat404Error} Subscription, order, or customer not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: CustomerSeatAssign): Promise<CustomerSeat> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-portal/seats",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSeat>(response, "json", {
      400: SeatsAssignSeat400Error,
      401: SeatsAssignSeat401Error,
      403: SeatsAssignSeat403Error,
      404: SeatsAssignSeat404Error,
      422: HTTPValidationError,
    });
  };
};
export const revokeSeatSeats = (client: ClientBase) => {
  /**
   *
   * @param seat_id
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {SeatsRevokeSeat401Error} Authentication required
   * @throws {SeatsRevokeSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {SeatsRevokeSeat404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (seat_id: string): Promise<CustomerSeat> => {
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
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSeat>(response, "json", {
      401: SeatsRevokeSeat401Error,
      403: SeatsRevokeSeat403Error,
      404: SeatsRevokeSeat404Error,
      422: HTTPValidationError,
    });
  };
};
export const resendInvitationSeats = (client: ClientBase) => {
  /**
   *
   * @param seat_id
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {SeatsResendInvitation400Error} Seat is not pending or already claimed
   * @throws {SeatsResendInvitation401Error} Authentication required
   * @throws {SeatsResendInvitation403Error} Not permitted or seat-based pricing not enabled
   * @throws {SeatsResendInvitation404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (seat_id: string): Promise<CustomerSeat> => {
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
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSeat>(response, "json", {
      400: SeatsResendInvitation400Error,
      401: SeatsResendInvitation401Error,
      403: SeatsResendInvitation403Error,
      404: SeatsResendInvitation404Error,
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
   * @returns {ListResourceCustomerSubscription}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {SeatsListClaimedSubscriptions401Error} Authentication required
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    page?: number;
    limit?: number;
  }): Promise<ListResourceCustomerSubscription> => {
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
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceCustomerSubscription>(response, "json", {
      401: SeatsListClaimedSubscriptions401Error,
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
 * @returns {AsyncGenerator<CustomerSubscription>} A generator that yields items of type CustomerSubscription.
 * @throws {PolarNetworkError} When a network error occurs
 * @throws {PolarRateLimitError} When the rate limit is exceeded
 * @throws {PolarServerError} When the server returns a 5xx error
 * @throws {SeatsListClaimedSubscriptions401Error} Authentication required
 * @throws {HTTPValidationError} Validation Error
 */
export const iterListClaimedSubscriptionsSeats = (client: ClientBase) => {
  return async function* (query?: {
    page?: number;
    limit?: number;
  }): AsyncGenerator<CustomerSubscription> {
    let page: number;
    page = query?.page ?? 1;
    let limit: number | undefined;
    limit = query?.limit;

    while (true) {
      const response = await listClaimedSubscriptionsSeats(client)({ ...query, page, limit });
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
