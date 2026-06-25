from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.errors import (
    AddMember400Error,
    AddMember401Error,
    AddMember403Error,
    HTTPValidationError,
    ListMembers401Error,
    ListMembers403Error,
    RemoveMember400Error,
    RemoveMember401Error,
    RemoveMember403Error,
    RemoveMember404Error,
    UpdateMember400Error,
    UpdateMember401Error,
    UpdateMember403Error,
    UpdateMember404Error,
)
from polar.inputs import (
    CustomerPortalMemberCreate,
    CustomerPortalMemberUpdate,
)
from polar.outputs import (
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
            ListMembers401Error: Authentication required
            ListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            401: ListMembers401Error,
            403: ListMembers403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerPortalMember, method_errors
        )

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
            AddMember400Error: Invalid request or member already exists.
            AddMember401Error: Authentication required
            AddMember403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            400: AddMember400Error,
            401: AddMember401Error,
            403: AddMember403Error,
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
            RemoveMember400Error: Cannot remove the only owner.
            RemoveMember401Error: Authentication required
            RemoveMember403Error: Not permitted - requires owner or billing manager role
            RemoveMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            400: RemoveMember400Error,
            401: RemoveMember401Error,
            403: RemoveMember403Error,
            404: RemoveMember404Error,
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
            UpdateMember400Error: Invalid role change.
            UpdateMember401Error: Authentication required
            UpdateMember403Error: Not permitted - requires owner or billing manager role
            UpdateMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            400: UpdateMember400Error,
            401: UpdateMember401Error,
            403: UpdateMember403Error,
            404: UpdateMember404Error,
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
            ListMembers401Error: Authentication required
            ListMembers403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            401: ListMembers401Error,
            403: ListMembers403Error,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceCustomerPortalMember, method_errors
        )

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
            AddMember400Error: Invalid request or member already exists.
            AddMember401Error: Authentication required
            AddMember403Error: Not permitted - requires owner or billing manager role
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            400: AddMember400Error,
            401: AddMember401Error,
            403: AddMember403Error,
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
            RemoveMember400Error: Cannot remove the only owner.
            RemoveMember401Error: Authentication required
            RemoveMember403Error: Not permitted - requires owner or billing manager role
            RemoveMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            400: RemoveMember400Error,
            401: RemoveMember401Error,
            403: RemoveMember403Error,
            404: RemoveMember404Error,
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
            UpdateMember400Error: Invalid role change.
            UpdateMember401Error: Authentication required
            UpdateMember403Error: Not permitted - requires owner or billing manager role
            UpdateMember404Error: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
            400: UpdateMember400Error,
            401: UpdateMember401Error,
            403: UpdateMember403Error,
            404: UpdateMember404Error,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerPortalMember, method_errors)
