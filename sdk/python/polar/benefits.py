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
    BenefitCustomCreate,
    BenefitCustomUpdate,
    BenefitDiscordCreate,
    BenefitDiscordUpdate,
    BenefitDownloadablesCreate,
    BenefitDownloadablesUpdate,
    BenefitFeatureFlagCreate,
    BenefitFeatureFlagUpdate,
    BenefitGitHubRepositoryCreate,
    BenefitGitHubRepositoryUpdate,
    BenefitLicenseKeysCreate,
    BenefitLicenseKeysUpdate,
    BenefitMeterCreditCreate,
    BenefitMeterCreditUpdate,
    BenefitSlackSharedChannelCreate,
    BenefitSlackSharedChannelUpdate,
    MetadataQuery,
)
from polar.literals import (
    BenefitSortProperty,
    BenefitType,
)
from polar.outputs import (
    Benefit,
    ListResourceBenefit,
    ListResourceBenefitGrant,
)


class BenefitsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        type: BenefitType | builtins.list[BenefitType] | None = None,
        id: str | builtins.list[str] | None = None,
        exclude_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceBenefit:
        """
        List benefits.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            type: Filter by benefit type.
            id: Filter by benefit IDs.
            exclude_id: Exclude benefits with these IDs.
            query: Filter by description.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "type": type,
                "id": id,
                "exclude_id": exclude_id,
                "query": query,
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
        return parse_response(response, ListResourceBenefit, method_errors)

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitCustomCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitDiscordCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitDownloadablesCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitLicenseKeysCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitMeterCreditCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitFeatureFlagCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelCreate],
    ) -> Benefit: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Create a benefit.

        **Scopes**: `benefits:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/benefits/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Benefit, method_errors)

    def get(
        self,
        id: str,
    ) -> Benefit:
        """
        Get a benefit by ID.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}",
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
        return parse_response(response, Benefit, method_errors)

    def delete(
        self,
        id: str,
    ) -> typing.Any:
        """
        Delete a benefit.

        > [!WARNING]
        > Every grants associated with the benefit will be revoked.
        > Users will lose access to the benefit.

        **Scopes**: `benefits:write`

        Args:
            id: None

        Raises:
            NotPermitted: This benefit is not deletable.
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitCustomUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitDiscordUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitDownloadablesUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitLicenseKeysUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitMeterCreditUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitFeatureFlagUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelUpdate],
    ) -> Benefit: ...

    def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Update a benefit.

        **Scopes**: `benefits:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/benefits/{id}",
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
        return parse_response(response, Benefit, method_errors)

    def grants(
        self,
        id: str,
        *,
        is_granted: bool | None = None,
        customer_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceBenefitGrant:
        """
        List the individual grants for a benefit.

        It's especially useful to check if a user has been granted a benefit.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id: None
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            customer_id: Filter by customer.
            member_id: Filter by member.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}/grants",
            path_params={
                "id": id,
            },
            query_params={
                "is_granted": is_granted,
                "customer_id": customer_id,
                "member_id": member_id,
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceBenefitGrant, method_errors)


class BenefitsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        type: BenefitType | builtins.list[BenefitType] | None = None,
        id: str | builtins.list[str] | None = None,
        exclude_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitSortProperty] | None = ["-created_at"],
        metadata: MetadataQuery = None,
    ) -> ListResourceBenefit:
        """
        List benefits.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            type: Filter by benefit type.
            id: Filter by benefit IDs.
            exclude_id: Exclude benefits with these IDs.
            query: Filter by description.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            metadata: Filter by metadata key-value pairs. It uses the `deepObject` style, e.g. `?metadata[key]=value`.

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "type": type,
                "id": id,
                "exclude_id": exclude_id,
                "query": query,
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
        return parse_response(response, ListResourceBenefit, method_errors)

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitCustomCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitDiscordCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitDownloadablesCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitLicenseKeysCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitMeterCreditCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitFeatureFlagCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelCreate],
    ) -> Benefit: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Create a benefit.

        **Scopes**: `benefits:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/benefits/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response(response, Benefit, method_errors)

    async def get(
        self,
        id: str,
    ) -> Benefit:
        """
        Get a benefit by ID.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}",
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
        return parse_response(response, Benefit, method_errors)

    async def delete(
        self,
        id: str,
    ) -> typing.Any:
        """
        Delete a benefit.

        > [!WARNING]
        > Every grants associated with the benefit will be revoked.
        > Users will lose access to the benefit.

        **Scopes**: `benefits:write`

        Args:
            id: None

        Raises:
            NotPermitted: This benefit is not deletable.
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitCustomUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitDiscordUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitDownloadablesUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitLicenseKeysUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitMeterCreditUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitFeatureFlagUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelUpdate],
    ) -> Benefit: ...

    async def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Update a benefit.

        **Scopes**: `benefits:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/benefits/{id}",
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
        return parse_response(response, Benefit, method_errors)

    async def grants(
        self,
        id: str,
        *,
        is_granted: bool | None = None,
        customer_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceBenefitGrant:
        """
        List the individual grants for a benefit.

        It's especially useful to check if a user has been granted a benefit.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id: None
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            customer_id: Filter by customer.
            member_id: Filter by member.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}/grants",
            path_params={
                "id": id,
            },
            query_params={
                "is_granted": is_granted,
                "customer_id": customer_id,
                "member_id": member_id,
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceBenefitGrant, method_errors)
