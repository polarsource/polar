import { ClientBase } from "../../base";
import type { CustomerSeatAssign } from "../../models/inputs";
import type {
  CustomerSeat,
  ListResourceCustomerSubscription,
  SeatsList,
} from "../../models/outputs";
import {
  AssignSeat400Error,
  AssignSeat401Error,
  AssignSeat403Error,
  AssignSeat404Error,
  HTTPValidationError,
  ListClaimedSubscriptions401Error,
  ListSeats401Error,
  ListSeats403Error,
  ListSeats404Error,
  ResendInvitation400Error,
  ResendInvitation401Error,
  ResendInvitation403Error,
  ResendInvitation404Error,
  RevokeSeat401Error,
  RevokeSeat403Error,
  RevokeSeat404Error,
} from "../../errors";

export const listSeatsSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_portal:read` `customer_portal:write`
   *
   * @param query - Query parameters
   * @returns {SeatsList}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ListSeats401Error} Authentication required
   * @throws {ListSeats403Error} Not permitted or seat-based pricing not enabled
   * @throws {ListSeats404Error} Subscription or order not found
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
      401: ListSeats401Error,
      403: ListSeats403Error,
      404: ListSeats404Error,
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
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {AssignSeat400Error} No available seats or customer already has a seat
   * @throws {AssignSeat401Error} Authentication required
   * @throws {AssignSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {AssignSeat404Error} Subscription, order, or customer not found
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
      400: AssignSeat400Error,
      401: AssignSeat401Error,
      403: AssignSeat403Error,
      404: AssignSeat404Error,
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
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {RevokeSeat401Error} Authentication required
   * @throws {RevokeSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {RevokeSeat404Error} Seat not found
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
      401: RevokeSeat401Error,
      403: RevokeSeat403Error,
      404: RevokeSeat404Error,
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
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ResendInvitation400Error} Seat is not pending or already claimed
   * @throws {ResendInvitation401Error} Authentication required
   * @throws {ResendInvitation403Error} Not permitted or seat-based pricing not enabled
   * @throws {ResendInvitation404Error} Seat not found
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
      400: ResendInvitation400Error,
      401: ResendInvitation401Error,
      403: ResendInvitation403Error,
      404: ResendInvitation404Error,
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
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ListClaimedSubscriptions401Error} Authentication required
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    page?: number;
    limit?: number;
  }): Promise<ListResourceCustomerSubscription> => {
    const pathParams = {};
    const queryParams = {
      page: query?.page || 1,
      limit: query?.limit || 10,
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
      401: ListClaimedSubscriptions401Error,
      422: HTTPValidationError,
    });
  };
};

export function createSeatsService(client: ClientBase) {
  return {
    listSeats: listSeatsSeats(client),
    assignSeat: assignSeatSeats(client),
    revokeSeat: revokeSeatSeats(client),
    resendInvitation: resendInvitationSeats(client),
    listClaimedSubscriptions: listClaimedSubscriptionsSeats(client),
  };
}

export type Seats = ReturnType<typeof createSeatsService>;
