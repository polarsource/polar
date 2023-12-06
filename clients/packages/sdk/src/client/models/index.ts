/* tslint:disable */
/* eslint-disable */
/**
 * 
 * @export
 * @interface Account
 */
export interface Account {
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    id: string;
    /**
     * 
     * @type {AccountType}
     * @memberof Account
     */
    account_type: AccountType;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    stripe_id?: string;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    open_collective_slug?: string;
    /**
     * 
     * @type {boolean}
     * @memberof Account
     */
    is_details_submitted?: boolean;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    country: string;
}
/**
 * 
 * @export
 * @interface AccountCreate
 */
export interface AccountCreate {
    /**
     * 
     * @type {string}
     * @memberof AccountCreate
     */
    user_id?: string;
    /**
     * 
     * @type {string}
     * @memberof AccountCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {AccountType}
     * @memberof AccountCreate
     */
    account_type: AccountType;
    /**
     * 
     * @type {string}
     * @memberof AccountCreate
     */
    open_collective_slug?: string;
    /**
     * Two letter uppercase country code
     * @type {string}
     * @memberof AccountCreate
     */
    country: string;
}
/**
 * 
 * @export
 * @interface AccountLink
 */
export interface AccountLink {
    /**
     * 
     * @type {string}
     * @memberof AccountLink
     */
    url: string;
}

/**
 * An enumeration.
 * @export
 */
export const AccountType = {
    STRIPE: 'stripe',
    OPEN_COLLECTIVE: 'open_collective'
} as const;
export type AccountType = typeof AccountType[keyof typeof AccountType];

/**
 * 
 * @export
 * @interface Article
 */
export interface Article {
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    slug: string;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    body: string;
    /**
     * 
     * @type {Byline}
     * @memberof Article
     */
    byline: Byline;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    visibility: ArticleVisibilityEnum;
    /**
     * 
     * @type {Organization}
     * @memberof Article
     */
    organization: Organization;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    published_at?: string;
    /**
     * 
     * @type {boolean}
     * @memberof Article
     */
    notify_subscribers?: boolean;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    notifications_sent_at?: string;
    /**
     * 
     * @type {number}
     * @memberof Article
     */
    email_sent_to_count?: number;
    /**
     * 
     * @type {number}
     * @memberof Article
     */
    web_view_count?: number;
    /**
     * 
     * @type {boolean}
     * @memberof Article
     */
    paid_subscribers_only?: boolean;
}


/**
 * @export
 */
export const ArticleVisibilityEnum = {
    PRIVATE: 'private',
    HIDDEN: 'hidden',
    PUBLIC: 'public'
} as const;
export type ArticleVisibilityEnum = typeof ArticleVisibilityEnum[keyof typeof ArticleVisibilityEnum];

/**
 * 
 * @export
 * @interface ArticleCreate
 */
export interface ArticleCreate {
    /**
     * Title of the article. A slug will be created automatically from the title.
     * @type {string}
     * @memberof ArticleCreate
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    body: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    organization_id: string;
    /**
     * If the user or organization should be credited in the byline.
     * @type {string}
     * @memberof ArticleCreate
     */
    byline?: ArticleCreateBylineEnum;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    visibility?: ArticleCreateVisibilityEnum;
    /**
     * Set to true to only make this article available for subscribers to a paid subscription tier in the organization.
     * @type {boolean}
     * @memberof ArticleCreate
     */
    paid_subscribers_only?: boolean;
    /**
     * Time of publishing. If this date is in the future, the post will be scheduled to publish at this time. If visibility is 'public', published_at will default to the current time.
     * @type {string}
     * @memberof ArticleCreate
     */
    published_at?: string;
    /**
     * Set to true to deliver this article via email and/or notifications to subscribers.
     * @type {boolean}
     * @memberof ArticleCreate
     */
    notify_subscribers?: boolean;
}


/**
 * @export
 */
export const ArticleCreateBylineEnum = {
    USER: 'user',
    ORGANIZATION: 'organization'
} as const;
export type ArticleCreateBylineEnum = typeof ArticleCreateBylineEnum[keyof typeof ArticleCreateBylineEnum];

/**
 * @export
 */
export const ArticleCreateVisibilityEnum = {
    PRIVATE: 'private',
    HIDDEN: 'hidden',
    PUBLIC: 'public'
} as const;
export type ArticleCreateVisibilityEnum = typeof ArticleCreateVisibilityEnum[keyof typeof ArticleCreateVisibilityEnum];

/**
 * 
 * @export
 * @interface ArticleDeleteResponse
 */
export interface ArticleDeleteResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ArticleDeleteResponse
     */
    ok: boolean;
}
/**
 * 
 * @export
 * @interface ArticlePreview
 */
export interface ArticlePreview {
    /**
     * Send a preview of the article to this email address
     * @type {string}
     * @memberof ArticlePreview
     */
    email: string;
}
/**
 * 
 * @export
 * @interface ArticlePreviewResponse
 */
export interface ArticlePreviewResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ArticlePreviewResponse
     */
    ok: boolean;
}
/**
 * 
 * @export
 * @interface ArticleReceiversResponse
 */
export interface ArticleReceiversResponse {
    /**
     * 
     * @type {number}
     * @memberof ArticleReceiversResponse
     */
    free_subscribers: number;
    /**
     * 
     * @type {number}
     * @memberof ArticleReceiversResponse
     */
    premium_subscribers: number;
    /**
     * 
     * @type {number}
     * @memberof ArticleReceiversResponse
     */
    organization_members: number;
}
/**
 * 
 * @export
 * @interface ArticleSentResponse
 */
export interface ArticleSentResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ArticleSentResponse
     */
    ok: boolean;
}
/**
 * 
 * @export
 * @interface ArticleUpdate
 */
export interface ArticleUpdate {
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    title?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    body?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    slug?: string;
    /**
     * If the user or organization should be credited in the byline.
     * @type {string}
     * @memberof ArticleUpdate
     */
    byline?: ArticleUpdateBylineEnum;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    visibility?: ArticleUpdateVisibilityEnum;
    /**
     * Set to true to only make this article available for subscribers to a paid subscription tier in the organization.
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    paid_subscribers_only?: boolean;
    /**
     * Time of publishing. If this date is in the future, the post will be scheduled to publish at this time.
     * @type {string}
     * @memberof ArticleUpdate
     */
    published_at?: string;
    /**
     * Set to true for changes to published_at to take affect.
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    set_published_at?: boolean;
    /**
     * Set to true to deliver this article via email and/or notifications to subscribers.
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    notify_subscribers?: boolean;
}


/**
 * @export
 */
export const ArticleUpdateBylineEnum = {
    USER: 'user',
    ORGANIZATION: 'organization'
} as const;
export type ArticleUpdateBylineEnum = typeof ArticleUpdateBylineEnum[keyof typeof ArticleUpdateBylineEnum];

/**
 * @export
 */
export const ArticleUpdateVisibilityEnum = {
    PRIVATE: 'private',
    HIDDEN: 'hidden',
    PUBLIC: 'public'
} as const;
export type ArticleUpdateVisibilityEnum = typeof ArticleUpdateVisibilityEnum[keyof typeof ArticleUpdateVisibilityEnum];

/**
 * 
 * @export
 * @interface ArticleViewedResponse
 */
export interface ArticleViewedResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ArticleViewedResponse
     */
    ok: boolean;
}
/**
 * 
 * @export
 * @interface Assignee
 */
export interface Assignee {
    /**
     * 
     * @type {number}
     * @memberof Assignee
     */
    id: number;
    /**
     * 
     * @type {string}
     * @memberof Assignee
     */
    login: string;
    /**
     * 
     * @type {string}
     * @memberof Assignee
     */
    html_url: string;
    /**
     * 
     * @type {string}
     * @memberof Assignee
     */
    avatar_url: string;
}
/**
 * 
 * @export
 * @interface Author
 */
export interface Author {
    /**
     * 
     * @type {number}
     * @memberof Author
     */
    id: number;
    /**
     * 
     * @type {string}
     * @memberof Author
     */
    login: string;
    /**
     * 
     * @type {string}
     * @memberof Author
     */
    html_url: string;
    /**
     * 
     * @type {string}
     * @memberof Author
     */
    avatar_url: string;
}
/**
 * 
 * @export
 * @interface AuthorizationResponse
 */
export interface AuthorizationResponse {
    /**
     * 
     * @type {string}
     * @memberof AuthorizationResponse
     */
    authorization_url: string;
}
/**
 * 
 * @export
 * @interface BackofficeBadge
 */
export interface BackofficeBadge {
    /**
     * 
     * @type {string}
     * @memberof BackofficeBadge
     */
    org_slug: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficeBadge
     */
    repo_slug: string;
    /**
     * 
     * @type {number}
     * @memberof BackofficeBadge
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof BackofficeBadge
     */
    action: BackofficeBadgeActionEnum;
}


/**
 * @export
 */
export const BackofficeBadgeActionEnum = {
    EMBED: 'embed',
    REMOVE: 'remove'
} as const;
export type BackofficeBadgeActionEnum = typeof BackofficeBadgeActionEnum[keyof typeof BackofficeBadgeActionEnum];

/**
 * 
 * @export
 * @interface BackofficeBadgeResponse
 */
export interface BackofficeBadgeResponse {
    /**
     * 
     * @type {string}
     * @memberof BackofficeBadgeResponse
     */
    org_slug: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficeBadgeResponse
     */
    repo_slug: string;
    /**
     * 
     * @type {number}
     * @memberof BackofficeBadgeResponse
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof BackofficeBadgeResponse
     */
    action: BackofficeBadgeResponseActionEnum;
    /**
     * 
     * @type {boolean}
     * @memberof BackofficeBadgeResponse
     */
    success: boolean;
}


/**
 * @export
 */
