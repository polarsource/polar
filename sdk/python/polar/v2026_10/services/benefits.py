from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.v2026_10.errors import (
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
)
from polar.v2026_10.inputs import (
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
from polar.v2026_10.literals import (
    BenefitSortProperty,
    BenefitType,
)
from polar.v2026_10.outputs import (
    Benefit,
    BenefitDownloadableFile,
    BenefitGrant,
    ListResourceBenefit,
    ListResourceBenefitDownloadableFile,
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
        request_timeout: RequestTimeout | None = None,
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
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefit, method_errors)

    def iter_list(
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
        request_timeout: RequestTimeout | None = None,
    ) -> typing.Generator[Benefit, None, None]:
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            A generator that yields items of type Benefit.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                type=type,
                id=id,
                exclude_id=exclude_id,
                query=query,
                page=page,
                limit=limit,
                sorting=sorting,
                metadata=metadata,
                request_timeout=request_timeout,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitCustomCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDiscordCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDownloadablesCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitLicenseKeysCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitMeterCreditCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitFeatureFlagCreate],
    ) -> Benefit: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelCreate],
    ) -> Benefit: ...

    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Create a benefit.

        **Scopes**: `benefits:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/benefits/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Benefit, method_errors)

    def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> Benefit:
        """
        Get a benefit by ID.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Benefit, method_errors)

    def delete(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> None:
        """
        Delete a benefit.

        > [!WARNING]
        > Every grants associated with the benefit will be revoked.
        > Users will lose access to the benefit.

        **Scopes**: `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            NotPermitted: This benefit is not deletable.
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitCustomUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDiscordUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDownloadablesUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitLicenseKeysUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitMeterCreditUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitFeatureFlagUpdate],
    ) -> Benefit: ...

    @typing.overload
    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelUpdate],
    ) -> Benefit: ...

    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Update a benefit.

        **Scopes**: `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Benefit, method_errors)

    def files(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceBenefitDownloadableFile:
        """
        List the downloadable files for a benefit with their download statistics.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}/files",
            path_params={
                "id": id,
            },
            query_params={
                "page": page,
                "limit": limit,
            },
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceBenefitDownloadableFile, method_errors
        )

    def iter_files(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> typing.Generator[BenefitDownloadableFile, None, None]:
        """
        List the downloadable files for a benefit with their download statistics.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            A generator that yields items of type BenefitDownloadableFile.

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.files(
                id=id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def grants(
        self,
        id: str,
        *,
        is_granted: bool | None = None,
        customer_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceBenefitGrant:
        """
        List the individual grants for a benefit.

        It's especially useful to check if a user has been granted a benefit.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            customer_id: Filter by customer.
            member_id: Filter by member.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefitGrant, method_errors)

    def iter_grants(
        self,
        id: str,
        *,
        is_granted: bool | None = None,
        customer_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> typing.Generator[BenefitGrant, None, None]:
        """
        List the individual grants for a benefit.

        It's especially useful to check if a user has been granted a benefit.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            customer_id: Filter by customer.
            member_id: Filter by member.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            A generator that yields items of type BenefitGrant.

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.grants(
                id=id,
                is_granted=is_granted,
                customer_id=customer_id,
                member_id=member_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1


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
        request_timeout: RequestTimeout | None = None,
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
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefit, method_errors)

    async def iter_list(
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
        request_timeout: RequestTimeout | None = None,
    ) -> typing.AsyncGenerator[Benefit, None]:
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
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            An async generator that yields items of type Benefit.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                type=type,
                id=id,
                exclude_id=exclude_id,
                query=query,
                page=page,
                limit=limit,
                sorting=sorting,
                metadata=metadata,
                request_timeout=request_timeout,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitCustomCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDiscordCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDownloadablesCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitLicenseKeysCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitMeterCreditCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitFeatureFlagCreate],
    ) -> Benefit: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelCreate],
    ) -> Benefit: ...

    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Create a benefit.

        **Scopes**: `benefits:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/benefits/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, Benefit, method_errors)

    async def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> Benefit:
        """
        Get a benefit by ID.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Benefit, method_errors)

    async def delete(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> None:
        """
        Delete a benefit.

        > [!WARNING]
        > Every grants associated with the benefit will be revoked.
        > Users will lose access to the benefit.

        **Scopes**: `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            NotPermitted: This benefit is not deletable.
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitCustomUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDiscordUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitGitHubRepositoryUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitDownloadablesUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitLicenseKeysUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitMeterCreditUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitFeatureFlagUpdate],
    ) -> Benefit: ...

    @typing.overload
    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[BenefitSlackSharedChannelUpdate],
    ) -> Benefit: ...

    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Any,
    ) -> Benefit:
        """
        Update a benefit.

        **Scopes**: `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/benefits/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, Benefit, method_errors)

    async def files(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceBenefitDownloadableFile:
        """
        List the downloadable files for a benefit with their download statistics.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefits/{id}/files",
            path_params={
                "id": id,
            },
            query_params={
                "page": page,
                "limit": limit,
            },
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(
            response, ListResourceBenefitDownloadableFile, method_errors
        )

    async def iter_files(
        self,
        id: str,
        *,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> typing.AsyncGenerator[BenefitDownloadableFile, None]:
        """
        List the downloadable files for a benefit with their download statistics.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            An async generator that yields items of type BenefitDownloadableFile.

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.files(
                id=id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def grants(
        self,
        id: str,
        *,
        is_granted: bool | None = None,
        customer_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceBenefitGrant:
        """
        List the individual grants for a benefit.

        It's especially useful to check if a user has been granted a benefit.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            customer_id: Filter by customer.
            member_id: Filter by member.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
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
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefitGrant, method_errors)

    async def iter_grants(
        self,
        id: str,
        *,
        is_granted: bool | None = None,
        customer_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> typing.AsyncGenerator[BenefitGrant, None]:
        """
        List the individual grants for a benefit.

        It's especially useful to check if a user has been granted a benefit.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            id:
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            customer_id: Filter by customer.
            member_id: Filter by member.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            An async generator that yields items of type BenefitGrant.

        Raises:
            ResourceNotFound: Benefit not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.grants(
                id=id,
                is_granted=is_granted,
                customer_id=customer_id,
                member_id=member_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1
