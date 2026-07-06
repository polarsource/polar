from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
    parse_response_text,
)
from polar.errors import (
    HTTPValidationError,
    ResourceNotFound,
)
from polar.inputs import (
    CustomerIndividualCreate,
    CustomerTeamCreate,
    CustomerUpdate,
    CustomerUpdateExternalID,
    MetadataQuery,
)
from polar.literals import (
    CustomerSortProperty,
)
from polar.outputs import (
    Customer,
    CustomerState,
    ListResourceCustomer,
    ListResourcePaymentMethod,
    PaymentMethod,
)

from .members import MembersAsync, MembersSync


class CustomersSync(SyncServiceBase):
    members: MembersSync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.members = MembersSync.from_service(self)

    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        email: str | None = None,
        query: str | None = None,
        active: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceCustomer:
        """
        List customers.

        **Scopes**: `customers:read` `customers:write`

        Args:
            organization_id: Filter by organization ID.
            email: Filter by exact email.
            query: Filter by name, email, or external ID.
            active: Filter by active customers, i.e. customers with at least one trialing, active or past_due subscription.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "email": email,
                "query": query,
                "active": active,
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomer, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        email: str | None = None,
        query: str | None = None,
        active: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> typing.Generator[Customer, None, None]:
        """
        List customers.

        **Scopes**: `customers:read` `customers:write`

        Args:
            organization_id: Filter by organization ID.
            email: Filter by exact email.
            query: Filter by name, email, or external ID.
            active: Filter by active customers, i.e. customers with at least one trialing, active or past_due subscription.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Returns:
            A generator that yields items of type Customer.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                email=email,
                query=query,
                active=active,
                page=page,
                limit=limit,
                sorting=sorting,
                metadata=metadata,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CustomerIndividualCreate],
    ) -> Customer: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CustomerTeamCreate],
    ) -> Customer: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> Customer:
        """
        Create a customer.

        **Scopes**: `customers:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customers/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Customer, method_errors)

    def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
    ) -> str:
        """
        Export customers as a CSV file.

        **Scopes**: `customers:read` `customers:write`

        Args:
            organization_id: Filter by organization ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_text(response, method_errors)

    def get(
        self,
        id: str,
    ) -> Customer:
        """
        Get a customer by ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}",
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
        return parse_response_json(response, Customer, method_errors)

    def delete(
        self,
        id: str,
        *,
        anonymize: bool = False,
    ) -> None:
        """
        Delete a customer.

        This action cannot be undone and will immediately:
        - Cancel any active subscriptions for the customer
        - Revoke all their benefits
        - Clear any `external_id`

        Use it only in the context of deleting a user within your
        own service. Otherwise, use more granular API endpoints to cancel
        a specific subscription or revoke certain benefits.

        Note: The customers information will nonetheless be retained for historic
        orders and subscriptions.

        Set `anonymize=true` to also anonymize PII for GDPR compliance.

        **Scopes**: `customers:write`

        Args:
            id: The customer ID.
            anonymize: If true, also anonymize the customer's personal data for GDPR compliance. This replaces email with a hashed version, hashes name and billing name (name preserved for businesses with tax_id), clears billing address, and removes OAuth account data.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/{id}",
            path_params={
                "id": id,
            },
            query_params={
                "anonymize": anonymize,
            },
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
        **kwargs: typing.Unpack[CustomerUpdate],
    ) -> Customer:
        """
        Update a customer.

        **Scopes**: `customers:write`

        Args:
            id: The customer ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/{id}",
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
        return parse_response_json(response, Customer, method_errors)

    def get_external(
        self,
        external_id: str,
    ) -> Customer:
        """
        Get a customer by external ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Customer, method_errors)

    def delete_external(
        self,
        external_id: str,
        *,
        anonymize: bool = False,
    ) -> None:
        """
        Delete a customer by external ID.

        Immediately cancels any active subscriptions and revokes any active benefits.

        Set `anonymize=true` to also anonymize PII for GDPR compliance.

        **Scopes**: `customers:write`

        Args:
            external_id: The customer external ID.
            anonymize: If true, also anonymize the customer's personal data for GDPR compliance.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "anonymize": anonymize,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    def update_external(
        self,
        external_id: str,
        **kwargs: typing.Unpack[CustomerUpdateExternalID],
    ) -> Customer:
        """
        Update a customer by external ID.

        **Scopes**: `customers:write`

        Args:
            external_id: The customer external ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Customer, method_errors)

    def get_state(
        self,
        id: str,
    ) -> CustomerState:
        """
        Get a customer state by ID.

        The customer state includes information about
        the customer's active subscriptions and benefits.

        It's the ideal endpoint to use when you need to get a full overview
        of a customer's status.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}/state",
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
        return parse_response_json(response, CustomerState, method_errors)

    def get_state_external(
        self,
        external_id: str,
    ) -> CustomerState:
        """
        Get a customer state by external ID.

        The customer state includes information about
        the customer's active subscriptions and benefits.

        It's the ideal endpoint to use when you need to get a full overview
        of a customer's status.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}/state",
            path_params={
                "external_id": external_id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerState, method_errors)

    def list_payment_methods(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourcePaymentMethod:
        """
        Get saved payment methods of a customer.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}/payment-methods",
            path_params={
                "id": id,
            },
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourcePaymentMethod, method_errors)

    def iter_list_payment_methods(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[PaymentMethod, None, None]:
        """
        Get saved payment methods of a customer.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type PaymentMethod.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_payment_methods(
                id=id,
                page=page,
                limit=limit,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def list_payment_methods_external(
        self,
        external_id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourcePaymentMethod:
        """
        Get saved payment methods of a customer by external ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}/payment-methods",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourcePaymentMethod, method_errors)

    def iter_list_payment_methods_external(
        self,
        external_id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[PaymentMethod, None, None]:
        """
        Get saved payment methods of a customer by external ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type PaymentMethod.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list_payment_methods_external(
                external_id=external_id,
                page=page,
                limit=limit,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1


class CustomersAsync(AsyncServiceBase):
    members: MembersAsync

    def __init__(self, *args: typing.Any, **kwargs: typing.Any) -> None:
        super().__init__(*args, **kwargs)
        self.members = MembersAsync.from_service(self)

    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        email: str | None = None,
        query: str | None = None,
        active: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceCustomer:
        """
        List customers.

        **Scopes**: `customers:read` `customers:write`

        Args:
            organization_id: Filter by organization ID.
            email: Filter by exact email.
            query: Filter by name, email, or external ID.
            active: Filter by active customers, i.e. customers with at least one trialing, active or past_due subscription.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "email": email,
                "query": query,
                "active": active,
                "page": page,
                "limit": limit,
                "sorting": sorting,
                "metadata": metadata,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomer, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        email: str | None = None,
        query: str | None = None,
        active: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> typing.AsyncGenerator[Customer, None]:
        """
        List customers.

        **Scopes**: `customers:read` `customers:write`

        Args:
            organization_id: Filter by organization ID.
            email: Filter by exact email.
            query: Filter by name, email, or external ID.
            active: Filter by active customers, i.e. customers with at least one trialing, active or past_due subscription.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Returns:
            An async generator that yields items of type Customer.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                email=email,
                query=query,
                active=active,
                page=page,
                limit=limit,
                sorting=sorting,
                metadata=metadata,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CustomerIndividualCreate],
    ) -> Customer: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CustomerTeamCreate],
    ) -> Customer: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> Customer:
        """
        Create a customer.

        **Scopes**: `customers:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customers/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Customer, method_errors)

    async def export(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
    ) -> str:
        """
        Export customers as a CSV file.

        **Scopes**: `customers:read` `customers:write`

        Args:
            organization_id: Filter by organization ID.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/export",
            path_params={},
            query_params={
                "organization_id": organization_id,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_text(response, method_errors)

    async def get(
        self,
        id: str,
    ) -> Customer:
        """
        Get a customer by ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}",
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
        return parse_response_json(response, Customer, method_errors)

    async def delete(
        self,
        id: str,
        *,
        anonymize: bool = False,
    ) -> None:
        """
        Delete a customer.

        This action cannot be undone and will immediately:
        - Cancel any active subscriptions for the customer
        - Revoke all their benefits
        - Clear any `external_id`

        Use it only in the context of deleting a user within your
        own service. Otherwise, use more granular API endpoints to cancel
        a specific subscription or revoke certain benefits.

        Note: The customers information will nonetheless be retained for historic
        orders and subscriptions.

        Set `anonymize=true` to also anonymize PII for GDPR compliance.

        **Scopes**: `customers:write`

        Args:
            id: The customer ID.
            anonymize: If true, also anonymize the customer's personal data for GDPR compliance. This replaces email with a hashed version, hashes name and billing name (name preserved for businesses with tax_id), clears billing address, and removes OAuth account data.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/{id}",
            path_params={
                "id": id,
            },
            query_params={
                "anonymize": anonymize,
            },
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
        **kwargs: typing.Unpack[CustomerUpdate],
    ) -> Customer:
        """
        Update a customer.

        **Scopes**: `customers:write`

        Args:
            id: The customer ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/{id}",
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
        return parse_response_json(response, Customer, method_errors)

    async def get_external(
        self,
        external_id: str,
    ) -> Customer:
        """
        Get a customer by external ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Customer, method_errors)

    async def delete_external(
        self,
        external_id: str,
        *,
        anonymize: bool = False,
    ) -> None:
        """
        Delete a customer by external ID.

        Immediately cancels any active subscriptions and revokes any active benefits.

        Set `anonymize=true` to also anonymize PII for GDPR compliance.

        **Scopes**: `customers:write`

        Args:
            external_id: The customer external ID.
            anonymize: If true, also anonymize the customer's personal data for GDPR compliance.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/customers/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "anonymize": anonymize,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    async def update_external(
        self,
        external_id: str,
        **kwargs: typing.Unpack[CustomerUpdateExternalID],
    ) -> Customer:
        """
        Update a customer by external ID.

        **Scopes**: `customers:write`

        Args:
            external_id: The customer external ID.
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customers/external/{external_id}",
            path_params={
                "external_id": external_id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Customer, method_errors)

    async def get_state(
        self,
        id: str,
    ) -> CustomerState:
        """
        Get a customer state by ID.

        The customer state includes information about
        the customer's active subscriptions and benefits.

        It's the ideal endpoint to use when you need to get a full overview
        of a customer's status.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}/state",
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
        return parse_response_json(response, CustomerState, method_errors)

    async def get_state_external(
        self,
        external_id: str,
    ) -> CustomerState:
        """
        Get a customer state by external ID.

        The customer state includes information about
        the customer's active subscriptions and benefits.

        It's the ideal endpoint to use when you need to get a full overview
        of a customer's status.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}/state",
            path_params={
                "external_id": external_id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomerState, method_errors)

    async def list_payment_methods(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourcePaymentMethod:
        """
        Get saved payment methods of a customer.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/{id}/payment-methods",
            path_params={
                "id": id,
            },
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourcePaymentMethod, method_errors)

    async def iter_list_payment_methods(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[PaymentMethod, None]:
        """
        Get saved payment methods of a customer.

        **Scopes**: `customers:read` `customers:write`

        Args:
            id: The customer ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type PaymentMethod.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_payment_methods(
                id=id,
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def list_payment_methods_external(
        self,
        external_id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourcePaymentMethod:
        """
        Get saved payment methods of a customer by external ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customers/external/{external_id}/payment-methods",
            path_params={
                "external_id": external_id,
            },
            query_params={
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourcePaymentMethod, method_errors)

    async def iter_list_payment_methods_external(
        self,
        external_id: str,
        *,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[PaymentMethod, None]:
        """
        Get saved payment methods of a customer by external ID.

        **Scopes**: `customers:read` `customers:write`

        Args:
            external_id: The customer external ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type PaymentMethod.

        Raises:
            ResourceNotFound: Customer not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list_payment_methods_external(
                external_id=external_id,
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1