export const BackofficeBadgeResponseActionEnum = {
    EMBED: 'embed',
    REMOVE: 'remove'
} as const;
export type BackofficeBadgeResponseActionEnum = typeof BackofficeBadgeResponseActionEnum[keyof typeof BackofficeBadgeResponseActionEnum];

/**
 * 
 * @export
 * @interface BackofficePledge
 */
export interface BackofficePledge {
    /**
     * Pledge ID
     * @type {string}
     * @memberof BackofficePledge
     */
    id: string;
    /**
     * When the pledge was created
     * @type {string}
     * @memberof BackofficePledge
     */
    created_at: string;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof BackofficePledge
     */
    amount: CurrencyAmount;
    /**
     * 
     * @type {PledgeState}
     * @memberof BackofficePledge
     */
    state: PledgeState;
    /**
     * 
     * @type {PledgeType}
     * @memberof BackofficePledge
     */
    type: PledgeType;
    /**
     * If and when the pledge was refunded to the pledger
     * @type {string}
     * @memberof BackofficePledge
     */
    refunded_at?: string;
    /**
     * When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
     * @type {string}
     * @memberof BackofficePledge
     */
    scheduled_payout_at?: string;
    /**
     * 
     * @type {Issue}
     * @memberof BackofficePledge
     */
    issue: Issue;
    /**
     * 
     * @type {Pledger}
     * @memberof BackofficePledge
     */
    pledger?: Pledger;
    /**
     * URL of invoice for this pledge
     * @type {string}
     * @memberof BackofficePledge
     */
    hosted_invoice_url?: string;
    /**
     * If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
     * @type {boolean}
     * @memberof BackofficePledge
     */
    authed_can_admin_sender?: boolean;
    /**
     * If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
     * @type {boolean}
     * @memberof BackofficePledge
     */
    authed_can_admin_received?: boolean;
    /**
     * 
     * @type {Pledger}
     * @memberof BackofficePledge
     */
    created_by?: Pledger;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    payment_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    dispute_reason?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    disputed_by_user_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    disputed_at?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    pledger_email?: string;
}
/**
 * 
 * @export
 * @interface BackofficeReward
 */
export interface BackofficeReward {
    /**
     * 
     * @type {Pledge}
     * @memberof BackofficeReward
     */
    pledge: Pledge;
    /**
     * 
     * @type {PolarUserSchemasUser}
     * @memberof BackofficeReward
     */
    user?: PolarUserSchemasUser;
    /**
     * 
     * @type {Organization}
     * @memberof BackofficeReward
     */
    organization?: Organization;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof BackofficeReward
     */
    amount: CurrencyAmount;
    /**
     * 
     * @type {RewardState}
     * @memberof BackofficeReward
     */
    state: RewardState;
    /**
     * If and when the reward was paid out.
     * @type {string}
     * @memberof BackofficeReward
     */
    paid_at?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficeReward
     */
    transfer_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficeReward
     */
    issue_reward_id: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficeReward
     */
    pledge_payment_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficeReward
     */
    pledger_email?: string;
}
/**
 * 
 * @export
 * @interface Byline
 */
export interface Byline {
    /**
     * 
     * @type {string}
     * @memberof Byline
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Byline
     */
    avatar_url?: string;
}
/**
 * 
 * @export
 * @interface ConfirmIssue
 */
export interface ConfirmIssue {
    /**
     * 
     * @type {Array<ConfirmIssueSplit>}
     * @memberof ConfirmIssue
     */
    splits: Array<ConfirmIssueSplit>;
}
/**
 * 
 * @export
 * @interface ConfirmIssueSplit
 */
export interface ConfirmIssueSplit {
    /**
     * 
     * @type {string}
     * @memberof ConfirmIssueSplit
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof ConfirmIssueSplit
     */
    github_username?: string;
    /**
     * 
     * @type {number}
     * @memberof ConfirmIssueSplit
     */
    share_thousands: number;
}
/**
 * 
 * @export
 * @interface CreatePersonalAccessToken
 */
export interface CreatePersonalAccessToken {
    /**
     * 
     * @type {string}
     * @memberof CreatePersonalAccessToken
     */
    comment: string;
}
/**
 * 
 * @export
 * @interface CreatePersonalAccessTokenResponse
 */
export interface CreatePersonalAccessTokenResponse {
    /**
     * 
     * @type {string}
     * @memberof CreatePersonalAccessTokenResponse
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePersonalAccessTokenResponse
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePersonalAccessTokenResponse
     */
    last_used_at?: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePersonalAccessTokenResponse
     */
    expires_at: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePersonalAccessTokenResponse
     */
    comment: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePersonalAccessTokenResponse
     */
    token: string;
}
/**
 * 
 * @export
 * @interface CreatePledgeFromPaymentIntent
 */
export interface CreatePledgeFromPaymentIntent {
    /**
     * 
     * @type {string}
     * @memberof CreatePledgeFromPaymentIntent
     */
    payment_intent_id: string;
}
/**
 * 
 * @export
 * @interface CreatePledgePayLater
 */
export interface CreatePledgePayLater {
    /**
     * 
     * @type {string}
     * @memberof CreatePledgePayLater
     */
    issue_id: string;
    /**
     * 
     * @type {number}
     * @memberof CreatePledgePayLater
     */
    amount: number;
    /**
     * The organization to give credit to. The pledge will be paid by the authenticated user.
     * @type {string}
     * @memberof CreatePledgePayLater
     */
    on_behalf_of_organization_id?: string;
    /**
     * The organization to create the pledge as. The pledge will be paid by this organization.
     * @type {string}
     * @memberof CreatePledgePayLater
     */
    by_organization_id?: string;
}
/**
 * 
 * @export
 * @interface CreditBalance
 */
export interface CreditBalance {
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof CreditBalance
     */
    amount: CurrencyAmount;
}
/**
 * 
 * @export
 * @interface CurrencyAmount
 */
export interface CurrencyAmount {
    /**
     * Three letter currency code (eg: USD)
     * @type {string}
     * @memberof CurrencyAmount
     */
    currency: string;
    /**
     * Amount in the currencys smallest unit (cents if currency is USD)
     * @type {number}
     * @memberof CurrencyAmount
     */
    amount: number;
}
/**
 * 
 * @export
 * @interface Entry
 */
export interface Entry {
    /**
     * 
     * @type {string}
     * @memberof Entry
     */
    type: string;
    /**
     * 
     * @type {Id}
     * @memberof Entry
     */
    id: Id;
    /**
     * 
     * @type {Issue}
     * @memberof Entry
     */
    attributes: Issue;
    /**
     * 
     * @type {Array<Reward>}
     * @memberof Entry
     */
    rewards?: Array<Reward>;
    /**
     * 
     * @type {PledgesTypeSummaries}
     * @memberof Entry
     */
    pledges_summary?: PledgesTypeSummaries;
    /**
     * 
     * @type {Array<IssueReferenceRead>}
     * @memberof Entry
     */
    references?: Array<IssueReferenceRead>;
    /**
     * 
     * @type {Array<Pledge>}
     * @memberof Entry
     */
    pledges?: Array<Pledge>;
}
/**
 * 
 * @export
 * @interface ExternalGitHubCommitReference
 */
export interface ExternalGitHubCommitReference {
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    author_login: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    author_avatar: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    sha: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    organization_name: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    repository_name: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    branch_name?: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    message?: string;
}
/**
 * 
 * @export
 * @interface ExternalGitHubPullRequestReference
 */
export interface ExternalGitHubPullRequestReference {
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubPullRequestReference
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubPullRequestReference
     */
    author_login: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubPullRequestReference
     */
    author_avatar: string;
    /**
     * 
     * @type {number}
     * @memberof ExternalGitHubPullRequestReference
     */
    number: number;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubPullRequestReference
     */
    organization_name: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubPullRequestReference
     */
    repository_name: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubPullRequestReference
     */
    state: string;
}
/**
 * 
 * @export
 * @interface FreeSubscriptionCreate
 */
export interface FreeSubscriptionCreate {
    /**
     * ID of the free Subscription Tier to subscribe to.
     * @type {string}
     * @memberof FreeSubscriptionCreate
     */
    tier_id: string;
    /**
     * Email of your backer. This field is required if the API is called outside the Polar app.
     * @type {string}
     * @memberof FreeSubscriptionCreate
     */
    customer_email?: string;
}
/**
 * 
 * @export
 * @interface Funding
 */
export interface Funding {
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof Funding
     */
    funding_goal?: CurrencyAmount;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof Funding
     */
    pledges_sum?: CurrencyAmount;
}
/**
 * 
 * @export
 * @interface GithubUser
 */
export interface GithubUser {
    /**
     * 
     * @type {string}
     * @memberof GithubUser
     */
    username: string;
    /**
     * 
     * @type {string}
     * @memberof GithubUser
     */
    avatar_url: string;
}
/**
 * 
 * @export
 * @interface HTTPValidationError
 */
export interface HTTPValidationError {
    /**
     * 
     * @type {Array<ValidationError>}
     * @memberof HTTPValidationError
     */
    detail?: Array<ValidationError>;
}
/**
 * @type Id
 * @export
 */
export type Id = string;

/**
 * 
 * @export
 * @interface InstallationCreate
 */
export interface InstallationCreate {
    /**
     * 
     * @type {string}
     * @memberof InstallationCreate
     */
    platform: InstallationCreatePlatformEnum;
    /**
     * 
     * @type {number}
     * @memberof InstallationCreate
     */
    external_id: number;
}


/**
 * @export
 */
export const InstallationCreatePlatformEnum = {
    GITHUB: 'github'
} as const;
export type InstallationCreatePlatformEnum = typeof InstallationCreatePlatformEnum[keyof typeof InstallationCreatePlatformEnum];

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
     * @type {string}
     * @memberof Issue
     */
    issue_closed_at?: string;
    /**
     * 
     * @type {string}
     * @memberof Issue
     */
    issue_modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof Issue
     */
    issue_created_at: string;
    /**
     * If a maintainer needs to mark this issue as solved
     * @type {boolean}
     * @memberof Issue
     */
    needs_confirmation_solved: boolean;
    /**
     * If this issue has been marked as confirmed solved through Polar
     * @type {string}
     * @memberof Issue
     */
    confirmed_solved_at?: string;
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
 * 
 * @export
 * @interface IssueExtensionRead
 */
