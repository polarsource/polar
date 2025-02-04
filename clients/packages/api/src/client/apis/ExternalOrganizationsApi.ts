/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 * Read the docs at https://docs.polar.sh/api-reference
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
  ExternalOrganizationSortProperty,
  HTTPValidationError,
  ListResourceExternalOrganization,
  OrganizationIDFilter,
  PlatformFilter,
  RepositoryNameFilter,
} from '../models/index';

export interface ExternalOrganizationsApiListRequest {
    platform?: PlatformFilter | null;
    name?: RepositoryNameFilter | null;
    organizationId?: OrganizationIDFilter | null;
    page?: number;
    limit?: number;
    sorting?: Array<ExternalOrganizationSortProperty> | null;
}

/**
 * 
 */
export class ExternalOrganizationsApi extends runtime.BaseAPI {

    /**
     * List external organizations.
     * List External Organizations
     */
    async listRaw(requestParameters: ExternalOrganizationsApiListRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceExternalOrganization>> {
        const queryParameters: any = {};

        if (requestParameters['platform'] != null) {
            queryParameters['platform'] = requestParameters['platform'];
        }

        if (requestParameters['name'] != null) {
            queryParameters['name'] = requestParameters['name'];
        }

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        if (requestParameters['sorting'] != null) {
            queryParameters['sorting'] = requestParameters['sorting'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("oat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/external_organizations/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List external organizations.
     * List External Organizations
     */
    async list(requestParameters: ExternalOrganizationsApiListRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceExternalOrganization> {
        const response = await this.listRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
