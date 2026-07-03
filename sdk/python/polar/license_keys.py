from __future__ import annotations

import builtins
import typing

from polar.base import (
    AsyncServiceBase,
    SyncServiceBase,
    parse_response_json,
    parse_response_none,
)
from polar.errors import (
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
    Unauthorized,
)
from polar.inputs import (
    LicenseKeyActivate,
    LicenseKeyDeactivate,
    LicenseKeyUpdate,
    LicenseKeyValidate,
)
from polar.literals import (
    LicenseKeyStatus,
)
from polar.outputs import (
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

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
    ) -> typing.Generator[LicenseKeyRead]:
        """
        Get license keys connected to the given organization & filters.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            organization_id: Filter by organization ID.
            benefit_id: Filter by benefit ID.
            status: Filter by license key status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type LicenseKeyRead.

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                benefit_id=benefit_id,
                status=status,
                page=page,
                limit=limit,
            )
            yield from response.items
            if page == response.pagination.max_page:
                break
            page += 1

    def get(
        self,
        id: str,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
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
        **kwargs: typing.Unpack[LicenseKeyUpdate],
    ) -> LicenseKeyRead:
        """
        Update a license key.

        **Scopes**: `license_keys:write`

        Args:
            id:
            **kwargs: Request body parameters

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyRead, method_errors)

    def get_activation(
        self,
        id: str,
        activation_id: str,
    ) -> LicenseKeyActivationRead:
        """
        Get a license key activation.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:
            activation_id:

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        **Scopes**: `license_keys:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/validate",
            path_params={},
            query_params={},
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
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            NotPermitted: License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/activate",
            path_params={},
            query_params={},
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
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> None:
        """
        Deactivate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/deactivate",
            path_params={},
            query_params={},
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

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
    ) -> typing.AsyncGenerator[LicenseKeyRead]:
        """
        Get license keys connected to the given organization & filters.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            organization_id: Filter by organization ID.
            benefit_id: Filter by benefit ID.
            status: Filter by license key status.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type LicenseKeyRead.

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                benefit_id=benefit_id,
                status=status,
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page == response.pagination.max_page:
                break
            page += 1

    async def get(
        self,
        id: str,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
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
        **kwargs: typing.Unpack[LicenseKeyUpdate],
    ) -> LicenseKeyRead:
        """
        Update a license key.

        **Scopes**: `license_keys:write`

        Args:
            id:
            **kwargs: Request body parameters

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/license-keys/{id}",
            path_params={
                "id": id,
            },
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_json(response, LicenseKeyRead, method_errors)

    async def get_activation(
        self,
        id: str,
        activation_id: str,
    ) -> LicenseKeyActivationRead:
        """
        Get a license key activation.

        **Scopes**: `license_keys:read` `license_keys:write`

        Args:
            id:
            activation_id:

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
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
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        **Scopes**: `license_keys:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/validate",
            path_params={},
            query_params={},
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
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            NotPermitted: License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/activate",
            path_params={},
            query_params={},
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
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> None:
        """
        Deactivate a license key instance.

        **Scopes**: `license_keys:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/license-keys/deactivate",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response_none(response, method_errors)
