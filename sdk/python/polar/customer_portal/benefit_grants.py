from __future__ import annotations

import builtins
import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
)
from polar.inputs import (
    CustomerBenefitGrantCustomUpdate,
    CustomerBenefitGrantDiscordUpdate,
    CustomerBenefitGrantDownloadablesUpdate,
    CustomerBenefitGrantFeatureFlagUpdate,
    CustomerBenefitGrantGitHubRepositoryUpdate,
    CustomerBenefitGrantLicenseKeysUpdate,
    CustomerBenefitGrantMeterCreditUpdate,
    CustomerBenefitGrantSlackSharedChannelUpdate,
)
from polar.literals import (
    BenefitType,
    CustomerBenefitGrantSortProperty,
)
from polar.outputs import (
    CustomerBenefitGrant,
    ListResourceCustomerBenefitGrant,
)


class BenefitGrantsSync(SyncServiceBase):
    def list(
        self,
        *,
        query: str | None = None,
        type: BenefitType | builtins.list[BenefitType] | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerBenefitGrantSortProperty] | None = [
            "product_benefit",
            "-granted_at",
        ],
    ) -> ListResourceCustomerBenefitGrant:
        """
        List benefits grants of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            query: Filter by benefit description.
            type: Filter by benefit type.
            benefit_id: Filter by benefit ID.
            checkout_id: Filter by checkout ID.
            order_id: Filter by order ID.
            subscription_id: Filter by subscription ID.
            member_id: Filter by member ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/benefit-grants/",
            path_params={},
            query_params={
                "query": query,
                "type": type,
                "benefit_id": benefit_id,
                "checkout_id": checkout_id,
                "order_id": order_id,
                "subscription_id": subscription_id,
                "member_id": member_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceCustomerBenefitGrant, method_errors)

    def get(
        self,
        id: str,
    ) -> CustomerBenefitGrant:
        """
        Get a benefit grant by ID for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The benefit grant ID.

        Raises:
            ResourceNotFound: Benefit grant not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/benefit-grants/{id}",
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
        return parse_response(response, CustomerBenefitGrant, method_errors)

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantDiscordUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantGitHubRepositoryUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantDownloadablesUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantLicenseKeysUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantCustomUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantMeterCreditUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantFeatureFlagUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantSlackSharedChannelUpdate],
    ) -> CustomerBenefitGrant: ...

    def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> CustomerBenefitGrant:
        """
        Update a benefit grant for the authenticated customer.

        **Scopes**: `customer_portal:write`

        Args:
            id: The benefit grant ID.

        Raises:
            NotPermitted: The benefit grant is revoked and cannot be updated.
            ResourceNotFound: Benefit grant not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/benefit-grants/{id}",
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
        return parse_response(response, CustomerBenefitGrant, method_errors)


class BenefitGrantsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        query: str | None = None,
        type: BenefitType | builtins.list[BenefitType] | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        checkout_id: str | builtins.list[str] | None = None,
        order_id: str | builtins.list[str] | None = None,
        subscription_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomerBenefitGrantSortProperty] | None = [
            "product_benefit",
            "-granted_at",
        ],
    ) -> ListResourceCustomerBenefitGrant:
        """
        List benefits grants of the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            query: Filter by benefit description.
            type: Filter by benefit type.
            benefit_id: Filter by benefit ID.
            checkout_id: Filter by checkout ID.
            order_id: Filter by order ID.
            subscription_id: Filter by subscription ID.
            member_id: Filter by member ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/benefit-grants/",
            path_params={},
            query_params={
                "query": query,
                "type": type,
                "benefit_id": benefit_id,
                "checkout_id": checkout_id,
                "order_id": order_id,
                "subscription_id": subscription_id,
                "member_id": member_id,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceCustomerBenefitGrant, method_errors)

    async def get(
        self,
        id: str,
    ) -> CustomerBenefitGrant:
        """
        Get a benefit grant by ID for the authenticated customer.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: The benefit grant ID.

        Raises:
            ResourceNotFound: Benefit grant not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/benefit-grants/{id}",
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
        return parse_response(response, CustomerBenefitGrant, method_errors)

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantDiscordUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantGitHubRepositoryUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantDownloadablesUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantLicenseKeysUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantCustomUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantMeterCreditUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantFeatureFlagUpdate],
    ) -> CustomerBenefitGrant: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomerBenefitGrantSlackSharedChannelUpdate],
    ) -> CustomerBenefitGrant: ...

    async def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> CustomerBenefitGrant:
        """
        Update a benefit grant for the authenticated customer.

        **Scopes**: `customer_portal:write`

        Args:
            id: The benefit grant ID.

        Raises:
            NotPermitted: The benefit grant is revoked and cannot be updated.
            ResourceNotFound: Benefit grant not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/customer-portal/benefit-grants/{id}",
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
        return parse_response(response, CustomerBenefitGrant, method_errors)
