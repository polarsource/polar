/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 * Read the docs at https://docs.polar.sh/api
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
  HTTPValidationError,
  IntrospectTokenResponse,
  ResponseOauth2Authorize,
  ResponseOauth2Userinfo,
  TokenResponse,
} from '../models/index';

export interface Oauth2ApiConsentRequest {
    action: ConsentActionEnum;
}

export interface Oauth2ApiIntrospectTokenRequest {
    token: string;
    clientId: string;
    clientSecret: string;
    tokenTypeHint?: IntrospectTokenTokenTypeHintEnum;
}

export interface Oauth2ApiRequestTokenRequest {
    grantType?: RequestTokenGrantTypeEnum;
    clientId?: string;
    clientSecret?: string;
    code?: string;
    redirectUri?: string;
    refreshToken?: string;
}

export interface Oauth2ApiRevokeTokenRequest {
    token: string;
    clientId: string;
    clientSecret: string;
    tokenTypeHint?: RevokeTokenTokenTypeHintEnum;
}

/**
 * 
 */
export class Oauth2Api extends runtime.BaseAPI {

    /**
     * Authorize
     */
    async authorizeRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ResponseOauth2Authorize>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/oauth2/authorize`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Authorize
     */
    async authorize(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ResponseOauth2Authorize> {
        const response = await this.authorizeRaw(initOverrides);
        return await response.value();
    }

    /**
     * Consent
     */
    async consentRaw(requestParameters: Oauth2ApiConsentRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['action'] == null) {
            throw new runtime.RequiredError(
                'action',
                'Required parameter "action" was null or undefined when calling consent().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const consumes: runtime.Consume[] = [
            { contentType: 'application/x-www-form-urlencoded' },
        ];
        // @ts-ignore: canConsumeForm may be unused
        const canConsumeForm = runtime.canConsumeForm(consumes);

        let formParams: { append(param: string, value: any): any };
        let useForm = false;
        if (useForm) {
            formParams = new FormData();
        } else {
            formParams = new URLSearchParams();
        }

        if (requestParameters['action'] != null) {
            formParams.append('action', requestParameters['action'] as any);
        }

        const response = await this.request({
            path: `/v1/oauth2/consent`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: formParams,
        }, initOverrides);

        if (this.isJsonMime(response.headers.get('content-type'))) {
            return new runtime.JSONApiResponse<any>(response);
        } else {
            return new runtime.TextApiResponse(response) as any;
        }
    }

    /**
     * Consent
     */
    async consent(requestParameters: Oauth2ApiConsentRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.consentRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get information about an access token.
     * Introspect Token
     */
    async introspectTokenRaw(requestParameters: Oauth2ApiIntrospectTokenRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<IntrospectTokenResponse>> {
        if (requestParameters['token'] == null) {
            throw new runtime.RequiredError(
                'token',
                'Required parameter "token" was null or undefined when calling introspectToken().'
            );
        }

        if (requestParameters['clientId'] == null) {
            throw new runtime.RequiredError(
                'clientId',
                'Required parameter "clientId" was null or undefined when calling introspectToken().'
            );
        }

        if (requestParameters['clientSecret'] == null) {
            throw new runtime.RequiredError(
                'clientSecret',
                'Required parameter "clientSecret" was null or undefined when calling introspectToken().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const consumes: runtime.Consume[] = [
            { contentType: 'application/x-www-form-urlencoded' },
        ];
        // @ts-ignore: canConsumeForm may be unused
        const canConsumeForm = runtime.canConsumeForm(consumes);

        let formParams: { append(param: string, value: any): any };
        let useForm = false;
        if (useForm) {
            formParams = new FormData();
        } else {
            formParams = new URLSearchParams();
        }

        if (requestParameters['token'] != null) {
            formParams.append('token', requestParameters['token'] as any);
        }

        if (requestParameters['tokenTypeHint'] != null) {
            formParams.append('token_type_hint', requestParameters['tokenTypeHint'] as any);
        }

        if (requestParameters['clientId'] != null) {
            formParams.append('client_id', requestParameters['clientId'] as any);
        }

        if (requestParameters['clientSecret'] != null) {
            formParams.append('client_secret', requestParameters['clientSecret'] as any);
        }

        const response = await this.request({
            path: `/v1/oauth2/introspect`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: formParams,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get information about an access token.
     * Introspect Token
     */
    async introspectToken(requestParameters: Oauth2ApiIntrospectTokenRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<IntrospectTokenResponse> {
        const response = await this.introspectTokenRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Request an access token using a valid grant.
     * Request Token
     */
    async requestTokenRaw(requestParameters: Oauth2ApiRequestTokenRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<TokenResponse>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const consumes: runtime.Consume[] = [
            { contentType: 'application/x-www-form-urlencoded' },
        ];
        // @ts-ignore: canConsumeForm may be unused
        const canConsumeForm = runtime.canConsumeForm(consumes);

        let formParams: { append(param: string, value: any): any };
        let useForm = false;
        if (useForm) {
            formParams = new FormData();
        } else {
            formParams = new URLSearchParams();
        }

        if (requestParameters['grantType'] != null) {
            formParams.append('grant_type', requestParameters['grantType'] as any);
        }

        if (requestParameters['clientId'] != null) {
            formParams.append('client_id', requestParameters['clientId'] as any);
        }

        if (requestParameters['clientSecret'] != null) {
            formParams.append('client_secret', requestParameters['clientSecret'] as any);
        }

        if (requestParameters['code'] != null) {
            formParams.append('code', requestParameters['code'] as any);
        }

        if (requestParameters['redirectUri'] != null) {
            formParams.append('redirect_uri', requestParameters['redirectUri'] as any);
        }

        if (requestParameters['refreshToken'] != null) {
            formParams.append('refresh_token', requestParameters['refreshToken'] as any);
        }

        const response = await this.request({
            path: `/v1/oauth2/token`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: formParams,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Request an access token using a valid grant.
     * Request Token
     */
    async requestToken(requestParameters: Oauth2ApiRequestTokenRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<TokenResponse> {
        const response = await this.requestTokenRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Revoke an access token or a refresh token.
     * Revoke Token
     */
    async revokeTokenRaw(requestParameters: Oauth2ApiRevokeTokenRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<object>> {
        if (requestParameters['token'] == null) {
            throw new runtime.RequiredError(
                'token',
                'Required parameter "token" was null or undefined when calling revokeToken().'
            );
        }

        if (requestParameters['clientId'] == null) {
            throw new runtime.RequiredError(
                'clientId',
                'Required parameter "clientId" was null or undefined when calling revokeToken().'
            );
        }

        if (requestParameters['clientSecret'] == null) {
            throw new runtime.RequiredError(
                'clientSecret',
                'Required parameter "clientSecret" was null or undefined when calling revokeToken().'
            );
        }

        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const consumes: runtime.Consume[] = [
            { contentType: 'application/x-www-form-urlencoded' },
        ];
        // @ts-ignore: canConsumeForm may be unused
        const canConsumeForm = runtime.canConsumeForm(consumes);

        let formParams: { append(param: string, value: any): any };
        let useForm = false;
        if (useForm) {
            formParams = new FormData();
        } else {
            formParams = new URLSearchParams();
        }

        if (requestParameters['token'] != null) {
            formParams.append('token', requestParameters['token'] as any);
        }

        if (requestParameters['tokenTypeHint'] != null) {
            formParams.append('token_type_hint', requestParameters['tokenTypeHint'] as any);
        }

        if (requestParameters['clientId'] != null) {
            formParams.append('client_id', requestParameters['clientId'] as any);
        }

        if (requestParameters['clientSecret'] != null) {
            formParams.append('client_secret', requestParameters['clientSecret'] as any);
        }

        const response = await this.request({
            path: `/v1/oauth2/revoke`,
            method: 'POST',
            headers: headerParameters,
            query: queryParameters,
            body: formParams,
        }, initOverrides);

        return new runtime.JSONApiResponse<any>(response);
    }

    /**
     * Revoke an access token or a refresh token.
     * Revoke Token
     */
    async revokeToken(requestParameters: Oauth2ApiRevokeTokenRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<object> {
        const response = await this.revokeTokenRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Get information about the authenticated user.
     * Get User Info
     */
    async userinfoRaw(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<ResponseOauth2Userinfo>> {
        const queryParameters: any = {};

        const headerParameters: runtime.HTTPHeaders = {};

        const response = await this.request({
            path: `/v1/oauth2/userinfo`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Get information about the authenticated user.
     * Get User Info
     */
    async userinfo(initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<ResponseOauth2Userinfo> {
        const response = await this.userinfoRaw(initOverrides);
        return await response.value();
    }

}

/**
 * @export
 */
export const ConsentActionEnum = {
    ALLOW: 'allow',
    DENY: 'deny'
} as const;
export type ConsentActionEnum = typeof ConsentActionEnum[keyof typeof ConsentActionEnum];
/**
 * @export
 */
export const IntrospectTokenTokenTypeHintEnum = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token'
} as const;
export type IntrospectTokenTokenTypeHintEnum = typeof IntrospectTokenTokenTypeHintEnum[keyof typeof IntrospectTokenTokenTypeHintEnum];
/**
 * @export
 */
export const RequestTokenGrantTypeEnum = {
    REFRESH_TOKEN: 'refresh_token'
} as const;
export type RequestTokenGrantTypeEnum = typeof RequestTokenGrantTypeEnum[keyof typeof RequestTokenGrantTypeEnum];
/**
 * @export
 */
export const RevokeTokenTokenTypeHintEnum = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token'
} as const;
export type RevokeTokenTokenTypeHintEnum = typeof RevokeTokenTokenTypeHintEnum[keyof typeof RevokeTokenTokenTypeHintEnum];
