from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.v2026_04.errors import (
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
)
from polar.v2026_04.inputs import (
    CustomerSeatAssign,
)
from polar.v2026_04.outputs import (
    CustomerSeat,
    CustomerSubscription,
    ListResourceCustomerSubscription,
    SeatsList,
)


class SeatsSync(SyncServiceBase):
    def list_seats(
        self,
        *,
        subscription_id: str | None = None,
        order_id: str | None = None,
    ) -> SeatsList:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            subscription_id: Subscription ID
            order_id: Order ID

        Raises:
            SeatsListSeats401Error: Authentication required
            SeatsListSeats403Error: Not permitted or seat-based pricing not enabled
            SeatsListSeats404Error: Subscription or order not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/seats",
            path_params={},
            query_params={
                "subscription_id": subscription_id,
                "order_id": order_id,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            401: SeatsListSeats401Error,
            403: SeatsListSeats403Error,
            404: SeatsListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    def assign_seat(
        self,
        **kwargs: typing.Unpack[CustomerSeatAssign],
    ) -> CustomerSeat:
        """
        Args:
            **kwargs: Request body parameters

        Raises:
            SeatsAssignSeat400Error: No available seats or customer already has a seat
            SeatsAssignSeat401Error: Authentication required
            SeatsAssignSeat403Error: Not permitted or seat-based pricing not enabled
            SeatsAssignSeat404Error: Subscription, order, or customer not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/seats",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: SeatsAssignSeat400Error,
            401: SeatsAssignSeat401Error,
            403: SeatsAssignSeat403Error,
            404: SeatsAssignSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def revoke_seat(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        Args:
            seat_id:

        Raises:
            SeatsRevokeSeat401Error: Authentication required
            SeatsRevokeSeat403Error: Not permitted or seat-based pricing not enabled
            SeatsRevokeSeat404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/seats/{seat_id}",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            401: SeatsRevokeSeat401Error,
            403: SeatsRevokeSeat403Error,
            404: SeatsRevokeSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def resend_invitation(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        Args:
            seat_id:

        Raises:
            SeatsResendInvitation400Error: Seat is not pending or already claimed
            SeatsResendInvitation401Error: Authentication required
            SeatsResendInvitation403Error: Not permitted or seat-based pricing not enabled
            SeatsResendInvitation404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/seats/{seat_id}/resend",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            400: SeatsResendInvitation400Error,
            401: SeatsResendInvitation401Error,
            403: SeatsResendInvitation403Error,
            404: SeatsResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def list_claimed_subscriptions(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceCustomerSubscription:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            SeatsListClaimedSubscriptions401Error: Authentication required
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/seats/subscriptions",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            401: SeatsListClaimedSubscriptions401Error,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerSubscription, method_errors
        )

    def iter_list_claimed_subscriptions(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[CustomerSubscription, None, None]:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type CustomerSubscription.

        Raises:
            SeatsListClaimedSubscriptions401Error: Authentication required
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_claimed_subscriptions(
                page=page,
                limit=limit,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1


class SeatsAsync(AsyncServiceBase):
    async def list_seats(
        self,
        *,
        subscription_id: str | None = None,
        order_id: str | None = None,
    ) -> SeatsList:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            subscription_id: Subscription ID
            order_id: Order ID

        Raises:
            SeatsListSeats401Error: Authentication required
            SeatsListSeats403Error: Not permitted or seat-based pricing not enabled
            SeatsListSeats404Error: Subscription or order not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/seats",
            path_params={},
            query_params={
                "subscription_id": subscription_id,
                "order_id": order_id,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: SeatsListSeats401Error,
            403: SeatsListSeats403Error,
            404: SeatsListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    async def assign_seat(
        self,
        **kwargs: typing.Unpack[CustomerSeatAssign],
    ) -> CustomerSeat:
        """
        Args:
            **kwargs: Request body parameters

        Raises:
            SeatsAssignSeat400Error: No available seats or customer already has a seat
            SeatsAssignSeat401Error: Authentication required
            SeatsAssignSeat403Error: Not permitted or seat-based pricing not enabled
            SeatsAssignSeat404Error: Subscription, order, or customer not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/seats",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: SeatsAssignSeat400Error,
            401: SeatsAssignSeat401Error,
            403: SeatsAssignSeat403Error,
            404: SeatsAssignSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def revoke_seat(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        Args:
            seat_id:

        Raises:
            SeatsRevokeSeat401Error: Authentication required
            SeatsRevokeSeat403Error: Not permitted or seat-based pricing not enabled
            SeatsRevokeSeat404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/seats/{seat_id}",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: SeatsRevokeSeat401Error,
            403: SeatsRevokeSeat403Error,
            404: SeatsRevokeSeat404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def resend_invitation(
        self,
        seat_id: str,
    ) -> CustomerSeat:
        """
        Args:
            seat_id:

        Raises:
            SeatsResendInvitation400Error: Seat is not pending or already claimed
            SeatsResendInvitation401Error: Authentication required
            SeatsResendInvitation403Error: Not permitted or seat-based pricing not enabled
            SeatsResendInvitation404Error: Seat not found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/seats/{seat_id}/resend",
            path_params={
                "seat_id": seat_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: SeatsResendInvitation400Error,
            401: SeatsResendInvitation401Error,
            403: SeatsResendInvitation403Error,
            404: SeatsResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def list_claimed_subscriptions(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceCustomerSubscription:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            SeatsListClaimedSubscriptions401Error: Authentication required
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/seats/subscriptions",
            path_params={},
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: SeatsListClaimedSubscriptions401Error,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerSubscription, method_errors
        )

    async def iter_list_claimed_subscriptions(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[CustomerSubscription, None]:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type CustomerSubscription.

        Raises:
            SeatsListClaimedSubscriptions401Error: Authentication required
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_claimed_subscriptions(
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1
