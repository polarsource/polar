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
    ResourceNotFound,
)
from polar.inputs import (
    CustomFieldCreateCheckbox,
    CustomFieldCreateDate,
    CustomFieldCreateNumber,
    CustomFieldCreateSelect,
    CustomFieldCreateText,
    CustomFieldUpdateCheckbox,
    CustomFieldUpdateDate,
    CustomFieldUpdateNumber,
    CustomFieldUpdateSelect,
    CustomFieldUpdateText,
)
from polar.literals import (
    CustomFieldSortProperty,
    CustomFieldType,
)
from polar.outputs import (
    CustomField,
    ListResourceCustomField,
)


class CustomFieldsSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        type: CustomFieldType | builtins.list[CustomFieldType] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomFieldSortProperty] | None = ["slug"],
    ) -> ListResourceCustomField:
        """
        List custom fields.

        **Scopes**: `custom_fields:read` `custom_fields:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by custom field name or slug.
            type: Filter by custom field type.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/custom-fields/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "query": query,
                "type": type,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomField, method_errors)

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateText],
    ) -> CustomField: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateNumber],
    ) -> CustomField: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateDate],
    ) -> CustomField: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateCheckbox],
    ) -> CustomField: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateSelect],
    ) -> CustomField: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> CustomField:
        """
        Create a custom field.

        **Scopes**: `custom_fields:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/custom-fields/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomField, method_errors)

    def get(
        self,
        id: str,
    ) -> CustomField:
        """
        Get a custom field by ID.

        **Scopes**: `custom_fields:read` `custom_fields:write`

        Args:
            id: The custom field ID.

        Raises:
            ResourceNotFound: Custom field not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/custom-fields/{id}",
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
        return parse_response_json(response, CustomField, method_errors)

    def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a custom field.

        **Scopes**: `custom_fields:write`

        Args:
            id: The custom field ID.

        Raises:
            ResourceNotFound: Custom field not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/custom-fields/{id}",
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
        return parse_response_none(response, method_errors)

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateText],
    ) -> CustomField: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateNumber],
    ) -> CustomField: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateDate],
    ) -> CustomField: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateCheckbox],
    ) -> CustomField: ...

    @typing.overload
    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateSelect],
    ) -> CustomField: ...

    def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> CustomField:
        """
        Update a custom field.

        **Scopes**: `custom_fields:write`

        Args:
            id: The custom field ID.

        Raises:
            ResourceNotFound: Custom field not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/custom-fields/{id}",
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
        return parse_response_json(response, CustomField, method_errors)


class CustomFieldsAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        query: str | None = None,
        type: CustomFieldType | builtins.list[CustomFieldType] | None = None,
        page: int = 1,
        limit: int = 10,
        sorting: builtins.list[CustomFieldSortProperty] | None = ["slug"],
    ) -> ListResourceCustomField:
        """
        List custom fields.

        **Scopes**: `custom_fields:read` `custom_fields:write`

        Args:
            organization_id: Filter by organization ID.
            query: Filter by custom field name or slug.
            type: Filter by custom field type.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.
            sorting: Sorting criterion. Several criteria can be used simultaneously and will be applied in order. Add a minus sign `-` before the criteria name to sort by descending order.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/custom-fields/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "query": query,
                "type": type,
                "page": page,
                "limit": limit,
                "sorting": sorting,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceCustomField, method_errors)

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateText],
    ) -> CustomField: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateNumber],
    ) -> CustomField: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateDate],
    ) -> CustomField: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateCheckbox],
    ) -> CustomField: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[CustomFieldCreateSelect],
    ) -> CustomField: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> CustomField:
        """
        Create a custom field.

        **Scopes**: `custom_fields:write`

        Args:

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/custom-fields/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, CustomField, method_errors)

    async def get(
        self,
        id: str,
    ) -> CustomField:
        """
        Get a custom field by ID.

        **Scopes**: `custom_fields:read` `custom_fields:write`

        Args:
            id: The custom field ID.

        Raises:
            ResourceNotFound: Custom field not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/custom-fields/{id}",
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
        return parse_response_json(response, CustomField, method_errors)

    async def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a custom field.

        **Scopes**: `custom_fields:write`

        Args:
            id: The custom field ID.

        Raises:
            ResourceNotFound: Custom field not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/custom-fields/{id}",
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
        return parse_response_none(response, method_errors)

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateText],
    ) -> CustomField: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateNumber],
    ) -> CustomField: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateDate],
    ) -> CustomField: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateCheckbox],
    ) -> CustomField: ...

    @typing.overload
    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[CustomFieldUpdateSelect],
    ) -> CustomField: ...

    async def update(
        self,
        id: str,
        **kwargs: typing.Any,
    ) -> CustomField:
        """
        Update a custom field.

        **Scopes**: `custom_fields:write`

        Args:
            id: The custom field ID.

        Raises:
            ResourceNotFound: Custom field not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/custom-fields/{id}",
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
        return parse_response_json(response, CustomField, method_errors)
