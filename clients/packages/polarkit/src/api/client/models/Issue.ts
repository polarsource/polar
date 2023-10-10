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
import type { Assignee } from './Assignee';
import {
    AssigneeFromJSON,
    AssigneeFromJSONTyped,
    AssigneeToJSON,
} from './Assignee';
import type { Author } from './Author';
import {
    AuthorFromJSON,
    AuthorFromJSONTyped,
    AuthorToJSON,
} from './Author';
import type { Funding } from './Funding';
import {
    FundingFromJSON,
    FundingFromJSONTyped,
    FundingToJSON,
} from './Funding';
import type { Label } from './Label';
import {
    LabelFromJSON,
    LabelFromJSONTyped,
    LabelToJSON,
} from './Label';
import type { Platforms } from './Platforms';
import {
    PlatformsFromJSON,
    PlatformsFromJSONTyped,
    PlatformsToJSON,
} from './Platforms';
import type { Reactions } from './Reactions';
import {
    ReactionsFromJSON,
    ReactionsFromJSONTyped,
    ReactionsToJSON,
} from './Reactions';
import type { Repository } from './Repository';
import {
    RepositoryFromJSON,
    RepositoryFromJSONTyped,
    RepositoryToJSON,
} from './Repository';

/**
 * 
 * @export
 * @interface Issue
 */
export interface Issue {
    /**
     * 
     * @type {string}
     * @memberof Issue
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof Issue
     */
    platform: Platforms;
    /**
     * GitHub #number
     * @type {number}
     * @memberof Issue
     */
    number: number;
    /**
     * GitHub issue title
     * @type {string}
     * @memberof Issue
     */
    title: string;
    /**
     * GitHub issue body
     * @type {string}
     * @memberof Issue
     */
    body?: string;
    /**
     * Number of GitHub comments made on the issue
     * @type {number}
     * @memberof Issue
     */
    comments?: number;
    /**
     * 
     * @type {Array<Label>}
     * @memberof Issue
     */
    labels?: Array<Label>;
    /**
     * 
     * @type {Author}
     * @memberof Issue
     */
    author?: Author;
    /**
     * GitHub assignees
     * @type {Array<Assignee>}
     * @memberof Issue
     */
    assignees?: Array<Assignee>;
    /**
     * 
     * @type {Reactions}
     * @memberof Issue
     */
    reactions?: Reactions;
    /**
     * 
     * @type {string}
     * @memberof Issue
     */
    state: IssueStateEnum;
    /**
     * 
     * @type {Date}
     * @memberof Issue
     */
    issue_closed_at?: Date;
    /**
     * 
     * @type {Date}
     * @memberof Issue
     */
    issue_modified_at?: Date;
    /**
     * 
     * @type {Date}
     * @memberof Issue
     */
    issue_created_at: Date;
    /**
     * If a maintainer needs to mark this issue as solved
     * @type {boolean}
     * @memberof Issue
     */
    needs_confirmation_solved: boolean;
    /**
     * If this issue has been marked as confirmed solved through Polar
     * @type {Date}
     * @memberof Issue
     */
    confirmed_solved_at?: Date;
    /**
     * 
     * @type {Funding}
     * @memberof Issue
     */
    funding: Funding;
    /**
     * 
     * @type {Repository}
     * @memberof Issue
     */
    repository: Repository;
    /**
     * Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
     * @type {number}
     * @memberof Issue
     */
    upfront_split_to_contributors?: number;
    /**
     * If this issue currently has the Polar badge SVG embedded
     * @type {boolean}
     * @memberof Issue
     */
    pledge_badge_currently_embedded: boolean;
    /**
     * Optional custom badge SVG promotional content
     * @type {string}
     * @memberof Issue
     */
    badge_custom_content?: string;
}


/**
 * @export
 */
export const IssueStateEnum = {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED'
} as const;
export type IssueStateEnum = typeof IssueStateEnum[keyof typeof IssueStateEnum];


/**
 * Check if a given object implements the Issue interface.
 */
