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
from polar.v2026_04.errors import (
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
    RotateNotPermitted,
    Unauthorized,
)
from polar.v2026_04.inputs import (
    LicenseKeyActivate,
    LicenseKeyDeactivate,
    LicenseKeyUpdate,
    LicenseKeyValidate,
)
from polar.v2026_04.literals import (
    LicenseKeyStatus,
)
from polar.v2026_04.outputs import (
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
        organization_id: str | builtins.list[str] | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        status: LicenseKeyStatus | builtins.list[LicenseKeyStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceLicenseKeyRead:
        """
        Get license keys connected to the given organization & filters.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            organization_id: Filter by organization ID.
            benefit_id: Filter by benefit ID.
            status: Filter by license key status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


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
            url="/v1/license-keys/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "benefit_id": benefit_id,
                "status": status,
                "page": page,
                "limit": limit,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        organization_id: str | builtins.list[str] | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        status: LicenseKeyStatus | builtins.list[LicenseKeyStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.Generator[LicenseKeyRead, None, None]:
        """
        Get license keys connected to the given organization & filters.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            organization_id: Filter by organization ID.
            benefit_id: Filter by benefit ID.
            status: Filter by license key status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


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
                organization_id=organization_id,
                benefit_id=benefit_id,
                status=status,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
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
        request_access_token: str | None = None,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


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
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyWithActivations, method_errors)

    def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyUpdate],
    ) -> LicenseKeyRead:
        """
        Update a license key.

        **Scopes**: `license_keys:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyRead, method_errors)

    def rotate(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> LicenseKeyRead:
        """
        Rotate a license key.

        Generates a new key string for the same license key record. The previous
        key string immediately stops validating. Status, usage, limits, expiry,
        and activations are preserved.

        **Scopes**: `license_keys:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            RotateNotPermitted: License key cannot be rotated in its current status. Allowed statuses: disabled, granted.
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/{id}/rotate",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            400: RotateNotPermitted,
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyRead, method_errors)

    def get_activation(
        self,
        id: str,
        activation_id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> LicenseKeyActivationRead:
        """
        Get a license key activation.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:
            activation_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


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
            url="/v1/license-keys/{id}/activations/{activation_id}",
            path_params={
                "id": id,
                "activation_id": activation_id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyActivationRead, method_errors)

    def validate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        **Scopes**: `license_keys:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

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
            url="/v1/license-keys/validate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

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
            url="/v1/license-keys/activate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> None:
        """
        Deactivate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

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
            url="/v1/license-keys/deactivate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        organization_id: str | builtins.list[str] | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        status: LicenseKeyStatus | builtins.list[LicenseKeyStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> ListResourceLicenseKeyRead:
        """
        Get license keys connected to the given organization & filters.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            organization_id: Filter by organization ID.
            benefit_id: Filter by benefit ID.
            status: Filter by license key status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


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
            url="/v1/license-keys/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "benefit_id": benefit_id,
                "status": status,
                "page": page,
                "limit": limit,
            },
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        organization_id: str | builtins.list[str] | None = None,
        benefit_id: str | builtins.list[str] | None = None,
        status: LicenseKeyStatus | builtins.list[LicenseKeyStatus] | None = None,
        page: int = 1,
        limit: int = 10,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> typing.AsyncGenerator[LicenseKeyRead, None]:
        """
        Get license keys connected to the given organization & filters.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            organization_id: Filter by organization ID.
            benefit_id: Filter by benefit ID.
            status: Filter by license key status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            request_timeout: Timeout override for each request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for each request.


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
                organization_id=organization_id,
                benefit_id=benefit_id,
                status=status,
                page=page,
                limit=limit,
                request_timeout=request_timeout,
                request_access_token=request_access_token,
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
        request_access_token: str | None = None,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


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
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyWithActivations, method_errors)

    async def update(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyUpdate],
    ) -> LicenseKeyRead:
        """
        Update a license key.

        **Scopes**: `license_keys:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

            **kwargs: Request body parameters

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyRead, method_errors)

    async def rotate(
        self,
        id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> LicenseKeyRead:
        """
        Rotate a license key.

        Generates a new key string for the same license key record. The previous
        key string immediately stops validating. Status, usage, limits, expiry,
        and activations are preserved.

        **Scopes**: `license_keys:write`

        Args:
            id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


        Raises:
            RotateNotPermitted: License key cannot be rotated in its current status. Allowed statuses: disabled, granted.
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarRateLimitError: Raised when the rate limit is exceeded.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/{id}/rotate",
            path_params={
                "id": id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            400: RotateNotPermitted,
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyRead, method_errors)

    async def get_activation(
        self,
        id: str,
        activation_id: str,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
    ) -> LicenseKeyActivationRead:
        """
        Get a license key activation.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:
            activation_id:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.


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
            url="/v1/license-keys/{id}/activations/{activation_id}",
            path_params={
                "id": id,
                "activation_id": activation_id,
            },
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyActivationRead, method_errors)

    async def validate(
        self,
        *,
        request_timeout: RequestTimeout | None = None,
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        **Scopes**: `license_keys:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

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
            url="/v1/license-keys/validate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

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
            url="/v1/license-keys/activate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
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
        request_access_token: str | None = None,
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> None:
        """
        Deactivate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            request_timeout: Timeout override for this request, in seconds or as an httpx.Timeout instance.
            request_access_token: Access token override for this request.

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
            url="/v1/license-keys/deactivate",
            path_params={},
            query_params={},
            request_timeout=request_timeout,
            request_access_token=request_access_token,
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)