export interface IssueExtensionRead {
    /**
     * 
     * @type {number}
     * @memberof IssueExtensionRead
     */
    number: number;
    /**
     * 
     * @type {Array<Pledge>}
     * @memberof IssueExtensionRead
     */
    pledges: Array<Pledge>;
    /**
     * 
     * @type {Array<IssueReferenceRead>}
     * @memberof IssueExtensionRead
     */
    references: Array<IssueReferenceRead>;
    /**
     * 
     * @type {Issue}
     * @memberof IssueExtensionRead
     */
    issue: Issue;
}
/**
 * 
 * @export
 * @interface IssueFunding
 */
export interface IssueFunding {
    /**
     * 
     * @type {Issue}
     * @memberof IssueFunding
     */
    issue: Issue;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof IssueFunding
     */
    funding_goal?: CurrencyAmount;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof IssueFunding
     */
    total: CurrencyAmount;
    /**
     * 
     * @type {PledgesTypeSummaries}
     * @memberof IssueFunding
     */
    pledges_summaries: PledgesTypeSummaries;
}
/**
 * 
 * @export
 * @interface IssueListResponse
 */
export interface IssueListResponse {
    /**
     * 
     * @type {Array<Entry>}
     * @memberof IssueListResponse
     */
    data: Array<Entry>;
    /**
     * 
     * @type {PaginationResponse}
     * @memberof IssueListResponse
     */
    pagination: PaginationResponse;
}

/**
 * An enumeration.
 * @export
 */
export const IssueListType = {
    ISSUES: 'issues',
    DEPENDENCIES: 'dependencies'
} as const;
export type IssueListType = typeof IssueListType[keyof typeof IssueListType];

/**
 * 
 * @export
 * @interface IssueReferenceRead
 */
export interface IssueReferenceRead {
    /**
     * 
     * @type {string}
     * @memberof IssueReferenceRead
     */
    id: string;
    /**
     * 
     * @type {IssueReferenceType}
     * @memberof IssueReferenceRead
     */
    type: IssueReferenceType;
    /**
     * 
     * @type {PullRequestReference}
     * @memberof IssueReferenceRead
     */
    pull_request_reference?: PullRequestReference;
    /**
     * 
     * @type {ExternalGitHubPullRequestReference}
     * @memberof IssueReferenceRead
     */
    external_github_pull_request_reference?: ExternalGitHubPullRequestReference;
    /**
     * 
     * @type {ExternalGitHubCommitReference}
     * @memberof IssueReferenceRead
     */
    external_github_commit_reference?: ExternalGitHubCommitReference;
}

/**
 * An enumeration.
 * @export
 */
export const IssueReferenceType = {
    PULL_REQUEST: 'pull_request',
    EXTERNAL_GITHUB_PULL_REQUEST: 'external_github_pull_request',
    EXTERNAL_GITHUB_COMMIT: 'external_github_commit'
} as const;
export type IssueReferenceType = typeof IssueReferenceType[keyof typeof IssueReferenceType];


/**
 * An enumeration.
 * @export
 */
export const IssueSortBy = {
    NEWEST: 'newest',
    RECENTLY_UPDATED: 'recently_updated',
    LEAST_RECENTLY_UPDATED: 'least_recently_updated',
    PLEDGED_AMOUNT_DESC: 'pledged_amount_desc',
    RELEVANCE: 'relevance',
    DEPENDENCIES_DEFAULT: 'dependencies_default',
    ISSUES_DEFAULT: 'issues_default',
    MOST_ENGAGEMENT: 'most_engagement',
    MOST_POSITIVE_REACTIONS: 'most_positive_reactions',
    FUNDING_GOAL_DESC_AND_MOST_POSITIVE_REACTIONS: 'funding_goal_desc_and_most_positive_reactions',
    MOST_RECENTLY_FUNDED: 'most_recently_funded'
} as const;
export type IssueSortBy = typeof IssueSortBy[keyof typeof IssueSortBy];


/**
 * An enumeration.
 * @export
 */
export const IssueStatus = {
    BACKLOG: 'backlog',
    TRIAGED: 'triaged',
    IN_PROGRESS: 'in_progress',
    PULL_REQUEST: 'pull_request',
    CLOSED: 'closed',
    BUILDING: 'building'
} as const;
export type IssueStatus = typeof IssueStatus[keyof typeof IssueStatus];

/**
 * 
 * @export
 * @interface IssueUpdateBadgeMessage
 */
export interface IssueUpdateBadgeMessage {
    /**
     * 
     * @type {string}
     * @memberof IssueUpdateBadgeMessage
     */
    message: string;
}
/**
 * @type ItemsInner
 * @export
 */
export type ItemsInner = SubscriptionBenefitArticles | SubscriptionBenefitCustom;

/**
 * 
 * @export
 * @interface Label
 */
export interface Label {
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Label
     */
    color: string;
}

/**
 * An enumeration.
 * @export
 */
export const ListFundingSortBy = {
    OLDEST: 'oldest',
    NEWEST: 'newest',
    MOST_FUNDED: 'most_funded',
    MOST_RECENTLY_FUNDED: 'most_recently_funded',
    MOST_ENGAGEMENT: 'most_engagement'
} as const;
export type ListFundingSortBy = typeof ListFundingSortBy[keyof typeof ListFundingSortBy];

/**
 * 
 * @export
 * @interface ListResourceAccount
 */
