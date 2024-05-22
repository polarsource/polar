/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 *  Welcome to the **Polar API** for [polar.sh](https://polar.sh).  This specification contains both the definitions of the Polar HTTP API and the Webhook API.  #### Authentication  Use a [Personal Access Token](https://polar.sh/settings) and send it in the `Authorization` header on the format `Bearer [YOUR_TOKEN]`.  #### Feedback  If you have any feedback or comments, reach out in the [Polar API-issue](https://github.com/polarsource/polar/issues/834), or reach out on the Polar Discord server.  We\'d love to see what you\'ve built with the API and to get your thoughts on how we can make the API better!  #### Connecting  The Polar API is online at `https://api.polar.sh`. 
 *
 * The version of the OpenAPI document: 0.1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


import * as runtime from '../runtime';
import type {
  FileCreate,
  FileRead,
  FileUpload,
  FileUploadCompleted,
  HTTPValidationError,
} from '../models/index';

export interface FilesApiCreateRequest {
    fileCreate: FileCreate;
}

export interface FilesApiUploadedRequest {
    fileId: string;
    fileUploadCompleted: FileUploadCompleted;
}

/**
 * 
 */
export class FilesApi extends runtime.BaseAPI {

    /**
     * Create
     */
    async createRaw(requestParameters: FilesApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<FileUpload>> {
        if (requestParameters['fileCreate'] == null) {
            throw new runtime.RequiredError(
                'fileCreate',
                'Required parameter "fileCreate" was null or undefined when calling create().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/files/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['fileCreate'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create
     */
    async create(requestParameters: FilesApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<FileUpload> {
        const response = await this.createRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Uploaded
     */
    async uploadedRaw(requestParameters: FilesApiUploadedRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<FileRead>> {
        if (requestParameters['fileId'] == null) {
            throw new runtime.RequiredError(
                'fileId',
                'Required parameter "fileId" was null or undefined when calling uploaded().'
            );
        }

        if (requestParameters['fileUploadCompleted'] == null) {
            throw new runtime.RequiredError(
                'fileUploadCompleted',
                'Required parameter "fileUploadCompleted" was null or undefined when calling uploaded().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        headerParameters['Content-Type'] = 'application/json';

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/files/{file_id}/uploaded`.replace(`{${"file_id"}}`, encodeURIComponent(String(requestParameters['fileId']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['fileUploadCompleted'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Uploaded
     */
    async uploaded(requestParameters: FilesApiUploadedRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<FileRead> {
        const response = await this.uploadedRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
