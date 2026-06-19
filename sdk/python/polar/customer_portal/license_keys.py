from __future__ import annotations

import typing

from polar.base import AsyncServiceBase, SyncServiceBase, parse_response
from polar.errors import (
    HTTPValidationError,
    NotPermitted,
    ResourceNotFound,
    Unauthorized,
)
from polar.inputs import (
    LicenseKeyActivate,
    LicenseKeyDeactivate,
    LicenseKeyValidate,
)
from polar.outputs import (
    LicenseKeyActivationRead,
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
    ) -> ListResourceLicenseKeyRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by a specific benefit
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
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
        )
        response = self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceLicenseKeyRead, method_errors)

    def get(
        self,
        id: str,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/license-keys/{id}",
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
        return parse_response(response, LicenseKeyWithActivations, method_errors)

    def validate(
        self,
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/validate`
        > endpoint instead.

        Args:

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/validate",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, ValidatedLicenseKey, method_errors)

    def activate(
        self,
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/activate`
        > endpoint instead.

        Args:

        Raises:
            NotPermitted: License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/activate",
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
        return parse_response(response, LicenseKeyActivationRead, method_errors)

    def deactivate(
        self,
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> typing.Any:
        """
        Deactivate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/deactivate`
        > endpoint instead.

        Args:

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/deactivate",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)


class LicenseKeysAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        benefit_id: str | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceLicenseKeyRead:
        """
        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            benefit_id: Filter by a specific benefit
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            Unauthorized: Not authorized to manage license key.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
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
        )
        response = await self.client.send_request(request)
        method_errors = {
            401: Unauthorized,
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, ListResourceLicenseKeyRead, method_errors)

    async def get(
        self,
        id: str,
    ) -> LicenseKeyWithActivations:
        """
        Get a license key.

        **Scopes**: `customer_portal:read` `customer_portal:write`

        Args:
            id: None

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/customer-portal/license-keys/{id}",
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
        return parse_response(response, LicenseKeyWithActivations, method_errors)

    async def validate(
        self,
        **kwargs: typing.Unpack[LicenseKeyValidate],
    ) -> ValidatedLicenseKey:
        """
        Validate a license key.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/validate`
        > endpoint instead.

        Args:

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/validate",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, ValidatedLicenseKey, method_errors)

    async def activate(
        self,
        **kwargs: typing.Unpack[LicenseKeyActivate],
    ) -> LicenseKeyActivationRead:
        """
        Activate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/activate`
        > endpoint instead.

        Args:

        Raises:
            NotPermitted: License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/activate",
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
        return parse_response(response, LicenseKeyActivationRead, method_errors)

    async def deactivate(
        self,
        **kwargs: typing.Unpack[LicenseKeyDeactivate],
    ) -> typing.Any:
        """
        Deactivate a license key instance.

        > This endpoint doesn't require authentication and can be safely used on a public
        > client, like a desktop application or a mobile app.
        > If you plan to validate a license key on a server, use the `/v1/license-keys/deactivate`
        > endpoint instead.

        Args:

        Raises:
            ResourceNotFound: License key not found.
            HTTPValidationError: Validation Error
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/customer-portal/license-keys/deactivate",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            404: ResourceNotFound,
            422: HTTPValidationError,
        }
        return parse_response(response, typing.Any, method_errors)
