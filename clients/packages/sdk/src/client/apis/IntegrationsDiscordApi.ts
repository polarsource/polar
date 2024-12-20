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
  DiscordGuild,
  HTTPValidationError,
} from '../models/index';

export interface IntegrationsDiscordApiDiscordGuildLookupRequest {
    guildToken: string;
}

export interface IntegrationsDiscordApiIntegrationsDiscordBotAuthorizeRequest {
    returnTo?: string | null;
}

export interface IntegrationsDiscordApiIntegrationsDiscordBotCallbackRequest {
    state: string;
    code?: string | null;
    codeVerifier?: string | null;
    error?: string | null;
}

/**
 * 
 */
export class IntegrationsDiscordApi extends runtime.BaseAPI {

    /**
     * Discord Guild Lookup
     */
    async discordGuildLookupRaw(requestParameters: IntegrationsDiscordApiDiscordGuildLookupRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<DiscordGuild>> {
        if (requestParameters['guildToken'] == null) {
            throw new runtime.RequiredError(
                'guildToken',
                'Required parameter "guildToken" was null or undefined when calling discordGuildLookup().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['guildToken'] != null) {
            queryParameters['guild_token'] = requestParameters['guildToken'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/integrations/discord/guild/lookup`,
            method: 'GET',
            headers: headerParameters,
            query: queryParameters,
        }, initOverrides);

        return new runtime.JSONApiResponse(response);
    }

    /**
     * Discord Guild Lookup
     */
    async discordGuildLookup(requestParameters: IntegrationsDiscordApiDiscordGuildLookupRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<DiscordGuild> {
        const response = await this.discordGuildLookupRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Integrations.Discord.Bot Authorize
     */
    async integrationsDiscordBotAuthorizeRaw(requestParameters: IntegrationsDiscordApiIntegrationsDiscordBotAuthorizeRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        const queryParameters: any = {};

        if (requestParameters['returnTo'] != null) {
            queryParameters['return_to'] = requestParameters['returnTo'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/integrations/discord/bot/authorize`,
            method: 'GET',
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
     * Integrations.Discord.Bot Authorize
     */
    async integrationsDiscordBotAuthorize(requestParameters: IntegrationsDiscordApiIntegrationsDiscordBotAuthorizeRequest = {}, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.integrationsDiscordBotAuthorizeRaw(requestParameters, initOverrides);
        return await response.value();
    }

    /**
     * Integrations.Discord.Bot Callback
     */
    async integrationsDiscordBotCallbackRaw(requestParameters: IntegrationsDiscordApiIntegrationsDiscordBotCallbackRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<runtime.ApiResponse<any>> {
        if (requestParameters['state'] == null) {
            throw new runtime.RequiredError(
                'state',
                'Required parameter "state" was null or undefined when calling integrationsDiscordBotCallback().'
            );
        }

        const queryParameters: any = {};

        if (requestParameters['state'] != null) {
            queryParameters['state'] = requestParameters['state'];
        }

        if (requestParameters['code'] != null) {
            queryParameters['code'] = requestParameters['code'];
        }

        if (requestParameters['codeVerifier'] != null) {
            queryParameters['code_verifier'] = requestParameters['codeVerifier'];
        }

        if (requestParameters['error'] != null) {
            queryParameters['error'] = requestParameters['error'];
        }

        const headerParameters: runtime.HTTPHeaders = {};

        if (this.configuration && this.configuration.accessToken) {
            const token = this.configuration.accessToken;
            const tokenString = await token("pat", []);

            if (tokenString) {
                headerParameters["Authorization"] = `Bearer ${tokenString}`;
            }
        }
        const response = await this.request({
            path: `/v1/integrations/discord/bot/callback`,
            method: 'GET',
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
     * Integrations.Discord.Bot Callback
     */
    async integrationsDiscordBotCallback(requestParameters: IntegrationsDiscordApiIntegrationsDiscordBotCallbackRequest, initOverrides?: RequestInit | runtime.InitOverrideFunction): Promise<any> {
        const response = await this.integrationsDiscordBotCallbackRaw(requestParameters, initOverrides);
        return await response.value();
    }

}
