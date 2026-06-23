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
    DownloadableFileCreate,
    FilePatch,
    FileUploadCompleted,
    OrganizationAvatarFileCreate,
    ProductMediaFileCreate,
    SupportCaseAttachmentFileCreate,
)
from polar.outputs import (
    DownloadableFileRead,
    FileUpload,
    ListResourceFileRead,
    OrganizationAvatarFileRead,
    ProductMediaFileRead,
    SupportCaseAttachmentFileRead,
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
        return parse_response(response, ListResourceFileRead, method_errors)

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
        return parse_response(response, FileUpload, method_errors)

    def uploaded(
        self,
        id_path: str,
        **kwargs: typing.Unpack[FileUploadCompleted],
    ) -> (
        DownloadableFileRead
        | ProductMediaFileRead
        | OrganizationAvatarFileRead
        | SupportCaseAttachmentFileRead
    ):
        """
        Complete a file upload.

        **Scopes**: `files:write`

        Args:
            id_path: The file ID.

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
        return parse_response(
            response,
            DownloadableFileRead
            | ProductMediaFileRead
            | OrganizationAvatarFileRead
            | SupportCaseAttachmentFileRead,
            method_errors,
        )

    def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a file.

        **Scopes**: `files:write`

        Args:
            id: None

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
        return parse_response(response, None, method_errors)

    def update(
        self,
        id: str,
        **kwargs: typing.Unpack[FilePatch],
    ) -> (
        DownloadableFileRead
        | ProductMediaFileRead
        | OrganizationAvatarFileRead
        | SupportCaseAttachmentFileRead
    ):
        """
        Update a file.

        **Scopes**: `files:write`

        Args:
            id: The file ID.

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
        return parse_response(
            response,
            DownloadableFileRead
            | ProductMediaFileRead
            | OrganizationAvatarFileRead
            | SupportCaseAttachmentFileRead,
            method_errors,
        )


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
        return parse_response(response, ListResourceFileRead, method_errors)

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

        Raises:
            HTTPValidationError: Validation Error
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
        return parse_response(response, FileUpload, method_errors)

    async def uploaded(
        self,
        id_path: str,
        **kwargs: typing.Unpack[FileUploadCompleted],
    ) -> (
        DownloadableFileRead
        | ProductMediaFileRead
        | OrganizationAvatarFileRead
        | SupportCaseAttachmentFileRead
    ):
        """
        Complete a file upload.

        **Scopes**: `files:write`

        Args:
            id_path: The file ID.

        Raises:
            NotPermitted: You don't have the permission to update this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
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
        return parse_response(
            response,
            DownloadableFileRead
            | ProductMediaFileRead
            | OrganizationAvatarFileRead
            | SupportCaseAttachmentFileRead,
            method_errors,
        )

    async def delete(
        self,
        id: str,
    ) -> None:
        """
        Delete a file.

        **Scopes**: `files:write`

        Args:
            id: None

        Raises:
            NotPermitted: You don't have the permission to delete this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
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
        return parse_response(response, None, method_errors)

    async def update(
        self,
        id: str,
        **kwargs: typing.Unpack[FilePatch],
    ) -> (
        DownloadableFileRead
        | ProductMediaFileRead
        | OrganizationAvatarFileRead
        | SupportCaseAttachmentFileRead
    ):
        """
        Update a file.

        **Scopes**: `files:write`

        Args:
            id: The file ID.

        Raises:
            NotPermitted: You don't have the permission to update this file.
            ResourceNotFound: File not found.
            HTTPValidationError: Validation Error
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
        return parse_response(
            response,
            DownloadableFileRead
            | ProductMediaFileRead
            | OrganizationAvatarFileRead
            | SupportCaseAttachmentFileRead,
            method_errors,
        )
