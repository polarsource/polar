/* tslint:disable */
/* eslint-disable */
/**
 * Polar API
 *  Welcome to the **Polar API** for [polar.sh](https://polar.sh).  The Public API is currently a [work in progress](https://github.com/polarsource/polar/issues/834) and is in active development. 🚀  #### Authentication  Use a [Personal Access Token](https://polar.sh/settings) and send it in the `Authorization` header on the format `Bearer [YOUR_TOKEN]`.  #### Feedback  If you have any feedback or comments, reach out in the [Polar API-issue](https://github.com/polarsource/polar/issues/834), or reach out on the Polar Discord server.  We\'d love to see what you\'ve built with the API and to get your thoughts on how we can make the API better!  #### Connecting  The Polar API is online at `https://api.polar.sh`. 
 *
 * The version of the OpenAPI document: 0.1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { exists, mapValues } from '../runtime';
import type { OAuthAccountRead } from './OAuthAccountRead';
import {
    OAuthAccountReadFromJSON,
    OAuthAccountReadFromJSONTyped,
    OAuthAccountReadToJSON,
} from './OAuthAccountRead';

/**
 * 
 * @export
 * @interface UserRead
 */
export interface UserRead {
    /**
     * 
     * @type {Date}
     * @memberof UserRead
     */
    created_at: Date;
    /**
     * 
     * @type {Date}
     * @memberof UserRead
     */
    modified_at?: Date;
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    username: string;
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    avatar_url?: string;
    /**
     * 
     * @type {object}
     * @memberof UserRead
     */
    profile: object;
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    id: string;
    /**
     * 
     * @type {boolean}
     * @memberof UserRead
     */
    accepted_terms_of_service: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof UserRead
     */
    email_newsletters_and_changelogs: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof UserRead
     */
    email_promotions_and_events: boolean;
    /**
     * 
     * @type {Array<OAuthAccountRead>}
     * @memberof UserRead
     */
    oauth_accounts: Array<OAuthAccountRead>;
}

/**
 * Check if a given object implements the UserRead interface.
 */
export function instanceOfUserRead(value: object): boolean {
    let isInstance = true;
    isInstance = isInstance && "created_at" in value;
    isInstance = isInstance && "username" in value;
    isInstance = isInstance && "email" in value;
    isInstance = isInstance && "profile" in value;
    isInstance = isInstance && "id" in value;
    isInstance = isInstance && "accepted_terms_of_service" in value;
    isInstance = isInstance && "email_newsletters_and_changelogs" in value;
    isInstance = isInstance && "email_promotions_and_events" in value;
    isInstance = isInstance && "oauth_accounts" in value;

    return isInstance;
}

export function UserReadFromJSON(json: any): UserRead {
    return UserReadFromJSONTyped(json, false);
}

export function UserReadFromJSONTyped(json: any, ignoreDiscriminator: boolean): UserRead {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'created_at': (new Date(json['created_at'])),
        'modified_at': !exists(json, 'modified_at') ? undefined : (new Date(json['modified_at'])),
        'username': json['username'],
        'email': json['email'],
        'avatar_url': !exists(json, 'avatar_url') ? undefined : json['avatar_url'],
        'profile': json['profile'],
        'id': json['id'],
        'accepted_terms_of_service': json['accepted_terms_of_service'],
        'email_newsletters_and_changelogs': json['email_newsletters_and_changelogs'],
        'email_promotions_and_events': json['email_promotions_and_events'],
        'oauth_accounts': ((json['oauth_accounts'] as Array<any>).map(OAuthAccountReadFromJSON)),
    };
}

export function UserReadToJSON(value?: UserRead | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'created_at': (value.created_at.toISOString()),
        'modified_at': value.modified_at === undefined ? undefined : (value.modified_at.toISOString()),
        'username': value.username,
        'email': value.email,
        'avatar_url': value.avatar_url,
        'profile': value.profile,
        'id': value.id,
        'accepted_terms_of_service': value.accepted_terms_of_service,
        'email_newsletters_and_changelogs': value.email_newsletters_and_changelogs,
        'email_promotions_and_events': value.email_promotions_and_events,
        'oauth_accounts': ((value.oauth_accounts as Array<any>).map(OAuthAccountReadToJSON)),
    };
}

