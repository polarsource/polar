from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_04.errors import (
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
)
from polar.v2026_04.inputs import (
    SeatAssign,
    SeatClaim,
)
from polar.v2026_04.outputs import (
    CustomerSeat,
    CustomerSeatClaimResponse,
    SeatClaimInfo,
    SeatsList,
)


class CustomerSeatsSync(SyncServiceBase):
    def list_seats(
        self,
        *,
        subscription_id: str | None = None,
        order_id: str | None = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> SeatsList:
        """
        **Scopes**: `customer_seats:read`

        Args:
            subscription_id:
            order_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsListSeats401Error: Authentication required
            CustomerSeatsListSeats403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsListSeats404Error: Subscription or order not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-seats",
            path_params={},
            query_params={
                "subscription_id": subscription_id,
                "order_id": order_id,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: CustomerSeatsListSeats401Error,
            403: CustomerSeatsListSeats403Error,
            404: CustomerSeatsListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    def assign_seat(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[SeatAssign],
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerSeatsAssignSeat400Error: No available seats or customer already has a seat
            CustomerSeatsAssignSeat401Error: Authentication required
            CustomerSeatsAssignSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsAssignSeat404Error: Subscription, order, or customer not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-seats",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsAssignSeat400Error,
            401: CustomerSeatsAssignSeat401Error,
            403: CustomerSeatsAssignSeat403Error,
            404: CustomerSeatsAssignSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def revoke_seat(
        self,
        seat_id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsRevokeSeat401Error: Authentication required
            CustomerSeatsRevokeSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsRevokeSeat404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-seats/{seat_id}",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: CustomerSeatsRevokeSeat401Error,
            403: CustomerSeatsRevokeSeat403Error,
            404: CustomerSeatsRevokeSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def resend_invitation(
        self,
        seat_id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsResendInvitation400Error: Seat is not pending or already claimed
            CustomerSeatsResendInvitation401Error: Authentication required
            CustomerSeatsResendInvitation403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsResendInvitation404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-seats/{seat_id}/resend",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsResendInvitation400Error,
            401: CustomerSeatsResendInvitation401Error,
            403: CustomerSeatsResendInvitation403Error,
            404: CustomerSeatsResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def get_claim_info(
        self,
        invitation_token: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> SeatClaimInfo:
        """
        Args:
            invitation_token:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsGetClaimInfo400Error: Invalid or expired invitation token
            CustomerSeatsGetClaimInfo403Error: Seat-based pricing not enabled for organization
            CustomerSeatsGetClaimInfo404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-seats/claim/{invitation_token}",
            path_params={
                "invitation_token": invitation_token,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsGetClaimInfo400Error,
            403: CustomerSeatsGetClaimInfo403Error,
            404: CustomerSeatsGetClaimInfo404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatClaimInfo, method_errors)

    def claim_seat(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[SeatClaim],
    ) -> CustomerSeatClaimResponse:
        """
        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerSeatsClaimSeat400Error: Invalid, expired, or already claimed token
            CustomerSeatsClaimSeat403Error: Seat-based pricing not enabled for organization
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-seats/claim",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsClaimSeat400Error,
            403: CustomerSeatsClaimSeat403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeatClaimResponse, method_errors)


class CustomerSeatsAsync(AsyncServiceBase):
    async def list_seats(
        self,
        *,
        subscription_id: str | None = None,
        order_id: str | None = None,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> SeatsList:
        """
        **Scopes**: `customer_seats:read`

        Args:
            subscription_id:
            order_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsListSeats401Error: Authentication required
            CustomerSeatsListSeats403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsListSeats404Error: Subscription or order not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-seats",
            path_params={},
            query_params={
                "subscription_id": subscription_id,
                "order_id": order_id,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: CustomerSeatsListSeats401Error,
            403: CustomerSeatsListSeats403Error,
            404: CustomerSeatsListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    async def assign_seat(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[SeatAssign],
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerSeatsAssignSeat400Error: No available seats or customer already has a seat
            CustomerSeatsAssignSeat401Error: Authentication required
            CustomerSeatsAssignSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsAssignSeat404Error: Subscription, order, or customer not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-seats",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsAssignSeat400Error,
            401: CustomerSeatsAssignSeat401Error,
            403: CustomerSeatsAssignSeat403Error,
            404: CustomerSeatsAssignSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def revoke_seat(
        self,
        seat_id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsRevokeSeat401Error: Authentication required
            CustomerSeatsRevokeSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsRevokeSeat404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-seats/{seat_id}",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: CustomerSeatsRevokeSeat401Error,
            403: CustomerSeatsRevokeSeat403Error,
            404: CustomerSeatsRevokeSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def resend_invitation(
        self,
        seat_id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsResendInvitation400Error: Seat is not pending or already claimed
            CustomerSeatsResendInvitation401Error: Authentication required
            CustomerSeatsResendInvitation403Error: Not permitted or seat-based pricing not enabled
            CustomerSeatsResendInvitation404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-seats/{seat_id}/resend",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsResendInvitation400Error,
            401: CustomerSeatsResendInvitation401Error,
            403: CustomerSeatsResendInvitation403Error,
            404: CustomerSeatsResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def get_claim_info(
        self,
        invitation_token: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> SeatClaimInfo:
        """
        Args:
            invitation_token:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerSeatsGetClaimInfo400Error: Invalid or expired invitation token
            CustomerSeatsGetClaimInfo403Error: Seat-based pricing not enabled for organization
            CustomerSeatsGetClaimInfo404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-seats/claim/{invitation_token}",
            path_params={
                "invitation_token": invitation_token,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsGetClaimInfo400Error,
            403: CustomerSeatsGetClaimInfo403Error,
            404: CustomerSeatsGetClaimInfo404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatClaimInfo, method_errors)

    async def claim_seat(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[SeatClaim],
    ) -> CustomerSeatClaimResponse:
        """
        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerSeatsClaimSeat400Error: Invalid, expired, or already claimed token
            CustomerSeatsClaimSeat403Error: Seat-based pricing not enabled for organization
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-seats/claim",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerSeatsClaimSeat400Error,
            403: CustomerSeatsClaimSeat403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeatClaimResponse, method_errors)
