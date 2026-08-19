import type { ClientBase, RequestOptions } from "../../base";
import type {
  CustomerSeat,
  CustomerSeatClaimResponse,
  SeatAssign,
  SeatClaim,
  SeatClaimInfo,
  SeatsList,
} from "../models";

import {
  CustomerSeatsAssignSeat400Error,
  CustomerSeatsAssignSeat401Error,
  CustomerSeatsAssignSeat403Error,
  CustomerSeatsAssignSeat404Error,
  CustomerSeatsClaimSeat400Error,
  CustomerSeatsClaimSeat403Error,
  CustomerSeatsGetClaimInfo400Error,
  CustomerSeatsGetClaimInfo403Error,
  CustomerSeatsGetClaimInfo404Error,
  CustomerSeatsListSeats401Error,
  CustomerSeatsListSeats403Error,
  CustomerSeatsListSeats404Error,
  CustomerSeatsResendInvitation400Error,
  CustomerSeatsResendInvitation401Error,
  CustomerSeatsResendInvitation403Error,
  CustomerSeatsResendInvitation404Error,
  CustomerSeatsRevokeSeat401Error,
  CustomerSeatsRevokeSeat403Error,
  CustomerSeatsRevokeSeat404Error,
  HTTPValidationError,
} from "../errors";

export const listSeatsCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:read`
   *
   * @param query - Query parameters
   * @param requestOptions - Request options
   * @returns {SeatsList}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerSeatsListSeats401Error} Authentication required
   * @throws {CustomerSeatsListSeats403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerSeatsListSeats404Error} Subscription or order not found
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
      "/v1/customer-seats",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<SeatsList>(response, "json", {
      401: CustomerSeatsListSeats401Error,
      403: CustomerSeatsListSeats403Error,
      404: CustomerSeatsListSeats404Error,
      422: HTTPValidationError,
    });
  };
};
export const assignSeatCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:write`
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerSeatsAssignSeat400Error} No available seats or customer already has a seat
   * @throws {CustomerSeatsAssignSeat401Error} Authentication required
   * @throws {CustomerSeatsAssignSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerSeatsAssignSeat404Error} Subscription, order, or customer not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body: SeatAssign, requestOptions?: RequestOptions): Promise<CustomerSeat> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-seats",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerSeat>(response, "json", {
      400: CustomerSeatsAssignSeat400Error,
      401: CustomerSeatsAssignSeat401Error,
      403: CustomerSeatsAssignSeat403Error,
      404: CustomerSeatsAssignSeat404Error,
      422: HTTPValidationError,
    });
  };
};
export const revokeSeatCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:write`
   *
   * @param seat_id
   * @param requestOptions - Request options
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerSeatsRevokeSeat401Error} Authentication required
   * @throws {CustomerSeatsRevokeSeat403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerSeatsRevokeSeat404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (seat_id: string, requestOptions?: RequestOptions): Promise<CustomerSeat> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerSeat>(response, "json", {
      401: CustomerSeatsRevokeSeat401Error,
      403: CustomerSeatsRevokeSeat403Error,
      404: CustomerSeatsRevokeSeat404Error,
      422: HTTPValidationError,
    });
  };
};
export const resendInvitationCustomerSeats = (client: ClientBase) => {
  /**
   * **Scopes**: `customer_seats:write`
   *
   * @param seat_id
   * @param requestOptions - Request options
   * @returns {CustomerSeat}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerSeatsResendInvitation400Error} Seat is not pending or already claimed
   * @throws {CustomerSeatsResendInvitation401Error} Authentication required
   * @throws {CustomerSeatsResendInvitation403Error} Not permitted or seat-based pricing not enabled
   * @throws {CustomerSeatsResendInvitation404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (seat_id: string, requestOptions?: RequestOptions): Promise<CustomerSeat> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerSeat>(response, "json", {
      400: CustomerSeatsResendInvitation400Error,
      401: CustomerSeatsResendInvitation401Error,
      403: CustomerSeatsResendInvitation403Error,
      404: CustomerSeatsResendInvitation404Error,
      422: HTTPValidationError,
    });
  };
};
export const getClaimInfoCustomerSeats = (client: ClientBase) => {
  /**
   *
   * @param invitation_token
   * @param requestOptions - Request options
   * @returns {SeatClaimInfo}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerSeatsGetClaimInfo400Error} Invalid or expired invitation token
   * @throws {CustomerSeatsGetClaimInfo403Error} Seat-based pricing not enabled for organization
   * @throws {CustomerSeatsGetClaimInfo404Error} Seat not found
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    invitation_token: string,
    requestOptions?: RequestOptions,
  ): Promise<SeatClaimInfo> => {
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
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<SeatClaimInfo>(response, "json", {
      400: CustomerSeatsGetClaimInfo400Error,
      403: CustomerSeatsGetClaimInfo403Error,
      404: CustomerSeatsGetClaimInfo404Error,
      422: HTTPValidationError,
    });
  };
};
export const claimSeatCustomerSeats = (client: ClientBase) => {
  /**
   *
   * @param body - Request body
   * @param requestOptions - Request options
   * @returns {CustomerSeatClaimResponse}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarRateLimitError} When the rate limit is exceeded
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {CustomerSeatsClaimSeat400Error} Invalid, expired, or already claimed token
   * @throws {CustomerSeatsClaimSeat403Error} Seat-based pricing not enabled for organization
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    body: SeatClaim,
    requestOptions?: RequestOptions,
  ): Promise<CustomerSeatClaimResponse> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/customer-seats/claim",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request, requestOptions);
    return client.parseResponse<CustomerSeatClaimResponse>(response, "json", {
      400: CustomerSeatsClaimSeat400Error,
      403: CustomerSeatsClaimSeat403Error,
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
