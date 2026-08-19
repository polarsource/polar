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
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
    Unauthorized,
)
from polar.v2026_10.inputs import (
    LicenseKeyActivate,
    LicenseKeyDeactivate,
    LicenseKeyValidate,
)
from polar.v2026_10.outputs import (
    LicenseKeyActivationRead,
    LicenseKeyRead,
    LicenseKeyWithActivations,
    ListResourceLicenseKeyRead,
    ValidatedLicenseKey,
)


class LicenseKeysSync(SyncServiceBase):
    def list(
        self,
        *,
        benefit_id: str | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceLicenseKeyRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by a specific benefit
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/license-keys/",
            path_params={},
            query_params={
                "benefit_id": benefit_id,
                "page": page,
                "limit": limit,
            },
            request_timeout=request_timeout,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceLicenseKeyRead, method_errors)

    def iter_list(
        self,
        *,
        benefit_id: str | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> typing.Generator[LicenseKeyRead, None, None]:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by a specific benefit
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            A generator that yields items of type LicenseKeyRead.

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                benefit_id=benefit_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/license-keys/{id}",
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
        return parse_response_json(response, LicenseKeyWithActivations, method_errors)

    def validate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/validate`
        > endpoint instead.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/validate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ValidatedLicenseKey, method_errors)

    def activate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/activate`
        > endpoint instead.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            NotPermitted: License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/activate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyActivationRead, method_errors)

    def deactivate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> None:
        """
        Deactivate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/deactivate`
        > endpoint instead.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/deactivate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)


class LicenseKeysAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        benefit_id: str | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> ListResourceLicenseKeyRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by a specific benefit
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/license-keys/",
            path_params={},
            query_params={
                "benefit_id": benefit_id,
                "page": page,
                "limit": limit,
            },
            request_timeout=request_timeout,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceLicenseKeyRead, method_errors)

    async def iter_list(
        self,
        *,
        benefit_id: str | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
    ) -> typing.AsyncGenerator[LicenseKeyRead, None]:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by a specific benefit
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.


        Returns:
            An async generator that yields items of type LicenseKeyRead.

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                benefit_id=benefit_id,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.


        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/license-keys/{id}",
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
        return parse_response_json(response, LicenseKeyWithActivations, method_errors)

    async def validate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/validate`
        > endpoint instead.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/validate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, ValidatedLicenseKey, method_errors)

    async def activate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/activate`
        > endpoint instead.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            NotPermitted: License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/activate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            403: NotPermitted,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyActivationRead, method_errors)

    async def deactivate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> None:
        """
        Deactivate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/deactivate`
        > endpoint instead.

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.

            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/deactivate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)
