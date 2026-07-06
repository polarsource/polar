from __future__ import annotations

import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.errors import (
    AmbiguousExternalCustomerID,
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
)
from polar.inputs import (
    MemberCreateFromCustomer,
    MemberUpdate,
)
from polar.outputs import (
    Member,
)


class MembersSync(SyncServiceBase):
    def create(
        self,
        id: str,
        **kwargs: typing.Unpack[MemberCreateFromCustomer],
    ) -> Member:
        """
        Create a new member for a customer.

        Only B2B customers with the member management feature enabled can add members.
        The authenticated user or organization must have access to the customer's organization.

        **Scopes**: `members:write`

        Args:
            id: The customer ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: Not permitted to add members.
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customers/{id}/members",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    def create_external(
        self,
        external_id_path: str,
        **kwargs: typing.Unpack[MemberCreateFromCustomer],
    ) -> Member:
        """
        Create a new member for a customer identified by its external ID.

        **Scopes**: `members:write`

        Args:
            external_id_path: The customer external ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: Not permitted to add members.
            ResourceNotFound: Customer not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customers/external/{external_id}/members",
            path_params={
                "external_id": external_id_path,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    def get(
        self,
        id: str,
        member_id: str,
    ) -> Member:
        """
        Get a member of a customer by its ID.

        **Scopes**: `members:read` `members:write`

        Args:
            id: The customer ID.
            member_id:

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}/members/{member_id}",
            path_params={
                "id": id,
                "member_id": member_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    def delete(
        self,
        id: str,
        member_id: str,
    ) -> None:
        """
        Delete a member of a customer.

        **Scopes**: `members:write`

        Args:
            id: The customer ID.
            member_id:

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/{id}/members/{member_id}",
            path_params={
                "id": id,
                "member_id": member_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def update(
        self,
        id: str,
        member_id: str,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member of a customer.

        Only name, email and role can be updated.

        **Scopes**: `members:write`

        Args:
            id: The customer ID.
            member_id:
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/{id}/members/{member_id}",
            path_params={
                "id": id,
                "member_id": member_id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    def get_external(
        self,
        external_id: str,
        member_external_id: str,
    ) -> Member:
        """
        Get a member by external ID for a customer identified by its external ID.

        **Scopes**: `members:read` `members:write`

        Args:
            external_id: The customer external ID.
            member_external_id: The member external ID.

        Raises:
            ResourceNotFound: Member not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}/members/{member_external_id}",
            path_params={
                "external_id": external_id,
                "member_external_id": member_external_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    def delete_external(
        self,
        external_id: str,
        member_external_id: str,
    ) -> None:
        """
        Delete a member by external ID for a customer identified by its external ID.

        **Scopes**: `members:write`

        Args:
            external_id: The customer external ID.
            member_external_id: The member external ID.

        Raises:
            ResourceNotFound: Member not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/external/{external_id}/members/{member_external_id}",
            path_params={
                "external_id": external_id,
                "member_external_id": member_external_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def update_external(
        self,
        external_id: str,
        member_external_id: str,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member by external ID for a customer identified by its external ID.

        **Scopes**: `members:write`

        Args:
            external_id: The customer external ID.
            member_external_id: The member external ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Member not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/external/{external_id}/members/{member_external_id}",
            path_params={
                "external_id": external_id,
                "member_external_id": member_external_id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)


class MembersAsync(AsyncServiceBase):
    async def create(
        self,
        id: str,
        **kwargs: typing.Unpack[MemberCreateFromCustomer],
    ) -> Member:
        """
        Create a new member for a customer.

        Only B2B customers with the member management feature enabled can add members.
        The authenticated user or organization must have access to the customer's organization.

        **Scopes**: `members:write`

        Args:
            id: The customer ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: Not permitted to add members.
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customers/{id}/members",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    async def create_external(
        self,
        external_id_path: str,
        **kwargs: typing.Unpack[MemberCreateFromCustomer],
    ) -> Member:
        """
        Create a new member for a customer identified by its external ID.

        **Scopes**: `members:write`

        Args:
            external_id_path: The customer external ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: Not permitted to add members.
            ResourceNotFound: Customer not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customers/external/{external_id}/members",
            path_params={
                "external_id": external_id_path,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    async def get(
        self,
        id: str,
        member_id: str,
    ) -> Member:
        """
        Get a member of a customer by its ID.

        **Scopes**: `members:read` `members:write`

        Args:
            id: The customer ID.
            member_id:

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}/members/{member_id}",
            path_params={
                "id": id,
                "member_id": member_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    async def delete(
        self,
        id: str,
        member_id: str,
    ) -> None:
        """
        Delete a member of a customer.

        **Scopes**: `members:write`

        Args:
            id: The customer ID.
            member_id:

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/{id}/members/{member_id}",
            path_params={
                "id": id,
                "member_id": member_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def update(
        self,
        id: str,
        member_id: str,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member of a customer.

        Only name, email and role can be updated.

        **Scopes**: `members:write`

        Args:
            id: The customer ID.
            member_id:
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Member not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/{id}/members/{member_id}",
            path_params={
                "id": id,
                "member_id": member_id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    async def get_external(
        self,
        external_id: str,
        member_external_id: str,
    ) -> Member:
        """
        Get a member by external ID for a customer identified by its external ID.

        **Scopes**: `members:read` `members:write`

        Args:
            external_id: The customer external ID.
            member_external_id: The member external ID.

        Raises:
            ResourceNotFound: Member not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}/members/{member_external_id}",
            path_params={
                "external_id": external_id,
                "member_external_id": member_external_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)

    async def delete_external(
        self,
        external_id: str,
        member_external_id: str,
    ) -> None:
        """
        Delete a member by external ID for a customer identified by its external ID.

        **Scopes**: `members:write`

        Args:
            external_id: The customer external ID.
            member_external_id: The member external ID.

        Raises:
            ResourceNotFound: Member not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/external/{external_id}/members/{member_external_id}",
            path_params={
                "external_id": external_id,
                "member_external_id": member_external_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def update_external(
        self,
        external_id: str,
        member_external_id: str,
        **kwargs: typing.Unpack[MemberUpdate],
    ) -> Member:
        """
        Update a member by external ID for a customer identified by its external ID.

        **Scopes**: `members:write`

        Args:
            external_id: The customer external ID.
            member_external_id: The member external ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Member not found.
            AmbiguousExternalCustomerID: The external customer ID matches customers in several accessible organizations.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/external/{external_id}/members/{member_external_id}",
            path_params={
                "external_id": external_id,
                "member_external_id": member_external_id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            409: AmbiguousExternalCustomerID,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Member, method_errors)
