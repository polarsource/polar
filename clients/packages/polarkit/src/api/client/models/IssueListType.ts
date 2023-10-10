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


/**
 * An enumeration.
 * @export
 */
export const IssueListType = {
    ISSUES: 'issues',
    DEPENDENCIES: 'dependencies'
} as const;
export type IssueListType = typeof IssueListType[keyof typeof IssueListType];


export function IssueListTypeFromJSON(json: any): IssueListType {
    return IssueListTypeFromJSONTyped(json, false);
}

export function IssueListTypeFromJSONTyped(json: any, ignoreDiscriminator: boolean): IssueListType {
    return json as IssueListType;
}

export function IssueListTypeToJSON(value?: IssueListType | null): any {
    return value as any;
}

