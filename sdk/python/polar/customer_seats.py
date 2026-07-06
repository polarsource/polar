from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
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
)
from polar.inputs import (
    SeatAssign,
    SeatClaim,
)
from polar.outputs import (
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
    ) -> SeatsList:
        """
        **Scopes**: `customer_seats:read`

        Args:
            subscription_id:
            order_id:

        Raises:
            ListSeats401Error: Authentication required
            ListSeats403Error: Not permitted or seat-based pricing not enabled
            ListSeats404Error: Subscription or order not found
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
        )
        response = self.client.send_request(request)
        method_errors = {
            401: ListSeats401Error,
            403: ListSeats403Error,
            404: ListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    def assign_seat(
        self,
        **kwargs: typing.Unpack[SeatAssign],
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            AssignSeat400Error: No available seats or customer already has a seat
            AssignSeat401Error: Authentication required
            AssignSeat403Error: Not permitted or seat-based pricing not enabled
            AssignSeat404Error: Subscription, order, or customer not found
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
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: AssignSeat400Error,
            401: AssignSeat401Error,
            403: AssignSeat403Error,
            404: AssignSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def revoke_seat(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:

        Raises:
            RevokeSeat401Error: Authentication required
            RevokeSeat403Error: Not permitted or seat-based pricing not enabled
            RevokeSeat404Error: Seat not found
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
        )
        response = self.client.send_request(request)
        method_errors = {
            401: RevokeSeat401Error,
            403: RevokeSeat403Error,
            404: RevokeSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def resend_invitation(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:

        Raises:
            ResendInvitation400Error: Seat is not pending or already claimed
            ResendInvitation401Error: Authentication required
            ResendInvitation403Error: Not permitted or seat-based pricing not enabled
            ResendInvitation404Error: Seat not found
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
        )
        response = self.client.send_request(request)
        method_errors = {
            400: ResendInvitation400Error,
            401: ResendInvitation401Error,
            403: ResendInvitation403Error,
            404: ResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def get_claim_info(
        self,
        invitation_token: str,
    ) -> SeatClaimInfo:
        """
        Args:
            invitation_token:

        Raises:
            GetClaimInfo400Error: Invalid or expired invitation token
            GetClaimInfo403Error: Seat-based pricing not enabled for organization
            GetClaimInfo404Error: Seat not found
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
        )
        response = self.client.send_request(request)
        method_errors = {
            400: GetClaimInfo400Error,
            403: GetClaimInfo403Error,
            404: GetClaimInfo404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatClaimInfo, method_errors)

    def claim_seat(
        self,
        **kwargs: typing.Unpack[SeatClaim],
    ) -> CustomerSeatClaimResponse:
        """
        Args:
            **kwargs: Request body parameters

        Raises:
            ClaimSeat400Error: Invalid, expired, or already claimed token
            ClaimSeat403Error: Seat-based pricing not enabled for organization
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
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: ClaimSeat400Error,
            403: ClaimSeat403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeatClaimResponse, method_errors)


class CustomerSeatsAsync(AsyncServiceBase):
    async def list_seats(
        self,
        *,
        subscription_id: str | None = None,
        order_id: str | None = None,
    ) -> SeatsList:
        """
        **Scopes**: `customer_seats:read`

        Args:
            subscription_id:
            order_id:

        Raises:
            ListSeats401Error: Authentication required
            ListSeats403Error: Not permitted or seat-based pricing not enabled
            ListSeats404Error: Subscription or order not found
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
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: ListSeats401Error,
            403: ListSeats403Error,
            404: ListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    async def assign_seat(
        self,
        **kwargs: typing.Unpack[SeatAssign],
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            AssignSeat400Error: No available seats or customer already has a seat
            AssignSeat401Error: Authentication required
            AssignSeat403Error: Not permitted or seat-based pricing not enabled
            AssignSeat404Error: Subscription, order, or customer not found
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
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: AssignSeat400Error,
            401: AssignSeat401Error,
            403: AssignSeat403Error,
            404: AssignSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def revoke_seat(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:

        Raises:
            RevokeSeat401Error: Authentication required
            RevokeSeat403Error: Not permitted or seat-based pricing not enabled
            RevokeSeat404Error: Seat not found
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
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: RevokeSeat401Error,
            403: RevokeSeat403Error,
            404: RevokeSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def resend_invitation(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        **Scopes**: `customer_seats:write`

        Args:
            seat_id:

        Raises:
            ResendInvitation400Error: Seat is not pending or already claimed
            ResendInvitation401Error: Authentication required
            ResendInvitation403Error: Not permitted or seat-based pricing not enabled
            ResendInvitation404Error: Seat not found
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
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: ResendInvitation400Error,
            401: ResendInvitation401Error,
            403: ResendInvitation403Error,
            404: ResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def get_claim_info(
        self,
        invitation_token: str,
    ) -> SeatClaimInfo:
        """
        Args:
            invitation_token:

        Raises:
            GetClaimInfo400Error: Invalid or expired invitation token
            GetClaimInfo403Error: Seat-based pricing not enabled for organization
            GetClaimInfo404Error: Seat not found
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
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: GetClaimInfo400Error,
            403: GetClaimInfo403Error,
            404: GetClaimInfo404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatClaimInfo, method_errors)

    async def claim_seat(
        self,
        **kwargs: typing.Unpack[SeatClaim],
    ) -> CustomerSeatClaimResponse:
        """
        Args:
            **kwargs: Request body parameters

        Raises:
            ClaimSeat400Error: Invalid, expired, or already claimed token
            ClaimSeat403Error: Seat-based pricing not enabled for organization
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
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: ClaimSeat400Error,
            403: ClaimSeat403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeatClaimResponse, method_errors)
