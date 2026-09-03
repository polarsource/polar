from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.v2026_10.errors import (
    CustomerPortalMembersAddMember400Error,
    CustomerPortalMembersAddMember401Error,
    CustomerPortalMembersAddMember403Error,
    CustomerPortalMembersListMembers401Error,
    CustomerPortalMembersListMembers403Error,
    CustomerPortalMembersRemoveMember400Error,
    CustomerPortalMembersRemoveMember401Error,
    CustomerPortalMembersRemoveMember403Error,
    CustomerPortalMembersRemoveMember404Error,
    CustomerPortalMembersUpdateMember400Error,
    CustomerPortalMembersUpdateMember401Error,
    CustomerPortalMembersUpdateMember403Error,
    CustomerPortalMembersUpdateMember404Error,
    HTTPValidationError,
)
from polar.v2026_10.inputs import (
    CustomerPortalMemberCreate,
    CustomerPortalMemberUpdate,
)
from polar.v2026_10.outputs import (
    CustomerPortalMember,
    ListResourceCustomerPortalMember,
)


class MembersSync(SyncServiceBase):
    def list_members(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceCustomerPortalMember:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerPortalMembersListMembers401Error: Authentication required
            CustomerPortalMembersListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/members",
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
            401: CustomerPortalMembersListMembers401Error,
            403: CustomerPortalMembersListMembers403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerPortalMember, method_errors
        )

    def iter_list_members(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[CustomerPortalMember, None, None]:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.



        Returns:
            A generator that yields items of type CustomerPortalMember.

        Raises:
            CustomerPortalMembersListMembers401Error: Authentication required
            CustomerPortalMembersListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_members(
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            request_access_token=request_access_token,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def add_member(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerPortalMemberCreate],
    ) -> CustomerPortalMember:
        """
        Add a new member to the customer's team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot add a member with the owner role (there must be exactly one owner)
        - If a member with this email already exists, the existing member is returned

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerPortalMembersAddMember400Error: Invalid request or member already exists.
            CustomerPortalMembersAddMember401Error: Authentication required
            CustomerPortalMembersAddMember403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/members",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerPortalMembersAddMember400Error,
            401: CustomerPortalMembersAddMember401Error,
            403: CustomerPortalMembersAddMember403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)

    def remove_member(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> None:
        """
        Remove a member from the team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot remove yourself
        - Cannot remove the only owner

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerPortalMembersRemoveMember400Error: Cannot remove the only owner.
            CustomerPortalMembersRemoveMember401Error: Authentication required
            CustomerPortalMembersRemoveMember403Error: Not permitted - requires owner or billing manager role
            CustomerPortalMembersRemoveMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerPortalMembersRemoveMember400Error,
            401: CustomerPortalMembersRemoveMember401Error,
            403: CustomerPortalMembersRemoveMember403Error,
            404: CustomerPortalMembersRemoveMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def update_member(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerPortalMemberUpdate],
    ) -> CustomerPortalMember:
        """
        Update a member's name or role.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot modify your own role (to prevent self-demotion)
        - Customer must have exactly one owner at all times

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerPortalMembersUpdateMember400Error: Invalid role change.
            CustomerPortalMembersUpdateMember401Error: Authentication required
            CustomerPortalMembersUpdateMember403Error: Not permitted - requires owner or billing manager role
            CustomerPortalMembersUpdateMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: CustomerPortalMembersUpdateMember400Error,
            401: CustomerPortalMembersUpdateMember401Error,
            403: CustomerPortalMembersUpdateMember403Error,
            404: CustomerPortalMembersUpdateMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)


class MembersAsync(AsyncServiceBase):
    async def list_members(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceCustomerPortalMember:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerPortalMembersListMembers401Error: Authentication required
            CustomerPortalMembersListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/members",
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
            401: CustomerPortalMembersListMembers401Error,
            403: CustomerPortalMembersListMembers403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerPortalMember, method_errors
        )

    async def iter_list_members(
        self,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[CustomerPortalMember, None]:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.



        Returns:
            An async generator that yields items of type CustomerPortalMember.

        Raises:
            CustomerPortalMembersListMembers401Error: Authentication required
            CustomerPortalMembersListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_members(
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

    async def add_member(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerPortalMemberCreate],
    ) -> CustomerPortalMember:
        """
        Add a new member to the customer's team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot add a member with the owner role (there must be exactly one owner)
        - If a member with this email already exists, the existing member is returned

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerPortalMembersAddMember400Error: Invalid request or member already exists.
            CustomerPortalMembersAddMember401Error: Authentication required
            CustomerPortalMembersAddMember403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/members",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerPortalMembersAddMember400Error,
            401: CustomerPortalMembersAddMember401Error,
            403: CustomerPortalMembersAddMember403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)

    async def remove_member(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> None:
        """
        Remove a member from the team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot remove yourself
        - Cannot remove the only owner

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.



        Raises:
            CustomerPortalMembersRemoveMember400Error: Cannot remove the only owner.
            CustomerPortalMembersRemoveMember401Error: Authentication required
            CustomerPortalMembersRemoveMember403Error: Not permitted - requires owner or billing manager role
            CustomerPortalMembersRemoveMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customer-portal/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerPortalMembersRemoveMember400Error,
            401: CustomerPortalMembersRemoveMember401Error,
            403: CustomerPortalMembersRemoveMember403Error,
            404: CustomerPortalMembersRemoveMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def update_member(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[CustomerPortalMemberUpdate],
    ) -> CustomerPortalMember:
        """
        Update a member's name or role.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot modify your own role (to prevent self-demotion)
        - Customer must have exactly one owner at all times

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


            **kwargs: Request body parameters

        Raises:
            CustomerPortalMembersUpdateMember400Error: Invalid role change.
            CustomerPortalMembersUpdateMember401Error: Authentication required
            CustomerPortalMembersUpdateMember403Error: Not permitted - requires owner or billing manager role
            CustomerPortalMembersUpdateMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: CustomerPortalMembersUpdateMember400Error,
            401: CustomerPortalMembersUpdateMember401Error,
            403: CustomerPortalMembersUpdateMember403Error,
            404: CustomerPortalMembersUpdateMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)
