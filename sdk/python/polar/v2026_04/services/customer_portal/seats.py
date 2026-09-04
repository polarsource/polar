from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2026_04.errors import (
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> SeatsList:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            subscription_id: Subscription ID
            order_id: Order ID
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsListSeats401Error: Authentication required
            CustomerPortalSeatsListSeats403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsListSeats404Error: Subscription or order not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: CustomerPortalSeatsListSeats401Error,
            403: CustomerPortalSeatsListSeats403Error,
            404: CustomerPortalSeatsListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    def assign_seat(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSeatAssign],
    ) -> CustomerSeat:
        """
        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            CustomerPortalSeatsAssignSeat400Error: No available seats or customer already has a seat
            CustomerPortalSeatsAssignSeat401Error: Authentication required
            CustomerPortalSeatsAssignSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsAssignSeat404Error: Subscription, order, or customer not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerPortalSeatsAssignSeat400Error,
            401: CustomerPortalSeatsAssignSeat401Error,
            403: CustomerPortalSeatsAssignSeat403Error,
            404: CustomerPortalSeatsAssignSeat404Error,
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
        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsRevokeSeat401Error: Authentication required
            CustomerPortalSeatsRevokeSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsRevokeSeat404Error: Seat not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: CustomerPortalSeatsRevokeSeat401Error,
            403: CustomerPortalSeatsRevokeSeat403Error,
            404: CustomerPortalSeatsRevokeSeat404Error,
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
        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsResendInvitation400Error: Seat is not pending or already claimed
            CustomerPortalSeatsResendInvitation401Error: Authentication required
            CustomerPortalSeatsResendInvitation403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsResendInvitation404Error: Seat not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerPortalSeatsResendInvitation400Error,
            401: CustomerPortalSeatsResendInvitation401Error,
            403: CustomerPortalSeatsResendInvitation403Error,
            404: CustomerPortalSeatsResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    def list_claimed_subscriptions(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceCustomerSubscription:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsListClaimedSubscriptions401Error: Authentication required
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: CustomerPortalSeatsListClaimedSubscriptions401Error,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[CustomerSubscription, None, None]:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            A generator that yields items of type CustomerSubscription.

        Raises:
            CustomerPortalSeatsListClaimedSubscriptions401Error: Authentication required
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_claimed_subscriptions(
                page=page,
                limit=limit,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> SeatsList:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            subscription_id: Subscription ID
            order_id: Order ID
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsListSeats401Error: Authentication required
            CustomerPortalSeatsListSeats403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsListSeats404Error: Subscription or order not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: CustomerPortalSeatsListSeats401Error,
            403: CustomerPortalSeatsListSeats403Error,
            404: CustomerPortalSeatsListSeats404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, SeatsList, method_errors)

    async def assign_seat(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerSeatAssign],
    ) -> CustomerSeat:
        """
        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            CustomerPortalSeatsAssignSeat400Error: No available seats or customer already has a seat
            CustomerPortalSeatsAssignSeat401Error: Authentication required
            CustomerPortalSeatsAssignSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsAssignSeat404Error: Subscription, order, or customer not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerPortalSeatsAssignSeat400Error,
            401: CustomerPortalSeatsAssignSeat401Error,
            403: CustomerPortalSeatsAssignSeat403Error,
            404: CustomerPortalSeatsAssignSeat404Error,
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
        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsRevokeSeat401Error: Authentication required
            CustomerPortalSeatsRevokeSeat403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsRevokeSeat404Error: Seat not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: CustomerPortalSeatsRevokeSeat401Error,
            403: CustomerPortalSeatsRevokeSeat403Error,
            404: CustomerPortalSeatsRevokeSeat404Error,
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
        Args:
            seat_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsResendInvitation400Error: Seat is not pending or already claimed
            CustomerPortalSeatsResendInvitation401Error: Authentication required
            CustomerPortalSeatsResendInvitation403Error: Not permitted or seat-based pricing not enabled
            CustomerPortalSeatsResendInvitation404Error: Seat not found
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerPortalSeatsResendInvitation400Error,
            401: CustomerPortalSeatsResendInvitation401Error,
            403: CustomerPortalSeatsResendInvitation403Error,
            404: CustomerPortalSeatsResendInvitation404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerSeat, method_errors)

    async def list_claimed_subscriptions(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceCustomerSubscription:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            CustomerPortalSeatsListClaimedSubscriptions401Error: Authentication required
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
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: CustomerPortalSeatsListClaimedSubscriptions401Error,
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
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[CustomerSubscription, None]:
        """
        List all subscriptions where the authenticated customer has claimed a seat.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            An async generator that yields items of type CustomerSubscription.

        Raises:
            CustomerPortalSeatsListClaimedSubscriptions401Error: Authentication required
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_claimed_subscriptions(
                page=page,
                limit=limit,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1
