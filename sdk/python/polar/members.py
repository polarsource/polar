from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    CreateMember403Error,
    HTTPValidationError,
    ResourceNotFound,
)
from polar.inputs import (
    MemberCreate,
    MemberUpdate,
)
from polar.literals import (
    MemberRole,
    MemberSortProperty,
)
from polar.outputs import (
    ListResourceMember,
    Member,
)


class MembersSync(SyncServiceBase):
    def list_members(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
        role: MemberRole | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: list[MemberSortProperty] | None = ["-created_at"],
    ) -> ListResourceMember:
        """
        List members with optional customer ID filter.

        **Scopes**: `members:read` `members:write`

        Args:
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            role: Filter by member role.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/",
            path_params={},
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "role": role,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceMember, method_errors)

    def create_member(
        self,
        **kwargs: typing.Unpack[MemberCreate],
    ) -> Member:
        """
        Create a new member for a customer.

        Only B2B customers with the member management feature enabled can add members.
        The authenticated user or organization must have access to the customer's organization.

        **Scopes**: `members:write`

        Args:

        Raises:
            CreateMember403Error: Not permitted to add members.
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/members/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: CreateMember403Error,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    def get_member(
        self,
        id: str,
    ) -> Member:
        """
        Get a member by ID.

        The authenticated user or organization must have access to the member's organization.

        **Scopes**: `members:read` `members:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    def delete_member(
        self,
        id: str,
    ) -> typing.Any:
        """
        Delete a member.

        The authenticated user or organization must have access to the member's organization.

        **Scopes**: `members:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    def update_member(
        self,
        id: str,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member.

        Only name, email and role can be updated.
        The authenticated user or organization must have access to the member's organization.

        **Scopes**: `members:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    def get_member_by_external_id(
        self,
        external_id: str,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> Member:
        """
        Get a member by external ID. One of customer_id or external_customer_id must be specified.

        **Scopes**: `members:read` `members:write`

        Args:
            external_id: The member external ID.
            customer_id: The customer ID.
            external_customer_id: The customer external ID.

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    def delete_member_by_external_id(
        self,
        external_id: str,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> typing.Any:
        """
        Delete a member by external ID. One of customer_id or external_customer_id must be specified.

        **Scopes**: `members:write`

        Args:
            external_id: The member external ID.
            customer_id: The customer ID.
            external_customer_id: The customer external ID.

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/members/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    def update_member_by_external_id(
        self,
        external_id: str,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member by external ID. One of customer_id or external_customer_id must be specified.

        **Scopes**: `members:write`

        Args:
            external_id: The member external ID.
            customer_id: The customer ID.
            external_customer_id: The customer external ID.

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/members/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
            },
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)


class MembersAsync(AsyncServiceBase):
    async def list_members(
        self,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
        role: MemberRole | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: list[MemberSortProperty] | None = ["-created_at"],
    ) -> ListResourceMember:
        """
        List members with optional customer ID filter.

        **Scopes**: `members:read` `members:write`

        Args:
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            role: Filter by member role.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/",
            path_params={},
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "role": role,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceMember, method_errors)

    async def create_member(
        self,
        **kwargs: typing.Unpack[MemberCreate],
    ) -> Member:
        """
        Create a new member for a customer.

        Only B2B customers with the member management feature enabled can add members.
        The authenticated user or organization must have access to the customer's organization.

        **Scopes**: `members:write`

        Args:

        Raises:
            CreateMember403Error: Not permitted to add members.
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/members/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: CreateMember403Error,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    async def get_member(
        self,
        id: str,
    ) -> Member:
        """
        Get a member by ID.

        The authenticated user or organization must have access to the member's organization.

        **Scopes**: `members:read` `members:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    async def delete_member(
        self,
        id: str,
    ) -> typing.Any:
        """
        Delete a member.

        The authenticated user or organization must have access to the member's organization.

        **Scopes**: `members:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    async def update_member(
        self,
        id: str,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member.

        Only name, email and role can be updated.
        The authenticated user or organization must have access to the member's organization.

        **Scopes**: `members:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/members/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    async def get_member_by_external_id(
        self,
        external_id: str,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> Member:
        """
        Get a member by external ID. One of customer_id or external_customer_id must be specified.

        **Scopes**: `members:read` `members:write`

        Args:
            external_id: The member external ID.
            customer_id: The customer ID.
            external_customer_id: The customer external ID.

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/members/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)

    async def delete_member_by_external_id(
        self,
        external_id: str,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
    ) -> typing.Any:
        """
        Delete a member by external ID. One of customer_id or external_customer_id must be specified.

        **Scopes**: `members:write`

        Args:
            external_id: The member external ID.
            customer_id: The customer ID.
            external_customer_id: The customer external ID.

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/members/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    async def update_member_by_external_id(
        self,
        external_id: str,
        *,
        customer_id: str | None = None,
        external_customer_id: str | None = None,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member by external ID. One of customer_id or external_customer_id must be specified.

        **Scopes**: `members:write`

        Args:
            external_id: The member external ID.
            customer_id: The customer ID.
            external_customer_id: The customer external ID.

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/members/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
            },
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, Member, method_errors)
