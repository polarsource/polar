from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response_json
from polar.errors import (
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
)
from polar.inputs import (
    CustomerSeatAssign,
)
from polar.outputs import (
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
            url="/v1/customer-portal/seats",
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
        **kwargs: typing.Unpack[CustomerSeatAssign],
    ) -> CustomerSeat:
        """
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
            url="/v1/customer-portal/seats",
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
            url="/v1/customer-portal/seats/{seat_id}",
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
            url="/v1/customer-portal/seats/{seat_id}/resend",
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
            ListClaimedSubscriptions401Error: Authentication required
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
            401: ListClaimedSubscriptions401Error,
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
            ListClaimedSubscriptions401Error: Authentication required
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
            url="/v1/customer-portal/seats",
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
        **kwargs: typing.Unpack[CustomerSeatAssign],
    ) -> CustomerSeat:
        """
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
            url="/v1/customer-portal/seats",
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
            url="/v1/customer-portal/seats/{seat_id}",
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
            url="/v1/customer-portal/seats/{seat_id}/resend",
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
            ListClaimedSubscriptions401Error: Authentication required
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
            401: ListClaimedSubscriptions401Error,
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
            ListClaimedSubscriptions401Error: Authentication required
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
