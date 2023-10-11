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
/**
 * 
 * @export
 * @interface NotificationsMarkRead
 */
export interface NotificationsMarkRead {
    /**
     * 
     * @type {string}
     * @memberof NotificationsMarkRead
     */
    notification_id: string;
}

/**
 * Check if a given object implements the NotificationsMarkRead interface.
 */
export function instanceOfNotificationsMarkRead(value: object): boolean {
    let isInstance = true;
    isInstance = isInstance && "notification_id" in value;

    return isInstance;
}

export function NotificationsMarkReadFromJSON(json: any): NotificationsMarkRead {
    return NotificationsMarkReadFromJSONTyped(json, false);
}

export function NotificationsMarkReadFromJSONTyped(json: any, ignoreDiscriminator: boolean): NotificationsMarkRead {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'notification_id': json['notification_id'],
    };
}

export function NotificationsMarkReadToJSON(value?: NotificationsMarkRead | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'notification_id': value.notification_id,
    };
}

