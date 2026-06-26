import { ClientBase } from "../base";
import type { FileCreate, FilePatch, FileUploadCompleted } from "../models/inputs";
import type {
  DownloadableFileRead,
  FileUpload,
  ListResourceFileRead,
  OrganizationAvatarFileRead,
  ProductMediaFileRead,
  SupportCaseAttachmentFileRead,
} from "../models/outputs";
import { HTTPValidationError, NotPermitted, ResourceNotFound } from "../errors";

export const listFiles = (client: ClientBase) => {
  /**
   * List files.
   *
   * **Scopes**: `files:read` `files:write`
   *
   * @param query - Query parameters
   * @returns {ListResourceFileRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (query?: {
    organization_id?: string | string[] | null;
    ids?: string | string[] | null;
    page?: number;
    limit?: number;
  }): Promise<ListResourceFileRead> => {
    const pathParams = {};
    const queryParams = {
      organization_id: query?.organization_id,
      ids: query?.ids,
      page: query?.page || 1,
      limit: query?.limit || 10,
    };
    const request = client.buildRequest("GET", "/v1/files/", pathParams, queryParams, undefined);
    const response = await client.sendRequest(request);
    return client.parseResponse<ListResourceFileRead>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const createFiles = (client: ClientBase) => {
  /**
   * Create a file.
   *
   * **Scopes**: `files:write`
   *
   * @param body - Request body* @returns {FileUpload}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {HTTPValidationError} Validation Error
   */
  return async (body?: FileCreate): Promise<FileUpload> => {
    const pathParams = {};
    const queryParams = {};
    const request = client.buildRequest("POST", "/v1/files/", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<FileUpload>(response, "json", {
      422: HTTPValidationError,
    });
  };
};
export const uploadedFiles = (client: ClientBase) => {
  /**
   * Complete a file upload.
   *
   * **Scopes**: `files:write`
   *
   * @param id - The file ID.
   * @param body - Request body* @returns {DownloadableFileRead | ProductMediaFileRead | OrganizationAvatarFileRead | SupportCaseAttachmentFileRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have the permission to update this file.
   * @throws {ResourceNotFound} File not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body?: FileUploadCompleted,
  ): Promise<
    | DownloadableFileRead
    | ProductMediaFileRead
    | OrganizationAvatarFileRead
    | SupportCaseAttachmentFileRead
  > => {
    const pathParams = {
      id_path: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "POST",
      "/v1/files/{id}/uploaded",
      pathParams,
      queryParams,
      body,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<
      | DownloadableFileRead
      | ProductMediaFileRead
      | OrganizationAvatarFileRead
      | SupportCaseAttachmentFileRead
    >(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const deleteFiles = (client: ClientBase) => {
  /**
   * Delete a file.
   *
   * **Scopes**: `files:write`
   *
   * @param id - id
   * @returns {void}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have the permission to delete this file.
   * @throws {ResourceNotFound} File not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (id: string): Promise<void> => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest(
      "DELETE",
      "/v1/files/{id}",
      pathParams,
      queryParams,
      undefined,
    );
    const response = await client.sendRequest(request);
    return client.parseResponse<void>(response, "none", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};
export const updateFiles = (client: ClientBase) => {
  /**
   * Update a file.
   *
   * **Scopes**: `files:write`
   *
   * @param id - The file ID.
   * @param body - Request body* @returns {DownloadableFileRead | ProductMediaFileRead | OrganizationAvatarFileRead | SupportCaseAttachmentFileRead}
   * @throws {PolarNetworkError} When a network error occurs
   * @throws {PolarServerError} When the server returns a 5xx error
   * @throws {NotPermitted} You don't have the permission to update this file.
   * @throws {ResourceNotFound} File not found.
   * @throws {HTTPValidationError} Validation Error
   */
  return async (
    id: string,
    body?: FilePatch,
  ): Promise<
    | DownloadableFileRead
    | ProductMediaFileRead
    | OrganizationAvatarFileRead
    | SupportCaseAttachmentFileRead
  > => {
    const pathParams = {
      id: id,
    };
    const queryParams = {};
    const request = client.buildRequest("PATCH", "/v1/files/{id}", pathParams, queryParams, body);
    const response = await client.sendRequest(request);
    return client.parseResponse<
      | DownloadableFileRead
      | ProductMediaFileRead
      | OrganizationAvatarFileRead
      | SupportCaseAttachmentFileRead
    >(response, "json", {
      403: NotPermitted,
      404: ResourceNotFound,
      422: HTTPValidationError,
    });
  };
};

export function createFilesService(client: ClientBase) {
  return {
    list: listFiles(client),
    create: createFiles(client),
    uploaded: uploadedFiles(client),
    delete: deleteFiles(client),
    update: updateFiles(client),
  };
}

export type Files = ReturnType<typeof createFilesService>;
