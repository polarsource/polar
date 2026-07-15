import type { ClientBase } from "../../base";
import type {
  CustomerSeat,
  CustomerSeatClaimResponse,
  SeatAssign,
  SeatClaim,
  SeatClaimInfo,
  SeatsList,
} from "../models";

import {
  AssignSeat400Error,
  AssignSeat401Error,
  AssignSeat403Error,
  AssignSeat404Error,
  ClaimSeat400Error,
  ClaimSeat403Error,
  GetClaimInfo400Error,
  GetClaimInfo403Error,
  GetClaimInfo404Error,
  HTTPValidationError,
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
} from "../errors";

export const listSeatsCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:read`
   *
   * @param query - Query parameters
   * @returns {SeatsList}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
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
      "/v1/customer-seats",
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
export const assignSeatCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:write`
   *
   * @param body - Request body
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {AssignSeat400Error} No available seats or customer already has a seat
   * @throws {AssignSeat401Error} Authentication required
   * @throws {AssignSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {AssignSeat404Error} Subscription, order, or customer not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: SeatAssign): Promise<CustomerSeat> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-seats",
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
export const revokeSeatCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:write`
   *
   * @param seat_id
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
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
      "/v1/customer-seats/{seat_id}",
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
export const resendInvitationCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:write`
   *
   * @param seat_id
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
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
      "/v1/customer-seats/{seat_id}/resend",
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
export const getClaimInfoCustomerSeats = (client: ClientBase) => {
  /**
   *
   * @param invitation_token
   * @returns {SeatClaimInfo}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {GetClaimInfo400Error} Invalid or expired invitation token
   * @throws {GetClaimInfo403Error} Seat-based pricing not enabled for organization
   * @throws {GetClaimInfo404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (invitation_token: string): Promise<SeatClaimInfo> => {
    const pathParams = {
      invitation_token: invitation_token,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "GET",
      "/v1/customer-seats/claim/{invitation_token}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<SeatClaimInfo>(response, "json", {
      400: GetClaimInfo400Error,
      403: GetClaimInfo403Error,
      404: GetClaimInfo404Error,
      422: HTTPValidationError,
    });
  };
};
export const claimSeatCustomerSeats = (client: ClientBase) => {
  /**
   *
   * @param body - Request body
   * @returns {CustomerSeatClaimResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {ClaimSeat400Error} Invalid, expired, or already claimed token
   * @throws {ClaimSeat403Error} Seat-based pricing not enabled for organization
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: SeatClaim): Promise<CustomerSeatClaimResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-seats/claim",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<CustomerSeatClaimResponse>(response, "json", {
      400: ClaimSeat400Error,
      403: ClaimSeat403Error,
      422: HTTPValidationError,
    });
  };
};

export function createCustomerSeatsService(client: ClientBase) {
  return {
    listSeats: listSeatsCustomerSeats(client),
    assignSeat: assignSeatCustomerSeats(client),
    revokeSeat: revokeSeatCustomerSeats(client),
    resendInvitation: resendInvitationCustomerSeats(client),
    getClaimInfo: getClaimInfoCustomerSeats(client),
    claimSeat: claimSeatCustomerSeats(client),
  };
}

export type CustomerSeats = ReturnType<typeof createCustomerSeatsService>;
