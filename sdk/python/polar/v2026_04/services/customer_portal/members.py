from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.v2026_04.errors import (
    HTTPValidationError,
    MembersAddMember400Error,
    MembersAddMember401Error,
    MembersAddMember403Error,
    MembersListMembers401Error,
    MembersListMembers403Error,
    MembersRemoveMember400Error,
    MembersRemoveMember401Error,
    MembersRemoveMember403Error,
    MembersRemoveMember404Error,
    MembersUpdateMember400Error,
    MembersUpdateMember401Error,
    MembersUpdateMember403Error,
    MembersUpdateMember404Error,
)
from polar.v2026_04.inputs import (
    CustomerPortalMemberCreate,
    CustomerPortalMemberUpdate,
)
from polar.v2026_04.outputs import (
    CustomerPortalMember,
    ListResourceCustomerPortalMember,
)


class MembersSync(SyncServiceBase):
    def list_members(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceCustomerPortalMember:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            MembersListMembers401Error: Authentication required
            MembersListMembers403Error: Not permitted - requires owner or billing manager role
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
        )
        response = self.client.send_request(request)
        method_errors = {
            401: MembersListMembers401Error,
            403: MembersListMembers403Error,
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
    ) -> typing.Generator[CustomerPortalMember, None, None]:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type CustomerPortalMember.

        Raises:
            MembersListMembers401Error: Authentication required
            MembersListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_members(
                page=page,
                limit=limit,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def add_member(
        self,
        **kwargs: typing.Unpack[CustomerPortalMemberCreate],
    ) -> CustomerPortalMember:
        """
        Add a new member to the customer's team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot add a member with the owner role (there must be exactly one owner)
        - If a member with this email already exists, the existing member is returned

        Args:
            **kwargs: Request body parameters

        Raises:
            MembersAddMember400Error: Invalid request or member already exists.
            MembersAddMember401Error: Authentication required
            MembersAddMember403Error: Not permitted - requires owner or billing manager role
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
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: MembersAddMember400Error,
            401: MembersAddMember401Error,
            403: MembersAddMember403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)

    def remove_member(
        self,
        id: str,
    ) -> None:
        """
        Remove a member from the team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot remove yourself
        - Cannot remove the only owner

        Args:
            id:

        Raises:
            MembersRemoveMember400Error: Cannot remove the only owner.
            MembersRemoveMember401Error: Authentication required
            MembersRemoveMember403Error: Not permitted - requires owner or billing manager role
            MembersRemoveMember404Error: Member not found.
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
        )
        response = self.client.send_request(request)
        method_errors = {
            400: MembersRemoveMember400Error,
            401: MembersRemoveMember401Error,
            403: MembersRemoveMember403Error,
            404: MembersRemoveMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def update_member(
        self,
        id: str,
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
            **kwargs: Request body parameters

        Raises:
            MembersUpdateMember400Error: Invalid role change.
            MembersUpdateMember401Error: Authentication required
            MembersUpdateMember403Error: Not permitted - requires owner or billing manager role
            MembersUpdateMember404Error: Member not found.
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
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: MembersUpdateMember400Error,
            401: MembersUpdateMember401Error,
            403: MembersUpdateMember403Error,
            404: MembersUpdateMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)


class MembersAsync(AsyncServiceBase):
    async def list_members(
        self,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceCustomerPortalMember:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            MembersListMembers401Error: Authentication required
            MembersListMembers403Error: Not permitted - requires owner or billing manager role
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
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: MembersListMembers401Error,
            403: MembersListMembers403Error,
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
    ) -> typing.AsyncGenerator[CustomerPortalMember, None]:
        """
        List all members of the customer's team.

        Only available to owners and billing managers of team customers.

        Args:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type CustomerPortalMember.

        Raises:
            MembersListMembers401Error: Authentication required
            MembersListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_members(
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def add_member(
        self,
        **kwargs: typing.Unpack[CustomerPortalMemberCreate],
    ) -> CustomerPortalMember:
        """
        Add a new member to the customer's team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot add a member with the owner role (there must be exactly one owner)
        - If a member with this email already exists, the existing member is returned

        Args:
            **kwargs: Request body parameters

        Raises:
            MembersAddMember400Error: Invalid request or member already exists.
            MembersAddMember401Error: Authentication required
            MembersAddMember403Error: Not permitted - requires owner or billing manager role
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
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: MembersAddMember400Error,
            401: MembersAddMember401Error,
            403: MembersAddMember403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)

    async def remove_member(
        self,
        id: str,
    ) -> None:
        """
        Remove a member from the team.

        Only available to owners and billing managers of team customers.

        Rules:
        - Cannot remove yourself
        - Cannot remove the only owner

        Args:
            id:

        Raises:
            MembersRemoveMember400Error: Cannot remove the only owner.
            MembersRemoveMember401Error: Authentication required
            MembersRemoveMember403Error: Not permitted - requires owner or billing manager role
            MembersRemoveMember404Error: Member not found.
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
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: MembersRemoveMember400Error,
            401: MembersRemoveMember401Error,
            403: MembersRemoveMember403Error,
            404: MembersRemoveMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def update_member(
        self,
        id: str,
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
            **kwargs: Request body parameters

        Raises:
            MembersUpdateMember400Error: Invalid role change.
            MembersUpdateMember401Error: Authentication required
            MembersUpdateMember403Error: Not permitted - requires owner or billing manager role
            MembersUpdateMember404Error: Member not found.
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
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: MembersUpdateMember400Error,
            401: MembersUpdateMember401Error,
            403: MembersUpdateMember403Error,
            404: MembersUpdateMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)
