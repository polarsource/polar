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
  Article,
  ArticleCreate,
  ArticlePreview,
  ArticleReceivers,
  ArticleUpdate,
  ArticleVisibility,
  HTTPValidationError,
  ListResourceArticle,
  NotPermitted,
  ResourceNotFound,
} from '../models/index';

export interface ArticlesApiDeleteRequest {
    id: string;
}

export interface ArticlesApiCreateRequest {
    body: ArticleCreate;
}

export interface ArticlesApiEmailUnsubscribeRequest {
    articleSubscriptionId: string;
}

export interface ArticlesApiGetRequest {
    id: string;
}

export interface ArticlesApiListRequest {
    organizationId?: string;
    slug?: string;
    visibility?: ArticleVisibility;
    isPublished?: boolean;
    isPinned?: boolean;
    page?: number;
    limit?: number;
}

export interface ArticlesApiPreviewRequest {
    id: string;
    body: ArticlePreview;
}

export interface ArticlesApiReceiversRequest {
    id: string;
}

export interface ArticlesApiSendRequest {
    id: string;
}

export interface ArticlesApiUpdateRequest {
    id: string;
    body: ArticleUpdate;
}

/**
 * 
 */
export class ArticlesApi extends runtime.BaseAPI {

    /**
     * Delete an article.
     * Delete an article
     */
    async _deleteRaw(requestParameters: ArticlesApiDeleteRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling _delete().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/articles/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'DELETE',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Delete an article.
     * Delete an article
     */
    async _delete(requestParameters: ArticlesApiDeleteRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this._deleteRaw(requestParameters, initOverrides);
    }

    /**
     * Create an article.
     * Create
     */
    async createRaw(requestParameters: ArticlesApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Article>> {
        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling create().'
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
            path: `/api/v1/articles/`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Create an article.
     * Create
     */
    async create(requestParameters: ArticlesApiCreateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Article> {
        const response = await this.createRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Email Unsubscribe
     */
    async emailUnsubscribeRaw(requestParameters: ArticlesApiEmailUnsubscribeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<void>> {
        if (requestParameters['articleSubscriptionId'] == null) {
            throw new runtime.RequiredError(
                'articleSubscriptionId',
                'Required parameter "articleSubscriptionId" was null or undefined when calling emailUnsubscribe().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['articleSubscriptionId'] != null) {
            queryParameters['article_subscription_id'] = requestParameters['articleSubscriptionId'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/api/v1/articles/unsubscribe`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.VoidApiResponse(response);
    }

    /**
     * Email Unsubscribe
     */
    async emailUnsubscribe(requestParameters: ArticlesApiEmailUnsubscribeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<void> {
        await this.emailUnsubscribeRaw(requestParameters, initOverrides);
    }

    /**
     * Get an article by ID.
     * Get
     */
    async getRaw(requestParameters: ArticlesApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Article>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling get().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/articles/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get an article by ID.
     * Get
     */
    async get(requestParameters: ArticlesApiGetRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Article> {
        const response = await this.getRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * List articles.
     * List
     */
    async listRaw(requestParameters: ArticlesApiListRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ListResourceArticle>> {
        const queryParameters: any = {};

        if (requestParameters['organizationId'] != null) {
            queryParameters['organization_id'] = requestParameters['organizationId'];
        }

        if (requestParameters['slug'] != null) {
            queryParameters['slug'] = requestParameters['slug'];
        }

        if (requestParameters['visibility'] != null) {
            queryParameters['visibility'] = requestParameters['visibility'];
        }

        if (requestParameters['isPublished'] != null) {
            queryParameters['is_published'] = requestParameters['isPublished'];
        }

        if (requestParameters['isPinned'] != null) {
            queryParameters['is_pinned'] = requestParameters['isPinned'];
        }

        if (requestParameters['page'] != null) {
            queryParameters['page'] = requestParameters['page'];
        }

        if (requestParameters['limit'] != null) {
            queryParameters['limit'] = requestParameters['limit'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/articles/`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * List articles.
     * List
     */
    async list(requestParameters: ArticlesApiListRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ListResourceArticle> {
        const response = await this.listRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Send an article preview by email.
     * Preview
     */
    async previewRaw(requestParameters: ArticlesApiPreviewRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling preview().'
            );
        }

        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling preview().'
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
            path: `/api/v1/articles/{id}/preview`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<any>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Send an article preview by email.
     * Preview
     */
    async preview(requestParameters: ArticlesApiPreviewRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.previewRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get number of potential receivers for an article.
     * Receivers
     */
    async receiversRaw(requestParameters: ArticlesApiReceiversRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ArticleReceivers>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling receivers().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/articles/{id}/receivers`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get number of potential receivers for an article.
     * Receivers
     */
    async receivers(requestParameters: ArticlesApiReceiversRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ArticleReceivers> {
        const response = await this.receiversRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Send an article by email to all subscribers.
     * Send
     */
    async sendRaw(requestParameters: ArticlesApiSendRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling send().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("HTTPBearer", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/api/v1/articles/{id}/send`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<any>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Send an article by email to all subscribers.
     * Send
     */
    async send(requestParameters: ArticlesApiSendRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.sendRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Update an article.
     * Update
     */
    async updateRaw(requestParameters: ArticlesApiUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<Article>> {
        if (requestParameters['id'] == null) {
            throw new runtime.RequiredError(
                'id',
                'Required parameter "id" was null or undefined when calling update().'
            );
        }

        if (requestParameters['body'] == null) {
            throw new runtime.RequiredError(
                'body',
                'Required parameter "body" was null or undefined when calling update().'
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
            path: `/api/v1/articles/{id}`.replace(`{${"id"}}`, encodeURIComponent(String(requestParameters['id']))),
            method: 'PATCH',
            headers: headerParameters,
            query: queryParameters,
            body: requestParameters['body'],
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Update an article.
     * Update
     */
    async update(requestParameters: ArticlesApiUpdateRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<Article> {
        const response = await this.updateRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