export function instanceOfIssue(value: object): boolean {
    let isInstance = true;
    isInstance = isInstance && "id" in value;
    isInstance = isInstance && "platform" in value;
    isInstance = isInstance && "number" in value;
    isInstance = isInstance && "title" in value;
    isInstance = isInstance && "state" in value;
    isInstance = isInstance && "issue_created_at" in value;
    isInstance = isInstance && "needs_confirmation_solved" in value;
    isInstance = isInstance && "funding" in value;
    isInstance = isInstance && "repository" in value;
    isInstance = isInstance && "pledge_badge_currently_embedded" in value;

    return isInstance;
}

export function IssueFromJSON(json: any): Issue {
    return IssueFromJSONTyped(json, false);
}

export function IssueFromJSONTyped(json: any, ignoreDiscriminator: boolean): Issue {
    if ((json === undefined) || (json === null)) {
        return json;
    }
    return {
        
        'id': json['id'],
        'platform': PlatformsFromJSON(json['platform']),
        'number': json['number'],
        'title': json['title'],
        'body': !exists(json, 'body') ? undefined : json['body'],
        'comments': !exists(json, 'comments') ? undefined : json['comments'],
        'labels': !exists(json, 'labels') ? undefined : ((json['labels'] as Array<any>).map(LabelFromJSON)),
        'author': !exists(json, 'author') ? undefined : AuthorFromJSON(json['author']),
        'assignees': !exists(json, 'assignees') ? undefined : ((json['assignees'] as Array<any>).map(AssigneeFromJSON)),
        'reactions': !exists(json, 'reactions') ? undefined : ReactionsFromJSON(json['reactions']),
        'state': json['state'],
        'issue_closed_at': !exists(json, 'issue_closed_at') ? undefined : (new Date(json['issue_closed_at'])),
        'issue_modified_at': !exists(json, 'issue_modified_at') ? undefined : (new Date(json['issue_modified_at'])),
        'issue_created_at': (new Date(json['issue_created_at'])),
        'needs_confirmation_solved': json['needs_confirmation_solved'],
        'confirmed_solved_at': !exists(json, 'confirmed_solved_at') ? undefined : (new Date(json['confirmed_solved_at'])),
        'funding': FundingFromJSON(json['funding']),
        'repository': RepositoryFromJSON(json['repository']),
        'upfront_split_to_contributors': !exists(json, 'upfront_split_to_contributors') ? undefined : json['upfront_split_to_contributors'],
        'pledge_badge_currently_embedded': json['pledge_badge_currently_embedded'],
        'badge_custom_content': !exists(json, 'badge_custom_content') ? undefined : json['badge_custom_content'],
    };
}

export function IssueToJSON(value?: Issue | null): any {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    return {
        
        'id': value.id,
        'platform': PlatformsToJSON(value.platform),
        'number': value.number,
        'title': value.title,
        'body': value.body,
        'comments': value.comments,
        'labels': value.labels === undefined ? undefined : ((value.labels as Array<any>).map(LabelToJSON)),
        'author': AuthorToJSON(value.author),
        'assignees': value.assignees === undefined ? undefined : ((value.assignees as Array<any>).map(AssigneeToJSON)),
        'reactions': ReactionsToJSON(value.reactions),
        'state': value.state,
        'issue_closed_at': value.issue_closed_at === undefined ? undefined : (value.issue_closed_at.toISOString()),
        'issue_modified_at': value.issue_modified_at === undefined ? undefined : (value.issue_modified_at.toISOString()),
        'issue_created_at': (value.issue_created_at.toISOString()),
        'needs_confirmation_solved': value.needs_confirmation_solved,
        'confirmed_solved_at': value.confirmed_solved_at === undefined ? undefined : (value.confirmed_solved_at.toISOString()),
        'funding': FundingToJSON(value.funding),
        'repository': RepositoryToJSON(value.repository),
        'upfront_split_to_contributors': value.upfront_split_to_contributors,
        'pledge_badge_currently_embedded': value.pledge_badge_currently_embedded,
        'badge_custom_content': value.badge_custom_content,
    };
}

