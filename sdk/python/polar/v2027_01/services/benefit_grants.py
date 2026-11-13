from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    RequestTimeout,
    SyncServiceBase,
    parse_response_json,
)
from polar.v2027_01.errors import (
    BenefitGrantAlreadyExists,
    HTTPValidationError,
    ResourceNotFound,
)
from polar.v2027_01.inputs import (
    BenefitGrantCreate,
    BenefitGrantCreateExternal,
)
from polar.v2027_01.literals import (
    BenefitGrantSortProperty,
)
from polar.v2027_01.outputs import (
    BenefitGrant,
    ListResourceBenefitGrant,
)


class BenefitGrantsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        external_benefit_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        external_member_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceBenefitGrant:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            external_benefit_id: Filter by benefit external ID.
            member_id: Filter by member ID.
            external_member_id: Filter by member external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefit-grants/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "external_benefit_id": external_benefit_id,
                "member_id": member_id,
                "external_member_id": external_member_id,
                "is_granted": is_granted,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefitGrant, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        external_benefit_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        external_member_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[BenefitGrant, None, None]:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            external_benefit_id: Filter by benefit external ID.
            member_id: Filter by member ID.
            external_member_id: Filter by member external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            A generator that yields items of type BenefitGrant.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                external_benefit_id=external_benefit_id,
                member_id=member_id,
                external_member_id=external_member_id,
                is_granted=is_granted,
                page=page,
                limit=limit,
                sorting=sorting,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
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
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[BenefitGrantCreate],
    ) -> BenefitGrant: ...

    @typing.overload
    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[BenefitGrantCreateExternal],
    ) -> BenefitGrant: ...

    def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Any,
    ) -> BenefitGrant:
        """
        Manually grant a benefit to a customer or one of their members.

        Use either Polar IDs for every reference or external IDs for every reference.
        Fulfillment is asynchronous: the returned grant may not yet be granted.
        Meter-credit benefits cannot be granted manually.

        **Scopes**: `benefits:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            BenefitGrantAlreadyExists: Conflict
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/benefit-grants/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            409: BenefitGrantAlreadyExists,
            422: HTTPValidationError,
        }
        return parse_response_json(response, BenefitGrant, method_errors)

    def revoke(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> BenefitGrant:
        """
        Permanently revoke a benefit grant, including grants from purchases.

        Revocation is asynchronous. Once manually revoked, this grant cannot be
        reactivated by renewal or fulfillment retries. Other grants may still
        provide access to the benefit. Repeating this request is safe.

        **Scopes**: `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Not Found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/benefit-grants/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, BenefitGrant, method_errors)


class BenefitGrantsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        external_benefit_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        external_member_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceBenefitGrant:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            external_benefit_id: Filter by benefit external ID.
            member_id: Filter by member ID.
            external_member_id: Filter by member external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/benefit-grants/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "customer_id": customer_id,
                "external_customer_id": external_customer_id,
                "external_benefit_id": external_benefit_id,
                "member_id": member_id,
                "external_member_id": external_member_id,
                "is_granted": is_granted,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceBenefitGrant, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        customer_id: str | builtins.list[str] | None = None,
        external_customer_id: str | builtins.list[str] | None = None,
        external_benefit_id: str | builtins.list[str] | None = None,
        member_id: str | builtins.list[str] | None = None,
        external_member_id: str | builtins.list[str] | None = None,
        is_granted: bool | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[BenefitGrantSortProperty] | None = ["-created_at"],
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[BenefitGrant, None]:
        """
        List benefit grants across all benefits accessible to the authenticated subject.

        **Scopes**: `benefits:read` `benefits:write`

        Args:
            organization_id: Filter by organization ID.
            customer_id: Filter by customer ID.
            external_customer_id: Filter by customer external ID.
            external_benefit_id: Filter by benefit external ID.
            member_id: Filter by member ID.
            external_member_id: Filter by member external ID.
            is_granted: Filter by granted status. If `true`, only granted benefits will be returned. If `false`, only revoked benefits will be returned.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


        Returns:
            An async generator that yields items of type BenefitGrant.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                customer_id=customer_id,
                external_customer_id=external_customer_id,
                external_benefit_id=external_benefit_id,
                member_id=member_id,
                external_member_id=external_member_id,
                is_granted=is_granted,
                page=page,
                limit=limit,
                sorting=sorting,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
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
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[BenefitGrantCreate],
    ) -> BenefitGrant: ...

    @typing.overload
    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[BenefitGrantCreateExternal],
    ) -> BenefitGrant: ...

    async def create(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Any,
    ) -> BenefitGrant:
        """
        Manually grant a benefit to a customer or one of their members.

        Use either Polar IDs for every reference or external IDs for every reference.
        Fulfillment is asynchronous: the returned grant may not yet be granted.
        Meter-credit benefits cannot be granted manually.

        **Scopes**: `benefits:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            BenefitGrantAlreadyExists: Conflict
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/benefit-grants/",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            409: BenefitGrantAlreadyExists,
            422: HTTPValidationError,
        }
        return parse_response_json(response, BenefitGrant, method_errors)

    async def revoke(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> BenefitGrant:
        """
        Permanently revoke a benefit grant, including grants from purchases.

        Revocation is asynchronous. Once manually revoked, this grant cannot be
        reactivated by renewal or fulfillment retries. Other grants may still
        provide access to the benefit. Repeating this request is safe.

        **Scopes**: `benefits:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            ResourceNotFound: Not Found
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/benefit-grants/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, BenefitGrant, method_errors)
