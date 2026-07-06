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
)
from polar.inputs import (
    DownloadableFileCreate,
    FilePatch,
    FileUploadCompleted,
    OrganizationAvatarFileCreate,
    ProductMediaFileCreate,
    SupportCaseAttachmentFileCreate,
)
from polar.outputs import (
    FileRead,
    FileUpload,
    ListResourceFileRead,
)


class FilesSync(SyncServiceBase):
    def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        ids: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceFileRead:
        """
        List files.

        **Scopes**: `files:read` `files:write`

        Args:
            organization_id: Filter by organization ID.
            ids: Filter by file ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/files/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "ids": ids,
                "page": page,
                "limit": limit,
            },
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceFileRead, method_errors)

    def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        ids: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.Generator[FileRead]:
        """
        List files.

        **Scopes**: `files:read` `files:write`

        Args:
            organization_id: Filter by organization ID.
            ids: Filter by file ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            A generator that yields items of type FileRead.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = self.list(
                organization_id=organization_id,
                ids=ids,
                page=page,
                limit=limit,
            )
            yield from response.items
            if page >= response.pagination.max_page:
                break
            page += 1

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[DownloadableFileCreate],
    ) -> FileUpload: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[ProductMediaFileCreate],
    ) -> FileUpload: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[OrganizationAvatarFileCreate],
    ) -> FileUpload: ...

    @typing.overload
    def create(
        self,
        **kwargs: typing.Unpack[SupportCaseAttachmentFileCreate],
    ) -> FileUpload: ...

    def create(
        self,
        **kwargs: typing.Any,
    ) -> FileUpload:
        """
        Create a file.

        **Scopes**: `files:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/files/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, FileUpload, method_errors)

    def uploaded(
        self,
        id_path: str,
        **kwargs: typing.Unpack[FileUploadCompleted],
    ) -> FileRead:
        """
        Complete a file upload.

        **Scopes**: `files:write`

        Args:
            id_path: The file ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/files/{id}/uploaded",
            path_params={
                "id": id_path,
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
        return parse_response_json(response, FileRead, method_errors)

    def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a file.

        **Scopes**: `files:write`

        Args:
            id:

        Raises:
            NotPermitted: You don't have the permission to delete this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/files/{id}",
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
        return parse_response_none(response, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[FilePatch],
    ) -> FileRead:
        """
        Update a file.

        **Scopes**: `files:write`

        Args:
            id: The file ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/files/{id}",
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
        return parse_response_json(response, FileRead, method_errors)


class FilesAsync(AsyncServiceBase):
    async def list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        ids: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> ListResourceFileRead:
        """
        List files.

        **Scopes**: `files:read` `files:write`

        Args:
            organization_id: Filter by organization ID.
            ids: Filter by file ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="GET",
            url="/v1/files/",
            path_params={},
            query_params={
                "organization_id": organization_id,
                "ids": ids,
                "page": page,
                "limit": limit,
            },
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, ListResourceFileRead, method_errors)

    async def iter_list(
        self,
        *,
        organization_id: str | builtins.list[str] | None = None,
        ids: str | builtins.list[str] | None = None,
        page: int = 1,
        limit: int = 10,
    ) -> typing.AsyncGenerator[FileRead]:
        """
        List files.

        **Scopes**: `files:read` `files:write`

        Args:
            organization_id: Filter by organization ID.
            ids: Filter by file ID.
            page: Page number, defaults to 1.
            limit: Size of a page, defaults to 10. Maximum is 100.

        Returns:
            An async generator that yields items of type FileRead.

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        while True:
            response = await self.list(
                organization_id=organization_id,
                ids=ids,
                page=page,
                limit=limit,
            )
            for item in response.items:
                yield item
            if page >= response.pagination.max_page:
                break
            page += 1

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[DownloadableFileCreate],
    ) -> FileUpload: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[ProductMediaFileCreate],
    ) -> FileUpload: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[OrganizationAvatarFileCreate],
    ) -> FileUpload: ...

    @typing.overload
    async def create(
        self,
        **kwargs: typing.Unpack[SupportCaseAttachmentFileCreate],
    ) -> FileUpload: ...

    async def create(
        self,
        **kwargs: typing.Any,
    ) -> FileUpload:
        """
        Create a file.

        **Scopes**: `files:write`

        Args:
            **kwargs: Request body parameters

        Raises:
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/files/",
            path_params={},
            query_params={},
            body=kwargs,
        )
        response = await self.client.send_request(request)
        method_errors = {
            422: HTTPValidationError,
        }
        return parse_response_json(response, FileUpload, method_errors)

    async def uploaded(
        self,
        id_path: str,
        **kwargs: typing.Unpack[FileUploadCompleted],
    ) -> FileRead:
        """
        Complete a file upload.

        **Scopes**: `files:write`

        Args:
            id_path: The file ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="POST",
            url="/v1/files/{id}/uploaded",
            path_params={
                "id": id_path,
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
        return parse_response_json(response, FileRead, method_errors)

    async def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a file.

        **Scopes**: `files:write`

        Args:
            id:

        Raises:
            NotPermitted: You don't have the permission to delete this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="DELETE",
            url="/v1/files/{id}",
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
        return parse_response_none(response, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[FilePatch],
    ) -> FileRead:
        """
        Update a file.

        **Scopes**: `files:write`

        Args:
            id: The file ID.
            **kwargs: Request body parameters

        Raises:
            NotPermitted: You don't have the permission to update this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
            PolarNetworkError: Raised when a network error occurs while making the request.
            PolarServerError: Raised when the server returns a 5xx error response.
        """
        request = self.client.build_request(
            method="PATCH",
            url="/v1/files/{id}",
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
        return parse_response_json(response, FileRead, method_errors)