export interface ListResourceAccount {
    /**
     * 
     * @type {Array<Account>}
     * @memberof ListResourceAccount
     */
    items?: Array<Account>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceAccount
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceArticle
 */
export interface ListResourceArticle {
    /**
     * 
     * @type {Array<Article>}
     * @memberof ListResourceArticle
     */
    items?: Array<Article>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceArticle
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceBackofficeReward
 */
export interface ListResourceBackofficeReward {
    /**
     * 
     * @type {Array<BackofficeReward>}
     * @memberof ListResourceBackofficeReward
     */
    items?: Array<BackofficeReward>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceBackofficeReward
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceIssue
 */
export interface ListResourceIssue {
    /**
     * 
     * @type {Array<Issue>}
     * @memberof ListResourceIssue
     */
    items?: Array<Issue>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceIssue
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceIssueFunding
 */
export interface ListResourceIssueFunding {
    /**
     * 
     * @type {Array<IssueFunding>}
     * @memberof ListResourceIssueFunding
     */
    items?: Array<IssueFunding>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceIssueFunding
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceOrganization
 */
export interface ListResourceOrganization {
    /**
     * 
     * @type {Array<Organization>}
     * @memberof ListResourceOrganization
     */
    items?: Array<Organization>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceOrganization
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceOrganizationMember
 */
export interface ListResourceOrganizationMember {
    /**
     * 
     * @type {Array<OrganizationMember>}
     * @memberof ListResourceOrganizationMember
     */
    items?: Array<OrganizationMember>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceOrganizationMember
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourcePaymentMethod
 */
export interface ListResourcePaymentMethod {
    /**
     * 
     * @type {Array<PaymentMethod>}
     * @memberof ListResourcePaymentMethod
     */
    items?: Array<PaymentMethod>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourcePaymentMethod
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourcePersonalAccessToken
 */
export interface ListResourcePersonalAccessToken {
    /**
     * 
     * @type {Array<PersonalAccessToken>}
     * @memberof ListResourcePersonalAccessToken
     */
    items?: Array<PersonalAccessToken>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourcePersonalAccessToken
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourcePledge
 */
export interface ListResourcePledge {
    /**
     * 
     * @type {Array<Pledge>}
     * @memberof ListResourcePledge
     */
    items?: Array<Pledge>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourcePledge
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourcePullRequest
 */
export interface ListResourcePullRequest {
    /**
     * 
     * @type {Array<PullRequest>}
     * @memberof ListResourcePullRequest
     */
    items?: Array<PullRequest>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourcePullRequest
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceRepository
 */
export interface ListResourceRepository {
    /**
     * 
     * @type {Array<Repository>}
     * @memberof ListResourceRepository
     */
    items?: Array<Repository>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceRepository
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceReward
 */
export interface ListResourceReward {
    /**
     * 
     * @type {Array<Reward>}
     * @memberof ListResourceReward
     */
    items?: Array<Reward>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceReward
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceSubscription
 */
export interface ListResourceSubscription {
    /**
     * 
     * @type {Array<Subscription>}
     * @memberof ListResourceSubscription
     */
    items?: Array<Subscription>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceSubscription
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceSubscriptionSummary
 */
export interface ListResourceSubscriptionSummary {
    /**
     * 
     * @type {Array<SubscriptionSummary>}
     * @memberof ListResourceSubscriptionSummary
     */
    items?: Array<SubscriptionSummary>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceSubscriptionSummary
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceSubscriptionTier
 */
export interface ListResourceSubscriptionTier {
    /**
     * 
     * @type {Array<SubscriptionTier>}
     * @memberof ListResourceSubscriptionTier
     */
    items?: Array<SubscriptionTier>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceSubscriptionTier
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceTransaction
 */
export interface ListResourceTransaction {
    /**
     * 
     * @type {Array<Transaction>}
     * @memberof ListResourceTransaction
     */
    items?: Array<Transaction>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceTransaction
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitCustom
 */
export interface ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitCustom {
    /**
     * 
     * @type {Array<ItemsInner>}
     * @memberof ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitCustom
     */
    items?: Array<ItemsInner>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitCustom
     */
    pagination: Pagination;
}
/**
 * @type LocationInner
 * @export
 */
export type LocationInner = number | string;

/**
 * 
 * @export
 * @interface LoginResponse
 */
export interface LoginResponse {
    /**
     * 
     * @type {boolean}
     * @memberof LoginResponse
     */
    success: boolean;
    /**
     * 
     * @type {string}
     * @memberof LoginResponse
     */
    expires_at: string;
    /**
     * 
     * @type {string}
     * @memberof LoginResponse
     */
    token?: string;
    /**
     * 
     * @type {string}
     * @memberof LoginResponse
     */
    goto_url?: string;
}
/**
 * 
 * @export
 * @interface LogoutResponse
 */
export interface LogoutResponse {
    /**
     * 
     * @type {boolean}
     * @memberof LogoutResponse
     */
    success: boolean;
}
/**
 * 
 * @export
 * @interface LookupUserRequest
 */
export interface LookupUserRequest {
    /**
     * 
     * @type {string}
     * @memberof LookupUserRequest
     */
    username: string;
}
/**
 * 
 * @export
 * @interface MagicLinkRequest
 */
export interface MagicLinkRequest {
    /**
     * 
     * @type {string}
     * @memberof MagicLinkRequest
     */
    email: string;
}
/**
 * 
 * @export
 * @interface MaintainerPledgeConfirmationPendingNotification
 */
export interface MaintainerPledgeConfirmationPendingNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    pledger_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    maintainer_has_stripe_account: boolean;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    pledge_id?: string;
}
/**
 * 
 * @export
 * @interface MaintainerPledgeCreatedNotification
 */
export interface MaintainerPledgeCreatedNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    pledger_name?: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgeCreatedNotification
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgeCreatedNotification
     */
    maintainer_has_stripe_account: boolean;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    pledge_id?: string;
    /**
     * 
     * @type {PledgeType}
     * @memberof MaintainerPledgeCreatedNotification
     */
    pledge_type?: PledgeType;
}
/**
 * 
 * @export
 * @interface MaintainerPledgePaidNotification
 */
export interface MaintainerPledgePaidNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    paid_out_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgePaidNotification
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    pledge_id?: string;
}
/**
 * 
 * @export
 * @interface MaintainerPledgePendingNotification
 */
export interface MaintainerPledgePendingNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    pledger_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgePendingNotification
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgePendingNotification
     */
    maintainer_has_stripe_account: boolean;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    pledge_id?: string;
}
/**
 * 
 * @export
 * @interface MaintainerPledgedIssueConfirmationPendingNotification
 */
export interface MaintainerPledgedIssueConfirmationPendingNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    pledge_amount_sum: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    issue_id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    maintainer_has_account: boolean;
}
/**
 * 
 * @export
 * @interface MaintainerPledgedIssuePendingNotification
 */
export interface MaintainerPledgedIssuePendingNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    pledge_amount_sum: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    issue_id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    maintainer_has_account: boolean;
}
/**
 * 
 * @export
 * @interface NotificationRead
 */
export interface NotificationRead {
    /**
     * 
     * @type {string}
     * @memberof NotificationRead
     */
    id: string;
    /**
     * 
     * @type {NotificationType}
     * @memberof NotificationRead
     */
    type: NotificationType;
    /**
     * 
     * @type {string}
     * @memberof NotificationRead
     */
    created_at: string;
    /**
     * 
     * @type {MaintainerPledgePaidNotification}
     * @memberof NotificationRead
     */
    maintainer_pledge_paid?: MaintainerPledgePaidNotification;
    /**
     * 
     * @type {MaintainerPledgeConfirmationPendingNotification}
     * @memberof NotificationRead
     */
    maintainer_pledge_confirmation_pending?: MaintainerPledgeConfirmationPendingNotification;
    /**
     * 
     * @type {MaintainerPledgePendingNotification}
     * @memberof NotificationRead
     */
    maintainer_pledge_pending?: MaintainerPledgePendingNotification;
    /**
     * 
     * @type {MaintainerPledgeCreatedNotification}
     * @memberof NotificationRead
     */
    maintainer_pledge_created?: MaintainerPledgeCreatedNotification;
    /**
     * 
     * @type {PledgerPledgePendingNotification}
     * @memberof NotificationRead
     */
    pledger_pledge_pending?: PledgerPledgePendingNotification;
    /**
     * 
     * @type {RewardPaidNotification}
     * @memberof NotificationRead
     */
    reward_paid?: RewardPaidNotification;
    /**
     * 
     * @type {MaintainerPledgedIssueConfirmationPendingNotification}
     * @memberof NotificationRead
     */
    maintainer_pledged_issue_confirmation_pending?: MaintainerPledgedIssueConfirmationPendingNotification;
    /**
     * 
     * @type {MaintainerPledgedIssuePendingNotification}
     * @memberof NotificationRead
     */
    maintainer_pledged_issue_pending?: MaintainerPledgedIssuePendingNotification;
    /**
     * 
     * @type {TeamAdminMemberPledgedNotification}
     * @memberof NotificationRead
     */
    team_admin_member_pledged?: TeamAdminMemberPledgedNotification;
}

/**
 * An enumeration.
 * @export
 */
export const NotificationType = {
    MAINTAINER_PLEDGE_PAID_NOTIFICATION: 'MaintainerPledgePaidNotification',
    MAINTAINER_PLEDGE_CONFIRMATION_PENDING_NOTIFICATION: 'MaintainerPledgeConfirmationPendingNotification',
    MAINTAINER_PLEDGE_PENDING_NOTIFICATION: 'MaintainerPledgePendingNotification',
    MAINTAINER_PLEDGE_CREATED_NOTIFICATION: 'MaintainerPledgeCreatedNotification',
    PLEDGER_PLEDGE_PENDING_NOTIFICATION: 'PledgerPledgePendingNotification',
    REWARD_PAID_NOTIFICATION: 'RewardPaidNotification',
    MAINTAINER_PLEDGED_ISSUE_CONFIRMATION_PENDING_NOTIFICATION: 'MaintainerPledgedIssueConfirmationPendingNotification',
    MAINTAINER_PLEDGED_ISSUE_PENDING_NOTIFICATION: 'MaintainerPledgedIssuePendingNotification',
    TEAM_ADMIN_MEMBER_PLEDGED_NOTIFICATION: 'TeamAdminMemberPledgedNotification'
} as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

/**
 * 
 * @export
 * @interface NotificationsList
 */
export interface NotificationsList {
    /**
     * 
     * @type {Array<NotificationRead>}
     * @memberof NotificationsList
     */
    notifications: Array<NotificationRead>;
    /**
     * 
     * @type {string}
     * @memberof NotificationsList
     */
    last_read_notification_id?: string;
}
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
 * 
 * @export
 * @interface OAuthAccountRead
 */
export interface OAuthAccountRead {
    /**
     * 
     * @type {string}
     * @memberof OAuthAccountRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OAuthAccountRead
     */
    modified_at?: string;
    /**
     * 
     * @type {Platforms}
     * @memberof OAuthAccountRead
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof OAuthAccountRead
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof OAuthAccountRead
     */
    account_email: string;
}
/**
 * 
 * @export
 * @interface Organization
 */
export interface Organization {
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof Organization
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    avatar_url: string;
    /**
     * Public field from GitHub
     * @type {string}
     * @memberof Organization
     */
    bio?: string;
    /**
     * Public field from GitHub
     * @type {string}
     * @memberof Organization
     */
    pretty_name?: string;
    /**
     * Public field from GitHub
     * @type {string}
     * @memberof Organization
     */
    company?: string;
    /**
     * Public field from GitHub
     * @type {string}
     * @memberof Organization
     */
    blog?: string;
    /**
     * Public field from GitHub
     * @type {string}
     * @memberof Organization
     */
    location?: string;
    /**
     * Public field from GitHub
     * @type {string}
     * @memberof Organization
     */
    email?: string;
    /**
     * Public field from GitHub
     * @type {string}
     * @memberof Organization
     */
    twitter_username?: string;
    /**
     * 
     * @type {number}
     * @memberof Organization
     */
    pledge_minimum_amount: number;
    /**
     * 
     * @type {boolean}
     * @memberof Organization
     */
    pledge_badge_show_amount: boolean;
    /**
     * 
     * @type {number}
     * @memberof Organization
     */
    default_upfront_split_to_contributors?: number;
    /**
     * Where to send emails about payments for pledegs that this organization/team has made. Only visible for members of the organization
     * @type {string}
     * @memberof Organization
     */
    billing_email?: string;
    /**
     * Overall team monthly spending limit, per calendar month. Only visible for members of the organization
     * @type {number}
     * @memberof Organization
     */
    total_monthly_spending_limit?: number;
    /**
     * Team members monthly spending limit, per calendar month. Only visible for members of the organization
     * @type {number}
     * @memberof Organization
     */
    per_user_monthly_spending_limit?: number;
    /**
     * Feature flag for if this organization is a team.
     * @type {boolean}
     * @memberof Organization
     */
    is_teams_enabled: boolean;
}
/**
 * 
 * @export
 * @interface OrganizationBadgeSettingsRead
 */
export interface OrganizationBadgeSettingsRead {
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationBadgeSettingsRead
     */
    show_amount: boolean;
    /**
     * 
     * @type {number}
     * @memberof OrganizationBadgeSettingsRead
     */
    minimum_amount: number;
    /**
     * 
     * @type {string}
     * @memberof OrganizationBadgeSettingsRead
     */
    message?: string;
    /**
     * 
     * @type {Array<RepositoryBadgeSettingsRead>}
     * @memberof OrganizationBadgeSettingsRead
     */
    repositories: Array<RepositoryBadgeSettingsRead>;
}
/**
 * 
 * @export
 * @interface OrganizationBadgeSettingsUpdate
 */
export interface OrganizationBadgeSettingsUpdate {
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationBadgeSettingsUpdate
     */
    show_amount: boolean;
    /**
     * 
     * @type {number}
     * @memberof OrganizationBadgeSettingsUpdate
     */
    minimum_amount: number;
    /**
     * 
     * @type {string}
     * @memberof OrganizationBadgeSettingsUpdate
     */
    message: string;
    /**
     * 
     * @type {Array<RepositoryBadgeSettingsUpdate>}
     * @memberof OrganizationBadgeSettingsUpdate
     */
    repositories: Array<RepositoryBadgeSettingsUpdate>;
}
/**
 * 
 * @export
 * @interface OrganizationMember
 */
export interface OrganizationMember {
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    github_username?: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    avatar_url?: string;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationMember
     */
    is_admin: boolean;
}
/**
 * 
 * @export
 * @interface OrganizationStripePortalSession
 */
export interface OrganizationStripePortalSession {
    /**
     * 
     * @type {string}
     * @memberof OrganizationStripePortalSession
     */
    url: string;
}
/**
 * 
 * @export
 * @interface OrganizationUpdate
 */
export interface OrganizationUpdate {
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    set_default_upfront_split_to_contributors?: boolean;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    default_upfront_split_to_contributors?: number;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    pledge_badge_show_amount?: boolean;
    /**
     * 
     * @type {string}
     * @memberof OrganizationUpdate
     */
    billing_email?: string;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    set_default_badge_custom_content?: boolean;
    /**
     * 
     * @type {string}
     * @memberof OrganizationUpdate
     */
    default_badge_custom_content?: string;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    pledge_minimum_amount?: number;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    set_total_monthly_spending_limit?: boolean;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    total_monthly_spending_limit?: number;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    set_per_user_monthly_spending_limit?: boolean;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    per_user_monthly_spending_limit?: number;
}
/**
 * 
 * @export
 * @interface Pagination
 */
export interface Pagination {
    /**
     * 
     * @type {number}
     * @memberof Pagination
     */
    total_count: number;
    /**
     * 
     * @type {number}
     * @memberof Pagination
     */
    max_page: number;
}
/**
 * 
 * @export
 * @interface PaginationResponse
 */
export interface PaginationResponse {
    /**
     * 
     * @type {number}
     * @memberof PaginationResponse
     */
    total_count: number;
    /**
     * 
     * @type {number}
     * @memberof PaginationResponse
     */
    page: number;
    /**
     * 
     * @type {number}
     * @memberof PaginationResponse
     */
    next_page?: number;
}
/**
 * 
 * @export
 * @interface PaymentMethod
 */
export interface PaymentMethod {
    /**
     * 
     * @type {string}
     * @memberof PaymentMethod
     */
    stripe_payment_method_id: string;
    /**
     * 
     * @type {string}
     * @memberof PaymentMethod
     */
    type: PaymentMethodTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof PaymentMethod
     */
    brand?: string;
    /**
     * 
     * @type {string}
     * @memberof PaymentMethod
     */
    last4: string;
    /**
     * 
     * @type {number}
     * @memberof PaymentMethod
     */
    exp_month: number;
    /**
     * 
     * @type {number}
     * @memberof PaymentMethod
     */
    exp_year: number;
}


/**
 * @export
 */
export const PaymentMethodTypeEnum = {
    CARD: 'card'
} as const;
export type PaymentMethodTypeEnum = typeof PaymentMethodTypeEnum[keyof typeof PaymentMethodTypeEnum];


/**
 * Supported payment processors.
 * @export
 */
export const PaymentProcessor = {
    STRIPE: 'stripe',
    OPEN_COLLECTIVE: 'open_collective'
} as const;
export type PaymentProcessor = typeof PaymentProcessor[keyof typeof PaymentProcessor];

/**
 * 
 * @export
 * @interface PersonalAccessToken
 */
export interface PersonalAccessToken {
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    last_used_at?: string;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    expires_at: string;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    comment: string;
}

/**
 * An enumeration.
 * @export
 */
export const Platforms = {
    GITHUB: 'github'
} as const;
export type Platforms = typeof Platforms[keyof typeof Platforms];

/**
 * 
 * @export
 * @interface Pledge
 */
export interface Pledge {
    /**
     * Pledge ID
     * @type {string}
     * @memberof Pledge
     */
    id: string;
    /**
     * When the pledge was created
     * @type {string}
     * @memberof Pledge
     */
    created_at: string;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof Pledge
     */
    amount: CurrencyAmount;
    /**
     * 
     * @type {PledgeState}
     * @memberof Pledge
     */
    state: PledgeState;
    /**
     * 
     * @type {PledgeType}
     * @memberof Pledge
     */
    type: PledgeType;
    /**
     * If and when the pledge was refunded to the pledger
     * @type {string}
     * @memberof Pledge
     */
    refunded_at?: string;
    /**
     * When the payout is scheduled to be made to the maintainers behind the issue. Disputes must be made before this date.
     * @type {string}
     * @memberof Pledge
     */
    scheduled_payout_at?: string;
    /**
     * 
     * @type {Issue}
     * @memberof Pledge
     */
    issue: Issue;
    /**
     * 
     * @type {Pledger}
     * @memberof Pledge
     */
    pledger?: Pledger;
    /**
     * URL of invoice for this pledge
     * @type {string}
     * @memberof Pledge
     */
    hosted_invoice_url?: string;
    /**
     * If the currently authenticated subject can perform admin actions on behalf of the maker of the peldge
     * @type {boolean}
     * @memberof Pledge
     */
    authed_can_admin_sender?: boolean;
    /**
     * If the currently authenticated subject can perform admin actions on behalf of the receiver of the peldge
     * @type {boolean}
     * @memberof Pledge
     */
    authed_can_admin_received?: boolean;
    /**
     * 
     * @type {Pledger}
     * @memberof Pledge
     */
    created_by?: Pledger;
}
/**
 * 
 * @export
 * @interface PledgePledgesSummary
 */
export interface PledgePledgesSummary {
    /**
     * 
     * @type {Funding}
     * @memberof PledgePledgesSummary
     */
    funding: Funding;
    /**
     * 
     * @type {Array<SummaryPledge>}
     * @memberof PledgePledgesSummary
     */
    pledges: Array<SummaryPledge>;
}
/**
 * 
 * @export
 * @interface PledgeRewardTransfer
 */
export interface PledgeRewardTransfer {
    /**
     * 
     * @type {string}
     * @memberof PledgeRewardTransfer
     */
    pledge_id: string;
    /**
     * 
     * @type {string}
     * @memberof PledgeRewardTransfer
     */
    issue_reward_id: string;
}
/**
 * 
 * @export
 * @interface PledgeSpending
 */
export interface PledgeSpending {
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof PledgeSpending
     */
    amount: CurrencyAmount;
}

/**
 * An enumeration.
 * @export
 */
export const PledgeState = {
    INITIATED: 'initiated',
    CREATED: 'created',
    PENDING: 'pending',
    REFUNDED: 'refunded',
    DISPUTED: 'disputed',
    CHARGE_DISPUTED: 'charge_disputed',
    CANCELLED: 'cancelled'
} as const;
export type PledgeState = typeof PledgeState[keyof typeof PledgeState];

/**
 * 
 * @export
 * @interface PledgeStripePaymentIntentCreate
 */
export interface PledgeStripePaymentIntentCreate {
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    issue_id: string;
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    email: string;
    /**
     * 
     * @type {number}
     * @memberof PledgeStripePaymentIntentCreate
     */
    amount: number;
    /**
     * If the payment method should be saved for future usage.
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    setup_future_usage?: PledgeStripePaymentIntentCreateSetupFutureUsageEnum;
    /**
     * The organization to give credit to. The pledge will be paid by the authenticated user.
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    on_behalf_of_organization_id?: string;
}


/**
 * @export
 */
export const PledgeStripePaymentIntentCreateSetupFutureUsageEnum = {
    ON_SESSION: 'on_session'
} as const;
export type PledgeStripePaymentIntentCreateSetupFutureUsageEnum = typeof PledgeStripePaymentIntentCreateSetupFutureUsageEnum[keyof typeof PledgeStripePaymentIntentCreateSetupFutureUsageEnum];

/**
 * 
 * @export
 * @interface PledgeStripePaymentIntentMutationResponse
 */
export interface PledgeStripePaymentIntentMutationResponse {
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentMutationResponse
     */
    payment_intent_id: string;
    /**
     * 
     * @type {number}
     * @memberof PledgeStripePaymentIntentMutationResponse
     */
    amount: number;
    /**
     * 
     * @type {number}
     * @memberof PledgeStripePaymentIntentMutationResponse
     */
    fee: number;
    /**
     * 
     * @type {number}
     * @memberof PledgeStripePaymentIntentMutationResponse
     */
    amount_including_fee: number;
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentMutationResponse
     */
    client_secret?: string;
}
/**
 * 
 * @export
 * @interface PledgeStripePaymentIntentUpdate
 */
export interface PledgeStripePaymentIntentUpdate {
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    email: string;
    /**
     * 
     * @type {number}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    amount: number;
    /**
     * If the payment method should be saved for future usage.
     * @type {string}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    setup_future_usage?: PledgeStripePaymentIntentUpdateSetupFutureUsageEnum;
    /**
     * The organization to give credit to. The pledge will be paid by the authenticated user.
     * @type {string}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    on_behalf_of_organization_id?: string;
}


/**
 * @export
 */
export const PledgeStripePaymentIntentUpdateSetupFutureUsageEnum = {
    ON_SESSION: 'on_session'
} as const;
export type PledgeStripePaymentIntentUpdateSetupFutureUsageEnum = typeof PledgeStripePaymentIntentUpdateSetupFutureUsageEnum[keyof typeof PledgeStripePaymentIntentUpdateSetupFutureUsageEnum];


/**
 * An enumeration.
 * @export
 */
export const PledgeType = {
    UPFRONT: 'pay_upfront',
    ON_COMPLETION: 'pay_on_completion',
    DIRECTLY: 'pay_directly'
} as const;
export type PledgeType = typeof PledgeType[keyof typeof PledgeType];

/**
 * 
 * @export
 * @interface Pledger
 */
export interface Pledger {
    /**
     * 
     * @type {string}
     * @memberof Pledger
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Pledger
     */
    github_username?: string;
    /**
     * 
     * @type {string}
     * @memberof Pledger
     */
    avatar_url?: string;
}
/**
 * 
 * @export
 * @interface PledgerPledgePendingNotification
 */
export interface PledgerPledgePendingNotification {
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    issue_title: string;
    /**
     * 
     * @type {number}
     * @memberof PledgerPledgePendingNotification
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    pledge_date: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    pledge_id?: string;
    /**
     * 
     * @type {PledgeType}
     * @memberof PledgerPledgePendingNotification
     */
    pledge_type?: PledgeType;
}
/**
 * 
 * @export
 * @interface PledgesSummary
 */
export interface PledgesSummary {
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof PledgesSummary
     */
    total: CurrencyAmount;
    /**
     * 
     * @type {Array<Pledger>}
     * @memberof PledgesSummary
     */
    pledgers: Array<Pledger>;
}
/**
 * 
 * @export
 * @interface PledgesTypeSummaries
 */
export interface PledgesTypeSummaries {
    /**
     * 
     * @type {PledgesSummary}
     * @memberof PledgesTypeSummaries
     */
    pay_upfront: PledgesSummary;
    /**
     * 
     * @type {PledgesSummary}
     * @memberof PledgesTypeSummaries
     */
    pay_on_completion: PledgesSummary;
    /**
     * 
     * @type {PledgesSummary}
     * @memberof PledgesTypeSummaries
     */
    pay_directly: PledgesSummary;
}
/**
 * 
 * @export
 * @interface PolarSubscriptionSchemasUser
 */
export interface PolarSubscriptionSchemasUser {
    /**
     * 
     * @type {string}
     * @memberof PolarSubscriptionSchemasUser
     */
    username: string;
    /**
     * 
     * @type {string}
     * @memberof PolarSubscriptionSchemasUser
     */
    avatar_url?: string;
}
/**
 * 
 * @export
 * @interface PolarUserSchemasUser
 */
export interface PolarUserSchemasUser {
    /**
     * 
     * @type {string}
     * @memberof PolarUserSchemasUser
     */
    username: string;
    /**
     * 
     * @type {string}
     * @memberof PolarUserSchemasUser
     */
    avatar_url: string;
}
/**
 * 
 * @export
 * @interface PostIssueComment
 */
export interface PostIssueComment {
    /**
     * 
     * @type {string}
     * @memberof PostIssueComment
     */
    message: string;
    /**
     * 
     * @type {boolean}
     * @memberof PostIssueComment
     */
    append_badge?: boolean;
}
/**
 * 
 * @export
 * @interface PullRequest
 */
export interface PullRequest {
    /**
     * 
     * @type {string}
     * @memberof PullRequest
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof PullRequest
     */
    number: number;
    /**
     * 
     * @type {string}
     * @memberof PullRequest
     */
    title: string;
    /**
     * 
     * @type {Author}
     * @memberof PullRequest
     */
    author?: Author;
    /**
     * 
     * @type {number}
     * @memberof PullRequest
     */
    additions: number;
    /**
     * 
     * @type {number}
     * @memberof PullRequest
     */
    deletions: number;
    /**
     * 
     * @type {boolean}
     * @memberof PullRequest
     */
    is_merged: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof PullRequest
     */
    is_closed: boolean;
}
/**
 * 
 * @export
 * @interface PullRequestReference
 */
export interface PullRequestReference {
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    author_login: string;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    author_avatar: string;
    /**
     * 
     * @type {number}
     * @memberof PullRequestReference
     */
    number: number;
    /**
     * 
     * @type {number}
     * @memberof PullRequestReference
     */
    additions: number;
    /**
     * 
     * @type {number}
     * @memberof PullRequestReference
     */
    deletions: number;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    state: string;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    merged_at?: string;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    closed_at?: string;
    /**
     * 
     * @type {boolean}
     * @memberof PullRequestReference
     */
    is_draft: boolean;
}
/**
 * 
 * @export
 * @interface Reactions
 */
export interface Reactions {
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    total_count: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    plus_one: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    minus_one: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    laugh: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    hooray: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    confused: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    heart: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    rocket: number;
    /**
     * 
     * @type {number}
     * @memberof Reactions
     */
    eyes: number;
}
/**
 * 
 * @export
 * @interface Repository
 */
export interface Repository {
    /**
     * 
     * @type {string}
     * @memberof Repository
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof Repository
     */
    platform: Platforms;
    /**
     * 
     * @type {Visibility}
     * @memberof Repository
     */
    visibility: Visibility;
    /**
     * 
     * @type {string}
     * @memberof Repository
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Repository
     */
    description?: string;
    /**
     * 
     * @type {number}
     * @memberof Repository
     */
    stars?: number;
    /**
     * 
     * @type {string}
     * @memberof Repository
     */
    license?: string;
    /**
     * 
     * @type {string}
     * @memberof Repository
     */
    homepage?: string;
    /**
     * 
     * @type {Organization}
     * @memberof Repository
     */
    organization: Organization;
}
/**
 * 
 * @export
 * @interface RepositoryBadgeSettingsRead
 */
export interface RepositoryBadgeSettingsRead {
    /**
     * 
     * @type {string}
     * @memberof RepositoryBadgeSettingsRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof RepositoryBadgeSettingsRead
     */
    avatar_url?: string;
    /**
     * 
     * @type {string}
     * @memberof RepositoryBadgeSettingsRead
     */
    name: string;
    /**
     * 
     * @type {number}
     * @memberof RepositoryBadgeSettingsRead
     */
    synced_issues: number;
    /**
     * 
     * @type {number}
     * @memberof RepositoryBadgeSettingsRead
     */
    open_issues: number;
    /**
     * 
     * @type {number}
     * @memberof RepositoryBadgeSettingsRead
     */
    auto_embedded_issues: number;
    /**
     * 
     * @type {number}
     * @memberof RepositoryBadgeSettingsRead
     */
    label_embedded_issues: number;
    /**
     * 
     * @type {number}
     * @memberof RepositoryBadgeSettingsRead
     */
    pull_requests: number;
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryBadgeSettingsRead
     */
    badge_auto_embed: boolean;
    /**
     * 
     * @type {string}
     * @memberof RepositoryBadgeSettingsRead
     */
    badge_label: string;
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryBadgeSettingsRead
     */
    is_private: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryBadgeSettingsRead
     */
    is_sync_completed: boolean;
}
/**
 * 
 * @export
 * @interface RepositoryBadgeSettingsUpdate
 */
export interface RepositoryBadgeSettingsUpdate {
    /**
     * 
     * @type {string}
     * @memberof RepositoryBadgeSettingsUpdate
     */
    id: string;
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryBadgeSettingsUpdate
     */
    badge_auto_embed: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryBadgeSettingsUpdate
     */
    retroactive: boolean;
}
/**
 * @type ResponseSubscriptionsCreateSubscriptionBenefit
 * @export
 */
export type ResponseSubscriptionsCreateSubscriptionBenefit = SubscriptionBenefitArticles | SubscriptionBenefitCustom;

/**
 * @type ResponseSubscriptionsLookupSubscriptionBenefit
 * @export
 */
export type ResponseSubscriptionsLookupSubscriptionBenefit = SubscriptionBenefitArticles | SubscriptionBenefitCustom;

/**
 * @type ResponseSubscriptionsUpdateSubscriptionBenefit
 * @export
 */
export type ResponseSubscriptionsUpdateSubscriptionBenefit = SubscriptionBenefitArticles | SubscriptionBenefitCustom;

/**
 * 
 * @export
 * @interface Reward
 */
export interface Reward {
    /**
     * 
     * @type {Pledge}
     * @memberof Reward
     */
    pledge: Pledge;
    /**
     * 
     * @type {PolarUserSchemasUser}
     * @memberof Reward
     */
    user?: PolarUserSchemasUser;
    /**
     * 
     * @type {Organization}
     * @memberof Reward
     */
    organization?: Organization;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof Reward
     */
    amount: CurrencyAmount;
    /**
     * 
     * @type {RewardState}
     * @memberof Reward
     */
    state: RewardState;
    /**
     * If and when the reward was paid out.
     * @type {string}
     * @memberof Reward
     */
    paid_at?: string;
}
/**
 * 
 * @export
 * @interface RewardPaidNotification
 */
export interface RewardPaidNotification {
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    paid_out_amount: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof RewardPaidNotification
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    issue_id: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    pledge_id: string;
}

/**
 * An enumeration.
 * @export
 */
export const RewardState = {
    PENDING: 'pending',
    PAID: 'paid'
} as const;
export type RewardState = typeof RewardState[keyof typeof RewardState];

/**
 * 
 * @export
 * @interface RewardsSummary
 */
export interface RewardsSummary {
    /**
     * 
     * @type {Array<RewardsSummaryReceiver>}
     * @memberof RewardsSummary
     */
    receivers: Array<RewardsSummaryReceiver>;
}
/**
 * 
 * @export
 * @interface RewardsSummaryReceiver
 */
export interface RewardsSummaryReceiver {
    /**
     * 
     * @type {string}
     * @memberof RewardsSummaryReceiver
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof RewardsSummaryReceiver
     */
    avatar_url?: string;
}
/**
 * 
 * @export
 * @interface SubscribeSession
 */
export interface SubscribeSession {
    /**
     * ID of the subscribe session.
     * @type {string}
     * @memberof SubscribeSession
     */
    id: string;
    /**
     * URL where you should redirect your backer so they can subscribe to the selected tier.
     * @type {string}
     * @memberof SubscribeSession
     */
    url?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscribeSession
     */
    customer_email?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscribeSession
     */
    customer_name?: string;
    /**
     * 
     * @type {SubscriptionTier}
     * @memberof SubscribeSession
     */
    subscription_tier: SubscriptionTier;
    /**
     * 
     * @type {string}
     * @memberof SubscribeSession
     */
    organization_name?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscribeSession
     */
    repository_name?: string;
}
/**
 * 
 * @export
 * @interface SubscribeSessionCreate
 */
export interface SubscribeSessionCreate {
    /**
     * ID of the Subscription Tier to subscribe to.
     * @type {string}
     * @memberof SubscribeSessionCreate
     */
    tier_id: string;
    /**
     * URL where the backer will be redirected after a successful subscription. You can add the `session_id={CHECKOUT_SESSION_ID}` query parameter to retrieve the subscribe session id.
     * @type {string}
     * @memberof SubscribeSessionCreate
     */
    success_url: string;
    /**
     * If you already know the email of your backer, you can set it. It'll be pre-filled on the subscription page.
     * @type {string}
     * @memberof SubscribeSessionCreate
     */
    customer_email?: string;
}
/**
 * 
 * @export
 * @interface Subscription
 */
export interface Subscription {
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    id: string;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof Subscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    current_period_end?: string;
    /**
     * 
     * @type {boolean}
     * @memberof Subscription
     */
    cancel_at_period_end: boolean;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    started_at?: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    ended_at?: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    price_currency: string;
    /**
     * 
     * @type {number}
     * @memberof Subscription
     */
    price_amount: number;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    subscription_tier_id: string;
    /**
     * 
     * @type {PolarSubscriptionSchemasUser}
     * @memberof Subscription
     */
    user: PolarSubscriptionSchemasUser;
    /**
     * 
     * @type {SubscriptionTier}
     * @memberof Subscription
     */
    subscription_tier: SubscriptionTier;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitArticles
 */
export interface SubscriptionBenefitArticles {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticles
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticles
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticles
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticles
     */
    type: SubscriptionBenefitArticlesTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticles
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticles
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticles
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitArticlesProperties}
     * @memberof SubscriptionBenefitArticles
     */
    properties: SubscriptionBenefitArticlesProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitArticlesTypeEnum = {
    ARTICLES: 'articles'
} as const;
export type SubscriptionBenefitArticlesTypeEnum = typeof SubscriptionBenefitArticlesTypeEnum[keyof typeof SubscriptionBenefitArticlesTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitArticlesProperties
 */
export interface SubscriptionBenefitArticlesProperties {
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitArticlesProperties
     */
    paid_articles: boolean;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitArticlesUpdate
 */
export interface SubscriptionBenefitArticlesUpdate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesUpdate
     */
    description?: string;
}
/**
 * @type SubscriptionBenefitCreate
 * @export
 */
export type SubscriptionBenefitCreate = SubscriptionBenefitCustomBisCreate | SubscriptionBenefitCustomCreate;

/**
 * 
 * @export
 * @interface SubscriptionBenefitCustom
 */
export interface SubscriptionBenefitCustom {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustom
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustom
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustom
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustom
     */
    type: SubscriptionBenefitCustomTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustom
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustom
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustom
     */
    repository_id?: string;
    /**
     * 
     * @type {object}
     * @memberof SubscriptionBenefitCustom
     */
    properties: object;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitCustom
     */
    is_tax_applicable: boolean;
}


/**
 * @export
 */
export const SubscriptionBenefitCustomTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type SubscriptionBenefitCustomTypeEnum = typeof SubscriptionBenefitCustomTypeEnum[keyof typeof SubscriptionBenefitCustomTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitCustomBisCreate
 */
export interface SubscriptionBenefitCustomBisCreate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomBisCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomBisCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomBisCreate
     */
    repository_id?: string;
    /**
     * 
     * @type {object}
     * @memberof SubscriptionBenefitCustomBisCreate
     */
    properties: object;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomBisCreate
     */
    type: SubscriptionBenefitCustomBisCreateTypeEnum;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitCustomBisCreate
     */
    is_tax_applicable: boolean;
}


/**
 * @export
 */
export const SubscriptionBenefitCustomBisCreateTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type SubscriptionBenefitCustomBisCreateTypeEnum = typeof SubscriptionBenefitCustomBisCreateTypeEnum[keyof typeof SubscriptionBenefitCustomBisCreateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitCustomCreate
 */
export interface SubscriptionBenefitCustomCreate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomCreate
     */
    repository_id?: string;
    /**
     * 
     * @type {object}
     * @memberof SubscriptionBenefitCustomCreate
     */
    properties: object;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomCreate
     */
    type: SubscriptionBenefitCustomCreateTypeEnum;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitCustomCreate
     */
    is_tax_applicable: boolean;
}


/**
 * @export
 */
export const SubscriptionBenefitCustomCreateTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type SubscriptionBenefitCustomCreateTypeEnum = typeof SubscriptionBenefitCustomCreateTypeEnum[keyof typeof SubscriptionBenefitCustomCreateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitCustomUpdate
 */
export interface SubscriptionBenefitCustomUpdate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomUpdate
     */
    description?: string;
    /**
     * 
     * @type {object}
     * @memberof SubscriptionBenefitCustomUpdate
     */
    properties?: object;
}

/**
 * An enumeration.
 * @export
 */
export const SubscriptionBenefitType = {
    CUSTOM: 'custom',
    ARTICLES: 'articles'
} as const;
export type SubscriptionBenefitType = typeof SubscriptionBenefitType[keyof typeof SubscriptionBenefitType];

/**
 * @type SubscriptionBenefitUpdate
 * @export
 */
export type SubscriptionBenefitUpdate = SubscriptionBenefitArticlesUpdate | SubscriptionBenefitCustomUpdate;


/**
 * An enumeration.
 * @export
 */
export const SubscriptionStatus = {
    INCOMPLETE: 'incomplete',
    INCOMPLETE_EXPIRED: 'incomplete_expired',
    TRIALING: 'trialing',
    ACTIVE: 'active',
    PAST_DUE: 'past_due',
    CANCELED: 'canceled',
    UNPAID: 'unpaid'
} as const;
export type SubscriptionStatus = typeof SubscriptionStatus[keyof typeof SubscriptionStatus];

/**
 * 
 * @export
 * @interface SubscriptionSummary
 */
export interface SubscriptionSummary {
    /**
     * 
     * @type {PolarSubscriptionSchemasUser}
     * @memberof SubscriptionSummary
     */
    user: PolarSubscriptionSchemasUser;
    /**
     * 
     * @type {SubscriptionTier}
     * @memberof SubscriptionSummary
     */
    subscription_tier: SubscriptionTier;
}
/**
 * 
 * @export
 * @interface SubscriptionTier
 */
export interface SubscriptionTier {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    id: string;
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof SubscriptionTier
     */
    type: SubscriptionTierType;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    description?: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionTier
     */
    is_highlighted: boolean;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionTier
     */
    price_amount: number;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    price_currency: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionTier
     */
    is_archived: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTier
     */
    repository_id?: string;
    /**
     * 
     * @type {Array<SubscriptionTierBenefit>}
     * @memberof SubscriptionTier
     */
    benefits: Array<SubscriptionTierBenefit>;
}
/**
 * 
 * @export
 * @interface SubscriptionTierBenefit
 */
export interface SubscriptionTierBenefit {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierBenefit
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierBenefit
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierBenefit
     */
    id: string;
    /**
     * 
     * @type {SubscriptionBenefitType}
     * @memberof SubscriptionTierBenefit
     */
    type: SubscriptionBenefitType;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierBenefit
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierBenefit
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierBenefit
     */
    repository_id?: string;
}
/**
 * 
 * @export
 * @interface SubscriptionTierBenefitsUpdate
 */
export interface SubscriptionTierBenefitsUpdate {
    /**
     * 
     * @type {Array<string>}
     * @memberof SubscriptionTierBenefitsUpdate
     */
    benefits: Array<string>;
}
/**
 * 
 * @export
 * @interface SubscriptionTierCreate
 */
export interface SubscriptionTierCreate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierCreate
     */
    type: SubscriptionTierCreateTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierCreate
     */
    description?: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionTierCreate
     */
    is_highlighted?: boolean;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionTierCreate
     */
    price_amount: number;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierCreate
     */
    price_currency?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierCreate
     */
    repository_id?: string;
}


/**
 * @export
 */
export const SubscriptionTierCreateTypeEnum = {
    HOBBY: 'hobby',
    PRO: 'pro',
    BUSINESS: 'business'
} as const;
export type SubscriptionTierCreateTypeEnum = typeof SubscriptionTierCreateTypeEnum[keyof typeof SubscriptionTierCreateTypeEnum];


/**
 * An enumeration.
 * @export
 */
export const SubscriptionTierType = {
    FREE: 'free',
    HOBBY: 'hobby',
    PRO: 'pro',
    BUSINESS: 'business'
} as const;
export type SubscriptionTierType = typeof SubscriptionTierType[keyof typeof SubscriptionTierType];

/**
 * 
 * @export
 * @interface SubscriptionTierUpdate
 */
export interface SubscriptionTierUpdate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierUpdate
     */
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierUpdate
     */
    description?: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionTierUpdate
     */
    is_highlighted?: boolean;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionTierUpdate
     */
    price_amount?: number;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierUpdate
     */
    price_currency?: string;
}
/**
 * 
 * @export
 * @interface SubscriptionUpgrade
 */
export interface SubscriptionUpgrade {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUpgrade
     */
    subscription_tier_id: string;
}
/**
 * 
 * @export
 * @interface SubscriptionsStatistics
 */
export interface SubscriptionsStatistics {
    /**
     * 
     * @type {Array<SubscriptionsStatisticsPeriod>}
     * @memberof SubscriptionsStatistics
     */
    periods: Array<SubscriptionsStatisticsPeriod>;
}
/**
 * 
 * @export
 * @interface SubscriptionsStatisticsPeriod
 */
export interface SubscriptionsStatisticsPeriod {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionsStatisticsPeriod
     */
    start_date: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionsStatisticsPeriod
     */
    end_date: string;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionsStatisticsPeriod
     */
    subscribers: number;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionsStatisticsPeriod
     */
    mrr: number;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionsStatisticsPeriod
     */
    cumulative: number;
}
/**
 * 
 * @export
 * @interface SummaryPledge
 */
export interface SummaryPledge {
    /**
     * 
     * @type {PledgeType}
     * @memberof SummaryPledge
     */
    type: PledgeType;
    /**
     * 
     * @type {Pledger}
     * @memberof SummaryPledge
     */
    pledger?: Pledger;
}
/**
 * 
 * @export
 * @interface SynchronizeMembersResponse
 */
export interface SynchronizeMembersResponse {
    /**
     * 
     * @type {boolean}
     * @memberof SynchronizeMembersResponse
     */
    status: boolean;
}
/**
 * 
 * @export
 * @interface TeamAdminMemberPledgedNotification
 */
export interface TeamAdminMemberPledgedNotification {
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    team_member_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    team_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    issue_title: string;
    /**
     * 
     * @type {number}
     * @memberof TeamAdminMemberPledgedNotification
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    issue_repo_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    pledge_id: string;
}
/**
 * 
 * @export
 * @interface Transaction
 */
export interface Transaction {
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    id: string;
    /**
     * 
     * @type {TransactionType}
     * @memberof Transaction
     */
    type: TransactionType;
    /**
     * 
     * @type {PaymentProcessor}
     * @memberof Transaction
     */
    processor: PaymentProcessor;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    currency: string;
    /**
     * 
     * @type {number}
     * @memberof Transaction
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    account_currency: string;
    /**
     * 
     * @type {number}
     * @memberof Transaction
     */
    account_amount: number;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    pledge_id?: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    issue_reward_id?: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    subscription_id?: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    payout_transaction_id?: string;
    /**
     * 
     * @type {TransactionPledge}
     * @memberof Transaction
     */
    pledge?: TransactionPledge;
    /**
     * 
     * @type {TransactionIssueReward}
     * @memberof Transaction
     */
    issue_reward?: TransactionIssueReward;
    /**
     * 
     * @type {TransactionSubscription}
     * @memberof Transaction
     */
    subscription?: TransactionSubscription;
}
/**
 * 
 * @export
 * @interface TransactionDetails
 */
export interface TransactionDetails {
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    id: string;
    /**
     * 
     * @type {TransactionType}
     * @memberof TransactionDetails
     */
    type: TransactionType;
    /**
     * 
     * @type {PaymentProcessor}
     * @memberof TransactionDetails
     */
    processor: PaymentProcessor;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    currency: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    account_currency: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    account_amount: number;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    pledge_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    issue_reward_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    subscription_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    payout_transaction_id?: string;
    /**
     * 
     * @type {TransactionPledge}
     * @memberof TransactionDetails
     */
    pledge?: TransactionPledge;
    /**
     * 
     * @type {TransactionIssueReward}
     * @memberof TransactionDetails
     */
    issue_reward?: TransactionIssueReward;
    /**
     * 
     * @type {TransactionSubscription}
     * @memberof TransactionDetails
     */
    subscription?: TransactionSubscription;
    /**
     * 
     * @type {Array<Transaction>}
     * @memberof TransactionDetails
     */
    paid_transactions: Array<Transaction>;
}
/**
 * 
 * @export
 * @interface TransactionIssue
 */
export interface TransactionIssue {
    /**
     * 
     * @type {string}
     * @memberof TransactionIssue
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssue
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssue
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof TransactionIssue
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssue
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssue
     */
    repository_id: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionIssue
     */
    number: number;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssue
     */
    title: string;
    /**
     * 
     * @type {TransactionOrganization}
     * @memberof TransactionIssue
     */
    organization: TransactionOrganization;
    /**
     * 
     * @type {TransactionRepository}
     * @memberof TransactionIssue
     */
    repository: TransactionRepository;
}
/**
 * 
 * @export
 * @interface TransactionIssueReward
 */
export interface TransactionIssueReward {
    /**
     * 
     * @type {string}
     * @memberof TransactionIssueReward
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssueReward
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssueReward
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssueReward
     */
    issue_id: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionIssueReward
     */
    share_thousands: number;
}
/**
 * 
 * @export
 * @interface TransactionOrganization
 */
export interface TransactionOrganization {
    /**
     * 
     * @type {string}
     * @memberof TransactionOrganization
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrganization
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrganization
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof TransactionOrganization
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrganization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrganization
     */
    avatar_url: string;
    /**
     * 
     * @type {boolean}
     * @memberof TransactionOrganization
     */
    is_personal: boolean;
}
/**
 * 
 * @export
 * @interface TransactionPledge
 */
export interface TransactionPledge {
    /**
     * 
     * @type {string}
     * @memberof TransactionPledge
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionPledge
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionPledge
     */
    id: string;
    /**
     * 
     * @type {PledgeState}
     * @memberof TransactionPledge
     */
    state: PledgeState;
    /**
     * 
     * @type {TransactionIssue}
     * @memberof TransactionPledge
     */
    issue: TransactionIssue;
}
/**
 * 
 * @export
 * @interface TransactionRepository
 */
export interface TransactionRepository {
    /**
     * 
     * @type {string}
     * @memberof TransactionRepository
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionRepository
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionRepository
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof TransactionRepository
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof TransactionRepository
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionRepository
     */
    name: string;
}
/**
 * 
 * @export
 * @interface TransactionSubscription
 */
export interface TransactionSubscription {
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscription
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscription
     */
    id: string;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof TransactionSubscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscription
     */
    price_currency: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionSubscription
     */
    price_amount: number;
    /**
     * 
     * @type {TransactionSubscriptionTier}
     * @memberof TransactionSubscription
     */
    subscription_tier: TransactionSubscriptionTier;
}
/**
 * 
 * @export
 * @interface TransactionSubscriptionTier
 */
export interface TransactionSubscriptionTier {
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscriptionTier
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscriptionTier
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscriptionTier
     */
    id: string;
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof TransactionSubscriptionTier
     */
    type: SubscriptionTierType;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscriptionTier
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscriptionTier
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionSubscriptionTier
     */
    repository_id?: string;
    /**
     * 
     * @type {TransactionOrganization}
     * @memberof TransactionSubscriptionTier
     */
    organization?: TransactionOrganization;
    /**
     * 
     * @type {TransactionRepository}
     * @memberof TransactionSubscriptionTier
     */
    repository?: TransactionRepository;
}

/**
 * Type of transactions.
 * @export
 */
export const TransactionType = {
    PAYMENT: 'payment',
    REFUND: 'refund',
    DISPUTE: 'dispute',
    TRANSFER: 'transfer',
    PAYOUT: 'payout'
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

/**
 * 
 * @export
 * @interface TransactionsBalance
 */
export interface TransactionsBalance {
    /**
     * 
     * @type {string}
     * @memberof TransactionsBalance
     */
    currency: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionsBalance
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof TransactionsBalance
     */
    account_currency: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionsBalance
     */
    account_amount: number;
}
/**
 * 
 * @export
 * @interface TransactionsSummary
 */
export interface TransactionsSummary {
    /**
     * 
     * @type {TransactionsBalance}
     * @memberof TransactionsSummary
     */
    balance: TransactionsBalance;
    /**
     * 
     * @type {TransactionsBalance}
     * @memberof TransactionsSummary
     */
    payout: TransactionsBalance;
}
/**
 * 
 * @export
 * @interface UpdateIssue
 */
export interface UpdateIssue {
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof UpdateIssue
     */
    funding_goal?: CurrencyAmount;
    /**
     * 
     * @type {number}
     * @memberof UpdateIssue
     */
    upfront_split_to_contributors?: number;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateIssue
     */
    set_upfront_split_to_contributors?: boolean;
}
/**
 * 
 * @export
 * @interface UserRead
 */
export interface UserRead {
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    modified_at?: string;
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
 * An enumeration.
 * @export
 */
export const UserSignupType = {
    MAINTAINER: 'maintainer',
    BACKER: 'backer'
} as const;
export type UserSignupType = typeof UserSignupType[keyof typeof UserSignupType];

/**
 * 
 * @export
 * @interface UserStripePortalSession
 */
export interface UserStripePortalSession {
    /**
     * 
     * @type {string}
     * @memberof UserStripePortalSession
     */
    url: string;
}
/**
 * 
 * @export
 * @interface UserUpdateSettings
 */
export interface UserUpdateSettings {
    /**
     * 
     * @type {boolean}
     * @memberof UserUpdateSettings
     */
    email_newsletters_and_changelogs?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof UserUpdateSettings
     */
    email_promotions_and_events?: boolean;
}
/**
 * 
 * @export
 * @interface ValidationError
 */
export interface ValidationError {
    /**
     * 
     * @type {Array<LocationInner>}
     * @memberof ValidationError
     */
    loc: Array<LocationInner>;
    /**
     * 
     * @type {string}
     * @memberof ValidationError
     */
    msg: string;
    /**
     * 
     * @type {string}
     * @memberof ValidationError
     */
    type: string;
}

/**
 * An enumeration.
 * @export
 */
export const Visibility = {
    PUBLIC: 'public',
    PRIVATE: 'private'
} as const;
export type Visibility = typeof Visibility[keyof typeof Visibility];

/**
 * 
 * @export
 * @interface WebhookResponse
 */
export interface WebhookResponse {
    /**
     * 
     * @type {boolean}
     * @memberof WebhookResponse
     */
    success: boolean;
    /**
     * 
     * @type {string}
     * @memberof WebhookResponse
     */
    message?: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookResponse
     */
    job_id?: string;
}
