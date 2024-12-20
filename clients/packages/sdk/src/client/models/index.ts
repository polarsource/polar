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
     * @type {Status}
     * @memberof Account
     */
    status: Status;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    stripe_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    open_collective_slug: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof Account
     */
    is_details_submitted: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Account
     */
    is_charges_enabled: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Account
     */
    is_payouts_enabled: boolean;
    /**
     * 
     * @type {string}
     * @memberof Account
     */
    country: string;
    /**
     * 
     * @type {Array<UserBase>}
     * @memberof Account
     */
    users: Array<UserBase>;
    /**
     * 
     * @type {Array<Organization>}
     * @memberof Account
     */
    organizations: Array<Organization>;
}


/**
 * 
 * @export
 * @interface AccountCreate
 */
export interface AccountCreate {
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
    open_collective_slug?: string | null;
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
 * 
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
 * @interface Address
 */
export interface Address {
    /**
     * 
     * @type {string}
     * @memberof Address
     */
    line1?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Address
     */
    line2?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Address
     */
    postal_code?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Address
     */
    city?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Address
     */
    state?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Address
     */
    country: string;
}
/**
 * 
 * @export
 * @interface AdvertisementCampaign
 */
export interface AdvertisementCampaign {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    image_url: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    image_url_dark: string | null;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    link_url: string;
}
/**
 * 
 * @export
 * @interface AdvertisementCampaignListResource
 */
export interface AdvertisementCampaignListResource {
    /**
     * 
     * @type {Array<AdvertisementCampaign>}
     * @memberof AdvertisementCampaignListResource
     */
    items: Array<AdvertisementCampaign>;
    /**
     * 
     * @type {Pagination}
     * @memberof AdvertisementCampaignListResource
     */
    pagination: Pagination;
    /**
     * The dimensions (width, height) in pixels of the advertisement images.
     * @type {Array<number>}
     * @memberof AdvertisementCampaignListResource
     */
    dimensions: Array<number>;
}

/**
 * 
 * @export
 */
export const AdvertisementSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    GRANTED_AT: 'granted_at',
    GRANTED_AT2: '-granted_at',
    VIEWS: 'views',
    VIEWS2: '-views',
    CLICKS: 'clicks',
    CLICKS2: '-clicks'
} as const;
export type AdvertisementSortProperty = typeof AdvertisementSortProperty[keyof typeof AdvertisementSortProperty];

/**
 * 
 * @export
 * @interface AlreadyCanceledSubscription
 */
export interface AlreadyCanceledSubscription {
    /**
     * 
     * @type {string}
     * @memberof AlreadyCanceledSubscription
     */
    error: AlreadyCanceledSubscriptionErrorEnum;
    /**
     * 
     * @type {string}
     * @memberof AlreadyCanceledSubscription
     */
    detail: string;
}


/**
 * @export
 */
export const AlreadyCanceledSubscriptionErrorEnum = {
    ALREADY_CANCELED_SUBSCRIPTION: 'AlreadyCanceledSubscription'
} as const;
export type AlreadyCanceledSubscriptionErrorEnum = typeof AlreadyCanceledSubscriptionErrorEnum[keyof typeof AlreadyCanceledSubscriptionErrorEnum];

/**
 * App Permissions
 * 
 * The permissions granted to the user access token.
 * 
 * Examples:
 *     {'contents': 'read', 'issues': 'read', 'deployments': 'write', 'single_file':
 * 'read'}
 * @export
 * @interface AppPermissionsType
 */
export interface AppPermissionsType {
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    actions?: AppPermissionsTypeActionsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    administration?: AppPermissionsTypeAdministrationEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    checks?: AppPermissionsTypeChecksEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    codespaces?: AppPermissionsTypeCodespacesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    contents?: AppPermissionsTypeContentsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    dependabot_secrets?: AppPermissionsTypeDependabotSecretsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    deployments?: AppPermissionsTypeDeploymentsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    environments?: AppPermissionsTypeEnvironmentsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    issues?: AppPermissionsTypeIssuesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    metadata?: AppPermissionsTypeMetadataEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    packages?: AppPermissionsTypePackagesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    pages?: AppPermissionsTypePagesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    pull_requests?: AppPermissionsTypePullRequestsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    repository_custom_properties?: AppPermissionsTypeRepositoryCustomPropertiesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    repository_hooks?: AppPermissionsTypeRepositoryHooksEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    repository_projects?: AppPermissionsTypeRepositoryProjectsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    secret_scanning_alerts?: AppPermissionsTypeSecretScanningAlertsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    secrets?: AppPermissionsTypeSecretsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    security_events?: AppPermissionsTypeSecurityEventsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    single_file?: AppPermissionsTypeSingleFileEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    statuses?: AppPermissionsTypeStatusesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    vulnerability_alerts?: AppPermissionsTypeVulnerabilityAlertsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    workflows?: AppPermissionsTypeWorkflowsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    members?: AppPermissionsTypeMembersEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_administration?: AppPermissionsTypeOrganizationAdministrationEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_custom_roles?: AppPermissionsTypeOrganizationCustomRolesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_custom_org_roles?: AppPermissionsTypeOrganizationCustomOrgRolesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_custom_properties?: AppPermissionsTypeOrganizationCustomPropertiesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_copilot_seat_management?: AppPermissionsTypeOrganizationCopilotSeatManagementEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_announcement_banners?: AppPermissionsTypeOrganizationAnnouncementBannersEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_events?: AppPermissionsTypeOrganizationEventsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_hooks?: AppPermissionsTypeOrganizationHooksEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_personal_access_tokens?: AppPermissionsTypeOrganizationPersonalAccessTokensEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_personal_access_token_requests?: AppPermissionsTypeOrganizationPersonalAccessTokenRequestsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_plan?: AppPermissionsTypeOrganizationPlanEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_projects?: AppPermissionsTypeOrganizationProjectsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_packages?: AppPermissionsTypeOrganizationPackagesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_secrets?: AppPermissionsTypeOrganizationSecretsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_self_hosted_runners?: AppPermissionsTypeOrganizationSelfHostedRunnersEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    organization_user_blocking?: AppPermissionsTypeOrganizationUserBlockingEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    team_discussions?: AppPermissionsTypeTeamDiscussionsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    email_addresses?: AppPermissionsTypeEmailAddressesEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    followers?: AppPermissionsTypeFollowersEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    git_ssh_keys?: AppPermissionsTypeGitSshKeysEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    gpg_keys?: AppPermissionsTypeGpgKeysEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    interaction_limits?: AppPermissionsTypeInteractionLimitsEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    profile?: AppPermissionsTypeProfileEnum;
    /**
     * 
     * @type {string}
     * @memberof AppPermissionsType
     */
    starring?: AppPermissionsTypeStarringEnum;
}


/**
 * @export
 */
export const AppPermissionsTypeActionsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeActionsEnum = typeof AppPermissionsTypeActionsEnum[keyof typeof AppPermissionsTypeActionsEnum];

/**
 * @export
 */
export const AppPermissionsTypeAdministrationEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeAdministrationEnum = typeof AppPermissionsTypeAdministrationEnum[keyof typeof AppPermissionsTypeAdministrationEnum];

/**
 * @export
 */
export const AppPermissionsTypeChecksEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeChecksEnum = typeof AppPermissionsTypeChecksEnum[keyof typeof AppPermissionsTypeChecksEnum];

/**
 * @export
 */
export const AppPermissionsTypeCodespacesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeCodespacesEnum = typeof AppPermissionsTypeCodespacesEnum[keyof typeof AppPermissionsTypeCodespacesEnum];

/**
 * @export
 */
export const AppPermissionsTypeContentsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeContentsEnum = typeof AppPermissionsTypeContentsEnum[keyof typeof AppPermissionsTypeContentsEnum];

/**
 * @export
 */
export const AppPermissionsTypeDependabotSecretsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeDependabotSecretsEnum = typeof AppPermissionsTypeDependabotSecretsEnum[keyof typeof AppPermissionsTypeDependabotSecretsEnum];

/**
 * @export
 */
export const AppPermissionsTypeDeploymentsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeDeploymentsEnum = typeof AppPermissionsTypeDeploymentsEnum[keyof typeof AppPermissionsTypeDeploymentsEnum];

/**
 * @export
 */
export const AppPermissionsTypeEnvironmentsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeEnvironmentsEnum = typeof AppPermissionsTypeEnvironmentsEnum[keyof typeof AppPermissionsTypeEnvironmentsEnum];

/**
 * @export
 */
export const AppPermissionsTypeIssuesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeIssuesEnum = typeof AppPermissionsTypeIssuesEnum[keyof typeof AppPermissionsTypeIssuesEnum];

/**
 * @export
 */
export const AppPermissionsTypeMetadataEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeMetadataEnum = typeof AppPermissionsTypeMetadataEnum[keyof typeof AppPermissionsTypeMetadataEnum];

/**
 * @export
 */
export const AppPermissionsTypePackagesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypePackagesEnum = typeof AppPermissionsTypePackagesEnum[keyof typeof AppPermissionsTypePackagesEnum];

/**
 * @export
 */
export const AppPermissionsTypePagesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypePagesEnum = typeof AppPermissionsTypePagesEnum[keyof typeof AppPermissionsTypePagesEnum];

/**
 * @export
 */
export const AppPermissionsTypePullRequestsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypePullRequestsEnum = typeof AppPermissionsTypePullRequestsEnum[keyof typeof AppPermissionsTypePullRequestsEnum];

/**
 * @export
 */
export const AppPermissionsTypeRepositoryCustomPropertiesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeRepositoryCustomPropertiesEnum = typeof AppPermissionsTypeRepositoryCustomPropertiesEnum[keyof typeof AppPermissionsTypeRepositoryCustomPropertiesEnum];

/**
 * @export
 */
export const AppPermissionsTypeRepositoryHooksEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeRepositoryHooksEnum = typeof AppPermissionsTypeRepositoryHooksEnum[keyof typeof AppPermissionsTypeRepositoryHooksEnum];

/**
 * @export
 */
export const AppPermissionsTypeRepositoryProjectsEnum = {
    READ: 'read',
    WRITE: 'write',
    ADMIN: 'admin'
} as const;
export type AppPermissionsTypeRepositoryProjectsEnum = typeof AppPermissionsTypeRepositoryProjectsEnum[keyof typeof AppPermissionsTypeRepositoryProjectsEnum];

/**
 * @export
 */
export const AppPermissionsTypeSecretScanningAlertsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeSecretScanningAlertsEnum = typeof AppPermissionsTypeSecretScanningAlertsEnum[keyof typeof AppPermissionsTypeSecretScanningAlertsEnum];

/**
 * @export
 */
export const AppPermissionsTypeSecretsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeSecretsEnum = typeof AppPermissionsTypeSecretsEnum[keyof typeof AppPermissionsTypeSecretsEnum];

/**
 * @export
 */
export const AppPermissionsTypeSecurityEventsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeSecurityEventsEnum = typeof AppPermissionsTypeSecurityEventsEnum[keyof typeof AppPermissionsTypeSecurityEventsEnum];

/**
 * @export
 */
export const AppPermissionsTypeSingleFileEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeSingleFileEnum = typeof AppPermissionsTypeSingleFileEnum[keyof typeof AppPermissionsTypeSingleFileEnum];

/**
 * @export
 */
export const AppPermissionsTypeStatusesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeStatusesEnum = typeof AppPermissionsTypeStatusesEnum[keyof typeof AppPermissionsTypeStatusesEnum];

/**
 * @export
 */
export const AppPermissionsTypeVulnerabilityAlertsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeVulnerabilityAlertsEnum = typeof AppPermissionsTypeVulnerabilityAlertsEnum[keyof typeof AppPermissionsTypeVulnerabilityAlertsEnum];

/**
 * @export
 */
export const AppPermissionsTypeWorkflowsEnum = {
    WRITE: 'write'
} as const;
export type AppPermissionsTypeWorkflowsEnum = typeof AppPermissionsTypeWorkflowsEnum[keyof typeof AppPermissionsTypeWorkflowsEnum];

/**
 * @export
 */
export const AppPermissionsTypeMembersEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeMembersEnum = typeof AppPermissionsTypeMembersEnum[keyof typeof AppPermissionsTypeMembersEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationAdministrationEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationAdministrationEnum = typeof AppPermissionsTypeOrganizationAdministrationEnum[keyof typeof AppPermissionsTypeOrganizationAdministrationEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationCustomRolesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationCustomRolesEnum = typeof AppPermissionsTypeOrganizationCustomRolesEnum[keyof typeof AppPermissionsTypeOrganizationCustomRolesEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationCustomOrgRolesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationCustomOrgRolesEnum = typeof AppPermissionsTypeOrganizationCustomOrgRolesEnum[keyof typeof AppPermissionsTypeOrganizationCustomOrgRolesEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationCustomPropertiesEnum = {
    READ: 'read',
    WRITE: 'write',
    ADMIN: 'admin'
} as const;
export type AppPermissionsTypeOrganizationCustomPropertiesEnum = typeof AppPermissionsTypeOrganizationCustomPropertiesEnum[keyof typeof AppPermissionsTypeOrganizationCustomPropertiesEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationCopilotSeatManagementEnum = {
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationCopilotSeatManagementEnum = typeof AppPermissionsTypeOrganizationCopilotSeatManagementEnum[keyof typeof AppPermissionsTypeOrganizationCopilotSeatManagementEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationAnnouncementBannersEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationAnnouncementBannersEnum = typeof AppPermissionsTypeOrganizationAnnouncementBannersEnum[keyof typeof AppPermissionsTypeOrganizationAnnouncementBannersEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationEventsEnum = {
    READ: 'read'
} as const;
export type AppPermissionsTypeOrganizationEventsEnum = typeof AppPermissionsTypeOrganizationEventsEnum[keyof typeof AppPermissionsTypeOrganizationEventsEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationHooksEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationHooksEnum = typeof AppPermissionsTypeOrganizationHooksEnum[keyof typeof AppPermissionsTypeOrganizationHooksEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationPersonalAccessTokensEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationPersonalAccessTokensEnum = typeof AppPermissionsTypeOrganizationPersonalAccessTokensEnum[keyof typeof AppPermissionsTypeOrganizationPersonalAccessTokensEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationPersonalAccessTokenRequestsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationPersonalAccessTokenRequestsEnum = typeof AppPermissionsTypeOrganizationPersonalAccessTokenRequestsEnum[keyof typeof AppPermissionsTypeOrganizationPersonalAccessTokenRequestsEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationPlanEnum = {
    READ: 'read'
} as const;
export type AppPermissionsTypeOrganizationPlanEnum = typeof AppPermissionsTypeOrganizationPlanEnum[keyof typeof AppPermissionsTypeOrganizationPlanEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationProjectsEnum = {
    READ: 'read',
    WRITE: 'write',
    ADMIN: 'admin'
} as const;
export type AppPermissionsTypeOrganizationProjectsEnum = typeof AppPermissionsTypeOrganizationProjectsEnum[keyof typeof AppPermissionsTypeOrganizationProjectsEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationPackagesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationPackagesEnum = typeof AppPermissionsTypeOrganizationPackagesEnum[keyof typeof AppPermissionsTypeOrganizationPackagesEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationSecretsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationSecretsEnum = typeof AppPermissionsTypeOrganizationSecretsEnum[keyof typeof AppPermissionsTypeOrganizationSecretsEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationSelfHostedRunnersEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationSelfHostedRunnersEnum = typeof AppPermissionsTypeOrganizationSelfHostedRunnersEnum[keyof typeof AppPermissionsTypeOrganizationSelfHostedRunnersEnum];

/**
 * @export
 */
export const AppPermissionsTypeOrganizationUserBlockingEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeOrganizationUserBlockingEnum = typeof AppPermissionsTypeOrganizationUserBlockingEnum[keyof typeof AppPermissionsTypeOrganizationUserBlockingEnum];

/**
 * @export
 */
export const AppPermissionsTypeTeamDiscussionsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeTeamDiscussionsEnum = typeof AppPermissionsTypeTeamDiscussionsEnum[keyof typeof AppPermissionsTypeTeamDiscussionsEnum];

/**
 * @export
 */
export const AppPermissionsTypeEmailAddressesEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeEmailAddressesEnum = typeof AppPermissionsTypeEmailAddressesEnum[keyof typeof AppPermissionsTypeEmailAddressesEnum];

/**
 * @export
 */
export const AppPermissionsTypeFollowersEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeFollowersEnum = typeof AppPermissionsTypeFollowersEnum[keyof typeof AppPermissionsTypeFollowersEnum];

/**
 * @export
 */
export const AppPermissionsTypeGitSshKeysEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeGitSshKeysEnum = typeof AppPermissionsTypeGitSshKeysEnum[keyof typeof AppPermissionsTypeGitSshKeysEnum];

/**
 * @export
 */
export const AppPermissionsTypeGpgKeysEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeGpgKeysEnum = typeof AppPermissionsTypeGpgKeysEnum[keyof typeof AppPermissionsTypeGpgKeysEnum];

/**
 * @export
 */
export const AppPermissionsTypeInteractionLimitsEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeInteractionLimitsEnum = typeof AppPermissionsTypeInteractionLimitsEnum[keyof typeof AppPermissionsTypeInteractionLimitsEnum];

/**
 * @export
 */
export const AppPermissionsTypeProfileEnum = {
    WRITE: 'write'
} as const;
export type AppPermissionsTypeProfileEnum = typeof AppPermissionsTypeProfileEnum[keyof typeof AppPermissionsTypeProfileEnum];

/**
 * @export
 */
export const AppPermissionsTypeStarringEnum = {
    READ: 'read',
    WRITE: 'write'
} as const;
export type AppPermissionsTypeStarringEnum = typeof AppPermissionsTypeStarringEnum[keyof typeof AppPermissionsTypeStarringEnum];

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
 * Schema of a custom field attached to a resource.
 * @export
 * @interface AttachedCustomField
 */
export interface AttachedCustomField {
    /**
     * ID of the custom field.
     * @type {string}
     * @memberof AttachedCustomField
     */
    custom_field_id: string;
    /**
     * 
     * @type {CustomField}
     * @memberof AttachedCustomField
     */
    custom_field: CustomField;
    /**
     * Order of the custom field in the resource.
     * @type {number}
     * @memberof AttachedCustomField
     */
    order: number;
    /**
     * Whether the value is required for this custom field.
     * @type {boolean}
     * @memberof AttachedCustomField
     */
    required: boolean;
}
/**
 * Schema to attach a custom field to a resource.
 * @export
 * @interface AttachedCustomFieldCreate
 */
export interface AttachedCustomFieldCreate {
    /**
     * ID of the custom field to attach.
     * @type {string}
     * @memberof AttachedCustomFieldCreate
     */
    custom_field_id: string;
    /**
     * Whether the value is required for this custom field.
     * @type {boolean}
     * @memberof AttachedCustomFieldCreate
     */
    required: boolean;
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
 * @interface AuthorizeOrganization
 */
export interface AuthorizeOrganization {
    /**
     * 
     * @type {string}
     * @memberof AuthorizeOrganization
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeOrganization
     */
    slug: string;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeOrganization
     */
    avatar_url: string | null;
}
/**
 * 
 * @export
 * @interface AuthorizeResponse
 */
export interface AuthorizeResponse {
    /**
     * 
     * @type {string}
     * @memberof AuthorizeResponse
     */
    url: string;
}
/**
 * 
 * @export
 * @interface AuthorizeResponseOrganization
 */
export interface AuthorizeResponseOrganization {
    /**
     * 
     * @type {OAuth2ClientPublic}
     * @memberof AuthorizeResponseOrganization
     */
    client: OAuth2ClientPublic;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeResponseOrganization
     */
    sub_type: AuthorizeResponseOrganizationSubTypeEnum;
    /**
     * 
     * @type {AuthorizeOrganization}
     * @memberof AuthorizeResponseOrganization
     */
    sub: AuthorizeOrganization | null;
    /**
     * 
     * @type {Array<Scope>}
     * @memberof AuthorizeResponseOrganization
     */
    scopes: Array<Scope>;
    /**
     * 
     * @type {Array<AuthorizeOrganization>}
     * @memberof AuthorizeResponseOrganization
     */
    organizations: Array<AuthorizeOrganization>;
}


/**
 * @export
 */
export const AuthorizeResponseOrganizationSubTypeEnum = {
    ORGANIZATION: 'organization'
} as const;
export type AuthorizeResponseOrganizationSubTypeEnum = typeof AuthorizeResponseOrganizationSubTypeEnum[keyof typeof AuthorizeResponseOrganizationSubTypeEnum];

/**
 * 
 * @export
 * @interface AuthorizeResponseUser
 */
export interface AuthorizeResponseUser {
    /**
     * 
     * @type {OAuth2ClientPublic}
     * @memberof AuthorizeResponseUser
     */
    client: OAuth2ClientPublic;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeResponseUser
     */
    sub_type: AuthorizeResponseUserSubTypeEnum;
    /**
     * 
     * @type {AuthorizeUser}
     * @memberof AuthorizeResponseUser
     */
    sub: AuthorizeUser | null;
    /**
     * 
     * @type {Array<Scope>}
     * @memberof AuthorizeResponseUser
     */
    scopes: Array<Scope>;
}


/**
 * @export
 */
export const AuthorizeResponseUserSubTypeEnum = {
    USER: 'user'
} as const;
export type AuthorizeResponseUserSubTypeEnum = typeof AuthorizeResponseUserSubTypeEnum[keyof typeof AuthorizeResponseUserSubTypeEnum];

/**
 * 
 * @export
 * @interface AuthorizeUser
 */
export interface AuthorizeUser {
    /**
     * 
     * @type {string}
     * @memberof AuthorizeUser
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeUser
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeUser
     */
    avatar_url: string | null;
}

/**
 * 
 * @export
 */
export const AvailableScope = {
    OPENID: 'openid',
    PROFILE: 'profile',
    EMAIL: 'email',
    USERREAD: 'user:read',
    ORGANIZATIONSREAD: 'organizations:read',
    ORGANIZATIONSWRITE: 'organizations:write',
    CUSTOM_FIELDSREAD: 'custom_fields:read',
    CUSTOM_FIELDSWRITE: 'custom_fields:write',
    DISCOUNTSREAD: 'discounts:read',
    DISCOUNTSWRITE: 'discounts:write',
    CHECKOUT_LINKSREAD: 'checkout_links:read',
    CHECKOUT_LINKSWRITE: 'checkout_links:write',
    CHECKOUTSREAD: 'checkouts:read',
    CHECKOUTSWRITE: 'checkouts:write',
    PRODUCTSREAD: 'products:read',
    PRODUCTSWRITE: 'products:write',
    BENEFITSREAD: 'benefits:read',
    BENEFITSWRITE: 'benefits:write',
    FILESREAD: 'files:read',
    FILESWRITE: 'files:write',
    SUBSCRIPTIONSREAD: 'subscriptions:read',
    SUBSCRIPTIONSWRITE: 'subscriptions:write',
    CUSTOMERSREAD: 'customers:read',
    CUSTOMERSWRITE: 'customers:write',
    CUSTOMER_SESSIONSWRITE: 'customer_sessions:write',
    ORDERSREAD: 'orders:read',
    METRICSREAD: 'metrics:read',
    WEBHOOKSREAD: 'webhooks:read',
    WEBHOOKSWRITE: 'webhooks:write',
    EXTERNAL_ORGANIZATIONSREAD: 'external_organizations:read',
    LICENSE_KEYSREAD: 'license_keys:read',
    LICENSE_KEYSWRITE: 'license_keys:write',
    REPOSITORIESREAD: 'repositories:read',
    REPOSITORIESWRITE: 'repositories:write',
    ISSUESREAD: 'issues:read',
    ISSUESWRITE: 'issues:write',
    CUSTOMER_PORTALREAD: 'customer_portal:read',
    CUSTOMER_PORTALWRITE: 'customer_portal:write'
} as const;
export type AvailableScope = typeof AvailableScope[keyof typeof AvailableScope];

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
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BackofficePledge
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof BackofficePledge
     */
    id: string;
    /**
     * Amount pledged towards the issue
     * @type {number}
     * @memberof BackofficePledge
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    currency: string;
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
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    refunded_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    scheduled_payout_at?: string | null;
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
    pledger?: Pledger | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    hosted_invoice_url?: string | null;
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
    created_by?: Pledger | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    payment_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    dispute_reason: string | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    disputed_by_user_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    disputed_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    pledger_email: string | null;
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
     * @type {User}
     * @memberof BackofficeReward
     */
    user?: User | null;
    /**
     * 
     * @type {Organization}
     * @memberof BackofficeReward
     */
    organization?: Organization | null;
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
     * 
     * @type {string}
     * @memberof BackofficeReward
     */
    paid_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficeReward
     */
    transfer_id: string | null;
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
    pledge_payment_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BackofficeReward
     */
    pledger_email: string | null;
}


/**
 * @type Benefit
 * @export
 */
export type Benefit = BenefitAds | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository | BenefitLicenseKeys;

/**
 * A benefit of type `ads`.
 * 
 * Use it so your backers can display ads on your README, website, etc.
 * @export
 * @interface BenefitAds
 */
export interface BenefitAds {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitAds
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitAds
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitAds
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitAds
     */
    type: BenefitAdsTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitAds
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitAds
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitAds
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitAds
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitAdsProperties}
     * @memberof BenefitAds
     */
    properties: BenefitAdsProperties;
}


/**
 * @export
 */
export const BenefitAdsTypeEnum = {
    ADS: 'ads'
} as const;
export type BenefitAdsTypeEnum = typeof BenefitAdsTypeEnum[keyof typeof BenefitAdsTypeEnum];

/**
 * 
 * @export
 * @interface BenefitAdsCreate
 */
export interface BenefitAdsCreate {
    /**
     * 
     * @type {string}
     * @memberof BenefitAdsCreate
     */
    type: BenefitAdsCreateTypeEnum;
    /**
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitAdsCreate
     */
    description: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof BenefitAdsCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {BenefitAdsProperties}
     * @memberof BenefitAdsCreate
     */
    properties: BenefitAdsProperties;
}


/**
 * @export
 */
export const BenefitAdsCreateTypeEnum = {
    ADS: 'ads'
} as const;
export type BenefitAdsCreateTypeEnum = typeof BenefitAdsCreateTypeEnum[keyof typeof BenefitAdsCreateTypeEnum];

/**
 * Properties for a benefit of type `ads`.
 * @export
 * @interface BenefitAdsProperties
 */
export interface BenefitAdsProperties {
    /**
     * The height of the displayed ad.
     * @type {number}
     * @memberof BenefitAdsProperties
     */
    image_height?: number;
    /**
     * The width of the displayed ad.
     * @type {number}
     * @memberof BenefitAdsProperties
     */
    image_width?: number;
}
/**
 * 
 * @export
 * @interface BenefitAdsSubscriber
 */
export interface BenefitAdsSubscriber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitAdsSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitAdsSubscriber
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitAdsSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitAdsSubscriber
     */
    type: BenefitAdsSubscriberTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitAdsSubscriber
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitAdsSubscriber
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitAdsSubscriber
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitAdsSubscriber
     */
    organization_id: string;
    /**
     * 
     * @type {Organization}
     * @memberof BenefitAdsSubscriber
     */
    organization: Organization;
    /**
     * 
     * @type {BenefitAdsProperties}
     * @memberof BenefitAdsSubscriber
     */
    properties: BenefitAdsProperties;
}


/**
 * @export
 */
export const BenefitAdsSubscriberTypeEnum = {
    ADS: 'ads'
} as const;
export type BenefitAdsSubscriberTypeEnum = typeof BenefitAdsSubscriberTypeEnum[keyof typeof BenefitAdsSubscriberTypeEnum];

/**
 * 
 * @export
 * @interface BenefitAdsUpdate
 */
export interface BenefitAdsUpdate {
    /**
     * 
     * @type {string}
     * @memberof BenefitAdsUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitAdsUpdate
     */
    type: BenefitAdsUpdateTypeEnum;
    /**
     * 
     * @type {BenefitAdsProperties}
     * @memberof BenefitAdsUpdate
     */
    properties?: BenefitAdsProperties | null;
}


/**
 * @export
 */
export const BenefitAdsUpdateTypeEnum = {
    ADS: 'ads'
} as const;
export type BenefitAdsUpdateTypeEnum = typeof BenefitAdsUpdateTypeEnum[keyof typeof BenefitAdsUpdateTypeEnum];

/**
 * 
 * @export
 * @interface BenefitBase
 */
export interface BenefitBase {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitBase
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitBase
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitBase
     */
    id: string;
    /**
     * 
     * @type {BenefitType}
     * @memberof BenefitBase
     */
    type: BenefitType;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitBase
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitBase
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitBase
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitBase
     */
    organization_id: string;
}


/**
 * @type BenefitCreate
 * 
 * @export
 */
export type BenefitCreate = { type: 'ads' } & BenefitAdsCreate | { type: 'custom' } & BenefitCustomCreate | { type: 'discord' } & BenefitDiscordCreate | { type: 'downloadables' } & BenefitDownloadablesCreate | { type: 'github_repository' } & BenefitGitHubRepositoryCreate | { type: 'license_keys' } & BenefitLicenseKeysCreate;
/**
 * A benefit of type `custom`.
 * 
 * Use it to grant any kind of benefit that doesn't fit in the other types.
 * @export
 * @interface BenefitCustom
 */
export interface BenefitCustom {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitCustom
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitCustom
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitCustom
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitCustom
     */
    type: BenefitCustomTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitCustom
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitCustom
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitCustom
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitCustom
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitCustomProperties}
     * @memberof BenefitCustom
     */
    properties: BenefitCustomProperties;
    /**
     * 
     * @type {boolean}
     * @memberof BenefitCustom
     * @deprecated
     */
    is_tax_applicable: boolean;
}


/**
 * @export
 */
export const BenefitCustomTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type BenefitCustomTypeEnum = typeof BenefitCustomTypeEnum[keyof typeof BenefitCustomTypeEnum];

/**
 * Schema to create a benefit of type `custom`.
 * @export
 * @interface BenefitCustomCreate
 */
export interface BenefitCustomCreate {
    /**
     * 
     * @type {string}
     * @memberof BenefitCustomCreate
     */
    type: BenefitCustomCreateTypeEnum;
    /**
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitCustomCreate
     */
    description: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof BenefitCustomCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {BenefitCustomCreateProperties}
     * @memberof BenefitCustomCreate
     */
    properties: BenefitCustomCreateProperties;
}


/**
 * @export
 */
export const BenefitCustomCreateTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type BenefitCustomCreateTypeEnum = typeof BenefitCustomCreateTypeEnum[keyof typeof BenefitCustomCreateTypeEnum];

/**
 * Properties for creating a benefit of type `custom`.
 * @export
 * @interface BenefitCustomCreateProperties
 */
export interface BenefitCustomCreateProperties {
    /**
     * 
     * @type {BenefitCustomCreatePropertiesNote}
     * @memberof BenefitCustomCreateProperties
     */
    note?: BenefitCustomCreatePropertiesNote | null;
}
/**
 * @type BenefitCustomCreatePropertiesNote
 * Private note to be shared with customers who have this benefit granted.
 * @export
 */
export type BenefitCustomCreatePropertiesNote = string;

/**
 * Properties for a benefit of type `custom`.
 * @export
 * @interface BenefitCustomProperties
 */
export interface BenefitCustomProperties {
    /**
     * 
     * @type {BenefitCustomCreatePropertiesNote}
     * @memberof BenefitCustomProperties
     */
    note: BenefitCustomCreatePropertiesNote | null;
}
/**
 * 
 * @export
 * @interface BenefitCustomSubscriber
 */
export interface BenefitCustomSubscriber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitCustomSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitCustomSubscriber
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitCustomSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitCustomSubscriber
     */
    type: BenefitCustomSubscriberTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitCustomSubscriber
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitCustomSubscriber
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitCustomSubscriber
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitCustomSubscriber
     */
    organization_id: string;
    /**
     * 
     * @type {Organization}
     * @memberof BenefitCustomSubscriber
     */
    organization: Organization;
    /**
     * 
     * @type {BenefitCustomSubscriberProperties}
     * @memberof BenefitCustomSubscriber
     */
    properties: BenefitCustomSubscriberProperties;
}


/**
 * @export
 */
export const BenefitCustomSubscriberTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type BenefitCustomSubscriberTypeEnum = typeof BenefitCustomSubscriberTypeEnum[keyof typeof BenefitCustomSubscriberTypeEnum];

/**
 * Properties available to subscribers for a benefit of type `custom`.
 * @export
 * @interface BenefitCustomSubscriberProperties
 */
export interface BenefitCustomSubscriberProperties {
    /**
     * 
     * @type {BenefitCustomCreatePropertiesNote}
     * @memberof BenefitCustomSubscriberProperties
     */
    note: BenefitCustomCreatePropertiesNote | null;
}
/**
 * 
 * @export
 * @interface BenefitCustomUpdate
 */
export interface BenefitCustomUpdate {
    /**
     * 
     * @type {string}
     * @memberof BenefitCustomUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitCustomUpdate
     */
    type: BenefitCustomUpdateTypeEnum;
    /**
     * 
     * @type {BenefitCustomProperties}
     * @memberof BenefitCustomUpdate
     */
    properties?: BenefitCustomProperties | null;
}


/**
 * @export
 */
export const BenefitCustomUpdateTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type BenefitCustomUpdateTypeEnum = typeof BenefitCustomUpdateTypeEnum[keyof typeof BenefitCustomUpdateTypeEnum];

/**
 * A benefit of type `discord`.
 * 
 * Use it to automatically invite your backers to a Discord server.
 * @export
 * @interface BenefitDiscord
 */
export interface BenefitDiscord {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitDiscord
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscord
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitDiscord
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscord
     */
    type: BenefitDiscordTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitDiscord
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitDiscord
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitDiscord
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitDiscord
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitDiscordProperties}
     * @memberof BenefitDiscord
     */
    properties: BenefitDiscordProperties;
}


/**
 * @export
 */
export const BenefitDiscordTypeEnum = {
    DISCORD: 'discord'
} as const;
export type BenefitDiscordTypeEnum = typeof BenefitDiscordTypeEnum[keyof typeof BenefitDiscordTypeEnum];

/**
 * 
 * @export
 * @interface BenefitDiscordCreate
 */
export interface BenefitDiscordCreate {
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordCreate
     */
    type: BenefitDiscordCreateTypeEnum;
    /**
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitDiscordCreate
     */
    description: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof BenefitDiscordCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {BenefitDiscordCreateProperties}
     * @memberof BenefitDiscordCreate
     */
    properties: BenefitDiscordCreateProperties;
}


/**
 * @export
 */
export const BenefitDiscordCreateTypeEnum = {
    DISCORD: 'discord'
} as const;
export type BenefitDiscordCreateTypeEnum = typeof BenefitDiscordCreateTypeEnum[keyof typeof BenefitDiscordCreateTypeEnum];

/**
 * Properties to create a benefit of type `discord`.
 * @export
 * @interface BenefitDiscordCreateProperties
 */
export interface BenefitDiscordCreateProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordCreateProperties
     */
    guild_token: string;
    /**
     * The ID of the Discord role to grant.
     * @type {string}
     * @memberof BenefitDiscordCreateProperties
     */
    role_id: string;
}
/**
 * Properties for a benefit of type `discord`.
 * @export
 * @interface BenefitDiscordProperties
 */
export interface BenefitDiscordProperties {
    /**
     * The ID of the Discord server.
     * @type {string}
     * @memberof BenefitDiscordProperties
     */
    guild_id: string;
    /**
     * The ID of the Discord role to grant.
     * @type {string}
     * @memberof BenefitDiscordProperties
     */
    role_id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordProperties
     */
    readonly guild_token: string;
}
/**
 * 
 * @export
 * @interface BenefitDiscordSubscriber
 */
export interface BenefitDiscordSubscriber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitDiscordSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordSubscriber
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitDiscordSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordSubscriber
     */
    type: BenefitDiscordSubscriberTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitDiscordSubscriber
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitDiscordSubscriber
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitDiscordSubscriber
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitDiscordSubscriber
     */
    organization_id: string;
    /**
     * 
     * @type {Organization}
     * @memberof BenefitDiscordSubscriber
     */
    organization: Organization;
    /**
     * 
     * @type {BenefitDiscordSubscriberProperties}
     * @memberof BenefitDiscordSubscriber
     */
    properties: BenefitDiscordSubscriberProperties;
}


/**
 * @export
 */
export const BenefitDiscordSubscriberTypeEnum = {
    DISCORD: 'discord'
} as const;
export type BenefitDiscordSubscriberTypeEnum = typeof BenefitDiscordSubscriberTypeEnum[keyof typeof BenefitDiscordSubscriberTypeEnum];

/**
 * Properties available to subscribers for a benefit of type `discord`.
 * @export
 * @interface BenefitDiscordSubscriberProperties
 */
export interface BenefitDiscordSubscriberProperties {
    /**
     * The ID of the Discord server.
     * @type {string}
     * @memberof BenefitDiscordSubscriberProperties
     */
    guild_id: string;
}
/**
 * 
 * @export
 * @interface BenefitDiscordUpdate
 */
export interface BenefitDiscordUpdate {
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordUpdate
     */
    type: BenefitDiscordUpdateTypeEnum;
    /**
     * 
     * @type {BenefitDiscordCreateProperties}
     * @memberof BenefitDiscordUpdate
     */
    properties?: BenefitDiscordCreateProperties | null;
}


/**
 * @export
 */
export const BenefitDiscordUpdateTypeEnum = {
    DISCORD: 'discord'
} as const;
export type BenefitDiscordUpdateTypeEnum = typeof BenefitDiscordUpdateTypeEnum[keyof typeof BenefitDiscordUpdateTypeEnum];

/**
 * 
 * @export
 * @interface BenefitDownloadables
 */
export interface BenefitDownloadables {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitDownloadables
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadables
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitDownloadables
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadables
     */
    type: BenefitDownloadablesTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitDownloadables
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitDownloadables
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitDownloadables
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitDownloadables
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitDownloadablesProperties}
     * @memberof BenefitDownloadables
     */
    properties: BenefitDownloadablesProperties;
}


/**
 * @export
 */
export const BenefitDownloadablesTypeEnum = {
    DOWNLOADABLES: 'downloadables'
} as const;
export type BenefitDownloadablesTypeEnum = typeof BenefitDownloadablesTypeEnum[keyof typeof BenefitDownloadablesTypeEnum];

/**
 * 
 * @export
 * @interface BenefitDownloadablesCreate
 */
export interface BenefitDownloadablesCreate {
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadablesCreate
     */
    type: BenefitDownloadablesCreateTypeEnum;
    /**
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitDownloadablesCreate
     */
    description: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof BenefitDownloadablesCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {BenefitDownloadablesCreateProperties}
     * @memberof BenefitDownloadablesCreate
     */
    properties: BenefitDownloadablesCreateProperties;
}


/**
 * @export
 */
export const BenefitDownloadablesCreateTypeEnum = {
    DOWNLOADABLES: 'downloadables'
} as const;
export type BenefitDownloadablesCreateTypeEnum = typeof BenefitDownloadablesCreateTypeEnum[keyof typeof BenefitDownloadablesCreateTypeEnum];

/**
 * 
 * @export
 * @interface BenefitDownloadablesCreateProperties
 */
export interface BenefitDownloadablesCreateProperties {
    /**
     * 
     * @type {{ [key: string]: boolean; }}
     * @memberof BenefitDownloadablesCreateProperties
     */
    archived?: { [key: string]: boolean; };
    /**
     * 
     * @type {Array<string>}
     * @memberof BenefitDownloadablesCreateProperties
     */
    files: Array<string>;
}
/**
 * 
 * @export
 * @interface BenefitDownloadablesProperties
 */
export interface BenefitDownloadablesProperties {
    /**
     * 
     * @type {{ [key: string]: boolean; }}
     * @memberof BenefitDownloadablesProperties
     */
    archived: { [key: string]: boolean; };
    /**
     * 
     * @type {Array<string>}
     * @memberof BenefitDownloadablesProperties
     */
    files: Array<string>;
}
/**
 * 
 * @export
 * @interface BenefitDownloadablesSubscriber
 */
export interface BenefitDownloadablesSubscriber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitDownloadablesSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadablesSubscriber
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitDownloadablesSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadablesSubscriber
     */
    type: BenefitDownloadablesSubscriberTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitDownloadablesSubscriber
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitDownloadablesSubscriber
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitDownloadablesSubscriber
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitDownloadablesSubscriber
     */
    organization_id: string;
    /**
     * 
     * @type {Organization}
     * @memberof BenefitDownloadablesSubscriber
     */
    organization: Organization;
    /**
     * 
     * @type {BenefitDownloadablesSubscriberProperties}
     * @memberof BenefitDownloadablesSubscriber
     */
    properties: BenefitDownloadablesSubscriberProperties;
}


/**
 * @export
 */
export const BenefitDownloadablesSubscriberTypeEnum = {
    DOWNLOADABLES: 'downloadables'
} as const;
export type BenefitDownloadablesSubscriberTypeEnum = typeof BenefitDownloadablesSubscriberTypeEnum[keyof typeof BenefitDownloadablesSubscriberTypeEnum];

/**
 * 
 * @export
 * @interface BenefitDownloadablesSubscriberProperties
 */
export interface BenefitDownloadablesSubscriberProperties {
    /**
     * 
     * @type {Array<string>}
     * @memberof BenefitDownloadablesSubscriberProperties
     */
    active_files: Array<string>;
}
/**
 * 
 * @export
 * @interface BenefitDownloadablesUpdate
 */
export interface BenefitDownloadablesUpdate {
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadablesUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadablesUpdate
     */
    type: BenefitDownloadablesUpdateTypeEnum;
    /**
     * 
     * @type {BenefitDownloadablesCreateProperties}
     * @memberof BenefitDownloadablesUpdate
     */
    properties?: BenefitDownloadablesCreateProperties | null;
}


/**
 * @export
 */
export const BenefitDownloadablesUpdateTypeEnum = {
    DOWNLOADABLES: 'downloadables'
} as const;
export type BenefitDownloadablesUpdateTypeEnum = typeof BenefitDownloadablesUpdateTypeEnum[keyof typeof BenefitDownloadablesUpdateTypeEnum];

/**
 * A benefit of type `github_repository`.
 * 
 * Use it to automatically invite your backers to a private GitHub repository.
 * @export
 * @interface BenefitGitHubRepository
 */
export interface BenefitGitHubRepository {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitGitHubRepository
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepository
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitGitHubRepository
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepository
     */
    type: BenefitGitHubRepositoryTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitGitHubRepository
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitGitHubRepository
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitGitHubRepository
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitGitHubRepository
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitGitHubRepositoryProperties}
     * @memberof BenefitGitHubRepository
     */
    properties: BenefitGitHubRepositoryProperties;
}


/**
 * @export
 */
export const BenefitGitHubRepositoryTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type BenefitGitHubRepositoryTypeEnum = typeof BenefitGitHubRepositoryTypeEnum[keyof typeof BenefitGitHubRepositoryTypeEnum];

/**
 * 
 * @export
 * @interface BenefitGitHubRepositoryCreate
 */
export interface BenefitGitHubRepositoryCreate {
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreate
     */
    type: BenefitGitHubRepositoryCreateTypeEnum;
    /**
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreate
     */
    description: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {BenefitGitHubRepositoryCreateProperties}
     * @memberof BenefitGitHubRepositoryCreate
     */
    properties: BenefitGitHubRepositoryCreateProperties;
}


/**
 * @export
 */
export const BenefitGitHubRepositoryCreateTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type BenefitGitHubRepositoryCreateTypeEnum = typeof BenefitGitHubRepositoryCreateTypeEnum[keyof typeof BenefitGitHubRepositoryCreateTypeEnum];

/**
 * Properties to create a benefit of type `github_repository`.
 * @export
 * @interface BenefitGitHubRepositoryCreateProperties
 */
export interface BenefitGitHubRepositoryCreateProperties {
    /**
     * The owner of the repository.
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    repository_owner: string;
    /**
     * The name of the repository.
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    repository_name: string;
    /**
     * The permission level to grant. Read more about roles and their permissions on [GitHub documentation](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role).
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    permission: BenefitGitHubRepositoryCreatePropertiesPermissionEnum;
}


/**
 * @export
 */
export const BenefitGitHubRepositoryCreatePropertiesPermissionEnum = {
    PULL: 'pull',
    TRIAGE: 'triage',
    PUSH: 'push',
    MAINTAIN: 'maintain',
    ADMIN: 'admin'
} as const;
export type BenefitGitHubRepositoryCreatePropertiesPermissionEnum = typeof BenefitGitHubRepositoryCreatePropertiesPermissionEnum[keyof typeof BenefitGitHubRepositoryCreatePropertiesPermissionEnum];

/**
 * Properties for a benefit of type `github_repository`.
 * @export
 * @interface BenefitGitHubRepositoryProperties
 */
export interface BenefitGitHubRepositoryProperties {
    /**
     * The owner of the repository.
     * @type {string}
     * @memberof BenefitGitHubRepositoryProperties
     */
    repository_owner: string;
    /**
     * The name of the repository.
     * @type {string}
     * @memberof BenefitGitHubRepositoryProperties
     */
    repository_name: string;
    /**
     * The permission level to grant. Read more about roles and their permissions on [GitHub documentation](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization#permissions-for-each-role).
     * @type {string}
     * @memberof BenefitGitHubRepositoryProperties
     */
    permission: BenefitGitHubRepositoryPropertiesPermissionEnum;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryProperties
     */
    repository_id?: string | null;
}


/**
 * @export
 */
export const BenefitGitHubRepositoryPropertiesPermissionEnum = {
    PULL: 'pull',
    TRIAGE: 'triage',
    PUSH: 'push',
    MAINTAIN: 'maintain',
    ADMIN: 'admin'
} as const;
export type BenefitGitHubRepositoryPropertiesPermissionEnum = typeof BenefitGitHubRepositoryPropertiesPermissionEnum[keyof typeof BenefitGitHubRepositoryPropertiesPermissionEnum];

/**
 * 
 * @export
 * @interface BenefitGitHubRepositorySubscriber
 */
export interface BenefitGitHubRepositorySubscriber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    type: BenefitGitHubRepositorySubscriberTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    organization_id: string;
    /**
     * 
     * @type {Organization}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    organization: Organization;
    /**
     * 
     * @type {BenefitGitHubRepositorySubscriberProperties}
     * @memberof BenefitGitHubRepositorySubscriber
     */
    properties: BenefitGitHubRepositorySubscriberProperties;
}


/**
 * @export
 */
export const BenefitGitHubRepositorySubscriberTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type BenefitGitHubRepositorySubscriberTypeEnum = typeof BenefitGitHubRepositorySubscriberTypeEnum[keyof typeof BenefitGitHubRepositorySubscriberTypeEnum];

/**
 * Properties available to subscribers for a benefit of type `github_repository`.
 * @export
 * @interface BenefitGitHubRepositorySubscriberProperties
 */
export interface BenefitGitHubRepositorySubscriberProperties {
    /**
     * The owner of the repository.
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriberProperties
     */
    repository_owner: string;
    /**
     * The name of the repository.
     * @type {string}
     * @memberof BenefitGitHubRepositorySubscriberProperties
     */
    repository_name: string;
}
/**
 * 
 * @export
 * @interface BenefitGitHubRepositoryUpdate
 */
export interface BenefitGitHubRepositoryUpdate {
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryUpdate
     */
    type: BenefitGitHubRepositoryUpdateTypeEnum;
    /**
     * 
     * @type {BenefitGitHubRepositoryCreateProperties}
     * @memberof BenefitGitHubRepositoryUpdate
     */
    properties?: BenefitGitHubRepositoryCreateProperties | null;
}


/**
 * @export
 */
export const BenefitGitHubRepositoryUpdateTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type BenefitGitHubRepositoryUpdateTypeEnum = typeof BenefitGitHubRepositoryUpdateTypeEnum[keyof typeof BenefitGitHubRepositoryUpdateTypeEnum];

/**
 * 
 * @export
 * @interface BenefitGrant
 */
export interface BenefitGrant {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitGrant
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrant
     */
    modified_at: string | null;
    /**
     * The ID of the grant.
     * @type {string}
     * @memberof BenefitGrant
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrant
     */
    granted_at?: string | null;
    /**
     * Whether the benefit is granted.
     * @type {boolean}
     * @memberof BenefitGrant
     */
    is_granted: boolean;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrant
     */
    revoked_at?: string | null;
    /**
     * Whether the benefit is revoked.
     * @type {boolean}
     * @memberof BenefitGrant
     */
    is_revoked: boolean;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrant
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrant
     */
    order_id: string | null;
    /**
     * The ID of the customer concerned by this grant.
     * @type {string}
     * @memberof BenefitGrant
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrant
     * @deprecated
     */
    user_id: string;
    /**
     * The ID of the benefit concerned by this grant.
     * @type {string}
     * @memberof BenefitGrant
     */
    benefit_id: string;
    /**
     * 
     * @type {Customer}
     * @memberof BenefitGrant
     */
    customer: Customer;
    /**
     * 
     * @type {Properties}
     * @memberof BenefitGrant
     */
    properties: Properties;
}
/**
 * 
 * @export
 * @interface BenefitGrantAdsProperties
 */
export interface BenefitGrantAdsProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantAdsProperties
     */
    advertisement_campaign_id: string;
}
/**
 * 
 * @export
 * @interface BenefitGrantDiscordProperties
 */
export interface BenefitGrantDiscordProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantDiscordProperties
     */
    account_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantDiscordProperties
     */
    guild_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantDiscordProperties
     */
    role_id?: string;
}
/**
 * 
 * @export
 * @interface BenefitGrantDownloadablesProperties
 */
export interface BenefitGrantDownloadablesProperties {
    /**
     * 
     * @type {Array<string>}
     * @memberof BenefitGrantDownloadablesProperties
     */
    files?: Array<string>;
}
/**
 * 
 * @export
 * @interface BenefitGrantGitHubRepositoryProperties
 */
export interface BenefitGrantGitHubRepositoryProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantGitHubRepositoryProperties
     */
    account_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantGitHubRepositoryProperties
     */
    repository_owner?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantGitHubRepositoryProperties
     */
    repository_name?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantGitHubRepositoryProperties
     */
    permission?: BenefitGrantGitHubRepositoryPropertiesPermissionEnum;
}


/**
 * @export
 */
export const BenefitGrantGitHubRepositoryPropertiesPermissionEnum = {
    PULL: 'pull',
    TRIAGE: 'triage',
    PUSH: 'push',
    MAINTAIN: 'maintain',
    ADMIN: 'admin'
} as const;
export type BenefitGrantGitHubRepositoryPropertiesPermissionEnum = typeof BenefitGrantGitHubRepositoryPropertiesPermissionEnum[keyof typeof BenefitGrantGitHubRepositoryPropertiesPermissionEnum];

/**
 * 
 * @export
 * @interface BenefitGrantLicenseKeysProperties
 */
export interface BenefitGrantLicenseKeysProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeysProperties
     */
    license_key_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeysProperties
     */
    display_key?: string;
}
/**
 * 
 * @export
 * @interface BenefitGrantWebhook
 */
export interface BenefitGrantWebhook {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    modified_at: string | null;
    /**
     * The ID of the grant.
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    granted_at?: string | null;
    /**
     * Whether the benefit is granted.
     * @type {boolean}
     * @memberof BenefitGrantWebhook
     */
    is_granted: boolean;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    revoked_at?: string | null;
    /**
     * Whether the benefit is revoked.
     * @type {boolean}
     * @memberof BenefitGrantWebhook
     */
    is_revoked: boolean;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    order_id: string | null;
    /**
     * The ID of the customer concerned by this grant.
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantWebhook
     * @deprecated
     */
    user_id: string;
    /**
     * The ID of the benefit concerned by this grant.
     * @type {string}
     * @memberof BenefitGrantWebhook
     */
    benefit_id: string;
    /**
     * 
     * @type {Customer}
     * @memberof BenefitGrantWebhook
     */
    customer: Customer;
    /**
     * 
     * @type {Properties}
     * @memberof BenefitGrantWebhook
     */
    properties: Properties;
    /**
     * 
     * @type {Benefit}
     * @memberof BenefitGrantWebhook
     */
    benefit: Benefit;
    /**
     * 
     * @type {PreviousProperties}
     * @memberof BenefitGrantWebhook
     */
    previous_properties?: PreviousProperties | null;
}
/**
 * @type BenefitIDFilter
 * Filter products granting specific benefit.
 * @export
 */
export type BenefitIDFilter = Array<string> | string;

/**
 * @type BenefitIDFilter1
 * Filter by benefit ID.
 * @export
 */
export type BenefitIDFilter1 = Array<string> | string;

/**
 * @type BenefitIDFilter2
 * Filter by benefit ID.
 * @export
 */
export type BenefitIDFilter2 = Array<string> | string;

/**
 * 
 * @export
 * @interface BenefitLicenseKeyActivationProperties
 */
export interface BenefitLicenseKeyActivationProperties {
    /**
     * 
     * @type {number}
     * @memberof BenefitLicenseKeyActivationProperties
     */
    limit: number;
    /**
     * 
     * @type {boolean}
     * @memberof BenefitLicenseKeyActivationProperties
     */
    enable_customer_admin: boolean;
}
/**
 * 
 * @export
 * @interface BenefitLicenseKeyExpirationProperties
 */
export interface BenefitLicenseKeyExpirationProperties {
    /**
     * 
     * @type {number}
     * @memberof BenefitLicenseKeyExpirationProperties
     */
    ttl: number;
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeyExpirationProperties
     */
    timeframe: BenefitLicenseKeyExpirationPropertiesTimeframeEnum;
}


/**
 * @export
 */
export const BenefitLicenseKeyExpirationPropertiesTimeframeEnum = {
    YEAR: 'year',
    MONTH: 'month',
    DAY: 'day'
} as const;
export type BenefitLicenseKeyExpirationPropertiesTimeframeEnum = typeof BenefitLicenseKeyExpirationPropertiesTimeframeEnum[keyof typeof BenefitLicenseKeyExpirationPropertiesTimeframeEnum];

/**
 * 
 * @export
 * @interface BenefitLicenseKeys
 */
export interface BenefitLicenseKeys {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitLicenseKeys
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeys
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitLicenseKeys
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeys
     */
    type: BenefitLicenseKeysTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitLicenseKeys
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitLicenseKeys
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitLicenseKeys
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitLicenseKeys
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitLicenseKeysProperties}
     * @memberof BenefitLicenseKeys
     */
    properties: BenefitLicenseKeysProperties;
}


/**
 * @export
 */
export const BenefitLicenseKeysTypeEnum = {
    LICENSE_KEYS: 'license_keys'
} as const;
export type BenefitLicenseKeysTypeEnum = typeof BenefitLicenseKeysTypeEnum[keyof typeof BenefitLicenseKeysTypeEnum];

/**
 * 
 * @export
 * @interface BenefitLicenseKeysCreate
 */
export interface BenefitLicenseKeysCreate {
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysCreate
     */
    type: BenefitLicenseKeysCreateTypeEnum;
    /**
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitLicenseKeysCreate
     */
    description: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof BenefitLicenseKeysCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {BenefitLicenseKeysCreateProperties}
     * @memberof BenefitLicenseKeysCreate
     */
    properties: BenefitLicenseKeysCreateProperties;
}


/**
 * @export
 */
export const BenefitLicenseKeysCreateTypeEnum = {
    LICENSE_KEYS: 'license_keys'
} as const;
export type BenefitLicenseKeysCreateTypeEnum = typeof BenefitLicenseKeysCreateTypeEnum[keyof typeof BenefitLicenseKeysCreateTypeEnum];

/**
 * 
 * @export
 * @interface BenefitLicenseKeysCreateProperties
 */
export interface BenefitLicenseKeysCreateProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysCreateProperties
     */
    prefix?: string | null;
    /**
     * 
     * @type {BenefitLicenseKeyExpirationProperties}
     * @memberof BenefitLicenseKeysCreateProperties
     */
    expires?: BenefitLicenseKeyExpirationProperties | null;
    /**
     * 
     * @type {BenefitLicenseKeyActivationProperties}
     * @memberof BenefitLicenseKeysCreateProperties
     */
    activations?: BenefitLicenseKeyActivationProperties | null;
    /**
     * 
     * @type {number}
     * @memberof BenefitLicenseKeysCreateProperties
     */
    limit_usage?: number | null;
}
/**
 * 
 * @export
 * @interface BenefitLicenseKeysProperties
 */
export interface BenefitLicenseKeysProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysProperties
     */
    prefix: string | null;
    /**
     * 
     * @type {BenefitLicenseKeyExpirationProperties}
     * @memberof BenefitLicenseKeysProperties
     */
    expires: BenefitLicenseKeyExpirationProperties | null;
    /**
     * 
     * @type {BenefitLicenseKeyActivationProperties}
     * @memberof BenefitLicenseKeysProperties
     */
    activations: BenefitLicenseKeyActivationProperties | null;
    /**
     * 
     * @type {number}
     * @memberof BenefitLicenseKeysProperties
     */
    limit_usage: number | null;
}
/**
 * 
 * @export
 * @interface BenefitLicenseKeysSubscriber
 */
export interface BenefitLicenseKeysSubscriber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitLicenseKeysSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysSubscriber
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitLicenseKeysSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysSubscriber
     */
    type: BenefitLicenseKeysSubscriberTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitLicenseKeysSubscriber
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitLicenseKeysSubscriber
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitLicenseKeysSubscriber
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitLicenseKeysSubscriber
     */
    organization_id: string;
    /**
     * 
     * @type {Organization}
     * @memberof BenefitLicenseKeysSubscriber
     */
    organization: Organization;
    /**
     * 
     * @type {BenefitLicenseKeysSubscriberProperties}
     * @memberof BenefitLicenseKeysSubscriber
     */
    properties: BenefitLicenseKeysSubscriberProperties;
}


/**
 * @export
 */
export const BenefitLicenseKeysSubscriberTypeEnum = {
    LICENSE_KEYS: 'license_keys'
} as const;
export type BenefitLicenseKeysSubscriberTypeEnum = typeof BenefitLicenseKeysSubscriberTypeEnum[keyof typeof BenefitLicenseKeysSubscriberTypeEnum];

/**
 * 
 * @export
 * @interface BenefitLicenseKeysSubscriberProperties
 */
export interface BenefitLicenseKeysSubscriberProperties {
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysSubscriberProperties
     */
    prefix: string | null;
    /**
     * 
     * @type {BenefitLicenseKeyExpirationProperties}
     * @memberof BenefitLicenseKeysSubscriberProperties
     */
    expires: BenefitLicenseKeyExpirationProperties | null;
    /**
     * 
     * @type {BenefitLicenseKeyActivationProperties}
     * @memberof BenefitLicenseKeysSubscriberProperties
     */
    activations: BenefitLicenseKeyActivationProperties | null;
    /**
     * 
     * @type {number}
     * @memberof BenefitLicenseKeysSubscriberProperties
     */
    limit_usage: number | null;
}
/**
 * 
 * @export
 * @interface BenefitLicenseKeysUpdate
 */
export interface BenefitLicenseKeysUpdate {
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitLicenseKeysUpdate
     */
    type: BenefitLicenseKeysUpdateTypeEnum;
    /**
     * 
     * @type {BenefitLicenseKeysCreateProperties}
     * @memberof BenefitLicenseKeysUpdate
     */
    properties?: BenefitLicenseKeysCreateProperties | null;
}


/**
 * @export
 */
export const BenefitLicenseKeysUpdateTypeEnum = {
    LICENSE_KEYS: 'license_keys'
} as const;
export type BenefitLicenseKeysUpdateTypeEnum = typeof BenefitLicenseKeysUpdateTypeEnum[keyof typeof BenefitLicenseKeysUpdateTypeEnum];


/**
 * 
 * @export
 */
export const BenefitType = {
    CUSTOM: 'custom',
    ADS: 'ads',
    DISCORD: 'discord',
    GITHUB_REPOSITORY: 'github_repository',
    DOWNLOADABLES: 'downloadables',
    LICENSE_KEYS: 'license_keys'
} as const;
export type BenefitType = typeof BenefitType[keyof typeof BenefitType];

/**
 * @type BenefitTypeFilter
 * Filter by benefit type.
 * @export
 */
export type BenefitTypeFilter = Array<BenefitType> | BenefitType;

/**
 * @type BenefitUpdate
 * @export
 */
export type BenefitUpdate = BenefitAdsUpdate | BenefitCustomUpdate | BenefitDiscordUpdate | BenefitDownloadablesUpdate | BenefitGitHubRepositoryUpdate | BenefitLicenseKeysUpdate;

/**
 * Checkout session data retrieved using an access token.
 * @export
 * @interface Checkout
 */
export interface Checkout {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Checkout
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof Checkout
     */
    id: string;
    /**
     * Key-value object storing custom field values.
     * @type {object}
     * @memberof Checkout
     */
    custom_field_data?: object;
    /**
     * 
     * @type {PolarEnumsPaymentProcessor}
     * @memberof Checkout
     */
    payment_processor: PolarEnumsPaymentProcessor;
    /**
     * 
     * @type {CheckoutStatus}
     * @memberof Checkout
     */
    status: CheckoutStatus;
    /**
     * Client secret used to update and complete the checkout session from the client.
     * @type {string}
     * @memberof Checkout
     */
    client_secret: string;
    /**
     * URL where the customer can access the checkout session.
     * @type {string}
     * @memberof Checkout
     */
    url: string;
    /**
     * Expiration date and time of the checkout session.
     * @type {string}
     * @memberof Checkout
     */
    expires_at: string;
    /**
     * URL where the customer will be redirected after a successful payment.
     * @type {string}
     * @memberof Checkout
     */
    success_url: string;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    embed_origin: string | null;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof Checkout
     */
    amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof Checkout
     */
    tax_amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    currency: string | null;
    /**
     * 
     * @type {number}
     * @memberof Checkout
     */
    subtotal_amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof Checkout
     */
    total_amount: number | null;
    /**
     * ID of the product to checkout.
     * @type {string}
     * @memberof Checkout
     */
    product_id: string;
    /**
     * ID of the product price to checkout.
     * @type {string}
     * @memberof Checkout
     */
    product_price_id: string;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    discount_id: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof Checkout
     */
    allow_discount_codes: boolean;
    /**
     * Whether the discount is applicable to the checkout. Typically, free and custom prices are not discountable.
     * @type {boolean}
     * @memberof Checkout
     */
    is_discount_applicable: boolean;
    /**
     * Whether the product price is free, regardless of discounts.
     * @type {boolean}
     * @memberof Checkout
     */
    is_free_product_price: boolean;
    /**
     * Whether the checkout requires payment, e.g. in case of free products or discounts that cover the total amount.
     * @type {boolean}
     * @memberof Checkout
     */
    is_payment_required: boolean;
    /**
     * Whether the checkout requires setting up a payment method, regardless of the amount, e.g. subscriptions that have first free cycles.
     * @type {boolean}
     * @memberof Checkout
     */
    is_payment_setup_required: boolean;
    /**
     * Whether the checkout requires a payment form, whether because of a payment or payment method setup.
     * @type {boolean}
     * @memberof Checkout
     */
    is_payment_form_required: boolean;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    customer_id: string | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof Checkout
     */
    customer_name: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof Checkout
     */
    customer_email: string | null;
    /**
     * IP address of the customer. Used to detect tax location.
     * @type {string}
     * @memberof Checkout
     */
    customer_ip_address: string | null;
    /**
     * 
     * @type {Address}
     * @memberof Checkout
     */
    customer_billing_address: Address | null;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    customer_tax_id: string | null;
    /**
     * 
     * @type {object}
     * @memberof Checkout
     */
    payment_processor_metadata: object;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof Checkout
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {CheckoutProduct}
     * @memberof Checkout
     */
    product: CheckoutProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof Checkout
     */
    product_price: ProductPrice;
    /**
     * 
     * @type {CheckoutDiscount}
     * @memberof Checkout
     */
    discount: CheckoutDiscount | null;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    subscription_id: string | null;
    /**
     * 
     * @type {Array<AttachedCustomField>}
     * @memberof Checkout
     */
    attached_custom_fields: Array<AttachedCustomField>;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof Checkout
     */
    customer_metadata: { [key: string]: MetadataValue; };
}


/**
 * Confirm a checkout session using a Stripe confirmation token.
 * @export
 * @interface CheckoutConfirmStripe
 */
export interface CheckoutConfirmStripe {
    /**
     * 
     * @type {object}
     * @memberof CheckoutConfirmStripe
     */
    custom_field_data?: object | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutConfirmStripe
     */
    product_price_id?: string | null;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof CheckoutConfirmStripe
     */
    amount?: number | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof CheckoutConfirmStripe
     */
    customer_name?: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutConfirmStripe
     */
    customer_email?: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CheckoutConfirmStripe
     */
    customer_billing_address?: Address | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutConfirmStripe
     */
    customer_tax_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutConfirmStripe
     */
    discount_code?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutConfirmStripe
     */
    confirmation_token_id?: string | null;
}
/**
 * @type CheckoutCreate
 * @export
 */
export type CheckoutCreate = CheckoutPriceCreate | CheckoutProductCreate;

/**
 * Create a new checkout session from a client.
 * @export
 * @interface CheckoutCreatePublic
 */
export interface CheckoutCreatePublic {
    /**
     * ID of the product price to checkout.
     * @type {string}
     * @memberof CheckoutCreatePublic
     */
    product_price_id: string;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutCreatePublic
     */
    customer_email?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CheckoutCreatePublic
     */
    from_legacy_checkout_link?: boolean;
    /**
     * 
     * @type {string}
     * @memberof CheckoutCreatePublic
     */
    subscription_id?: string | null;
}
/**
 * @type CheckoutDiscount
 * 
 * @export
 */
export type CheckoutDiscount = CheckoutDiscountFixedOnceForeverDuration | CheckoutDiscountFixedRepeatDuration | CheckoutDiscountPercentageOnceForeverDuration | CheckoutDiscountPercentageRepeatDuration;
/**
 * Schema for a fixed amount discount that is applied once or forever.
 * @export
 * @interface CheckoutDiscountFixedOnceForeverDuration
 */
export interface CheckoutDiscountFixedOnceForeverDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof CheckoutDiscountFixedOnceForeverDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof CheckoutDiscountFixedOnceForeverDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof CheckoutDiscountFixedOnceForeverDuration
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountFixedOnceForeverDuration
     */
    currency: string;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CheckoutDiscountFixedOnceForeverDuration
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountFixedOnceForeverDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountFixedOnceForeverDuration
     */
    code: string | null;
}


/**
 * Schema for a fixed amount discount that is applied on every invoice
 * for a certain number of months.
 * @export
 * @interface CheckoutDiscountFixedRepeatDuration
 */
export interface CheckoutDiscountFixedRepeatDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {number}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    currency: string;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountFixedRepeatDuration
     */
    code: string | null;
}


/**
 * Schema for a percentage discount that is applied once or forever.
 * @export
 * @interface CheckoutDiscountPercentageOnceForeverDuration
 */
export interface CheckoutDiscountPercentageOnceForeverDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof CheckoutDiscountPercentageOnceForeverDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof CheckoutDiscountPercentageOnceForeverDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof CheckoutDiscountPercentageOnceForeverDuration
     */
    basis_points: number;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CheckoutDiscountPercentageOnceForeverDuration
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountPercentageOnceForeverDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountPercentageOnceForeverDuration
     */
    code: string | null;
}


/**
 * Schema for a percentage discount that is applied on every invoice
 * for a certain number of months.
 * @export
 * @interface CheckoutDiscountPercentageRepeatDuration
 */
export interface CheckoutDiscountPercentageRepeatDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof CheckoutDiscountPercentageRepeatDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {number}
     * @memberof CheckoutDiscountPercentageRepeatDuration
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof CheckoutDiscountPercentageRepeatDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof CheckoutDiscountPercentageRepeatDuration
     */
    basis_points: number;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CheckoutDiscountPercentageRepeatDuration
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountPercentageRepeatDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutDiscountPercentageRepeatDuration
     */
    code: string | null;
}


/**
 * @type CheckoutIDFilter
 * Filter by checkout ID.
 * @export
 */
export type CheckoutIDFilter = Array<string> | string;

/**
 * A checkout session.
 * @export
 * @interface CheckoutLegacy
 */
export interface CheckoutLegacy {
    /**
     * The ID of the checkout.
     * @type {string}
     * @memberof CheckoutLegacy
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLegacy
     */
    url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLegacy
     */
    customer_email: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLegacy
     */
    customer_name: string | null;
    /**
     * 
     * @type {CheckoutProduct}
     * @memberof CheckoutLegacy
     */
    product: CheckoutProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof CheckoutLegacy
     */
    product_price: ProductPrice;
}
/**
 * 
 * @export
 * @interface CheckoutLegacyCreate
 */
export interface CheckoutLegacyCreate {
    /**
     * ID of the product price to subscribe to.
     * @type {string}
     * @memberof CheckoutLegacyCreate
     */
    product_price_id: string;
    /**
     * URL where the customer will be redirected after a successful subscription. You can add the `session_id={CHECKOUT_SESSION_ID}` query parameter to retrieve the checkout session id.
     * @type {string}
     * @memberof CheckoutLegacyCreate
     */
    success_url: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLegacyCreate
     */
    customer_email?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLegacyCreate
     */
    subscription_id?: string | null;
}
/**
 * Checkout link data.
 * @export
 * @interface CheckoutLink
 */
export interface CheckoutLink {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CheckoutLink
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLink
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CheckoutLink
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof CheckoutLink
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {PolarEnumsPaymentProcessor}
     * @memberof CheckoutLink
     */
    payment_processor: PolarEnumsPaymentProcessor;
    /**
     * Client secret used to access the checkout link.
     * @type {string}
     * @memberof CheckoutLink
     */
    client_secret: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLink
     */
    success_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLink
     */
    label: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof CheckoutLink
     */
    allow_discount_codes: boolean;
    /**
     * ID of the product to checkout.
     * @type {string}
     * @memberof CheckoutLink
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLink
     */
    product_price_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLink
     */
    discount_id: string | null;
    /**
     * 
     * @type {CheckoutLinkProduct}
     * @memberof CheckoutLink
     */
    product: CheckoutLinkProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof CheckoutLink
     */
    product_price: ProductPrice | null;
    /**
     * 
     * @type {CheckoutLinkDiscount}
     * @memberof CheckoutLink
     */
    discount: CheckoutLinkDiscount | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLink
     */
    readonly url: string;
}


/**
 * @type CheckoutLinkCreate
 * @export
 */
export type CheckoutLinkCreate = CheckoutLinkPriceCreate | CheckoutLinkProductCreate;

/**
 * @type CheckoutLinkDiscount
 * 
 * @export
 */
export type CheckoutLinkDiscount = DiscountFixedOnceForeverDurationBase | DiscountFixedRepeatDurationBase | DiscountPercentageOnceForeverDurationBase | DiscountPercentageRepeatDurationBase;
/**
 * 
 * @export
 * @interface CheckoutLinkPriceCreate
 */
export interface CheckoutLinkPriceCreate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutLinkPriceCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Payment processor to use. Currently only Stripe is supported.
     * @type {string}
     * @memberof CheckoutLinkPriceCreate
     */
    payment_processor: CheckoutLinkPriceCreatePaymentProcessorEnum;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkPriceCreate
     */
    label?: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof CheckoutLinkPriceCreate
     */
    allow_discount_codes?: boolean;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkPriceCreate
     */
    discount_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkPriceCreate
     */
    success_url?: string | null;
    /**
     * ID of the product price to checkout.
     * @type {string}
     * @memberof CheckoutLinkPriceCreate
     */
    product_price_id: string;
}


/**
 * @export
 */
export const CheckoutLinkPriceCreatePaymentProcessorEnum = {
    STRIPE: 'stripe'
} as const;
export type CheckoutLinkPriceCreatePaymentProcessorEnum = typeof CheckoutLinkPriceCreatePaymentProcessorEnum[keyof typeof CheckoutLinkPriceCreatePaymentProcessorEnum];

/**
 * Product data for a checkout link.
 * @export
 * @interface CheckoutLinkProduct
 */
export interface CheckoutLinkProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CheckoutLinkProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof CheckoutLinkProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof CheckoutLinkProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof CheckoutLinkProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof CheckoutLinkProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof CheckoutLinkProduct
     */
    organization_id: string;
    /**
     * List of prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof CheckoutLinkProduct
     */
    prices: Array<ProductPrice>;
    /**
     * List of benefits granted by the product.
     * @type {Array<BenefitBase>}
     * @memberof CheckoutLinkProduct
     */
    benefits: Array<BenefitBase>;
    /**
     * List of medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof CheckoutLinkProduct
     */
    medias: Array<ProductMediaFileRead>;
}
/**
 * 
 * @export
 * @interface CheckoutLinkProductCreate
 */
export interface CheckoutLinkProductCreate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutLinkProductCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Payment processor to use. Currently only Stripe is supported.
     * @type {string}
     * @memberof CheckoutLinkProductCreate
     */
    payment_processor: CheckoutLinkProductCreatePaymentProcessorEnum;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkProductCreate
     */
    label?: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof CheckoutLinkProductCreate
     */
    allow_discount_codes?: boolean;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkProductCreate
     */
    discount_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkProductCreate
     */
    success_url?: string | null;
    /**
     * ID of the product to checkout. First available price will be selected.
     * @type {string}
     * @memberof CheckoutLinkProductCreate
     */
    product_id: string;
}


/**
 * @export
 */
export const CheckoutLinkProductCreatePaymentProcessorEnum = {
    STRIPE: 'stripe'
} as const;
export type CheckoutLinkProductCreatePaymentProcessorEnum = typeof CheckoutLinkProductCreatePaymentProcessorEnum[keyof typeof CheckoutLinkProductCreatePaymentProcessorEnum];


/**
 * 
 * @export
 */
export const CheckoutLinkSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at'
} as const;
export type CheckoutLinkSortProperty = typeof CheckoutLinkSortProperty[keyof typeof CheckoutLinkSortProperty];

/**
 * Schema to update an existing checkout link.
 * @export
 * @interface CheckoutLinkUpdate
 */
export interface CheckoutLinkUpdate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutLinkUpdate
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkUpdate
     */
    label?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CheckoutLinkUpdate
     */
    allow_discount_codes?: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkUpdate
     */
    product_price_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkUpdate
     */
    discount_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutLinkUpdate
     */
    success_url?: string | null;
}
/**
 * Create a new checkout session from a product price.
 * 
 * Metadata set on the checkout will be copied
 * to the resulting order and/or subscription.
 * @export
 * @interface CheckoutPriceCreate
 */
export interface CheckoutPriceCreate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutPriceCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Key-value object storing custom field values.
     * @type {object}
     * @memberof CheckoutPriceCreate
     */
    custom_field_data?: object;
    /**
     * Payment processor to use. Currently only Stripe is supported.
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    payment_processor: CheckoutPriceCreatePaymentProcessorEnum;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    discount_id?: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof CheckoutPriceCreate
     */
    allow_discount_codes?: boolean;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof CheckoutPriceCreate
     */
    amount?: number | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    customer_id?: string | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    customer_name?: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    customer_email?: string | null;
    /**
     * IP address of the customer. Used to detect tax location.
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    customer_ip_address?: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CheckoutPriceCreate
     */
    customer_billing_address?: Address | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    customer_tax_id?: string | null;
    /**
     * Key-value object allowing you to store additional information that'll be copied to the created customer.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutPriceCreate
     */
    customer_metadata?: { [key: string]: MetadataValue1; };
    /**
     * 
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    subscription_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    success_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    embed_origin?: string | null;
    /**
     * ID of the product price to checkout.
     * @type {string}
     * @memberof CheckoutPriceCreate
     */
    product_price_id: string;
}


/**
 * @export
 */
export const CheckoutPriceCreatePaymentProcessorEnum = {
    STRIPE: 'stripe'
} as const;
export type CheckoutPriceCreatePaymentProcessorEnum = typeof CheckoutPriceCreatePaymentProcessorEnum[keyof typeof CheckoutPriceCreatePaymentProcessorEnum];

/**
 * Product data for a checkout session.
 * @export
 * @interface CheckoutProduct
 */
export interface CheckoutProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CheckoutProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof CheckoutProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof CheckoutProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof CheckoutProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof CheckoutProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof CheckoutProduct
     */
    organization_id: string;
    /**
     * List of prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof CheckoutProduct
     */
    prices: Array<ProductPrice>;
    /**
     * List of benefits granted by the product.
     * @type {Array<BenefitBase>}
     * @memberof CheckoutProduct
     */
    benefits: Array<BenefitBase>;
    /**
     * List of medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof CheckoutProduct
     */
    medias: Array<ProductMediaFileRead>;
}
/**
 * Create a new checkout session from a product.
 * 
 * Metadata set on the checkout will be copied
 * to the resulting order and/or subscription.
 * @export
 * @interface CheckoutProductCreate
 */
export interface CheckoutProductCreate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutProductCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Key-value object storing custom field values.
     * @type {object}
     * @memberof CheckoutProductCreate
     */
    custom_field_data?: object;
    /**
     * Payment processor to use. Currently only Stripe is supported.
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    payment_processor: CheckoutProductCreatePaymentProcessorEnum;
    /**
     * 
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    discount_id?: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof CheckoutProductCreate
     */
    allow_discount_codes?: boolean;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof CheckoutProductCreate
     */
    amount?: number | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    customer_id?: string | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    customer_name?: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    customer_email?: string | null;
    /**
     * IP address of the customer. Used to detect tax location.
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    customer_ip_address?: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CheckoutProductCreate
     */
    customer_billing_address?: Address | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    customer_tax_id?: string | null;
    /**
     * Key-value object allowing you to store additional information that'll be copied to the created customer.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutProductCreate
     */
    customer_metadata?: { [key: string]: MetadataValue1; };
    /**
     * 
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    subscription_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    success_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    embed_origin?: string | null;
    /**
     * ID of the product to checkout. First available price will be selected.
     * @type {string}
     * @memberof CheckoutProductCreate
     */
    product_id: string;
}


/**
 * @export
 */
export const CheckoutProductCreatePaymentProcessorEnum = {
    STRIPE: 'stripe'
} as const;
export type CheckoutProductCreatePaymentProcessorEnum = typeof CheckoutProductCreatePaymentProcessorEnum[keyof typeof CheckoutProductCreatePaymentProcessorEnum];

/**
 * Checkout session data retrieved using the client secret.
 * @export
 * @interface CheckoutPublic
 */
export interface CheckoutPublic {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CheckoutPublic
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublic
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CheckoutPublic
     */
    id: string;
    /**
     * Key-value object storing custom field values.
     * @type {object}
     * @memberof CheckoutPublic
     */
    custom_field_data?: object;
    /**
     * 
     * @type {PolarEnumsPaymentProcessor}
     * @memberof CheckoutPublic
     */
    payment_processor: PolarEnumsPaymentProcessor;
    /**
     * 
     * @type {CheckoutStatus}
     * @memberof CheckoutPublic
     */
    status: CheckoutStatus;
    /**
     * Client secret used to update and complete the checkout session from the client.
     * @type {string}
     * @memberof CheckoutPublic
     */
    client_secret: string;
    /**
     * URL where the customer can access the checkout session.
     * @type {string}
     * @memberof CheckoutPublic
     */
    url: string;
    /**
     * Expiration date and time of the checkout session.
     * @type {string}
     * @memberof CheckoutPublic
     */
    expires_at: string;
    /**
     * URL where the customer will be redirected after a successful payment.
     * @type {string}
     * @memberof CheckoutPublic
     */
    success_url: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublic
     */
    embed_origin: string | null;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof CheckoutPublic
     */
    amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof CheckoutPublic
     */
    tax_amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublic
     */
    currency: string | null;
    /**
     * 
     * @type {number}
     * @memberof CheckoutPublic
     */
    subtotal_amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof CheckoutPublic
     */
    total_amount: number | null;
    /**
     * ID of the product to checkout.
     * @type {string}
     * @memberof CheckoutPublic
     */
    product_id: string;
    /**
     * ID of the product price to checkout.
     * @type {string}
     * @memberof CheckoutPublic
     */
    product_price_id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublic
     */
    discount_id: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof CheckoutPublic
     */
    allow_discount_codes: boolean;
    /**
     * Whether the discount is applicable to the checkout. Typically, free and custom prices are not discountable.
     * @type {boolean}
     * @memberof CheckoutPublic
     */
    is_discount_applicable: boolean;
    /**
     * Whether the product price is free, regardless of discounts.
     * @type {boolean}
     * @memberof CheckoutPublic
     */
    is_free_product_price: boolean;
    /**
     * Whether the checkout requires payment, e.g. in case of free products or discounts that cover the total amount.
     * @type {boolean}
     * @memberof CheckoutPublic
     */
    is_payment_required: boolean;
    /**
     * Whether the checkout requires setting up a payment method, regardless of the amount, e.g. subscriptions that have first free cycles.
     * @type {boolean}
     * @memberof CheckoutPublic
     */
    is_payment_setup_required: boolean;
    /**
     * Whether the checkout requires a payment form, whether because of a payment or payment method setup.
     * @type {boolean}
     * @memberof CheckoutPublic
     */
    is_payment_form_required: boolean;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublic
     */
    customer_id: string | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof CheckoutPublic
     */
    customer_name: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutPublic
     */
    customer_email: string | null;
    /**
     * IP address of the customer. Used to detect tax location.
     * @type {string}
     * @memberof CheckoutPublic
     */
    customer_ip_address: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CheckoutPublic
     */
    customer_billing_address: Address | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublic
     */
    customer_tax_id: string | null;
    /**
     * 
     * @type {object}
     * @memberof CheckoutPublic
     */
    payment_processor_metadata: object;
    /**
     * 
     * @type {CheckoutProduct}
     * @memberof CheckoutPublic
     */
    product: CheckoutProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof CheckoutPublic
     */
    product_price: ProductPrice;
    /**
     * 
     * @type {CheckoutDiscount}
     * @memberof CheckoutPublic
     */
    discount: CheckoutDiscount | null;
    /**
     * 
     * @type {Organization}
     * @memberof CheckoutPublic
     */
    organization: Organization;
    /**
     * 
     * @type {Array<AttachedCustomField>}
     * @memberof CheckoutPublic
     */
    attached_custom_fields: Array<AttachedCustomField>;
}


/**
 * Checkout session data retrieved using the client secret after confirmation.
 * 
 * It contains a customer session token to retrieve order information
 * right after the checkout.
 * @export
 * @interface CheckoutPublicConfirmed
 */
export interface CheckoutPublicConfirmed {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    id: string;
    /**
     * Key-value object storing custom field values.
     * @type {object}
     * @memberof CheckoutPublicConfirmed
     */
    custom_field_data?: object;
    /**
     * 
     * @type {PolarEnumsPaymentProcessor}
     * @memberof CheckoutPublicConfirmed
     */
    payment_processor: PolarEnumsPaymentProcessor;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    status: CheckoutPublicConfirmedStatusEnum;
    /**
     * Client secret used to update and complete the checkout session from the client.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    client_secret: string;
    /**
     * URL where the customer can access the checkout session.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    url: string;
    /**
     * Expiration date and time of the checkout session.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    expires_at: string;
    /**
     * URL where the customer will be redirected after a successful payment.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    success_url: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    embed_origin: string | null;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof CheckoutPublicConfirmed
     */
    amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof CheckoutPublicConfirmed
     */
    tax_amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    currency: string | null;
    /**
     * 
     * @type {number}
     * @memberof CheckoutPublicConfirmed
     */
    subtotal_amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof CheckoutPublicConfirmed
     */
    total_amount: number | null;
    /**
     * ID of the product to checkout.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    product_id: string;
    /**
     * ID of the product price to checkout.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    product_price_id: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    discount_id: string | null;
    /**
     * Whether to allow the customer to apply discount codes. If you apply a discount through `discount_id`, it'll still be applied, but the customer won't be able to change it.
     * @type {boolean}
     * @memberof CheckoutPublicConfirmed
     */
    allow_discount_codes: boolean;
    /**
     * Whether the discount is applicable to the checkout. Typically, free and custom prices are not discountable.
     * @type {boolean}
     * @memberof CheckoutPublicConfirmed
     */
    is_discount_applicable: boolean;
    /**
     * Whether the product price is free, regardless of discounts.
     * @type {boolean}
     * @memberof CheckoutPublicConfirmed
     */
    is_free_product_price: boolean;
    /**
     * Whether the checkout requires payment, e.g. in case of free products or discounts that cover the total amount.
     * @type {boolean}
     * @memberof CheckoutPublicConfirmed
     */
    is_payment_required: boolean;
    /**
     * Whether the checkout requires setting up a payment method, regardless of the amount, e.g. subscriptions that have first free cycles.
     * @type {boolean}
     * @memberof CheckoutPublicConfirmed
     */
    is_payment_setup_required: boolean;
    /**
     * Whether the checkout requires a payment form, whether because of a payment or payment method setup.
     * @type {boolean}
     * @memberof CheckoutPublicConfirmed
     */
    is_payment_form_required: boolean;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    customer_id: string | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    customer_name: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    customer_email: string | null;
    /**
     * IP address of the customer. Used to detect tax location.
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    customer_ip_address: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CheckoutPublicConfirmed
     */
    customer_billing_address: Address | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    customer_tax_id: string | null;
    /**
     * 
     * @type {object}
     * @memberof CheckoutPublicConfirmed
     */
    payment_processor_metadata: object;
    /**
     * 
     * @type {CheckoutProduct}
     * @memberof CheckoutPublicConfirmed
     */
    product: CheckoutProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof CheckoutPublicConfirmed
     */
    product_price: ProductPrice;
    /**
     * 
     * @type {CheckoutDiscount}
     * @memberof CheckoutPublicConfirmed
     */
    discount: CheckoutDiscount | null;
    /**
     * 
     * @type {Organization}
     * @memberof CheckoutPublicConfirmed
     */
    organization: Organization;
    /**
     * 
     * @type {Array<AttachedCustomField>}
     * @memberof CheckoutPublicConfirmed
     */
    attached_custom_fields: Array<AttachedCustomField>;
    /**
     * 
     * @type {string}
     * @memberof CheckoutPublicConfirmed
     */
    customer_session_token: string;
}


/**
 * @export
 */
export const CheckoutPublicConfirmedStatusEnum = {
    CONFIRMED: 'confirmed'
} as const;
export type CheckoutPublicConfirmedStatusEnum = typeof CheckoutPublicConfirmedStatusEnum[keyof typeof CheckoutPublicConfirmedStatusEnum];


/**
 * 
 * @export
 */
export const CheckoutSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    EXPIRES_AT: 'expires_at',
    EXPIRES_AT2: '-expires_at'
} as const;
export type CheckoutSortProperty = typeof CheckoutSortProperty[keyof typeof CheckoutSortProperty];


/**
 * 
 * @export
 */
export const CheckoutStatus = {
    OPEN: 'open',
    EXPIRED: 'expired',
    CONFIRMED: 'confirmed',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed'
} as const;
export type CheckoutStatus = typeof CheckoutStatus[keyof typeof CheckoutStatus];

/**
 * Update an existing checkout session using an access token.
 * @export
 * @interface CheckoutUpdate
 */
export interface CheckoutUpdate {
    /**
     * 
     * @type {object}
     * @memberof CheckoutUpdate
     */
    custom_field_data?: object | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdate
     */
    product_price_id?: string | null;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof CheckoutUpdate
     */
    amount?: number | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof CheckoutUpdate
     */
    customer_name?: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutUpdate
     */
    customer_email?: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CheckoutUpdate
     */
    customer_billing_address?: Address | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdate
     */
    customer_tax_id?: string | null;
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutUpdate
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdate
     */
    discount_id?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CheckoutUpdate
     */
    allow_discount_codes?: boolean | null;
    /**
     * IP address of the customer. Used to detect tax location.
     * @type {string}
     * @memberof CheckoutUpdate
     */
    customer_ip_address?: string | null;
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CheckoutUpdate
     */
    customer_metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdate
     */
    success_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdate
     */
    embed_origin?: string | null;
}
/**
 * Update an existing checkout session using the client secret.
 * @export
 * @interface CheckoutUpdatePublic
 */
export interface CheckoutUpdatePublic {
    /**
     * 
     * @type {object}
     * @memberof CheckoutUpdatePublic
     */
    custom_field_data?: object | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdatePublic
     */
    product_price_id?: string | null;
    /**
     * Amount to pay in cents. Only useful for custom prices, it'll be ignored for fixed and free prices.
     * @type {number}
     * @memberof CheckoutUpdatePublic
     */
    amount?: number | null;
    /**
     * Name of the customer.
     * @type {string}
     * @memberof CheckoutUpdatePublic
     */
    customer_name?: string | null;
    /**
     * Email address of the customer.
     * @type {string}
     * @memberof CheckoutUpdatePublic
     */
    customer_email?: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CheckoutUpdatePublic
     */
    customer_billing_address?: Address | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdatePublic
     */
    customer_tax_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CheckoutUpdatePublic
     */
    discount_code?: string | null;
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
    organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ConfirmIssueSplit
     */
    github_username?: string | null;
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
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof CreatePledgePayLater
     */
    currency?: string;
    /**
     * 
     * @type {string}
     * @memberof CreatePledgePayLater
     */
    on_behalf_of_organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CreatePledgePayLater
     */
    by_organization_id?: string | null;
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
     * Amount in the currencies smallest unit (cents if currency is USD)
     * @type {number}
     * @memberof CurrencyAmount
     */
    amount: number;
}
/**
 * @type CustomField
 * 
 * @export
 */
export type CustomField = { type: 'checkbox' } & CustomFieldCheckbox | { type: 'date' } & CustomFieldDate | { type: 'number' } & CustomFieldNumber | { type: 'select' } & CustomFieldSelect | { type: 'text' } & CustomFieldText;
/**
 * Schema for a custom field of type checkbox.
 * @export
 * @interface CustomFieldCheckbox
 */
export interface CustomFieldCheckbox {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomFieldCheckbox
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCheckbox
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomFieldCheckbox
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof CustomFieldCheckbox
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCheckbox
     */
    type: CustomFieldCheckboxTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value.
     * @type {string}
     * @memberof CustomFieldCheckbox
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldCheckbox
     */
    name: string;
    /**
     * The ID of the organization owning the custom field.
     * @type {string}
     * @memberof CustomFieldCheckbox
     */
    organization_id: string;
    /**
     * 
     * @type {CustomFieldCheckboxProperties}
     * @memberof CustomFieldCheckbox
     */
    properties: CustomFieldCheckboxProperties;
}


/**
 * @export
 */
export const CustomFieldCheckboxTypeEnum = {
    CHECKBOX: 'checkbox'
} as const;
export type CustomFieldCheckboxTypeEnum = typeof CustomFieldCheckboxTypeEnum[keyof typeof CustomFieldCheckboxTypeEnum];

/**
 * 
 * @export
 * @interface CustomFieldCheckboxProperties
 */
export interface CustomFieldCheckboxProperties {
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCheckboxProperties
     */
    form_label?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCheckboxProperties
     */
    form_help_text?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCheckboxProperties
     */
    form_placeholder?: string;
}
/**
 * @type CustomFieldCreate
 * 
 * @export
 */
export type CustomFieldCreate = { type: 'checkbox' } & CustomFieldCreateCheckbox | { type: 'date' } & CustomFieldCreateDate | { type: 'number' } & CustomFieldCreateNumber | { type: 'select' } & CustomFieldCreateSelect | { type: 'text' } & CustomFieldCreateText;
/**
 * Schema to create a custom field of type checkbox.
 * @export
 * @interface CustomFieldCreateCheckbox
 */
export interface CustomFieldCreateCheckbox {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldCreateCheckbox
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCreateCheckbox
     */
    type: CustomFieldCreateCheckboxTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldCreateCheckbox
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldCreateCheckbox
     */
    name: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof CustomFieldCreateCheckbox
     */
    organization_id?: string | null;
    /**
     * 
     * @type {CustomFieldCheckboxProperties}
     * @memberof CustomFieldCreateCheckbox
     */
    properties: CustomFieldCheckboxProperties;
}


/**
 * @export
 */
export const CustomFieldCreateCheckboxTypeEnum = {
    CHECKBOX: 'checkbox'
} as const;
export type CustomFieldCreateCheckboxTypeEnum = typeof CustomFieldCreateCheckboxTypeEnum[keyof typeof CustomFieldCreateCheckboxTypeEnum];

/**
 * Schema to create a custom field of type date.
 * @export
 * @interface CustomFieldCreateDate
 */
export interface CustomFieldCreateDate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldCreateDate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCreateDate
     */
    type: CustomFieldCreateDateTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldCreateDate
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldCreateDate
     */
    name: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof CustomFieldCreateDate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {CustomFieldDateProperties}
     * @memberof CustomFieldCreateDate
     */
    properties: CustomFieldDateProperties;
}


/**
 * @export
 */
export const CustomFieldCreateDateTypeEnum = {
    DATE: 'date'
} as const;
export type CustomFieldCreateDateTypeEnum = typeof CustomFieldCreateDateTypeEnum[keyof typeof CustomFieldCreateDateTypeEnum];

/**
 * Schema to create a custom field of type number.
 * @export
 * @interface CustomFieldCreateNumber
 */
export interface CustomFieldCreateNumber {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldCreateNumber
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCreateNumber
     */
    type: CustomFieldCreateNumberTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldCreateNumber
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldCreateNumber
     */
    name: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof CustomFieldCreateNumber
     */
    organization_id?: string | null;
    /**
     * 
     * @type {CustomFieldNumberProperties}
     * @memberof CustomFieldCreateNumber
     */
    properties: CustomFieldNumberProperties;
}


/**
 * @export
 */
export const CustomFieldCreateNumberTypeEnum = {
    NUMBER: 'number'
} as const;
export type CustomFieldCreateNumberTypeEnum = typeof CustomFieldCreateNumberTypeEnum[keyof typeof CustomFieldCreateNumberTypeEnum];

/**
 * Schema to create a custom field of type select.
 * @export
 * @interface CustomFieldCreateSelect
 */
export interface CustomFieldCreateSelect {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldCreateSelect
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCreateSelect
     */
    type: CustomFieldCreateSelectTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldCreateSelect
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldCreateSelect
     */
    name: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof CustomFieldCreateSelect
     */
    organization_id?: string | null;
    /**
     * 
     * @type {CustomFieldSelectProperties}
     * @memberof CustomFieldCreateSelect
     */
    properties: CustomFieldSelectProperties;
}


/**
 * @export
 */
export const CustomFieldCreateSelectTypeEnum = {
    SELECT: 'select'
} as const;
export type CustomFieldCreateSelectTypeEnum = typeof CustomFieldCreateSelectTypeEnum[keyof typeof CustomFieldCreateSelectTypeEnum];

/**
 * Schema to create a custom field of type text.
 * @export
 * @interface CustomFieldCreateText
 */
export interface CustomFieldCreateText {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldCreateText
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldCreateText
     */
    type: CustomFieldCreateTextTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldCreateText
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldCreateText
     */
    name: string;
    /**
     * The organization ID.
     * @type {string}
     * @memberof CustomFieldCreateText
     */
    organization_id?: string | null;
    /**
     * 
     * @type {CustomFieldTextProperties}
     * @memberof CustomFieldCreateText
     */
    properties: CustomFieldTextProperties;
}


/**
 * @export
 */
export const CustomFieldCreateTextTypeEnum = {
    TEXT: 'text'
} as const;
export type CustomFieldCreateTextTypeEnum = typeof CustomFieldCreateTextTypeEnum[keyof typeof CustomFieldCreateTextTypeEnum];

/**
 * Schema for a custom field of type date.
 * @export
 * @interface CustomFieldDate
 */
export interface CustomFieldDate {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomFieldDate
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldDate
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomFieldDate
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof CustomFieldDate
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldDate
     */
    type: CustomFieldDateTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value.
     * @type {string}
     * @memberof CustomFieldDate
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldDate
     */
    name: string;
    /**
     * The ID of the organization owning the custom field.
     * @type {string}
     * @memberof CustomFieldDate
     */
    organization_id: string;
    /**
     * 
     * @type {CustomFieldDateProperties}
     * @memberof CustomFieldDate
     */
    properties: CustomFieldDateProperties;
}


/**
 * @export
 */
export const CustomFieldDateTypeEnum = {
    DATE: 'date'
} as const;
export type CustomFieldDateTypeEnum = typeof CustomFieldDateTypeEnum[keyof typeof CustomFieldDateTypeEnum];

/**
 * 
 * @export
 * @interface CustomFieldDateProperties
 */
export interface CustomFieldDateProperties {
    /**
     * 
     * @type {string}
     * @memberof CustomFieldDateProperties
     */
    form_label?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldDateProperties
     */
    form_help_text?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldDateProperties
     */
    form_placeholder?: string;
    /**
     * 
     * @type {number}
     * @memberof CustomFieldDateProperties
     */
    ge?: number;
    /**
     * 
     * @type {number}
     * @memberof CustomFieldDateProperties
     */
    le?: number;
}
/**
 * Schema for a custom field of type number.
 * @export
 * @interface CustomFieldNumber
 */
export interface CustomFieldNumber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomFieldNumber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldNumber
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomFieldNumber
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof CustomFieldNumber
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldNumber
     */
    type: CustomFieldNumberTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value.
     * @type {string}
     * @memberof CustomFieldNumber
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldNumber
     */
    name: string;
    /**
     * The ID of the organization owning the custom field.
     * @type {string}
     * @memberof CustomFieldNumber
     */
    organization_id: string;
    /**
     * 
     * @type {CustomFieldNumberProperties}
     * @memberof CustomFieldNumber
     */
    properties: CustomFieldNumberProperties;
}


/**
 * @export
 */
export const CustomFieldNumberTypeEnum = {
    NUMBER: 'number'
} as const;
export type CustomFieldNumberTypeEnum = typeof CustomFieldNumberTypeEnum[keyof typeof CustomFieldNumberTypeEnum];

/**
 * 
 * @export
 * @interface CustomFieldNumberProperties
 */
export interface CustomFieldNumberProperties {
    /**
     * 
     * @type {string}
     * @memberof CustomFieldNumberProperties
     */
    form_label?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldNumberProperties
     */
    form_help_text?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldNumberProperties
     */
    form_placeholder?: string;
    /**
     * 
     * @type {number}
     * @memberof CustomFieldNumberProperties
     */
    ge?: number;
    /**
     * 
     * @type {number}
     * @memberof CustomFieldNumberProperties
     */
    le?: number;
}
/**
 * Schema for a custom field of type select.
 * @export
 * @interface CustomFieldSelect
 */
export interface CustomFieldSelect {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomFieldSelect
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldSelect
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomFieldSelect
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof CustomFieldSelect
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldSelect
     */
    type: CustomFieldSelectTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value.
     * @type {string}
     * @memberof CustomFieldSelect
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldSelect
     */
    name: string;
    /**
     * The ID of the organization owning the custom field.
     * @type {string}
     * @memberof CustomFieldSelect
     */
    organization_id: string;
    /**
     * 
     * @type {CustomFieldSelectProperties}
     * @memberof CustomFieldSelect
     */
    properties: CustomFieldSelectProperties;
}


/**
 * @export
 */
export const CustomFieldSelectTypeEnum = {
    SELECT: 'select'
} as const;
export type CustomFieldSelectTypeEnum = typeof CustomFieldSelectTypeEnum[keyof typeof CustomFieldSelectTypeEnum];

/**
 * 
 * @export
 * @interface CustomFieldSelectOption
 */
export interface CustomFieldSelectOption {
    /**
     * 
     * @type {string}
     * @memberof CustomFieldSelectOption
     */
    value: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldSelectOption
     */
    label: string;
}
/**
 * 
 * @export
 * @interface CustomFieldSelectProperties
 */
export interface CustomFieldSelectProperties {
    /**
     * 
     * @type {string}
     * @memberof CustomFieldSelectProperties
     */
    form_label?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldSelectProperties
     */
    form_help_text?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldSelectProperties
     */
    form_placeholder?: string;
    /**
     * 
     * @type {Array<CustomFieldSelectOption>}
     * @memberof CustomFieldSelectProperties
     */
    options: Array<CustomFieldSelectOption>;
}

/**
 * 
 * @export
 */
export const CustomFieldSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    SLUG: 'slug',
    SLUG2: '-slug',
    NAME: 'name',
    NAME2: '-name',
    TYPE: 'type',
    TYPE2: '-type'
} as const;
export type CustomFieldSortProperty = typeof CustomFieldSortProperty[keyof typeof CustomFieldSortProperty];

/**
 * Schema for a custom field of type text.
 * @export
 * @interface CustomFieldText
 */
export interface CustomFieldText {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomFieldText
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldText
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomFieldText
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof CustomFieldText
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof CustomFieldText
     */
    type: CustomFieldTextTypeEnum;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value.
     * @type {string}
     * @memberof CustomFieldText
     */
    slug: string;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldText
     */
    name: string;
    /**
     * The ID of the organization owning the custom field.
     * @type {string}
     * @memberof CustomFieldText
     */
    organization_id: string;
    /**
     * 
     * @type {CustomFieldTextProperties}
     * @memberof CustomFieldText
     */
    properties: CustomFieldTextProperties;
}


/**
 * @export
 */
export const CustomFieldTextTypeEnum = {
    TEXT: 'text'
} as const;
export type CustomFieldTextTypeEnum = typeof CustomFieldTextTypeEnum[keyof typeof CustomFieldTextTypeEnum];

/**
 * 
 * @export
 * @interface CustomFieldTextProperties
 */
export interface CustomFieldTextProperties {
    /**
     * 
     * @type {string}
     * @memberof CustomFieldTextProperties
     */
    form_label?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldTextProperties
     */
    form_help_text?: string;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldTextProperties
     */
    form_placeholder?: string;
    /**
     * 
     * @type {boolean}
     * @memberof CustomFieldTextProperties
     */
    textarea?: boolean;
    /**
     * 
     * @type {number}
     * @memberof CustomFieldTextProperties
     */
    min_length?: number;
    /**
     * 
     * @type {number}
     * @memberof CustomFieldTextProperties
     */
    max_length?: number;
}

/**
 * 
 * @export
 */
export const CustomFieldType = {
    TEXT: 'text',
    NUMBER: 'number',
    DATE: 'date',
    CHECKBOX: 'checkbox',
    SELECT: 'select'
} as const;
export type CustomFieldType = typeof CustomFieldType[keyof typeof CustomFieldType];

/**
 * @type CustomFieldTypeFilter
 * Filter by custom field type.
 * @export
 */
export type CustomFieldTypeFilter = Array<CustomFieldType> | CustomFieldType;

/**
 * @type CustomFieldUpdate
 * 
 * @export
 */
export type CustomFieldUpdate = { type: 'checkbox' } & CustomFieldUpdateCheckbox | { type: 'date' } & CustomFieldUpdateDate | { type: 'number' } & CustomFieldUpdateNumber | { type: 'select' } & CustomFieldUpdateSelect | { type: 'text' } & CustomFieldUpdateText;
/**
 * Schema to update a custom field of type checkbox.
 * @export
 * @interface CustomFieldUpdateCheckbox
 */
export interface CustomFieldUpdateCheckbox {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldUpdateCheckbox
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldUpdateCheckbox
     */
    name?: string | null;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldUpdateCheckbox
     */
    slug?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldUpdateCheckbox
     */
    type: CustomFieldUpdateCheckboxTypeEnum;
    /**
     * 
     * @type {CustomFieldCheckboxProperties}
     * @memberof CustomFieldUpdateCheckbox
     */
    properties?: CustomFieldCheckboxProperties | null;
}


/**
 * @export
 */
export const CustomFieldUpdateCheckboxTypeEnum = {
    CHECKBOX: 'checkbox'
} as const;
export type CustomFieldUpdateCheckboxTypeEnum = typeof CustomFieldUpdateCheckboxTypeEnum[keyof typeof CustomFieldUpdateCheckboxTypeEnum];

/**
 * Schema to update a custom field of type date.
 * @export
 * @interface CustomFieldUpdateDate
 */
export interface CustomFieldUpdateDate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldUpdateDate
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldUpdateDate
     */
    name?: string | null;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldUpdateDate
     */
    slug?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldUpdateDate
     */
    type: CustomFieldUpdateDateTypeEnum;
    /**
     * 
     * @type {CustomFieldDateProperties}
     * @memberof CustomFieldUpdateDate
     */
    properties?: CustomFieldDateProperties | null;
}


/**
 * @export
 */
export const CustomFieldUpdateDateTypeEnum = {
    DATE: 'date'
} as const;
export type CustomFieldUpdateDateTypeEnum = typeof CustomFieldUpdateDateTypeEnum[keyof typeof CustomFieldUpdateDateTypeEnum];

/**
 * Schema to update a custom field of type number.
 * @export
 * @interface CustomFieldUpdateNumber
 */
export interface CustomFieldUpdateNumber {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldUpdateNumber
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldUpdateNumber
     */
    name?: string | null;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldUpdateNumber
     */
    slug?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldUpdateNumber
     */
    type: CustomFieldUpdateNumberTypeEnum;
    /**
     * 
     * @type {CustomFieldNumberProperties}
     * @memberof CustomFieldUpdateNumber
     */
    properties?: CustomFieldNumberProperties | null;
}


/**
 * @export
 */
export const CustomFieldUpdateNumberTypeEnum = {
    NUMBER: 'number'
} as const;
export type CustomFieldUpdateNumberTypeEnum = typeof CustomFieldUpdateNumberTypeEnum[keyof typeof CustomFieldUpdateNumberTypeEnum];

/**
 * Schema to update a custom field of type select.
 * @export
 * @interface CustomFieldUpdateSelect
 */
export interface CustomFieldUpdateSelect {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldUpdateSelect
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldUpdateSelect
     */
    name?: string | null;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldUpdateSelect
     */
    slug?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldUpdateSelect
     */
    type: CustomFieldUpdateSelectTypeEnum;
    /**
     * 
     * @type {CustomFieldSelectProperties}
     * @memberof CustomFieldUpdateSelect
     */
    properties?: CustomFieldSelectProperties | null;
}


/**
 * @export
 */
export const CustomFieldUpdateSelectTypeEnum = {
    SELECT: 'select'
} as const;
export type CustomFieldUpdateSelectTypeEnum = typeof CustomFieldUpdateSelectTypeEnum[keyof typeof CustomFieldUpdateSelectTypeEnum];

/**
 * Schema to update a custom field of type text.
 * @export
 * @interface CustomFieldUpdateText
 */
export interface CustomFieldUpdateText {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof CustomFieldUpdateText
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * Name of the custom field.
     * @type {string}
     * @memberof CustomFieldUpdateText
     */
    name?: string | null;
    /**
     * Identifier of the custom field. It'll be used as key when storing the value. Must be unique across the organization.It can only contain ASCII letters, numbers and hyphens.
     * @type {string}
     * @memberof CustomFieldUpdateText
     */
    slug?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomFieldUpdateText
     */
    type: CustomFieldUpdateTextTypeEnum;
    /**
     * 
     * @type {CustomFieldTextProperties}
     * @memberof CustomFieldUpdateText
     */
    properties?: CustomFieldTextProperties | null;
}


/**
 * @export
 */
export const CustomFieldUpdateTextTypeEnum = {
    TEXT: 'text'
} as const;
export type CustomFieldUpdateTextTypeEnum = typeof CustomFieldUpdateTextTypeEnum[keyof typeof CustomFieldUpdateTextTypeEnum];

/**
 * A customer in an organization.
 * @export
 * @interface Customer
 */
export interface Customer {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Customer
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Customer
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof Customer
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof Customer
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof Customer
     */
    email: string;
    /**
     * 
     * @type {boolean}
     * @memberof Customer
     */
    email_verified: boolean;
    /**
     * 
     * @type {string}
     * @memberof Customer
     */
    name: string | null;
    /**
     * 
     * @type {Address}
     * @memberof Customer
     */
    billing_address: Address | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof Customer
     */
    tax_id: Array<string> | null;
    /**
     * 
     * @type {string}
     * @memberof Customer
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof Customer
     */
    readonly avatar_url: string;
}
/**
 * @type CustomerBenefitGrant
 * @export
 */
export type CustomerBenefitGrant = CustomerBenefitGrantAds | CustomerBenefitGrantCustom | CustomerBenefitGrantDiscord | CustomerBenefitGrantDownloadables | CustomerBenefitGrantGitHubRepository | CustomerBenefitGrantLicenseKeys;

/**
 * 
 * @export
 * @interface CustomerBenefitGrantAds
 */
export interface CustomerBenefitGrantAds {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    granted_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    revoked_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAds
     */
    order_id: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantAds
     */
    is_granted: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantAds
     */
    is_revoked: boolean;
    /**
     * 
     * @type {CustomerPortalCustomer}
     * @memberof CustomerBenefitGrantAds
     */
    customer: CustomerPortalCustomer;
    /**
     * 
     * @type {BenefitAdsSubscriber}
     * @memberof CustomerBenefitGrantAds
     */
    benefit: BenefitAdsSubscriber;
    /**
     * 
     * @type {BenefitGrantAdsProperties}
     * @memberof CustomerBenefitGrantAds
     */
    properties: BenefitGrantAdsProperties;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantAdsUpdate
 */
export interface CustomerBenefitGrantAdsUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantAdsUpdate
     */
    benefit_type: CustomerBenefitGrantAdsUpdateBenefitTypeEnum;
}


/**
 * @export
 */
export const CustomerBenefitGrantAdsUpdateBenefitTypeEnum = {
    ADS: 'ads'
} as const;
export type CustomerBenefitGrantAdsUpdateBenefitTypeEnum = typeof CustomerBenefitGrantAdsUpdateBenefitTypeEnum[keyof typeof CustomerBenefitGrantAdsUpdateBenefitTypeEnum];

/**
 * 
 * @export
 * @interface CustomerBenefitGrantCustom
 */
export interface CustomerBenefitGrantCustom {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    granted_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    revoked_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustom
     */
    order_id: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantCustom
     */
    is_granted: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantCustom
     */
    is_revoked: boolean;
    /**
     * 
     * @type {CustomerPortalCustomer}
     * @memberof CustomerBenefitGrantCustom
     */
    customer: CustomerPortalCustomer;
    /**
     * 
     * @type {BenefitCustomSubscriber}
     * @memberof CustomerBenefitGrantCustom
     */
    benefit: BenefitCustomSubscriber;
    /**
     * 
     * @type {object}
     * @memberof CustomerBenefitGrantCustom
     */
    properties: object;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantCustomUpdate
 */
export interface CustomerBenefitGrantCustomUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantCustomUpdate
     */
    benefit_type: CustomerBenefitGrantCustomUpdateBenefitTypeEnum;
}


/**
 * @export
 */
export const CustomerBenefitGrantCustomUpdateBenefitTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type CustomerBenefitGrantCustomUpdateBenefitTypeEnum = typeof CustomerBenefitGrantCustomUpdateBenefitTypeEnum[keyof typeof CustomerBenefitGrantCustomUpdateBenefitTypeEnum];

/**
 * 
 * @export
 * @interface CustomerBenefitGrantDiscord
 */
export interface CustomerBenefitGrantDiscord {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    granted_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    revoked_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscord
     */
    order_id: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantDiscord
     */
    is_granted: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantDiscord
     */
    is_revoked: boolean;
    /**
     * 
     * @type {CustomerPortalCustomer}
     * @memberof CustomerBenefitGrantDiscord
     */
    customer: CustomerPortalCustomer;
    /**
     * 
     * @type {BenefitDiscordSubscriber}
     * @memberof CustomerBenefitGrantDiscord
     */
    benefit: BenefitDiscordSubscriber;
    /**
     * 
     * @type {BenefitGrantDiscordProperties}
     * @memberof CustomerBenefitGrantDiscord
     */
    properties: BenefitGrantDiscordProperties;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantDiscordPropertiesUpdate
 */
export interface CustomerBenefitGrantDiscordPropertiesUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscordPropertiesUpdate
     */
    account_id: string;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantDiscordUpdate
 */
export interface CustomerBenefitGrantDiscordUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDiscordUpdate
     */
    benefit_type: CustomerBenefitGrantDiscordUpdateBenefitTypeEnum;
    /**
     * 
     * @type {CustomerBenefitGrantDiscordPropertiesUpdate}
     * @memberof CustomerBenefitGrantDiscordUpdate
     */
    properties: CustomerBenefitGrantDiscordPropertiesUpdate;
}


/**
 * @export
 */
export const CustomerBenefitGrantDiscordUpdateBenefitTypeEnum = {
    DISCORD: 'discord'
} as const;
export type CustomerBenefitGrantDiscordUpdateBenefitTypeEnum = typeof CustomerBenefitGrantDiscordUpdateBenefitTypeEnum[keyof typeof CustomerBenefitGrantDiscordUpdateBenefitTypeEnum];

/**
 * 
 * @export
 * @interface CustomerBenefitGrantDownloadables
 */
export interface CustomerBenefitGrantDownloadables {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    granted_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    revoked_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadables
     */
    order_id: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantDownloadables
     */
    is_granted: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantDownloadables
     */
    is_revoked: boolean;
    /**
     * 
     * @type {CustomerPortalCustomer}
     * @memberof CustomerBenefitGrantDownloadables
     */
    customer: CustomerPortalCustomer;
    /**
     * 
     * @type {BenefitDownloadablesSubscriber}
     * @memberof CustomerBenefitGrantDownloadables
     */
    benefit: BenefitDownloadablesSubscriber;
    /**
     * 
     * @type {BenefitGrantDownloadablesProperties}
     * @memberof CustomerBenefitGrantDownloadables
     */
    properties: BenefitGrantDownloadablesProperties;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantDownloadablesUpdate
 */
export interface CustomerBenefitGrantDownloadablesUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantDownloadablesUpdate
     */
    benefit_type: CustomerBenefitGrantDownloadablesUpdateBenefitTypeEnum;
}


/**
 * @export
 */
export const CustomerBenefitGrantDownloadablesUpdateBenefitTypeEnum = {
    DOWNLOADABLES: 'downloadables'
} as const;
export type CustomerBenefitGrantDownloadablesUpdateBenefitTypeEnum = typeof CustomerBenefitGrantDownloadablesUpdateBenefitTypeEnum[keyof typeof CustomerBenefitGrantDownloadablesUpdateBenefitTypeEnum];

/**
 * 
 * @export
 * @interface CustomerBenefitGrantGitHubRepository
 */
export interface CustomerBenefitGrantGitHubRepository {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    granted_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    revoked_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    order_id: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    is_granted: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    is_revoked: boolean;
    /**
     * 
     * @type {CustomerPortalCustomer}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    customer: CustomerPortalCustomer;
    /**
     * 
     * @type {BenefitGitHubRepositorySubscriber}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    benefit: BenefitGitHubRepositorySubscriber;
    /**
     * 
     * @type {BenefitGrantGitHubRepositoryProperties}
     * @memberof CustomerBenefitGrantGitHubRepository
     */
    properties: BenefitGrantGitHubRepositoryProperties;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantGitHubRepositoryPropertiesUpdate
 */
export interface CustomerBenefitGrantGitHubRepositoryPropertiesUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepositoryPropertiesUpdate
     */
    account_id: string;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantGitHubRepositoryUpdate
 */
export interface CustomerBenefitGrantGitHubRepositoryUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantGitHubRepositoryUpdate
     */
    benefit_type: CustomerBenefitGrantGitHubRepositoryUpdateBenefitTypeEnum;
    /**
     * 
     * @type {CustomerBenefitGrantGitHubRepositoryPropertiesUpdate}
     * @memberof CustomerBenefitGrantGitHubRepositoryUpdate
     */
    properties: CustomerBenefitGrantGitHubRepositoryPropertiesUpdate;
}


/**
 * @export
 */
export const CustomerBenefitGrantGitHubRepositoryUpdateBenefitTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type CustomerBenefitGrantGitHubRepositoryUpdateBenefitTypeEnum = typeof CustomerBenefitGrantGitHubRepositoryUpdateBenefitTypeEnum[keyof typeof CustomerBenefitGrantGitHubRepositoryUpdateBenefitTypeEnum];

/**
 * 
 * @export
 * @interface CustomerBenefitGrantLicenseKeys
 */
export interface CustomerBenefitGrantLicenseKeys {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    granted_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    revoked_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    order_id: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    is_granted: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    is_revoked: boolean;
    /**
     * 
     * @type {CustomerPortalCustomer}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    customer: CustomerPortalCustomer;
    /**
     * 
     * @type {BenefitLicenseKeysSubscriber}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    benefit: BenefitLicenseKeysSubscriber;
    /**
     * 
     * @type {BenefitGrantLicenseKeysProperties}
     * @memberof CustomerBenefitGrantLicenseKeys
     */
    properties: BenefitGrantLicenseKeysProperties;
}
/**
 * 
 * @export
 * @interface CustomerBenefitGrantLicenseKeysUpdate
 */
export interface CustomerBenefitGrantLicenseKeysUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerBenefitGrantLicenseKeysUpdate
     */
    benefit_type: CustomerBenefitGrantLicenseKeysUpdateBenefitTypeEnum;
}


/**
 * @export
 */
export const CustomerBenefitGrantLicenseKeysUpdateBenefitTypeEnum = {
    LICENSE_KEYS: 'license_keys'
} as const;
export type CustomerBenefitGrantLicenseKeysUpdateBenefitTypeEnum = typeof CustomerBenefitGrantLicenseKeysUpdateBenefitTypeEnum[keyof typeof CustomerBenefitGrantLicenseKeysUpdateBenefitTypeEnum];


/**
 * 
 * @export
 */
export const CustomerBenefitGrantSortProperty = {
    GRANTED_AT: 'granted_at',
    GRANTED_AT2: '-granted_at',
    TYPE: 'type',
    TYPE2: '-type',
    ORGANIZATION: 'organization',
    ORGANIZATION2: '-organization'
} as const;
export type CustomerBenefitGrantSortProperty = typeof CustomerBenefitGrantSortProperty[keyof typeof CustomerBenefitGrantSortProperty];

/**
 * @type CustomerBenefitGrantUpdate
 * 
 * @export
 */
export type CustomerBenefitGrantUpdate = { benefit_type: 'ads' } & CustomerBenefitGrantAdsUpdate | { benefit_type: 'custom' } & CustomerBenefitGrantCustomUpdate | { benefit_type: 'discord' } & CustomerBenefitGrantDiscordUpdate | { benefit_type: 'downloadables' } & CustomerBenefitGrantDownloadablesUpdate | { benefit_type: 'github_repository' } & CustomerBenefitGrantGitHubRepositoryUpdate | { benefit_type: 'license_keys' } & CustomerBenefitGrantLicenseKeysUpdate;
/**
 * 
 * @export
 * @interface CustomerCreate
 */
export interface CustomerCreate {
    /**
     * 
     * @type {string}
     * @memberof CustomerCreate
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerCreate
     */
    name?: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CustomerCreate
     */
    billing_address?: Address | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof CustomerCreate
     */
    tax_id?: Array<string> | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof CustomerCreate
     */
    organization_id?: string | null;
}
/**
 * @type CustomerIDFilter
 * Filter by customer ID.
 * @export
 */
export type CustomerIDFilter = Array<string> | string;

/**
 * @type CustomerIDFilter1
 * Filter by customer.
 * @export
 */
export type CustomerIDFilter1 = Array<string> | string;


/**
 * 
 * @export
 */
export const CustomerOAuthPlatform = {
    GITHUB: 'github',
    DISCORD: 'discord'
} as const;
export type CustomerOAuthPlatform = typeof CustomerOAuthPlatform[keyof typeof CustomerOAuthPlatform];

/**
 * 
 * @export
 * @interface CustomerOrder
 */
export interface CustomerOrder {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerOrder
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof CustomerOrder
     */
    amount: number;
    /**
     * 
     * @type {number}
     * @memberof CustomerOrder
     */
    tax_amount: number;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     */
    currency: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     */
    product_price_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrder
     * @deprecated
     */
    user_id: string;
    /**
     * 
     * @type {CustomerOrderProduct}
     * @memberof CustomerOrder
     */
    product: CustomerOrderProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof CustomerOrder
     */
    product_price: ProductPrice;
    /**
     * 
     * @type {CustomerOrderSubscription}
     * @memberof CustomerOrder
     */
    subscription: CustomerOrderSubscription | null;
}
/**
 * Order's invoice data.
 * @export
 * @interface CustomerOrderInvoice
 */
export interface CustomerOrderInvoice {
    /**
     * The URL to the invoice.
     * @type {string}
     * @memberof CustomerOrderInvoice
     */
    url: string;
}
/**
 * 
 * @export
 * @interface CustomerOrderProduct
 */
export interface CustomerOrderProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerOrderProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof CustomerOrderProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof CustomerOrderProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof CustomerOrderProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof CustomerOrderProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof CustomerOrderProduct
     */
    organization_id: string;
    /**
     * List of prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof CustomerOrderProduct
     */
    prices: Array<ProductPrice>;
    /**
     * List of benefits granted by the product.
     * @type {Array<BenefitBase>}
     * @memberof CustomerOrderProduct
     */
    benefits: Array<BenefitBase>;
    /**
     * List of medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof CustomerOrderProduct
     */
    medias: Array<ProductMediaFileRead>;
    /**
     * 
     * @type {Organization}
     * @memberof CustomerOrderProduct
     */
    organization: Organization;
}

/**
 * 
 * @export
 */
export const CustomerOrderSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    AMOUNT: 'amount',
    AMOUNT2: '-amount',
    ORGANIZATION: 'organization',
    ORGANIZATION2: '-organization',
    PRODUCT: 'product',
    PRODUCT2: '-product',
    SUBSCRIPTION: 'subscription',
    SUBSCRIPTION2: '-subscription'
} as const;
export type CustomerOrderSortProperty = typeof CustomerOrderSortProperty[keyof typeof CustomerOrderSortProperty];

/**
 * 
 * @export
 * @interface CustomerOrderSubscription
 */
export interface CustomerOrderSubscription {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof CustomerOrderSubscription
     */
    amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    currency: string | null;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof CustomerOrderSubscription
     */
    recurring_interval: SubscriptionRecurringInterval;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof CustomerOrderSubscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    current_period_end: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerOrderSubscription
     */
    cancel_at_period_end: boolean;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    started_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    ended_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    price_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    discount_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerOrderSubscription
     */
    checkout_id: string | null;
}


/**
 * 
 * @export
 * @interface CustomerPortalCustomer
 */
export interface CustomerPortalCustomer {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerPortalCustomer
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerPortalCustomer
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerPortalCustomer
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerPortalCustomer
     */
    email: string;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerPortalCustomer
     */
    email_verified: boolean;
    /**
     * 
     * @type {string}
     * @memberof CustomerPortalCustomer
     */
    name: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CustomerPortalCustomer
     */
    billing_address: Address | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof CustomerPortalCustomer
     */
    tax_id: Array<string> | null;
    /**
     * 
     * @type {{ [key: string]: CustomerPortalOAuthAccount; }}
     * @memberof CustomerPortalCustomer
     */
    oauth_accounts: { [key: string]: CustomerPortalOAuthAccount; };
}
/**
 * 
 * @export
 * @interface CustomerPortalOAuthAccount
 */
export interface CustomerPortalOAuthAccount {
    /**
     * 
     * @type {string}
     * @memberof CustomerPortalOAuthAccount
     */
    account_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerPortalOAuthAccount
     */
    account_username: string | null;
}
/**
 * A customer session that can be used to authenticate as a customer.
 * @export
 * @interface CustomerSession
 */
export interface CustomerSession {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerSession
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSession
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerSession
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSession
     */
    token: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSession
     */
    expires_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSession
     */
    customer_id: string;
    /**
     * 
     * @type {Customer}
     * @memberof CustomerSession
     */
    customer: Customer;
}
/**
 * 
 * @export
 * @interface CustomerSessionCodeAuthenticateRequest
 */
export interface CustomerSessionCodeAuthenticateRequest {
    /**
     * 
     * @type {string}
     * @memberof CustomerSessionCodeAuthenticateRequest
     */
    code: string;
}
/**
 * 
 * @export
 * @interface CustomerSessionCodeAuthenticateResponse
 */
export interface CustomerSessionCodeAuthenticateResponse {
    /**
     * 
     * @type {string}
     * @memberof CustomerSessionCodeAuthenticateResponse
     */
    token: string;
}
/**
 * 
 * @export
 * @interface CustomerSessionCodeRequest
 */
export interface CustomerSessionCodeRequest {
    /**
     * 
     * @type {string}
     * @memberof CustomerSessionCodeRequest
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSessionCodeRequest
     */
    organization_id: string;
}
/**
 * Schema for creating a customer session.
 * @export
 * @interface CustomerSessionCreate
 */
export interface CustomerSessionCreate {
    /**
     * ID of the customer to create a session for.
     * @type {string}
     * @memberof CustomerSessionCreate
     */
    customer_id: string;
}

/**
 * 
 * @export
 */
export const CustomerSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    EMAIL: 'email',
    EMAIL2: '-email',
    NAME: 'name',
    NAME2: '-name'
} as const;
export type CustomerSortProperty = typeof CustomerSortProperty[keyof typeof CustomerSortProperty];

/**
 * 
 * @export
 * @interface CustomerSubscription
 */
export interface CustomerSubscription {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerSubscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof CustomerSubscription
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof CustomerSubscription
     */
    amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    currency: string | null;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof CustomerSubscription
     */
    recurring_interval: SubscriptionRecurringInterval;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof CustomerSubscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    current_period_end: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof CustomerSubscription
     */
    cancel_at_period_end: boolean;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    started_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    ended_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    price_id: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    discount_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     */
    checkout_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscription
     * @deprecated
     */
    user_id: string;
    /**
     * 
     * @type {CustomerSubscriptionProduct}
     * @memberof CustomerSubscription
     */
    product: CustomerSubscriptionProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof CustomerSubscription
     */
    price: ProductPrice;
}


/**
 * 
 * @export
 * @interface CustomerSubscriptionProduct
 */
export interface CustomerSubscriptionProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof CustomerSubscriptionProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscriptionProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof CustomerSubscriptionProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof CustomerSubscriptionProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscriptionProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof CustomerSubscriptionProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof CustomerSubscriptionProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof CustomerSubscriptionProduct
     */
    organization_id: string;
    /**
     * List of prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof CustomerSubscriptionProduct
     */
    prices: Array<ProductPrice>;
    /**
     * List of benefits granted by the product.
     * @type {Array<BenefitBase>}
     * @memberof CustomerSubscriptionProduct
     */
    benefits: Array<BenefitBase>;
    /**
     * List of medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof CustomerSubscriptionProduct
     */
    medias: Array<ProductMediaFileRead>;
    /**
     * 
     * @type {Organization}
     * @memberof CustomerSubscriptionProduct
     */
    organization: Organization;
}

/**
 * 
 * @export
 */
export const CustomerSubscriptionSortProperty = {
    STARTED_AT: 'started_at',
    STARTED_AT2: '-started_at',
    AMOUNT: 'amount',
    AMOUNT2: '-amount',
    STATUS: 'status',
    STATUS2: '-status',
    ORGANIZATION: 'organization',
    ORGANIZATION2: '-organization',
    PRODUCT: 'product',
    PRODUCT2: '-product'
} as const;
export type CustomerSubscriptionSortProperty = typeof CustomerSubscriptionSortProperty[keyof typeof CustomerSubscriptionSortProperty];

/**
 * 
 * @export
 * @interface CustomerSubscriptionUpdate
 */
export interface CustomerSubscriptionUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerSubscriptionUpdate
     */
    product_price_id: string;
}
/**
 * 
 * @export
 * @interface CustomerUpdate
 */
export interface CustomerUpdate {
    /**
     * 
     * @type {string}
     * @memberof CustomerUpdate
     */
    email?: string | null;
    /**
     * 
     * @type {string}
     * @memberof CustomerUpdate
     */
    name?: string | null;
    /**
     * 
     * @type {Address}
     * @memberof CustomerUpdate
     */
    billing_address?: Address | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof CustomerUpdate
     */
    tax_id?: Array<string> | null;
}
/**
 * 
 * @export
 * @interface DiscordGuild
 */
export interface DiscordGuild {
    /**
     * 
     * @type {string}
     * @memberof DiscordGuild
     */
    name: string;
    /**
     * 
     * @type {Array<DiscordGuildRole>}
     * @memberof DiscordGuild
     */
    roles: Array<DiscordGuildRole>;
}
/**
 * 
 * @export
 * @interface DiscordGuildRole
 */
export interface DiscordGuildRole {
    /**
     * 
     * @type {string}
     * @memberof DiscordGuildRole
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof DiscordGuildRole
     */
    name: string;
    /**
     * 
     * @type {number}
     * @memberof DiscordGuildRole
     */
    position: number;
    /**
     * 
     * @type {boolean}
     * @memberof DiscordGuildRole
     */
    is_polar_bot: boolean;
    /**
     * 
     * @type {string}
     * @memberof DiscordGuildRole
     */
    color: string;
}
/**
 * @type Discount
 * 
 * @export
 */
export type Discount = DiscountFixedOnceForeverDuration | DiscountFixedRepeatDuration | DiscountPercentageOnceForeverDuration | DiscountPercentageRepeatDuration;
/**
 * @type DiscountCreate
 * 
 * @export
 */
export type DiscountCreate = DiscountFixedOnceForeverDurationCreate | DiscountFixedRepeatDurationCreate | DiscountPercentageOnceForeverDurationCreate | DiscountPercentageRepeatDurationCreate;

/**
 * 
 * @export
 */
export const DiscountDuration = {
    ONCE: 'once',
    FOREVER: 'forever',
    REPEATING: 'repeating'
} as const;
export type DiscountDuration = typeof DiscountDuration[keyof typeof DiscountDuration];

/**
 * Schema for a fixed amount discount that is applied once or forever.
 * @export
 * @interface DiscountFixedOnceForeverDuration
 */
export interface DiscountFixedOnceForeverDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountFixedOnceForeverDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountFixedOnceForeverDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedOnceForeverDuration
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    currency: string;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountFixedOnceForeverDuration
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedOnceForeverDuration
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountFixedOnceForeverDuration
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDuration
     */
    organization_id: string;
    /**
     * 
     * @type {Array<DiscountProduct>}
     * @memberof DiscountFixedOnceForeverDuration
     */
    products: Array<DiscountProduct>;
}


/**
 * 
 * @export
 * @interface DiscountFixedOnceForeverDurationBase
 */
export interface DiscountFixedOnceForeverDurationBase {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    currency: string;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationBase
     */
    organization_id: string;
}


/**
 * Schema to create a fixed amount discount that is applied once or forever.
 * @export
 * @interface DiscountFixedOnceForeverDurationCreate
 */
export interface DiscountFixedOnceForeverDurationCreate {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    type: DiscountType;
    /**
     * Fixed amount to discount from the invoice total.
     * @type {number}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    currency?: string;
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    code?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    starts_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    ends_at?: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    max_redemptions?: number | null;
    /**
     * List of product IDs the discount can be applied to.
     * @type {Array<string>}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    products?: Array<string> | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountFixedOnceForeverDurationCreate
     */
    organization_id?: string | null;
}


/**
 * Schema for a fixed amount discount that is applied on every invoice
 * for a certain number of months.
 * @export
 * @interface DiscountFixedRepeatDuration
 */
export interface DiscountFixedRepeatDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountFixedRepeatDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedRepeatDuration
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountFixedRepeatDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedRepeatDuration
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    currency: string;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountFixedRepeatDuration
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedRepeatDuration
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountFixedRepeatDuration
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountFixedRepeatDuration
     */
    organization_id: string;
    /**
     * 
     * @type {Array<DiscountProduct>}
     * @memberof DiscountFixedRepeatDuration
     */
    products: Array<DiscountProduct>;
}


/**
 * 
 * @export
 * @interface DiscountFixedRepeatDurationBase
 */
export interface DiscountFixedRepeatDurationBase {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountFixedRepeatDurationBase
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedRepeatDurationBase
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountFixedRepeatDurationBase
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedRepeatDurationBase
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    currency: string;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountFixedRepeatDurationBase
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedRepeatDurationBase
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountFixedRepeatDurationBase
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountFixedRepeatDurationBase
     */
    organization_id: string;
}


/**
 * Schema to create a fixed amount discount that is applied on every invoice
 * for a certain number of months.
 * @export
 * @interface DiscountFixedRepeatDurationCreate
 */
export interface DiscountFixedRepeatDurationCreate {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    duration: DiscountDuration;
    /**
     * Number of months the discount should be applied.
     * 
     * For this to work on yearly pricing, you should multiply this by 12.
     * For example, to apply the discount for 2 years, set this to 24.
     * @type {number}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    type: DiscountType;
    /**
     * Fixed amount to discount from the invoice total.
     * @type {number}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    currency?: string;
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    code?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    starts_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    ends_at?: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    max_redemptions?: number | null;
    /**
     * List of product IDs the discount can be applied to.
     * @type {Array<string>}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    products?: Array<string> | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountFixedRepeatDurationCreate
     */
    organization_id?: string | null;
}


/**
 * @type DiscountIDFilter
 * Filter by discount ID.
 * @export
 */
export type DiscountIDFilter = Array<string> | string;

/**
 * @type DiscountIDFilter1
 * Filter by discount ID.
 * @export
 */
export type DiscountIDFilter1 = Array<string> | string;

/**
 * Schema for a percentage discount that is applied once or forever.
 * @export
 * @interface DiscountPercentageOnceForeverDuration
 */
export interface DiscountPercentageOnceForeverDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    basis_points: number;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    organization_id: string;
    /**
     * 
     * @type {Array<DiscountProduct>}
     * @memberof DiscountPercentageOnceForeverDuration
     */
    products: Array<DiscountProduct>;
}


/**
 * 
 * @export
 * @interface DiscountPercentageOnceForeverDurationBase
 */
export interface DiscountPercentageOnceForeverDurationBase {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    basis_points: number;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationBase
     */
    organization_id: string;
}


/**
 * Schema to create a percentage discount that is applied once or forever.
 * @export
 * @interface DiscountPercentageOnceForeverDurationCreate
 */
export interface DiscountPercentageOnceForeverDurationCreate {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    type: DiscountType;
    /**
     * Discount percentage in basis points.
     * 
     * A basis point is 1/100th of a percent.
     * For example, to create a 25.5% discount, set this to 2550.
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    basis_points: number;
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    code?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    starts_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    ends_at?: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    max_redemptions?: number | null;
    /**
     * List of product IDs the discount can be applied to.
     * @type {Array<string>}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    products?: Array<string> | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountPercentageOnceForeverDurationCreate
     */
    organization_id?: string | null;
}


/**
 * Schema for a percentage discount that is applied on every invoice
 * for a certain number of months.
 * @export
 * @interface DiscountPercentageRepeatDuration
 */
export interface DiscountPercentageRepeatDuration {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountPercentageRepeatDuration
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageRepeatDuration
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountPercentageRepeatDuration
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageRepeatDuration
     */
    basis_points: number;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountPercentageRepeatDuration
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageRepeatDuration
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountPercentageRepeatDuration
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountPercentageRepeatDuration
     */
    organization_id: string;
    /**
     * 
     * @type {Array<DiscountProduct>}
     * @memberof DiscountPercentageRepeatDuration
     */
    products: Array<DiscountProduct>;
}


/**
 * 
 * @export
 * @interface DiscountPercentageRepeatDurationBase
 */
export interface DiscountPercentageRepeatDurationBase {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    duration: DiscountDuration;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    type: DiscountType;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    basis_points: number;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    code: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    starts_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    ends_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    max_redemptions: number | null;
    /**
     * Number of times the discount has been redeemed.
     * @type {number}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    redemptions_count: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationBase
     */
    organization_id: string;
}


/**
 * Schema to create a percentage discount that is applied on every invoice
 * for a certain number of months.
 * @export
 * @interface DiscountPercentageRepeatDurationCreate
 */
export interface DiscountPercentageRepeatDurationCreate {
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    duration: DiscountDuration;
    /**
     * Number of months the discount should be applied.
     * 
     * For this to work on yearly pricing, you should multiply this by 12.
     * For example, to apply the discount for 2 years, set this to 24.
     * @type {number}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    duration_in_months: number;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    type: DiscountType;
    /**
     * Discount percentage in basis points.
     * 
     * A basis point is 1/100th of a percent.
     * For example, to create a 25.5% discount, set this to 2550.
     * @type {number}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    basis_points: number;
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    code?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    starts_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    ends_at?: string | null;
    /**
     * 
     * @type {number}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    max_redemptions?: number | null;
    /**
     * List of product IDs the discount can be applied to.
     * @type {Array<string>}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    products?: Array<string> | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof DiscountPercentageRepeatDurationCreate
     */
    organization_id?: string | null;
}


/**
 * A product that a discount can be applied to.
 * @export
 * @interface DiscountProduct
 */
export interface DiscountProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof DiscountProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof DiscountProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof DiscountProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DiscountProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof DiscountProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof DiscountProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof DiscountProduct
     */
    organization_id: string;
}

/**
 * 
 * @export
 */
export const DiscountSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    NAME: 'name',
    NAME2: '-name',
    CODE: 'code',
    CODE2: '-code',
    REDEMPTIONS_COUNT: 'redemptions_count',
    REDEMPTIONS_COUNT2: '-redemptions_count'
} as const;
export type DiscountSortProperty = typeof DiscountSortProperty[keyof typeof DiscountSortProperty];


/**
 * 
 * @export
 */
export const DiscountType = {
    FIXED: 'fixed',
    PERCENTAGE: 'percentage'
} as const;
export type DiscountType = typeof DiscountType[keyof typeof DiscountType];

/**
 * Schema to update a discount.
 * @export
 * @interface DiscountUpdate
 */
export interface DiscountUpdate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof DiscountUpdate
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * Name of the discount. Will be displayed to the customer when the discount is applied.
     * @type {string}
     * @memberof DiscountUpdate
     */
    name?: string | null;
    /**
     * 
     * @type {DiscountUpdateCode}
     * @memberof DiscountUpdate
     */
    code?: DiscountUpdateCode | null;
    /**
     * 
     * @type {DiscountUpdateStartsAt}
     * @memberof DiscountUpdate
     */
    starts_at?: DiscountUpdateStartsAt | null;
    /**
     * 
     * @type {DiscountUpdateEndsAt}
     * @memberof DiscountUpdate
     */
    ends_at?: DiscountUpdateEndsAt | null;
    /**
     * 
     * @type {DiscountUpdateMaxRedemptions}
     * @memberof DiscountUpdate
     */
    max_redemptions?: DiscountUpdateMaxRedemptions | null;
    /**
     * 
     * @type {DiscountDuration}
     * @memberof DiscountUpdate
     */
    duration?: DiscountDuration | null;
    /**
     * Number of months the discount should be applied.
     * 
     * For this to work on yearly pricing, you should multiply this by 12.
     * For example, to apply the discount for 2 years, set this to 24.
     * @type {number}
     * @memberof DiscountUpdate
     */
    duration_in_months?: number | null;
    /**
     * 
     * @type {DiscountType}
     * @memberof DiscountUpdate
     */
    type?: DiscountType | null;
    /**
     * Fixed amount to discount from the invoice total.
     * @type {number}
     * @memberof DiscountUpdate
     */
    amount?: number | null;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof DiscountUpdate
     */
    currency?: string | null;
    /**
     * Discount percentage in basis points.
     * 
     * A basis point is 1/100th of a percent.
     * For example, to create a 25.5% discount, set this to 2550.
     * @type {number}
     * @memberof DiscountUpdate
     */
    basis_points?: number | null;
    /**
     * List of product IDs the discount can be applied to.
     * @type {Array<string>}
     * @memberof DiscountUpdate
     */
    products?: Array<string> | null;
}


/**
 * @type DiscountUpdateCode
 * Code customers can use to apply the discount during checkout. Must be between 3 and 256 characters long and contain only alphanumeric characters.If not provided, the discount can only be applied via the API.
 * @export
 */
export type DiscountUpdateCode = string;

/**
 * @type DiscountUpdateEndsAt
 * Optional timestamp after which the discount is no longer redeemable.
 * @export
 */
export type DiscountUpdateEndsAt = string;

/**
 * @type DiscountUpdateMaxRedemptions
 * Optional maximum number of times the discount can be redeemed.
 * @export
 */
export type DiscountUpdateMaxRedemptions = number;

/**
 * @type DiscountUpdateStartsAt
 * Optional timestamp after which the discount is redeemable.
 * @export
 */
export type DiscountUpdateStartsAt = string;

/**
 * Schema to create a file to be associated with the downloadables benefit.
 * @export
 * @interface DownloadableFileCreate
 */
export interface DownloadableFileCreate {
    /**
     * The organization ID.
     * @type {string}
     * @memberof DownloadableFileCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileCreate
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof DownloadableFileCreate
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileCreate
     */
    checksum_sha256_base64?: string | null;
    /**
     * 
     * @type {S3FileCreateMultipart}
     * @memberof DownloadableFileCreate
     */
    upload: S3FileCreateMultipart;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileCreate
     */
    service: DownloadableFileCreateServiceEnum;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileCreate
     */
    version?: string | null;
}


/**
 * @export
 */
export const DownloadableFileCreateServiceEnum = {
    DOWNLOADABLE: 'downloadable'
} as const;
export type DownloadableFileCreateServiceEnum = typeof DownloadableFileCreateServiceEnum[keyof typeof DownloadableFileCreateServiceEnum];

/**
 * File to be associated with the downloadables benefit.
 * @export
 * @interface DownloadableFileRead
 */
export interface DownloadableFileRead {
    /**
     * The ID of the object.
     * @type {string}
     * @memberof DownloadableFileRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    path: string;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof DownloadableFileRead
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    storage_version: string | null;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    checksum_etag: string | null;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    checksum_sha256_base64: string | null;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    checksum_sha256_hex: string | null;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    last_modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    version: string | null;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    service: DownloadableFileReadServiceEnum;
    /**
     * 
     * @type {boolean}
     * @memberof DownloadableFileRead
     */
    is_uploaded: boolean;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof DownloadableFileRead
     */
    readonly size_readable: string;
}


/**
 * @export
 */
export const DownloadableFileReadServiceEnum = {
    DOWNLOADABLE: 'downloadable'
} as const;
export type DownloadableFileReadServiceEnum = typeof DownloadableFileReadServiceEnum[keyof typeof DownloadableFileReadServiceEnum];

/**
 * 
 * @export
 * @interface DownloadableRead
 */
export interface DownloadableRead {
    /**
     * 
     * @type {string}
     * @memberof DownloadableRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof DownloadableRead
     */
    benefit_id: string;
    /**
     * 
     * @type {FileDownload}
     * @memberof DownloadableRead
     */
    file: FileDownload;
}
/**
 * 
 * @export
 * @interface EmailUpdateRequest
 */
export interface EmailUpdateRequest {
    /**
     * 
     * @type {string}
     * @memberof EmailUpdateRequest
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof EmailUpdateRequest
     */
    return_to?: string | null;
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
    rewards: Array<Reward> | null;
    /**
     * 
     * @type {PledgesTypeSummaries}
     * @memberof Entry
     */
    pledges_summary: PledgesTypeSummaries | null;
    /**
     * 
     * @type {Array<Pledge>}
     * @memberof Entry
     */
    pledges: Array<Pledge> | null;
}
/**
 * A price that already exists for this product.
 * 
 * Useful when updating a product if you want to keep an existing price.
 * @export
 * @interface ExistingProductPrice
 */
export interface ExistingProductPrice {
    /**
     * 
     * @type {string}
     * @memberof ExistingProductPrice
     */
    id: string;
}
/**
 * 
 * @export
 * @interface ExternalOrganization
 */
export interface ExternalOrganization {
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof ExternalOrganization
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    avatar_url: string;
    /**
     * 
     * @type {boolean}
     * @memberof ExternalOrganization
     */
    is_personal: boolean;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    bio: string | null;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    pretty_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    company: string | null;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    blog: string | null;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    location: string | null;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    email: string | null;
    /**
     * 
     * @type {string}
     * @memberof ExternalOrganization
     */
    twitter_username: string | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof ExternalOrganization
     */
    organization_id: string | null;
}


/**
 * @type ExternalOrganizationNameFilter
 * Filter by external organization name.
 * @export
 */
export type ExternalOrganizationNameFilter = Array<string> | string;


/**
 * 
 * @export
 */
export const ExternalOrganizationSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    NAME: 'name',
    NAME2: '-name'
} as const;
export type ExternalOrganizationSortProperty = typeof ExternalOrganizationSortProperty[keyof typeof ExternalOrganizationSortProperty];

/**
 * @type FileCreate
 * 
 * @export
 */
export type FileCreate = { service: 'downloadable' } & DownloadableFileCreate | { service: 'organization_avatar' } & OrganizationAvatarFileCreate | { service: 'product_media' } & ProductMediaFileCreate;
/**
 * 
 * @export
 * @interface FileDownload
 */
export interface FileDownload {
    /**
     * The ID of the object.
     * @type {string}
     * @memberof FileDownload
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    path: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof FileDownload
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    storage_version: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    checksum_etag: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    checksum_sha256_base64: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    checksum_sha256_hex: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    last_modified_at: string | null;
    /**
     * 
     * @type {S3DownloadURL}
     * @memberof FileDownload
     */
    download: S3DownloadURL;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    version: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof FileDownload
     */
    is_uploaded: boolean;
    /**
     * 
     * @type {FileServiceTypes}
     * @memberof FileDownload
     */
    service: FileServiceTypes;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    readonly size_readable: string;
}


/**
 * 
 * @export
 * @interface FilePatch
 */
export interface FilePatch {
    /**
     * 
     * @type {string}
     * @memberof FilePatch
     */
    name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof FilePatch
     */
    version?: string | null;
}
/**
 * @type FileRead
 * 
 * @export
 */
export type FileRead = { service: 'downloadable' } & DownloadableFileRead | { service: 'organization_avatar' } & OrganizationAvatarFileRead | { service: 'product_media' } & ProductMediaFileRead;

/**
 * 
 * @export
 */
export const FileServiceTypes = {
    DOWNLOADABLE: 'downloadable',
    PRODUCT_MEDIA: 'product_media',
    ORGANIZATION_AVATAR: 'organization_avatar'
} as const;
export type FileServiceTypes = typeof FileServiceTypes[keyof typeof FileServiceTypes];

/**
 * 
 * @export
 * @interface FileUpload
 */
export interface FileUpload {
    /**
     * The ID of the object.
     * @type {string}
     * @memberof FileUpload
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    path: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof FileUpload
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    storage_version: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    checksum_etag: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    checksum_sha256_base64: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    checksum_sha256_hex: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    last_modified_at: string | null;
    /**
     * 
     * @type {S3FileUploadMultipart}
     * @memberof FileUpload
     */
    upload: S3FileUploadMultipart;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    version: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof FileUpload
     */
    is_uploaded?: boolean;
    /**
     * 
     * @type {FileServiceTypes}
     * @memberof FileUpload
     */
    service: FileServiceTypes;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    readonly size_readable: string;
}


/**
 * 
 * @export
 * @interface FileUploadCompleted
 */
export interface FileUploadCompleted {
    /**
     * 
     * @type {string}
     * @memberof FileUploadCompleted
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof FileUploadCompleted
     */
    path: string;
    /**
     * 
     * @type {Array<S3FileUploadCompletedPart>}
     * @memberof FileUploadCompleted
     */
    parts: Array<S3FileUploadCompletedPart>;
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
    funding_goal?: CurrencyAmount | null;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof Funding
     */
    pledges_sum?: CurrencyAmount | null;
}
/**
 * 
 * @export
 * @interface GitHubInvitesBenefitOrganization
 */
export interface GitHubInvitesBenefitOrganization {
    /**
     * 
     * @type {string}
     * @memberof GitHubInvitesBenefitOrganization
     */
    name: string;
    /**
     * 
     * @type {boolean}
     * @memberof GitHubInvitesBenefitOrganization
     */
    is_personal: boolean;
    /**
     * 
     * @type {string}
     * @memberof GitHubInvitesBenefitOrganization
     */
    plan_name: string;
    /**
     * 
     * @type {boolean}
     * @memberof GitHubInvitesBenefitOrganization
     */
    is_free: boolean;
}
/**
 * 
 * @export
 * @interface GitHubInvitesBenefitRepositories
 */
export interface GitHubInvitesBenefitRepositories {
    /**
     * 
     * @type {Array<GitHubInvitesBenefitRepository>}
     * @memberof GitHubInvitesBenefitRepositories
     */
    repositories: Array<GitHubInvitesBenefitRepository>;
    /**
     * 
     * @type {Array<GitHubInvitesBenefitOrganization>}
     * @memberof GitHubInvitesBenefitRepositories
     */
    organizations: Array<GitHubInvitesBenefitOrganization>;
}
/**
 * 
 * @export
 * @interface GitHubInvitesBenefitRepository
 */
export interface GitHubInvitesBenefitRepository {
    /**
     * 
     * @type {string}
     * @memberof GitHubInvitesBenefitRepository
     */
    repository_owner: string;
    /**
     * 
     * @type {string}
     * @memberof GitHubInvitesBenefitRepository
     */
    repository_name: string;
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
     * @type {number}
     * @memberof InstallationCreate
     */
    installation_id: number;
    /**
     * The organization ID.
     * @type {string}
     * @memberof InstallationCreate
     */
    organization_id: string;
}

/**
 * 
 * @export
 */
export const Interval = {
    YEAR: 'year',
    MONTH: 'month',
    WEEK: 'week',
    DAY: 'day',
    HOUR: 'hour'
} as const;
export type Interval = typeof Interval[keyof typeof Interval];

/**
 * 
 * @export
 * @interface IntrospectTokenResponse
 */
export interface IntrospectTokenResponse {
    /**
     * 
     * @type {boolean}
     * @memberof IntrospectTokenResponse
     */
    active: boolean;
    /**
     * 
     * @type {string}
     * @memberof IntrospectTokenResponse
     */
    client_id: string;
    /**
     * 
     * @type {string}
     * @memberof IntrospectTokenResponse
     */
    token_type: IntrospectTokenResponseTokenTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof IntrospectTokenResponse
     */
    scope: string;
    /**
     * 
     * @type {SubType}
     * @memberof IntrospectTokenResponse
     */
    sub_type: SubType;
    /**
     * 
     * @type {string}
     * @memberof IntrospectTokenResponse
     */
    sub: string;
    /**
     * 
     * @type {string}
     * @memberof IntrospectTokenResponse
     */
    aud: string;
    /**
     * 
     * @type {string}
     * @memberof IntrospectTokenResponse
     */
    iss: string;
    /**
     * 
     * @type {number}
     * @memberof IntrospectTokenResponse
     */
    exp: number;
    /**
     * 
     * @type {number}
     * @memberof IntrospectTokenResponse
     */
    iat: number;
}


/**
 * @export
 */
export const IntrospectTokenResponseTokenTypeEnum = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token'
} as const;
export type IntrospectTokenResponseTokenTypeEnum = typeof IntrospectTokenResponseTokenTypeEnum[keyof typeof IntrospectTokenResponseTokenTypeEnum];

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
     * 
     * @type {string}
     * @memberof Issue
     */
    body?: string | null;
    /**
     * 
     * @type {number}
     * @memberof Issue
     */
    comments?: number | null;
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
    author?: Author | null;
    /**
     * 
     * @type {Array<Assignee>}
     * @memberof Issue
     */
    assignees?: Array<Assignee> | null;
    /**
     * 
     * @type {Reactions}
     * @memberof Issue
     */
    reactions?: Reactions | null;
    /**
     * 
     * @type {State}
     * @memberof Issue
     */
    state: State;
    /**
     * 
     * @type {string}
     * @memberof Issue
     */
    issue_closed_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Issue
     */
    issue_modified_at?: string | null;
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
     * 
     * @type {string}
     * @memberof Issue
     */
    confirmed_solved_at?: string | null;
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
     * 
     * @type {number}
     * @memberof Issue
     */
    upfront_split_to_contributors?: number | null;
    /**
     * If this issue currently has the Polar badge SVG embedded
     * @type {boolean}
     * @memberof Issue
     */
    pledge_badge_currently_embedded: boolean;
    /**
     * 
     * @type {string}
     * @memberof Issue
     */
    badge_custom_content?: string | null;
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
    funding_goal: CurrencyAmount | null;
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
 * @type IssueNumberFilter
 * Filter by issue number.
 * @export
 */
export type IssueNumberFilter = Array<number> | number;


/**
 * 
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
 * 
 * @export
 */
export const IssueSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    MODIFIED_AT: 'modified_at',
    MODIFIED_AT2: '-modified_at',
    ENGAGEMENT: 'engagement',
    ENGAGEMENT2: '-engagement',
    POSITIVE_REACTIONS: 'positive_reactions',
    POSITIVE_REACTIONS2: '-positive_reactions',
    FUNDING_GOAL: 'funding_goal',
    FUNDING_GOAL2: '-funding_goal'
} as const;
export type IssueSortProperty = typeof IssueSortProperty[keyof typeof IssueSortProperty];

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
 * 
 * @export
 * @interface LicenseKeyActivate
 */
export interface LicenseKeyActivate {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivate
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivate
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivate
     */
    label: string;
    /**
     * 
     * @type {object}
     * @memberof LicenseKeyActivate
     */
    conditions?: object;
    /**
     * 
     * @type {object}
     * @memberof LicenseKeyActivate
     */
    meta?: object;
}
/**
 * 
 * @export
 * @interface LicenseKeyActivationBase
 */
export interface LicenseKeyActivationBase {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationBase
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationBase
     */
    license_key_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationBase
     */
    label: string;
    /**
     * 
     * @type {object}
     * @memberof LicenseKeyActivationBase
     */
    meta: object;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationBase
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationBase
     */
    modified_at: string | null;
}
/**
 * 
 * @export
 * @interface LicenseKeyActivationRead
 */
export interface LicenseKeyActivationRead {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationRead
     */
    license_key_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationRead
     */
    label: string;
    /**
     * 
     * @type {object}
     * @memberof LicenseKeyActivationRead
     */
    meta: object;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyActivationRead
     */
    modified_at: string | null;
    /**
     * 
     * @type {LicenseKeyRead}
     * @memberof LicenseKeyActivationRead
     */
    license_key: LicenseKeyRead;
}
/**
 * 
 * @export
 * @interface LicenseKeyCustomer
 */
export interface LicenseKeyCustomer {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof LicenseKeyCustomer
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyCustomer
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof LicenseKeyCustomer
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof LicenseKeyCustomer
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyCustomer
     */
    email: string;
    /**
     * 
     * @type {boolean}
     * @memberof LicenseKeyCustomer
     */
    email_verified: boolean;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyCustomer
     */
    name: string | null;
    /**
     * 
     * @type {Address}
     * @memberof LicenseKeyCustomer
     */
    billing_address: Address | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof LicenseKeyCustomer
     */
    tax_id: Array<string> | null;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyCustomer
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyCustomer
     */
    readonly avatar_url: string;
}
/**
 * 
 * @export
 * @interface LicenseKeyDeactivate
 */
export interface LicenseKeyDeactivate {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyDeactivate
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyDeactivate
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyDeactivate
     */
    activation_id: string;
}
/**
 * 
 * @export
 * @interface LicenseKeyRead
 */
export interface LicenseKeyRead {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     * @deprecated
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     */
    customer_id: string;
    /**
     * 
     * @type {LicenseKeyUser}
     * @memberof LicenseKeyRead
     */
    user: LicenseKeyUser;
    /**
     * 
     * @type {LicenseKeyCustomer}
     * @memberof LicenseKeyRead
     */
    customer: LicenseKeyCustomer;
    /**
     * The benefit ID.
     * @type {string}
     * @memberof LicenseKeyRead
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     */
    display_key: string;
    /**
     * 
     * @type {LicenseKeyStatus}
     * @memberof LicenseKeyRead
     */
    status: LicenseKeyStatus;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyRead
     */
    limit_activations: number | null;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyRead
     */
    usage: number;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyRead
     */
    limit_usage: number | null;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyRead
     */
    validations: number;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     */
    last_validated_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyRead
     */
    expires_at: string | null;
}



/**
 * 
 * @export
 */
export const LicenseKeyStatus = {
    GRANTED: 'granted',
    REVOKED: 'revoked',
    DISABLED: 'disabled'
} as const;
export type LicenseKeyStatus = typeof LicenseKeyStatus[keyof typeof LicenseKeyStatus];

/**
 * 
 * @export
 * @interface LicenseKeyUpdate
 */
export interface LicenseKeyUpdate {
    /**
     * 
     * @type {LicenseKeyStatus}
     * @memberof LicenseKeyUpdate
     */
    status?: LicenseKeyStatus | null;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyUpdate
     */
    usage?: number;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyUpdate
     */
    limit_activations?: number | null;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyUpdate
     */
    limit_usage?: number | null;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyUpdate
     */
    expires_at?: string | null;
}


/**
 * 
 * @export
 * @interface LicenseKeyUser
 */
export interface LicenseKeyUser {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyUser
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyUser
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyUser
     */
    public_name: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyUser
     */
    avatar_url?: string | null;
}
/**
 * 
 * @export
 * @interface LicenseKeyValidate
 */
export interface LicenseKeyValidate {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyValidate
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyValidate
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyValidate
     */
    activation_id?: string | null;
    /**
     * The benefit ID.
     * @type {string}
     * @memberof LicenseKeyValidate
     */
    benefit_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyValidate
     */
    customer_id?: string | null;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyValidate
     */
    increment_usage?: number | null;
    /**
     * 
     * @type {object}
     * @memberof LicenseKeyValidate
     */
    conditions?: object;
}
/**
 * 
 * @export
 * @interface LicenseKeyWithActivations
 */
export interface LicenseKeyWithActivations {
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     * @deprecated
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    customer_id: string;
    /**
     * 
     * @type {LicenseKeyUser}
     * @memberof LicenseKeyWithActivations
     */
    user: LicenseKeyUser;
    /**
     * 
     * @type {LicenseKeyCustomer}
     * @memberof LicenseKeyWithActivations
     */
    customer: LicenseKeyCustomer;
    /**
     * The benefit ID.
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    display_key: string;
    /**
     * 
     * @type {LicenseKeyStatus}
     * @memberof LicenseKeyWithActivations
     */
    status: LicenseKeyStatus;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyWithActivations
     */
    limit_activations: number | null;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyWithActivations
     */
    usage: number;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyWithActivations
     */
    limit_usage: number | null;
    /**
     * 
     * @type {number}
     * @memberof LicenseKeyWithActivations
     */
    validations: number;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    last_validated_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof LicenseKeyWithActivations
     */
    expires_at: string | null;
    /**
     * 
     * @type {Array<LicenseKeyActivationBase>}
     * @memberof LicenseKeyWithActivations
     */
    activations: Array<LicenseKeyActivationBase>;
}



/**
 * 
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
    items: Array<Account>;
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
 * @interface ListResourceBackofficeReward
 */
export interface ListResourceBackofficeReward {
    /**
     * 
     * @type {Array<BackofficeReward>}
     * @memberof ListResourceBackofficeReward
     */
    items: Array<BackofficeReward>;
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
 * @interface ListResourceBenefit
 */
export interface ListResourceBenefit {
    /**
     * 
     * @type {Array<Benefit>}
     * @memberof ListResourceBenefit
     */
    items: Array<Benefit>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceBenefit
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceBenefitGrant
 */
export interface ListResourceBenefitGrant {
    /**
     * 
     * @type {Array<BenefitGrant>}
     * @memberof ListResourceBenefitGrant
     */
    items: Array<BenefitGrant>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceBenefitGrant
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceCheckout
 */
export interface ListResourceCheckout {
    /**
     * 
     * @type {Array<Checkout>}
     * @memberof ListResourceCheckout
     */
    items: Array<Checkout>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceCheckout
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceCheckoutLink
 */
export interface ListResourceCheckoutLink {
    /**
     * 
     * @type {Array<CheckoutLink>}
     * @memberof ListResourceCheckoutLink
     */
    items: Array<CheckoutLink>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceCheckoutLink
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceCustomField
 */
export interface ListResourceCustomField {
    /**
     * 
     * @type {Array<CustomField>}
     * @memberof ListResourceCustomField
     */
    items: Array<CustomField>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceCustomField
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceCustomer
 */
export interface ListResourceCustomer {
    /**
     * 
     * @type {Array<Customer>}
     * @memberof ListResourceCustomer
     */
    items: Array<Customer>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceCustomer
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceCustomerBenefitGrant
 */
export interface ListResourceCustomerBenefitGrant {
    /**
     * 
     * @type {Array<CustomerBenefitGrant>}
     * @memberof ListResourceCustomerBenefitGrant
     */
    items: Array<CustomerBenefitGrant>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceCustomerBenefitGrant
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceCustomerOrder
 */
export interface ListResourceCustomerOrder {
    /**
     * 
     * @type {Array<CustomerOrder>}
     * @memberof ListResourceCustomerOrder
     */
    items: Array<CustomerOrder>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceCustomerOrder
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceCustomerSubscription
 */
export interface ListResourceCustomerSubscription {
    /**
     * 
     * @type {Array<CustomerSubscription>}
     * @memberof ListResourceCustomerSubscription
     */
    items: Array<CustomerSubscription>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceCustomerSubscription
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceDiscount
 */
export interface ListResourceDiscount {
    /**
     * 
     * @type {Array<Discount>}
     * @memberof ListResourceDiscount
     */
    items: Array<Discount>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceDiscount
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceDownloadableRead
 */
export interface ListResourceDownloadableRead {
    /**
     * 
     * @type {Array<DownloadableRead>}
     * @memberof ListResourceDownloadableRead
     */
    items: Array<DownloadableRead>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceDownloadableRead
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceExternalOrganization
 */
export interface ListResourceExternalOrganization {
    /**
     * 
     * @type {Array<ExternalOrganization>}
     * @memberof ListResourceExternalOrganization
     */
    items: Array<ExternalOrganization>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceExternalOrganization
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceFileRead
 */
export interface ListResourceFileRead {
    /**
     * 
     * @type {Array<FileRead>}
     * @memberof ListResourceFileRead
     */
    items: Array<FileRead>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceFileRead
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
    items: Array<Issue>;
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
    items: Array<IssueFunding>;
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
 * @interface ListResourceLicenseKeyRead
 */
export interface ListResourceLicenseKeyRead {
    /**
     * 
     * @type {Array<LicenseKeyRead>}
     * @memberof ListResourceLicenseKeyRead
     */
    items: Array<LicenseKeyRead>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceLicenseKeyRead
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceOAuth2Client
 */
export interface ListResourceOAuth2Client {
    /**
     * 
     * @type {Array<OAuth2Client>}
     * @memberof ListResourceOAuth2Client
     */
    items: Array<OAuth2Client>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceOAuth2Client
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceOrder
 */
export interface ListResourceOrder {
    /**
     * 
     * @type {Array<Order>}
     * @memberof ListResourceOrder
     */
    items: Array<Order>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceOrder
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
    items: Array<Organization>;
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
    items: Array<OrganizationMember>;
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
    items: Array<PaymentMethod>;
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
    items: Array<PersonalAccessToken>;
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
    items: Array<Pledge>;
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
 * @interface ListResourceProduct
 */
export interface ListResourceProduct {
    /**
     * 
     * @type {Array<Product>}
     * @memberof ListResourceProduct
     */
    items: Array<Product>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceProduct
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
    items: Array<Repository>;
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
    items: Array<Reward>;
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
    items: Array<Subscription>;
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
 * @interface ListResourceTransaction
 */
export interface ListResourceTransaction {
    /**
     * 
     * @type {Array<Transaction>}
     * @memberof ListResourceTransaction
     */
    items: Array<Transaction>;
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
 * @interface ListResourceWebhookDelivery
 */
export interface ListResourceWebhookDelivery {
    /**
     * 
     * @type {Array<WebhookDelivery>}
     * @memberof ListResourceWebhookDelivery
     */
    items: Array<WebhookDelivery>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceWebhookDelivery
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceWebhookEndpoint
 */
export interface ListResourceWebhookEndpoint {
    /**
     * 
     * @type {Array<WebhookEndpoint>}
     * @memberof ListResourceWebhookEndpoint
     */
    items: Array<WebhookEndpoint>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceWebhookEndpoint
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
    /**
     * 
     * @type {string}
     * @memberof MagicLinkRequest
     */
    return_to?: string | null;
    /**
     * 
     * @type {UserSignupAttribution}
     * @memberof MagicLinkRequest
     */
    attribution?: UserSignupAttribution | null;
}
/**
 * 
 * @export
 * @interface MaintainerAccountReviewedNotification
 */
export interface MaintainerAccountReviewedNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountReviewedNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountReviewedNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountReviewedNotification
     */
    type: MaintainerAccountReviewedNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerAccountReviewedNotificationPayload}
     * @memberof MaintainerAccountReviewedNotification
     */
    payload: MaintainerAccountReviewedNotificationPayload;
}


/**
 * @export
 */
export const MaintainerAccountReviewedNotificationTypeEnum = {
    MAINTAINER_ACCOUNT_REVIEWED_NOTIFICATION: 'MaintainerAccountReviewedNotification'
} as const;
export type MaintainerAccountReviewedNotificationTypeEnum = typeof MaintainerAccountReviewedNotificationTypeEnum[keyof typeof MaintainerAccountReviewedNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerAccountReviewedNotificationPayload
 */
export interface MaintainerAccountReviewedNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountReviewedNotificationPayload
     */
    account_type: string;
}
/**
 * 
 * @export
 * @interface MaintainerAccountUnderReviewNotification
 */
export interface MaintainerAccountUnderReviewNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountUnderReviewNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountUnderReviewNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountUnderReviewNotification
     */
    type: MaintainerAccountUnderReviewNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerAccountUnderReviewNotificationPayload}
     * @memberof MaintainerAccountUnderReviewNotification
     */
    payload: MaintainerAccountUnderReviewNotificationPayload;
}


/**
 * @export
 */
export const MaintainerAccountUnderReviewNotificationTypeEnum = {
    MAINTAINER_ACCOUNT_UNDER_REVIEW_NOTIFICATION: 'MaintainerAccountUnderReviewNotification'
} as const;
export type MaintainerAccountUnderReviewNotificationTypeEnum = typeof MaintainerAccountUnderReviewNotificationTypeEnum[keyof typeof MaintainerAccountUnderReviewNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerAccountUnderReviewNotificationPayload
 */
export interface MaintainerAccountUnderReviewNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerAccountUnderReviewNotificationPayload
     */
    account_type: string;
}
/**
 * 
 * @export
 * @interface MaintainerCreateAccountNotification
 */
export interface MaintainerCreateAccountNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerCreateAccountNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerCreateAccountNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerCreateAccountNotification
     */
    type: MaintainerCreateAccountNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerCreateAccountNotificationPayload}
     * @memberof MaintainerCreateAccountNotification
     */
    payload: MaintainerCreateAccountNotificationPayload;
}


/**
 * @export
 */
export const MaintainerCreateAccountNotificationTypeEnum = {
    MAINTAINER_CREATE_ACCOUNT_NOTIFICATION: 'MaintainerCreateAccountNotification'
} as const;
export type MaintainerCreateAccountNotificationTypeEnum = typeof MaintainerCreateAccountNotificationTypeEnum[keyof typeof MaintainerCreateAccountNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerCreateAccountNotificationPayload
 */
export interface MaintainerCreateAccountNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerCreateAccountNotificationPayload
     */
    organization_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerCreateAccountNotificationPayload
     */
    url: string;
}
/**
 * 
 * @export
 * @interface MaintainerNewPaidSubscriptionNotification
 */
export interface MaintainerNewPaidSubscriptionNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewPaidSubscriptionNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewPaidSubscriptionNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewPaidSubscriptionNotification
     */
    type: MaintainerNewPaidSubscriptionNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerNewPaidSubscriptionNotificationPayload}
     * @memberof MaintainerNewPaidSubscriptionNotification
     */
    payload: MaintainerNewPaidSubscriptionNotificationPayload;
}


/**
 * @export
 */
export const MaintainerNewPaidSubscriptionNotificationTypeEnum = {
    MAINTAINER_NEW_PAID_SUBSCRIPTION_NOTIFICATION: 'MaintainerNewPaidSubscriptionNotification'
} as const;
export type MaintainerNewPaidSubscriptionNotificationTypeEnum = typeof MaintainerNewPaidSubscriptionNotificationTypeEnum[keyof typeof MaintainerNewPaidSubscriptionNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerNewPaidSubscriptionNotificationPayload
 */
export interface MaintainerNewPaidSubscriptionNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewPaidSubscriptionNotificationPayload
     */
    subscriber_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewPaidSubscriptionNotificationPayload
     */
    tier_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerNewPaidSubscriptionNotificationPayload
     */
    tier_price_amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewPaidSubscriptionNotificationPayload
     */
    tier_price_recurring_interval: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewPaidSubscriptionNotificationPayload
     */
    tier_organization_name: string;
}
/**
 * 
 * @export
 * @interface MaintainerNewProductSaleNotification
 */
export interface MaintainerNewProductSaleNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewProductSaleNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewProductSaleNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewProductSaleNotification
     */
    type: MaintainerNewProductSaleNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerNewProductSaleNotificationPayload}
     * @memberof MaintainerNewProductSaleNotification
     */
    payload: MaintainerNewProductSaleNotificationPayload;
}


/**
 * @export
 */
export const MaintainerNewProductSaleNotificationTypeEnum = {
    MAINTAINER_NEW_PRODUCT_SALE_NOTIFICATION: 'MaintainerNewProductSaleNotification'
} as const;
export type MaintainerNewProductSaleNotificationTypeEnum = typeof MaintainerNewProductSaleNotificationTypeEnum[keyof typeof MaintainerNewProductSaleNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerNewProductSaleNotificationPayload
 */
export interface MaintainerNewProductSaleNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewProductSaleNotificationPayload
     */
    customer_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewProductSaleNotificationPayload
     */
    product_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerNewProductSaleNotificationPayload
     */
    product_price_amount: number;
    /**
     * 
     * @type {string}
     * @memberof MaintainerNewProductSaleNotificationPayload
     */
    organization_name: string;
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    type: MaintainerPledgeConfirmationPendingNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerPledgeConfirmationPendingNotificationPayload}
     * @memberof MaintainerPledgeConfirmationPendingNotification
     */
    payload: MaintainerPledgeConfirmationPendingNotificationPayload;
}


/**
 * @export
 */
export const MaintainerPledgeConfirmationPendingNotificationTypeEnum = {
    MAINTAINER_PLEDGE_CONFIRMATION_PENDING_NOTIFICATION: 'MaintainerPledgeConfirmationPendingNotification'
} as const;
export type MaintainerPledgeConfirmationPendingNotificationTypeEnum = typeof MaintainerPledgeConfirmationPendingNotificationTypeEnum[keyof typeof MaintainerPledgeConfirmationPendingNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerPledgeConfirmationPendingNotificationPayload
 */
export interface MaintainerPledgeConfirmationPendingNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    pledger_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    maintainer_has_stripe_account: boolean;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeConfirmationPendingNotificationPayload
     */
    pledge_id: string | null;
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotification
     */
    type: MaintainerPledgeCreatedNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerPledgeCreatedNotificationPayload}
     * @memberof MaintainerPledgeCreatedNotification
     */
    payload: MaintainerPledgeCreatedNotificationPayload;
}


/**
 * @export
 */
export const MaintainerPledgeCreatedNotificationTypeEnum = {
    MAINTAINER_PLEDGE_CREATED_NOTIFICATION: 'MaintainerPledgeCreatedNotification'
} as const;
export type MaintainerPledgeCreatedNotificationTypeEnum = typeof MaintainerPledgeCreatedNotificationTypeEnum[keyof typeof MaintainerPledgeCreatedNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerPledgeCreatedNotificationPayload
 */
export interface MaintainerPledgeCreatedNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    pledger_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    maintainer_has_stripe_account: boolean;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    pledge_id: string | null;
    /**
     * 
     * @type {PledgeType}
     * @memberof MaintainerPledgeCreatedNotificationPayload
     */
    pledge_type: PledgeType | null;
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotification
     */
    type: MaintainerPledgePaidNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerPledgePaidNotificationPayload}
     * @memberof MaintainerPledgePaidNotification
     */
    payload: MaintainerPledgePaidNotificationPayload;
}


/**
 * @export
 */
export const MaintainerPledgePaidNotificationTypeEnum = {
    MAINTAINER_PLEDGE_PAID_NOTIFICATION: 'MaintainerPledgePaidNotification'
} as const;
export type MaintainerPledgePaidNotificationTypeEnum = typeof MaintainerPledgePaidNotificationTypeEnum[keyof typeof MaintainerPledgePaidNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerPledgePaidNotificationPayload
 */
export interface MaintainerPledgePaidNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotificationPayload
     */
    paid_out_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgePaidNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePaidNotificationPayload
     */
    pledge_id: string | null;
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotification
     */
    type: MaintainerPledgePendingNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerPledgePendingNotificationPayload}
     * @memberof MaintainerPledgePendingNotification
     */
    payload: MaintainerPledgePendingNotificationPayload;
}


/**
 * @export
 */
export const MaintainerPledgePendingNotificationTypeEnum = {
    MAINTAINER_PLEDGE_PENDING_NOTIFICATION: 'MaintainerPledgePendingNotification'
} as const;
export type MaintainerPledgePendingNotificationTypeEnum = typeof MaintainerPledgePendingNotificationTypeEnum[keyof typeof MaintainerPledgePendingNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerPledgePendingNotificationPayload
 */
export interface MaintainerPledgePendingNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    pledger_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    maintainer_has_stripe_account: boolean;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgePendingNotificationPayload
     */
    pledge_id: string | null;
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    type: MaintainerPledgedIssueConfirmationPendingNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerPledgedIssueConfirmationPendingNotificationPayload}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotification
     */
    payload: MaintainerPledgedIssueConfirmationPendingNotificationPayload;
}


/**
 * @export
 */
export const MaintainerPledgedIssueConfirmationPendingNotificationTypeEnum = {
    MAINTAINER_PLEDGED_ISSUE_CONFIRMATION_PENDING_NOTIFICATION: 'MaintainerPledgedIssueConfirmationPendingNotification'
} as const;
export type MaintainerPledgedIssueConfirmationPendingNotificationTypeEnum = typeof MaintainerPledgedIssueConfirmationPendingNotificationTypeEnum[keyof typeof MaintainerPledgedIssueConfirmationPendingNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerPledgedIssueConfirmationPendingNotificationPayload
 */
export interface MaintainerPledgedIssueConfirmationPendingNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
     */
    pledge_amount_sum: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
     */
    issue_id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgedIssueConfirmationPendingNotificationPayload
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    type: MaintainerPledgedIssuePendingNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerPledgedIssuePendingNotificationPayload}
     * @memberof MaintainerPledgedIssuePendingNotification
     */
    payload: MaintainerPledgedIssuePendingNotificationPayload;
}


/**
 * @export
 */
export const MaintainerPledgedIssuePendingNotificationTypeEnum = {
    MAINTAINER_PLEDGED_ISSUE_PENDING_NOTIFICATION: 'MaintainerPledgedIssuePendingNotification'
} as const;
export type MaintainerPledgedIssuePendingNotificationTypeEnum = typeof MaintainerPledgedIssuePendingNotificationTypeEnum[keyof typeof MaintainerPledgedIssuePendingNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerPledgedIssuePendingNotificationPayload
 */
export interface MaintainerPledgedIssuePendingNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    pledge_amount_sum: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    issue_id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {boolean}
     * @memberof MaintainerPledgedIssuePendingNotificationPayload
     */
    maintainer_has_account: boolean;
}
/**
 * @type MetadataValue
 * @export
 */
export type MetadataValue = boolean | number | string;

/**
 * @type MetadataValue1
 * @export
 */
export type MetadataValue1 = boolean | number | string;

/**
 * Information about a metric.
 * @export
 * @interface Metric
 */
export interface Metric {
    /**
     * Unique identifier for the metric.
     * @type {string}
     * @memberof Metric
     */
    slug: string;
    /**
     * Human-readable name for the metric.
     * @type {string}
     * @memberof Metric
     */
    display_name: string;
    /**
     * 
     * @type {MetricType}
     * @memberof Metric
     */
    type: MetricType;
}


/**
 * 
 * @export
 * @interface MetricPeriod
 */
export interface MetricPeriod {
    /**
     * Timestamp of this period data.
     * @type {string}
     * @memberof MetricPeriod
     */
    timestamp: string;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    orders: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    revenue: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    average_order_value: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    one_time_products: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    one_time_products_revenue: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    new_subscriptions: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    new_subscriptions_revenue: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    renewed_subscriptions: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    renewed_subscriptions_revenue: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    active_subscriptions: number;
    /**
     * 
     * @type {number}
     * @memberof MetricPeriod
     */
    monthly_recurring_revenue: number;
}

/**
 * 
 * @export
 */
export const MetricType = {
    SCALAR: 'scalar',
    CURRENCY: 'currency'
} as const;
export type MetricType = typeof MetricType[keyof typeof MetricType];

/**
 * 
 * @export
 * @interface Metrics
 */
export interface Metrics {
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    orders: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    revenue: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    average_order_value: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    one_time_products: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    one_time_products_revenue: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    new_subscriptions: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    new_subscriptions_revenue: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    renewed_subscriptions: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    renewed_subscriptions_revenue: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    active_subscriptions: Metric;
    /**
     * 
     * @type {Metric}
     * @memberof Metrics
     */
    monthly_recurring_revenue: Metric;
}
/**
 * Date interval limit to get metrics for a given interval.
 * @export
 * @interface MetricsIntervalLimit
 */
export interface MetricsIntervalLimit {
    /**
     * Maximum number of days for this interval.
     * @type {number}
     * @memberof MetricsIntervalLimit
     */
    max_days: number;
}
/**
 * Date interval limits to get metrics for each interval.
 * @export
 * @interface MetricsIntervalsLimits
 */
export interface MetricsIntervalsLimits {
    /**
     * 
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    hour: MetricsIntervalLimit;
    /**
     * 
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    day: MetricsIntervalLimit;
    /**
     * 
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    week: MetricsIntervalLimit;
    /**
     * 
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    month: MetricsIntervalLimit;
    /**
     * 
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    year: MetricsIntervalLimit;
}
/**
 * Date limits to get metrics.
 * @export
 * @interface MetricsLimits
 */
export interface MetricsLimits {
    /**
     * Minimum date to get metrics.
     * @type {string}
     * @memberof MetricsLimits
     */
    min_date: string;
    /**
     * 
     * @type {MetricsIntervalsLimits}
     * @memberof MetricsLimits
     */
    intervals: MetricsIntervalsLimits;
}
/**
 * Metrics response schema.
 * @export
 * @interface MetricsResponse
 */
export interface MetricsResponse {
    /**
     * List of data for each timestamp.
     * @type {Array<MetricPeriod>}
     * @memberof MetricsResponse
     */
    periods: Array<MetricPeriod>;
    /**
     * 
     * @type {Metrics}
     * @memberof MetricsResponse
     */
    metrics: Metrics;
}
/**
 * 
 * @export
 * @interface NotPermitted
 */
export interface NotPermitted {
    /**
     * 
     * @type {string}
     * @memberof NotPermitted
     */
    error: NotPermittedErrorEnum;
    /**
     * 
     * @type {string}
     * @memberof NotPermitted
     */
    detail: string;
}


/**
 * @export
 */
export const NotPermittedErrorEnum = {
    NOT_PERMITTED: 'NotPermitted'
} as const;
export type NotPermittedErrorEnum = typeof NotPermittedErrorEnum[keyof typeof NotPermittedErrorEnum];

/**
 * @type NotificationsInner
 * 
 * @export
 */
export type NotificationsInner = { type: 'MaintainerAccountReviewedNotification' } & MaintainerAccountReviewedNotification | { type: 'MaintainerAccountUnderReviewNotification' } & MaintainerAccountUnderReviewNotification | { type: 'MaintainerCreateAccountNotification' } & MaintainerCreateAccountNotification | { type: 'MaintainerNewPaidSubscriptionNotification' } & MaintainerNewPaidSubscriptionNotification | { type: 'MaintainerNewProductSaleNotification' } & MaintainerNewProductSaleNotification | { type: 'MaintainerPledgeConfirmationPendingNotification' } & MaintainerPledgeConfirmationPendingNotification | { type: 'MaintainerPledgeCreatedNotification' } & MaintainerPledgeCreatedNotification | { type: 'MaintainerPledgePaidNotification' } & MaintainerPledgePaidNotification | { type: 'MaintainerPledgePendingNotification' } & MaintainerPledgePendingNotification | { type: 'MaintainerPledgedIssueConfirmationPendingNotification' } & MaintainerPledgedIssueConfirmationPendingNotification | { type: 'MaintainerPledgedIssuePendingNotification' } & MaintainerPledgedIssuePendingNotification | { type: 'PledgerPledgePendingNotification' } & PledgerPledgePendingNotification | { type: 'RewardPaidNotification' } & RewardPaidNotification | { type: 'TeamAdminMemberPledgedNotification' } & TeamAdminMemberPledgedNotification;
/**
 * 
 * @export
 * @interface NotificationsList
 */
export interface NotificationsList {
    /**
     * 
     * @type {Array<NotificationsInner>}
     * @memberof NotificationsList
     */
    notifications: Array<NotificationsInner>;
    /**
     * 
     * @type {string}
     * @memberof NotificationsList
     */
    last_read_notification_id: string | null;
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
 * @interface OAuth2Client
 */
export interface OAuth2Client {
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2Client
     */
    redirect_uris: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    token_endpoint_auth_method?: OAuth2ClientTokenEndpointAuthMethodEnum;
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2Client
     */
    grant_types?: Array<OAuth2ClientGrantTypesEnum>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2Client
     */
    response_types?: Array<OAuth2ClientResponseTypesEnum>;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    scope?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    client_name: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    client_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    logo_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    tos_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    policy_uri?: string | null;
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof OAuth2Client
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    client_id: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    client_secret: string;
    /**
     * 
     * @type {number}
     * @memberof OAuth2Client
     */
    client_id_issued_at: number;
    /**
     * 
     * @type {number}
     * @memberof OAuth2Client
     */
    client_secret_expires_at: number;
}


/**
 * @export
 */
export const OAuth2ClientTokenEndpointAuthMethodEnum = {
    CLIENT_SECRET_BASIC: 'client_secret_basic',
    CLIENT_SECRET_POST: 'client_secret_post',
    NONE: 'none'
} as const;
export type OAuth2ClientTokenEndpointAuthMethodEnum = typeof OAuth2ClientTokenEndpointAuthMethodEnum[keyof typeof OAuth2ClientTokenEndpointAuthMethodEnum];

/**
 * @export
 */
export const OAuth2ClientGrantTypesEnum = {
    AUTHORIZATION_CODE: 'authorization_code',
    REFRESH_TOKEN: 'refresh_token'
} as const;
export type OAuth2ClientGrantTypesEnum = typeof OAuth2ClientGrantTypesEnum[keyof typeof OAuth2ClientGrantTypesEnum];

/**
 * @export
 */
export const OAuth2ClientResponseTypesEnum = {
    CODE: 'code'
} as const;
export type OAuth2ClientResponseTypesEnum = typeof OAuth2ClientResponseTypesEnum[keyof typeof OAuth2ClientResponseTypesEnum];

/**
 * 
 * @export
 * @interface OAuth2ClientConfiguration
 */
export interface OAuth2ClientConfiguration {
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2ClientConfiguration
     */
    redirect_uris: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    token_endpoint_auth_method?: OAuth2ClientConfigurationTokenEndpointAuthMethodEnum;
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2ClientConfiguration
     */
    grant_types?: Array<OAuth2ClientConfigurationGrantTypesEnum>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2ClientConfiguration
     */
    response_types?: Array<OAuth2ClientConfigurationResponseTypesEnum>;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    scope?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    client_name: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    client_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    logo_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    tos_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    policy_uri?: string | null;
}


/**
 * @export
 */
export const OAuth2ClientConfigurationTokenEndpointAuthMethodEnum = {
    CLIENT_SECRET_BASIC: 'client_secret_basic',
    CLIENT_SECRET_POST: 'client_secret_post',
    NONE: 'none'
} as const;
export type OAuth2ClientConfigurationTokenEndpointAuthMethodEnum = typeof OAuth2ClientConfigurationTokenEndpointAuthMethodEnum[keyof typeof OAuth2ClientConfigurationTokenEndpointAuthMethodEnum];

/**
 * @export
 */
export const OAuth2ClientConfigurationGrantTypesEnum = {
    AUTHORIZATION_CODE: 'authorization_code',
    REFRESH_TOKEN: 'refresh_token'
} as const;
export type OAuth2ClientConfigurationGrantTypesEnum = typeof OAuth2ClientConfigurationGrantTypesEnum[keyof typeof OAuth2ClientConfigurationGrantTypesEnum];

/**
 * @export
 */
export const OAuth2ClientConfigurationResponseTypesEnum = {
    CODE: 'code'
} as const;
export type OAuth2ClientConfigurationResponseTypesEnum = typeof OAuth2ClientConfigurationResponseTypesEnum[keyof typeof OAuth2ClientConfigurationResponseTypesEnum];

/**
 * 
 * @export
 * @interface OAuth2ClientConfigurationUpdate
 */
export interface OAuth2ClientConfigurationUpdate {
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    redirect_uris: Array<string>;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    token_endpoint_auth_method?: OAuth2ClientConfigurationUpdateTokenEndpointAuthMethodEnum;
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    grant_types?: Array<OAuth2ClientConfigurationUpdateGrantTypesEnum>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    response_types?: Array<OAuth2ClientConfigurationUpdateResponseTypesEnum>;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    scope?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    client_name: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    client_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    logo_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    tos_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    policy_uri?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    client_id: string;
}


/**
 * @export
 */
export const OAuth2ClientConfigurationUpdateTokenEndpointAuthMethodEnum = {
    CLIENT_SECRET_BASIC: 'client_secret_basic',
    CLIENT_SECRET_POST: 'client_secret_post',
    NONE: 'none'
} as const;
export type OAuth2ClientConfigurationUpdateTokenEndpointAuthMethodEnum = typeof OAuth2ClientConfigurationUpdateTokenEndpointAuthMethodEnum[keyof typeof OAuth2ClientConfigurationUpdateTokenEndpointAuthMethodEnum];

/**
 * @export
 */
export const OAuth2ClientConfigurationUpdateGrantTypesEnum = {
    AUTHORIZATION_CODE: 'authorization_code',
    REFRESH_TOKEN: 'refresh_token'
} as const;
export type OAuth2ClientConfigurationUpdateGrantTypesEnum = typeof OAuth2ClientConfigurationUpdateGrantTypesEnum[keyof typeof OAuth2ClientConfigurationUpdateGrantTypesEnum];

/**
 * @export
 */
export const OAuth2ClientConfigurationUpdateResponseTypesEnum = {
    CODE: 'code'
} as const;
export type OAuth2ClientConfigurationUpdateResponseTypesEnum = typeof OAuth2ClientConfigurationUpdateResponseTypesEnum[keyof typeof OAuth2ClientConfigurationUpdateResponseTypesEnum];

/**
 * 
 * @export
 * @interface OAuth2ClientPublic
 */
export interface OAuth2ClientPublic {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    client_id: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    client_name: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    client_uri: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    logo_uri: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    tos_uri: string | null;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    policy_uri: string | null;
}
/**
 * 
 * @export
 * @interface OAuthAccountRead
 */
export interface OAuthAccountRead {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof OAuthAccountRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OAuthAccountRead
     */
    modified_at: string | null;
    /**
     * 
     * @type {OAuthPlatform}
     * @memberof OAuthAccountRead
     */
    platform: OAuthPlatform;
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
    /**
     * 
     * @type {string}
     * @memberof OAuthAccountRead
     */
    account_username: string | null;
}



/**
 * 
 * @export
 */
export const OAuthPlatform = {
    GITHUB: 'github',
    GITHUB_REPOSITORY_BENEFIT: 'github_repository_benefit',
    GOOGLE: 'google'
} as const;
export type OAuthPlatform = typeof OAuthPlatform[keyof typeof OAuthPlatform];

/**
 * 
 * @export
 * @interface Order
 */
export interface Order {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Order
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof Order
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof Order
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Key-value object storing custom field values.
     * @type {object}
     * @memberof Order
     */
    custom_field_data?: object;
    /**
     * 
     * @type {number}
     * @memberof Order
     */
    amount: number;
    /**
     * 
     * @type {number}
     * @memberof Order
     */
    tax_amount: number;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    currency: string;
    /**
     * 
     * @type {OrderBillingReason}
     * @memberof Order
     */
    billing_reason: OrderBillingReason;
    /**
     * 
     * @type {Address}
     * @memberof Order
     */
    billing_address: Address | null;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    product_price_id: string;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    discount_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Order
     */
    checkout_id: string | null;
    /**
     * 
     * @type {OrderCustomer}
     * @memberof Order
     */
    customer: OrderCustomer;
    /**
     * 
     * @type {string}
     * @memberof Order
     * @deprecated
     */
    user_id: string;
    /**
     * 
     * @type {OrderUser}
     * @memberof Order
     */
    user: OrderUser;
    /**
     * 
     * @type {OrderProduct}
     * @memberof Order
     */
    product: OrderProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof Order
     */
    product_price: ProductPrice;
    /**
     * 
     * @type {OrderDiscount}
     * @memberof Order
     */
    discount: OrderDiscount | null;
    /**
     * 
     * @type {OrderSubscription}
     * @memberof Order
     */
    subscription: OrderSubscription | null;
}



/**
 * 
 * @export
 */
export const OrderBillingReason = {
    PURCHASE: 'purchase',
    SUBSCRIPTION_CREATE: 'subscription_create',
    SUBSCRIPTION_CYCLE: 'subscription_cycle',
    SUBSCRIPTION_UPDATE: 'subscription_update'
} as const;
export type OrderBillingReason = typeof OrderBillingReason[keyof typeof OrderBillingReason];

/**
 * 
 * @export
 * @interface OrderCustomer
 */
export interface OrderCustomer {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof OrderCustomer
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OrderCustomer
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof OrderCustomer
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof OrderCustomer
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof OrderCustomer
     */
    email: string;
    /**
     * 
     * @type {boolean}
     * @memberof OrderCustomer
     */
    email_verified: boolean;
    /**
     * 
     * @type {string}
     * @memberof OrderCustomer
     */
    name: string | null;
    /**
     * 
     * @type {Address}
     * @memberof OrderCustomer
     */
    billing_address: Address | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof OrderCustomer
     */
    tax_id: Array<string> | null;
    /**
     * 
     * @type {string}
     * @memberof OrderCustomer
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof OrderCustomer
     */
    readonly avatar_url: string;
}
/**
 * @type OrderDiscount
 * 
 * @export
 */
export type OrderDiscount = DiscountFixedOnceForeverDurationBase | DiscountFixedRepeatDurationBase | DiscountPercentageOnceForeverDurationBase | DiscountPercentageRepeatDurationBase;
/**
 * @type OrderIDFilter
 * Filter by order ID.
 * @export
 */
export type OrderIDFilter = Array<string> | string;

/**
 * Order's invoice data.
 * @export
 * @interface OrderInvoice
 */
export interface OrderInvoice {
    /**
     * The URL to the invoice.
     * @type {string}
     * @memberof OrderInvoice
     */
    url: string;
}
/**
 * 
 * @export
 * @interface OrderProduct
 */
export interface OrderProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof OrderProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OrderProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof OrderProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof OrderProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof OrderProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof OrderProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof OrderProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof OrderProduct
     */
    organization_id: string;
}

/**
 * 
 * @export
 */
export const OrderSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    AMOUNT: 'amount',
    AMOUNT2: '-amount',
    CUSTOMER: 'customer',
    CUSTOMER2: '-customer',
    PRODUCT: 'product',
    PRODUCT2: '-product',
    DISCOUNT: 'discount',
    DISCOUNT2: '-discount',
    SUBSCRIPTION: 'subscription',
    SUBSCRIPTION2: '-subscription'
} as const;
export type OrderSortProperty = typeof OrderSortProperty[keyof typeof OrderSortProperty];

/**
 * 
 * @export
 * @interface OrderSubscription
 */
export interface OrderSubscription {
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof OrderSubscription
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof OrderSubscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof OrderSubscription
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof OrderSubscription
     */
    amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    currency: string | null;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof OrderSubscription
     */
    recurring_interval: SubscriptionRecurringInterval;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof OrderSubscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    current_period_end: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof OrderSubscription
     */
    cancel_at_period_end: boolean;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    started_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    ended_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    price_id: string;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    discount_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    checkout_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     * @deprecated
     */
    user_id: string;
}


/**
 * 
 * @export
 * @interface OrderUser
 */
export interface OrderUser {
    /**
     * 
     * @type {string}
     * @memberof OrderUser
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof OrderUser
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof OrderUser
     */
    public_name: string;
    /**
     * 
     * @type {string}
     * @memberof OrderUser
     */
    avatar_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrderUser
     */
    github_username?: string | null;
}
/**
 * 
 * @export
 * @interface Organization
 */
export interface Organization {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Organization
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    modified_at: string | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof Organization
     */
    id: string;
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
    slug: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    avatar_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    bio: string | null;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    company: string | null;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    blog: string | null;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    location: string | null;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    email: string | null;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    twitter_username: string | null;
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
    default_upfront_split_to_contributors: number | null;
    /**
     * 
     * @type {OrganizationProfileSettings}
     * @memberof Organization
     */
    profile_settings: OrganizationProfileSettings | null;
    /**
     * 
     * @type {OrganizationFeatureSettings}
     * @memberof Organization
     */
    feature_settings: OrganizationFeatureSettings | null;
}
/**
 * Schema to create a file to be used as an organization avatar.
 * @export
 * @interface OrganizationAvatarFileCreate
 */
export interface OrganizationAvatarFileCreate {
    /**
     * The organization ID.
     * @type {string}
     * @memberof OrganizationAvatarFileCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileCreate
     */
    name: string;
    /**
     * MIME type of the file. Only images are supported for this type of file.
     * @type {string}
     * @memberof OrganizationAvatarFileCreate
     */
    mime_type: string;
    /**
     * Size of the file. A maximum of 1 MB is allowed for this type of file.
     * @type {number}
     * @memberof OrganizationAvatarFileCreate
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileCreate
     */
    checksum_sha256_base64?: string | null;
    /**
     * 
     * @type {S3FileCreateMultipart}
     * @memberof OrganizationAvatarFileCreate
     */
    upload: S3FileCreateMultipart;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileCreate
     */
    service: OrganizationAvatarFileCreateServiceEnum;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileCreate
     */
    version?: string | null;
}


/**
 * @export
 */
export const OrganizationAvatarFileCreateServiceEnum = {
    ORGANIZATION_AVATAR: 'organization_avatar'
} as const;
export type OrganizationAvatarFileCreateServiceEnum = typeof OrganizationAvatarFileCreateServiceEnum[keyof typeof OrganizationAvatarFileCreateServiceEnum];

/**
 * File to be used as an organization avatar.
 * @export
 * @interface OrganizationAvatarFileRead
 */
export interface OrganizationAvatarFileRead {
    /**
     * The ID of the object.
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    path: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof OrganizationAvatarFileRead
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    storage_version: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    checksum_etag: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    checksum_sha256_base64: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    checksum_sha256_hex: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    last_modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    version: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    service: OrganizationAvatarFileReadServiceEnum;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationAvatarFileRead
     */
    is_uploaded: boolean;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    readonly size_readable: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationAvatarFileRead
     */
    readonly public_url: string;
}


/**
 * @export
 */
export const OrganizationAvatarFileReadServiceEnum = {
    ORGANIZATION_AVATAR: 'organization_avatar'
} as const;
export type OrganizationAvatarFileReadServiceEnum = typeof OrganizationAvatarFileReadServiceEnum[keyof typeof OrganizationAvatarFileReadServiceEnum];

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
    message: string | null;
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
 * @interface OrganizationBillingPlan
 */
export interface OrganizationBillingPlan {
    /**
     * 
     * @type {string}
     * @memberof OrganizationBillingPlan
     */
    organization_id: string;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationBillingPlan
     */
    is_free: boolean;
    /**
     * 
     * @type {string}
     * @memberof OrganizationBillingPlan
     */
    plan_name: string;
}
/**
 * 
 * @export
 * @interface OrganizationCheckPermissionsInput
 */
export interface OrganizationCheckPermissionsInput {
    /**
     * 
     * @type {AppPermissionsType}
     * @memberof OrganizationCheckPermissionsInput
     */
    permissions: AppPermissionsType;
}
/**
 * 
 * @export
 * @interface OrganizationCreate
 */
export interface OrganizationCreate {
    /**
     * 
     * @type {string}
     * @memberof OrganizationCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationCreate
     */
    slug: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationCreate
     */
    avatar_url?: string | null;
    /**
     * 
     * @type {OrganizationFeatureSettings}
     * @memberof OrganizationCreate
     */
    feature_settings?: OrganizationFeatureSettings | null;
}
/**
 * 
 * @export
 * @interface OrganizationFeatureSettings
 */
export interface OrganizationFeatureSettings {
    /**
     * If this organization has issue funding enabled
     * @type {boolean}
     * @memberof OrganizationFeatureSettings
     */
    issue_funding_enabled?: boolean;
}
/**
 * @type OrganizationIDFilter
 * Filter by organization ID.
 * @export
 */
export type OrganizationIDFilter = Array<string> | string;

/**
 * @type OrganizationId
 * Filter by organization ID.
 * @export
 */
export type OrganizationId = Array<string> | string;

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
    email: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    avatar_url: string | null;
}
/**
 * 
 * @export
 * @interface OrganizationProfileSettings
 */
export interface OrganizationProfileSettings {
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationProfileSettings
     */
    enabled?: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationProfileSettings
     */
    description?: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof OrganizationProfileSettings
     */
    featured_projects?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof OrganizationProfileSettings
     */
    featured_organizations?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof OrganizationProfileSettings
     */
    links?: Array<string> | null;
    /**
     * 
     * @type {OrganizationSubscribePromoteSettings}
     * @memberof OrganizationProfileSettings
     */
    subscribe?: OrganizationSubscribePromoteSettings | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationProfileSettings
     */
    accent_color?: string | null;
}
/**
 * 
 * @export
 * @interface OrganizationSetAccount
 */
export interface OrganizationSetAccount {
    /**
     * 
     * @type {string}
     * @memberof OrganizationSetAccount
     */
    account_id: string;
}

/**
 * 
 * @export
 */
export const OrganizationSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    NAME: 'name',
    NAME2: '-name'
} as const;
export type OrganizationSortProperty = typeof OrganizationSortProperty[keyof typeof OrganizationSortProperty];

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
 * @interface OrganizationSubscribePromoteSettings
 */
export interface OrganizationSubscribePromoteSettings {
    /**
     * Promote email subscription (free)
     * @type {boolean}
     * @memberof OrganizationSubscribePromoteSettings
     */
    promote?: boolean;
    /**
     * Show subscription count publicly
     * @type {boolean}
     * @memberof OrganizationSubscribePromoteSettings
     */
    show_count?: boolean;
    /**
     * Include free subscribers in total count
     * @type {boolean}
     * @memberof OrganizationSubscribePromoteSettings
     */
    count_free?: boolean;
}
/**
 * 
 * @export
 * @interface OrganizationUpdate
 */
export interface OrganizationUpdate {
    /**
     * 
     * @type {string}
     * @memberof OrganizationUpdate
     */
    name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationUpdate
     */
    avatar_url?: string | null;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    default_upfront_split_to_contributors?: number | null;
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
    billing_email?: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationUpdate
     */
    default_badge_custom_content?: string | null;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    pledge_minimum_amount?: number;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    total_monthly_spending_limit?: number | null;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    per_user_monthly_spending_limit?: number | null;
    /**
     * 
     * @type {OrganizationProfileSettings}
     * @memberof OrganizationUpdate
     */
    profile_settings?: OrganizationProfileSettings | null;
    /**
     * 
     * @type {OrganizationFeatureSettings}
     * @memberof OrganizationUpdate
     */
    feature_settings?: OrganizationFeatureSettings | null;
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
    next_page: number | null;
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
    brand: string | null;
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
    CARD: 'card',
    NULL: 'null'
} as const;
export type PaymentMethodTypeEnum = typeof PaymentMethodTypeEnum[keyof typeof PaymentMethodTypeEnum];

/**
 * 
 * @export
 * @interface PayoutCreate
 */
export interface PayoutCreate {
    /**
     * 
     * @type {string}
     * @memberof PayoutCreate
     */
    account_id: string;
}
/**
 * 
 * @export
 * @interface PayoutEstimate
 */
export interface PayoutEstimate {
    /**
     * 
     * @type {string}
     * @memberof PayoutEstimate
     */
    account_id: string;
    /**
     * 
     * @type {number}
     * @memberof PayoutEstimate
     */
    gross_amount: number;
    /**
     * 
     * @type {number}
     * @memberof PayoutEstimate
     */
    fees_amount: number;
    /**
     * 
     * @type {number}
     * @memberof PayoutEstimate
     */
    net_amount: number;
}
/**
 * 
 * @export
 * @interface PersonalAccessToken
 */
export interface PersonalAccessToken {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof PersonalAccessToken
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    id: string;
    /**
     * 
     * @type {Array<Scope>}
     * @memberof PersonalAccessToken
     */
    scopes: Array<Scope>;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    expires_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    comment: string;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessToken
     */
    last_used_at: string | null;
}
/**
 * 
 * @export
 * @interface PersonalAccessTokenCreate
 */
export interface PersonalAccessTokenCreate {
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessTokenCreate
     */
    comment: string;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessTokenCreate
     */
    expires_in?: string | null;
    /**
     * 
     * @type {Array<AvailableScope>}
     * @memberof PersonalAccessTokenCreate
     */
    scopes: Array<AvailableScope>;
}
/**
 * 
 * @export
 * @interface PersonalAccessTokenCreateResponse
 */
export interface PersonalAccessTokenCreateResponse {
    /**
     * 
     * @type {PersonalAccessToken}
     * @memberof PersonalAccessTokenCreateResponse
     */
    personal_access_token: PersonalAccessToken;
    /**
     * 
     * @type {string}
     * @memberof PersonalAccessTokenCreateResponse
     */
    token: string;
}

/**
 * Type of fees applied by Polar, and billed to the users.
 * @export
 */
export const PlatformFeeType = {
    PAYMENT: 'payment',
    INTERNATIONAL_PAYMENT: 'international_payment',
    SUBSCRIPTION: 'subscription',
    INVOICE: 'invoice',
    CROSS_BORDER_TRANSFER: 'cross_border_transfer',
    PAYOUT: 'payout',
    ACCOUNT: 'account',
    PLATFORM: 'platform'
} as const;
export type PlatformFeeType = typeof PlatformFeeType[keyof typeof PlatformFeeType];

/**
 * @type PlatformFilter
 * Filter by platform.
 * @export
 */
export type PlatformFilter = Array<Platforms> | Platforms;


/**
 * 
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
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Pledge
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Pledge
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof Pledge
     */
    id: string;
    /**
     * Amount pledged towards the issue
     * @type {number}
     * @memberof Pledge
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof Pledge
     */
    currency: string;
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
     * 
     * @type {string}
     * @memberof Pledge
     */
    refunded_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Pledge
     */
    scheduled_payout_at?: string | null;
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
    pledger?: Pledger | null;
    /**
     * 
     * @type {string}
     * @memberof Pledge
     */
    hosted_invoice_url?: string | null;
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
    created_by?: Pledger | null;
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
     * @type {number}
     * @memberof PledgeSpending
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof PledgeSpending
     */
    currency: string;
}

/**
 * 
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
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    currency?: string;
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    setup_future_usage?: PledgeStripePaymentIntentCreateSetupFutureUsageEnum | null;
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    on_behalf_of_organization_id?: string | null;
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
     * @type {string}
     * @memberof PledgeStripePaymentIntentMutationResponse
     */
    currency: string;
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
    client_secret: string | null;
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
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    currency?: string;
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    setup_future_usage?: PledgeStripePaymentIntentUpdateSetupFutureUsageEnum | null;
    /**
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    on_behalf_of_organization_id?: string | null;
}


/**
 * @export
 */
export const PledgeStripePaymentIntentUpdateSetupFutureUsageEnum = {
    ON_SESSION: 'on_session'
} as const;
export type PledgeStripePaymentIntentUpdateSetupFutureUsageEnum = typeof PledgeStripePaymentIntentUpdateSetupFutureUsageEnum[keyof typeof PledgeStripePaymentIntentUpdateSetupFutureUsageEnum];


/**
 * 
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
    github_username: string | null;
    /**
     * 
     * @type {string}
     * @memberof Pledger
     */
    avatar_url: string | null;
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotification
     */
    type: PledgerPledgePendingNotificationTypeEnum;
    /**
     * 
     * @type {PledgerPledgePendingNotificationPayload}
     * @memberof PledgerPledgePendingNotification
     */
    payload: PledgerPledgePendingNotificationPayload;
}


/**
 * @export
 */
export const PledgerPledgePendingNotificationTypeEnum = {
    PLEDGER_PLEDGE_PENDING_NOTIFICATION: 'PledgerPledgePendingNotification'
} as const;
export type PledgerPledgePendingNotificationTypeEnum = typeof PledgerPledgePendingNotificationTypeEnum[keyof typeof PledgerPledgePendingNotificationTypeEnum];

/**
 * 
 * @export
 * @interface PledgerPledgePendingNotificationPayload
 */
export interface PledgerPledgePendingNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {number}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    pledge_date: string;
    /**
     * 
     * @type {string}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    pledge_id: string | null;
    /**
     * 
     * @type {PledgeType}
     * @memberof PledgerPledgePendingNotificationPayload
     */
    pledge_type: PledgeType | null;
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
 */
export const PolarEnumsPaymentProcessor = {
    STRIPE: 'stripe'
} as const;
export type PolarEnumsPaymentProcessor = typeof PolarEnumsPaymentProcessor[keyof typeof PolarEnumsPaymentProcessor];


/**
 * Supported payment processors.
 * @export
 */
export const PolarModelsTransactionPaymentProcessor = {
    STRIPE: 'stripe',
    OPEN_COLLECTIVE: 'open_collective'
} as const;
export type PolarModelsTransactionPaymentProcessor = typeof PolarModelsTransactionPaymentProcessor[keyof typeof PolarModelsTransactionPaymentProcessor];

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
 * @type PreviousProperties
 * @export
 */
export type PreviousProperties = BenefitGrantAdsProperties | BenefitGrantDiscordProperties | BenefitGrantDownloadablesProperties | BenefitGrantGitHubRepositoryProperties | BenefitGrantLicenseKeysProperties | object;

/**
 * @type Prices
 * List of available prices for this product.
 * @export
 */
export type Prices = Array<ProductPriceRecurringFixedCreate> | Array<ProductPriceRecurringFreeCreate>;

/**
 * A product.
 * @export
 * @interface Product
 */
export interface Product {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Product
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Product
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof Product
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof Product
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof Product
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof Product
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof Product
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof Product
     */
    organization_id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof Product
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * List of prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof Product
     */
    prices: Array<ProductPrice>;
    /**
     * List of benefits granted by the product.
     * @type {Array<Benefit>}
     * @memberof Product
     */
    benefits: Array<Benefit>;
    /**
     * List of medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof Product
     */
    medias: Array<ProductMediaFileRead>;
    /**
     * List of custom fields attached to the product.
     * @type {Array<AttachedCustomField>}
     * @memberof Product
     */
    attached_custom_fields: Array<AttachedCustomField>;
}
/**
 * Schema to update the benefits granted by a product.
 * @export
 * @interface ProductBenefitsUpdate
 */
export interface ProductBenefitsUpdate {
    /**
     * List of benefit IDs. Each one must be on the same organization as the product.
     * @type {Array<string>}
     * @memberof ProductBenefitsUpdate
     */
    benefits: Array<string>;
}
/**
 * @type ProductCreate
 * @export
 */
export type ProductCreate = ProductOneTimeCreate | ProductRecurringCreate;

/**
 * 
 * @export
 * @interface ProductEmbed
 */
export interface ProductEmbed {
    /**
     * 
     * @type {string}
     * @memberof ProductEmbed
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductEmbed
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ProductEmbed
     */
    description: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof ProductEmbed
     */
    is_recurring: boolean;
    /**
     * 
     * @type {string}
     * @memberof ProductEmbed
     */
    organization_id: string;
    /**
     * 
     * @type {ProductPrice}
     * @memberof ProductEmbed
     */
    price: ProductPrice;
    /**
     * 
     * @type {ProductMediaFileRead}
     * @memberof ProductEmbed
     */
    cover: ProductMediaFileRead | null;
    /**
     * List of benefits granted by the product.
     * @type {Array<Benefit>}
     * @memberof ProductEmbed
     */
    benefits: Array<Benefit>;
    /**
     * 
     * @type {string}
     * @memberof ProductEmbed
     */
    etag: string;
}
/**
 * @type ProductIDFilter
 * Filter by product ID.
 * @export
 */
export type ProductIDFilter = Array<string> | string;

/**
 * Schema to create a file to be used as a product media file.
 * @export
 * @interface ProductMediaFileCreate
 */
export interface ProductMediaFileCreate {
    /**
     * The organization ID.
     * @type {string}
     * @memberof ProductMediaFileCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileCreate
     */
    name: string;
    /**
     * MIME type of the file. Only images are supported for this type of file.
     * @type {string}
     * @memberof ProductMediaFileCreate
     */
    mime_type: string;
    /**
     * Size of the file. A maximum of 10 MB is allowed for this type of file.
     * @type {number}
     * @memberof ProductMediaFileCreate
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileCreate
     */
    checksum_sha256_base64?: string | null;
    /**
     * 
     * @type {S3FileCreateMultipart}
     * @memberof ProductMediaFileCreate
     */
    upload: S3FileCreateMultipart;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileCreate
     */
    service: ProductMediaFileCreateServiceEnum;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileCreate
     */
    version?: string | null;
}


/**
 * @export
 */
export const ProductMediaFileCreateServiceEnum = {
    PRODUCT_MEDIA: 'product_media'
} as const;
export type ProductMediaFileCreateServiceEnum = typeof ProductMediaFileCreateServiceEnum[keyof typeof ProductMediaFileCreateServiceEnum];

/**
 * File to be used as a product media file.
 * @export
 * @interface ProductMediaFileRead
 */
export interface ProductMediaFileRead {
    /**
     * The ID of the object.
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    path: string;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof ProductMediaFileRead
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    storage_version: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    checksum_etag: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    checksum_sha256_base64: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    checksum_sha256_hex: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    last_modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    version: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    service: ProductMediaFileReadServiceEnum;
    /**
     * 
     * @type {boolean}
     * @memberof ProductMediaFileRead
     */
    is_uploaded: boolean;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    readonly size_readable: string;
    /**
     * 
     * @type {string}
     * @memberof ProductMediaFileRead
     */
    readonly public_url: string;
}


/**
 * @export
 */
export const ProductMediaFileReadServiceEnum = {
    PRODUCT_MEDIA: 'product_media'
} as const;
export type ProductMediaFileReadServiceEnum = typeof ProductMediaFileReadServiceEnum[keyof typeof ProductMediaFileReadServiceEnum];

/**
 * Schema to create a one-time product.
 * @export
 * @interface ProductOneTimeCreate
 */
export interface ProductOneTimeCreate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof ProductOneTimeCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * The name of the product.
     * @type {string}
     * @memberof ProductOneTimeCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ProductOneTimeCreate
     */
    description?: string | null;
    /**
     * List of available prices for this product.
     * @type {Array<ProductPriceOneTimeCreateInner>}
     * @memberof ProductOneTimeCreate
     */
    prices: Array<ProductPriceOneTimeCreateInner>;
    /**
     * 
     * @type {Array<string>}
     * @memberof ProductOneTimeCreate
     */
    medias?: Array<string> | null;
    /**
     * List of custom fields to attach.
     * @type {Array<AttachedCustomFieldCreate>}
     * @memberof ProductOneTimeCreate
     */
    attached_custom_fields?: Array<AttachedCustomFieldCreate>;
    /**
     * The organization ID.
     * @type {string}
     * @memberof ProductOneTimeCreate
     */
    organization_id?: string | null;
}
/**
 * @type ProductPrice
 * 
 * @export
 */
export type ProductPrice = { type: 'one_time' } & ProductPriceOneTime | { type: 'recurring' } & ProductPriceRecurring;
/**
 * @type ProductPriceOneTime
 * 
 * @export
 */
export type ProductPriceOneTime = { amount_type: 'custom' } & ProductPriceOneTimeCustom | { amount_type: 'fixed' } & ProductPriceOneTimeFixed | { amount_type: 'free' } & ProductPriceOneTimeFree;
/**
 * @type ProductPriceOneTimeCreateInner
 * @export
 */
export type ProductPriceOneTimeCreateInner = ProductPriceOneTimeCustomCreate | ProductPriceOneTimeFixedCreate | ProductPriceOneTimeFreeCreate;

/**
 * A pay-what-you-want price for a one-time product.
 * @export
 * @interface ProductPriceOneTimeCustom
 */
export interface ProductPriceOneTimeCustom {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceOneTimeCustom
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeCustom
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceOneTimeCustom
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeCustom
     */
    amount_type: ProductPriceOneTimeCustomAmountTypeEnum;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceOneTimeCustom
     */
    is_archived: boolean;
    /**
     * The ID of the product owning the price.
     * @type {string}
     * @memberof ProductPriceOneTimeCustom
     */
    product_id: string;
    /**
     * The currency.
     * @type {string}
     * @memberof ProductPriceOneTimeCustom
     */
    price_currency: string;
    /**
     * 
     * @type {number}
     * @memberof ProductPriceOneTimeCustom
     */
    minimum_amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof ProductPriceOneTimeCustom
     */
    maximum_amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof ProductPriceOneTimeCustom
     */
    preset_amount: number | null;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceOneTimeCustom
     */
    type: ProductPriceOneTimeCustomTypeEnum;
}


/**
 * @export
 */
export const ProductPriceOneTimeCustomAmountTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type ProductPriceOneTimeCustomAmountTypeEnum = typeof ProductPriceOneTimeCustomAmountTypeEnum[keyof typeof ProductPriceOneTimeCustomAmountTypeEnum];

/**
 * @export
 */
export const ProductPriceOneTimeCustomTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeCustomTypeEnum = typeof ProductPriceOneTimeCustomTypeEnum[keyof typeof ProductPriceOneTimeCustomTypeEnum];

/**
 * Schema to create a pay-what-you-want price for a one-time product.
 * @export
 * @interface ProductPriceOneTimeCustomCreate
 */
export interface ProductPriceOneTimeCustomCreate {
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeCustomCreate
     */
    type: ProductPriceOneTimeCustomCreateTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeCustomCreate
     */
    amount_type: ProductPriceOneTimeCustomCreateAmountTypeEnum;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof ProductPriceOneTimeCustomCreate
     */
    price_currency?: string;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceOneTimeCustomCreate
     */
    minimum_amount?: number | null;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceOneTimeCustomCreate
     */
    maximum_amount?: number | null;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceOneTimeCustomCreate
     */
    preset_amount?: number | null;
}


/**
 * @export
 */
export const ProductPriceOneTimeCustomCreateTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeCustomCreateTypeEnum = typeof ProductPriceOneTimeCustomCreateTypeEnum[keyof typeof ProductPriceOneTimeCustomCreateTypeEnum];

/**
 * @export
 */
export const ProductPriceOneTimeCustomCreateAmountTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type ProductPriceOneTimeCustomCreateAmountTypeEnum = typeof ProductPriceOneTimeCustomCreateAmountTypeEnum[keyof typeof ProductPriceOneTimeCustomCreateAmountTypeEnum];

/**
 * A one-time price for a product.
 * @export
 * @interface ProductPriceOneTimeFixed
 */
export interface ProductPriceOneTimeFixed {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceOneTimeFixed
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFixed
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceOneTimeFixed
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFixed
     */
    amount_type: ProductPriceOneTimeFixedAmountTypeEnum;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceOneTimeFixed
     */
    is_archived: boolean;
    /**
     * The ID of the product owning the price.
     * @type {string}
     * @memberof ProductPriceOneTimeFixed
     */
    product_id: string;
    /**
     * The currency.
     * @type {string}
     * @memberof ProductPriceOneTimeFixed
     */
    price_currency: string;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceOneTimeFixed
     */
    price_amount: number;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceOneTimeFixed
     */
    type: ProductPriceOneTimeFixedTypeEnum;
}


/**
 * @export
 */
export const ProductPriceOneTimeFixedAmountTypeEnum = {
    FIXED: 'fixed'
} as const;
export type ProductPriceOneTimeFixedAmountTypeEnum = typeof ProductPriceOneTimeFixedAmountTypeEnum[keyof typeof ProductPriceOneTimeFixedAmountTypeEnum];

/**
 * @export
 */
export const ProductPriceOneTimeFixedTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeFixedTypeEnum = typeof ProductPriceOneTimeFixedTypeEnum[keyof typeof ProductPriceOneTimeFixedTypeEnum];

/**
 * Schema to create a one-time product price.
 * @export
 * @interface ProductPriceOneTimeFixedCreate
 */
export interface ProductPriceOneTimeFixedCreate {
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFixedCreate
     */
    type: ProductPriceOneTimeFixedCreateTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFixedCreate
     */
    amount_type: ProductPriceOneTimeFixedCreateAmountTypeEnum;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceOneTimeFixedCreate
     */
    price_amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof ProductPriceOneTimeFixedCreate
     */
    price_currency?: string;
}


/**
 * @export
 */
export const ProductPriceOneTimeFixedCreateTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeFixedCreateTypeEnum = typeof ProductPriceOneTimeFixedCreateTypeEnum[keyof typeof ProductPriceOneTimeFixedCreateTypeEnum];

/**
 * @export
 */
export const ProductPriceOneTimeFixedCreateAmountTypeEnum = {
    FIXED: 'fixed'
} as const;
export type ProductPriceOneTimeFixedCreateAmountTypeEnum = typeof ProductPriceOneTimeFixedCreateAmountTypeEnum[keyof typeof ProductPriceOneTimeFixedCreateAmountTypeEnum];

/**
 * A free one-time price for a product.
 * @export
 * @interface ProductPriceOneTimeFree
 */
export interface ProductPriceOneTimeFree {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceOneTimeFree
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFree
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceOneTimeFree
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFree
     */
    amount_type: ProductPriceOneTimeFreeAmountTypeEnum;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceOneTimeFree
     */
    is_archived: boolean;
    /**
     * The ID of the product owning the price.
     * @type {string}
     * @memberof ProductPriceOneTimeFree
     */
    product_id: string;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceOneTimeFree
     */
    type: ProductPriceOneTimeFreeTypeEnum;
}


/**
 * @export
 */
export const ProductPriceOneTimeFreeAmountTypeEnum = {
    FREE: 'free'
} as const;
export type ProductPriceOneTimeFreeAmountTypeEnum = typeof ProductPriceOneTimeFreeAmountTypeEnum[keyof typeof ProductPriceOneTimeFreeAmountTypeEnum];

/**
 * @export
 */
export const ProductPriceOneTimeFreeTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeFreeTypeEnum = typeof ProductPriceOneTimeFreeTypeEnum[keyof typeof ProductPriceOneTimeFreeTypeEnum];

/**
 * Schema to create a free one-time product price.
 * @export
 * @interface ProductPriceOneTimeFreeCreate
 */
export interface ProductPriceOneTimeFreeCreate {
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFreeCreate
     */
    type: ProductPriceOneTimeFreeCreateTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeFreeCreate
     */
    amount_type: ProductPriceOneTimeFreeCreateAmountTypeEnum;
}


/**
 * @export
 */
export const ProductPriceOneTimeFreeCreateTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeFreeCreateTypeEnum = typeof ProductPriceOneTimeFreeCreateTypeEnum[keyof typeof ProductPriceOneTimeFreeCreateTypeEnum];

/**
 * @export
 */
export const ProductPriceOneTimeFreeCreateAmountTypeEnum = {
    FREE: 'free'
} as const;
export type ProductPriceOneTimeFreeCreateAmountTypeEnum = typeof ProductPriceOneTimeFreeCreateAmountTypeEnum[keyof typeof ProductPriceOneTimeFreeCreateAmountTypeEnum];

/**
 * @type ProductPriceRecurring
 * 
 * @export
 */
export type ProductPriceRecurring = { amount_type: 'custom' } & ProductPriceRecurringCustom | { amount_type: 'fixed' } & ProductPriceRecurringFixed | { amount_type: 'free' } & ProductPriceRecurringFree;
/**
 * A pay-what-you-want recurring price for a product, i.e. a subscription.
 * @export
 * @interface ProductPriceRecurringCustom
 */
export interface ProductPriceRecurringCustom {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceRecurringCustom
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringCustom
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceRecurringCustom
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringCustom
     */
    amount_type: ProductPriceRecurringCustomAmountTypeEnum;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceRecurringCustom
     */
    is_archived: boolean;
    /**
     * The ID of the product owning the price.
     * @type {string}
     * @memberof ProductPriceRecurringCustom
     */
    product_id: string;
    /**
     * The currency.
     * @type {string}
     * @memberof ProductPriceRecurringCustom
     */
    price_currency: string;
    /**
     * 
     * @type {number}
     * @memberof ProductPriceRecurringCustom
     */
    minimum_amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof ProductPriceRecurringCustom
     */
    maximum_amount: number | null;
    /**
     * 
     * @type {number}
     * @memberof ProductPriceRecurringCustom
     */
    preset_amount: number | null;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceRecurringCustom
     */
    type: ProductPriceRecurringCustomTypeEnum;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof ProductPriceRecurringCustom
     */
    recurring_interval: SubscriptionRecurringInterval;
}


/**
 * @export
 */
export const ProductPriceRecurringCustomAmountTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type ProductPriceRecurringCustomAmountTypeEnum = typeof ProductPriceRecurringCustomAmountTypeEnum[keyof typeof ProductPriceRecurringCustomAmountTypeEnum];

/**
 * @export
 */
export const ProductPriceRecurringCustomTypeEnum = {
    RECURRING: 'recurring'
} as const;
export type ProductPriceRecurringCustomTypeEnum = typeof ProductPriceRecurringCustomTypeEnum[keyof typeof ProductPriceRecurringCustomTypeEnum];

/**
 * A recurring price for a product, i.e. a subscription.
 * @export
 * @interface ProductPriceRecurringFixed
 */
export interface ProductPriceRecurringFixed {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceRecurringFixed
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFixed
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceRecurringFixed
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFixed
     */
    amount_type: ProductPriceRecurringFixedAmountTypeEnum;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceRecurringFixed
     */
    is_archived: boolean;
    /**
     * The ID of the product owning the price.
     * @type {string}
     * @memberof ProductPriceRecurringFixed
     */
    product_id: string;
    /**
     * The currency.
     * @type {string}
     * @memberof ProductPriceRecurringFixed
     */
    price_currency: string;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceRecurringFixed
     */
    price_amount: number;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceRecurringFixed
     */
    type: ProductPriceRecurringFixedTypeEnum;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof ProductPriceRecurringFixed
     */
    recurring_interval: SubscriptionRecurringInterval;
}


/**
 * @export
 */
export const ProductPriceRecurringFixedAmountTypeEnum = {
    FIXED: 'fixed'
} as const;
export type ProductPriceRecurringFixedAmountTypeEnum = typeof ProductPriceRecurringFixedAmountTypeEnum[keyof typeof ProductPriceRecurringFixedAmountTypeEnum];

/**
 * @export
 */
export const ProductPriceRecurringFixedTypeEnum = {
    RECURRING: 'recurring'
} as const;
export type ProductPriceRecurringFixedTypeEnum = typeof ProductPriceRecurringFixedTypeEnum[keyof typeof ProductPriceRecurringFixedTypeEnum];

/**
 * Schema to create a recurring product price, i.e. a subscription.
 * @export
 * @interface ProductPriceRecurringFixedCreate
 */
export interface ProductPriceRecurringFixedCreate {
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFixedCreate
     */
    type: ProductPriceRecurringFixedCreateTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFixedCreate
     */
    amount_type: ProductPriceRecurringFixedCreateAmountTypeEnum;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceRecurringFixedCreate
     */
    price_amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof ProductPriceRecurringFixedCreate
     */
    price_currency?: string;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof ProductPriceRecurringFixedCreate
     */
    recurring_interval: SubscriptionRecurringInterval;
}


/**
 * @export
 */
export const ProductPriceRecurringFixedCreateTypeEnum = {
    RECURRING: 'recurring'
} as const;
export type ProductPriceRecurringFixedCreateTypeEnum = typeof ProductPriceRecurringFixedCreateTypeEnum[keyof typeof ProductPriceRecurringFixedCreateTypeEnum];

/**
 * @export
 */
export const ProductPriceRecurringFixedCreateAmountTypeEnum = {
    FIXED: 'fixed'
} as const;
export type ProductPriceRecurringFixedCreateAmountTypeEnum = typeof ProductPriceRecurringFixedCreateAmountTypeEnum[keyof typeof ProductPriceRecurringFixedCreateAmountTypeEnum];

/**
 * A free recurring price for a product, i.e. a subscription.
 * @export
 * @interface ProductPriceRecurringFree
 */
export interface ProductPriceRecurringFree {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceRecurringFree
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFree
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceRecurringFree
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFree
     */
    amount_type: ProductPriceRecurringFreeAmountTypeEnum;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceRecurringFree
     */
    is_archived: boolean;
    /**
     * The ID of the product owning the price.
     * @type {string}
     * @memberof ProductPriceRecurringFree
     */
    product_id: string;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceRecurringFree
     */
    type: ProductPriceRecurringFreeTypeEnum;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof ProductPriceRecurringFree
     */
    recurring_interval: SubscriptionRecurringInterval;
}


/**
 * @export
 */
export const ProductPriceRecurringFreeAmountTypeEnum = {
    FREE: 'free'
} as const;
export type ProductPriceRecurringFreeAmountTypeEnum = typeof ProductPriceRecurringFreeAmountTypeEnum[keyof typeof ProductPriceRecurringFreeAmountTypeEnum];

/**
 * @export
 */
export const ProductPriceRecurringFreeTypeEnum = {
    RECURRING: 'recurring'
} as const;
export type ProductPriceRecurringFreeTypeEnum = typeof ProductPriceRecurringFreeTypeEnum[keyof typeof ProductPriceRecurringFreeTypeEnum];

/**
 * Schema to create a free recurring product price, i.e. a subscription.
 * @export
 * @interface ProductPriceRecurringFreeCreate
 */
export interface ProductPriceRecurringFreeCreate {
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFreeCreate
     */
    type: ProductPriceRecurringFreeCreateTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringFreeCreate
     */
    amount_type: ProductPriceRecurringFreeCreateAmountTypeEnum;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof ProductPriceRecurringFreeCreate
     */
    recurring_interval: SubscriptionRecurringInterval;
}


/**
 * @export
 */
export const ProductPriceRecurringFreeCreateTypeEnum = {
    RECURRING: 'recurring'
} as const;
export type ProductPriceRecurringFreeCreateTypeEnum = typeof ProductPriceRecurringFreeCreateTypeEnum[keyof typeof ProductPriceRecurringFreeCreateTypeEnum];

/**
 * @export
 */
export const ProductPriceRecurringFreeCreateAmountTypeEnum = {
    FREE: 'free'
} as const;
export type ProductPriceRecurringFreeCreateAmountTypeEnum = typeof ProductPriceRecurringFreeCreateAmountTypeEnum[keyof typeof ProductPriceRecurringFreeCreateAmountTypeEnum];


/**
 * 
 * @export
 */
export const ProductPriceType = {
    ONE_TIME: 'one_time',
    RECURRING: 'recurring'
} as const;
export type ProductPriceType = typeof ProductPriceType[keyof typeof ProductPriceType];

/**
 * @type ProductPriceTypeFilter
 * Filter by product price type. `recurring` will return orders corresponding to subscriptions creations or renewals. `one_time` will return orders corresponding to one-time purchases.
 * @export
 */
export type ProductPriceTypeFilter = Array<ProductPriceType> | ProductPriceType;

/**
 * @type ProductPriceTypeFilter1
 * Filter by product price type. `recurring` will filter data corresponding to subscriptions creations or renewals. `one_time` will filter data corresponding to one-time purchases.
 * @export
 */
export type ProductPriceTypeFilter1 = Array<ProductPriceType> | ProductPriceType;

/**
 * Schema to create a recurring product, i.e. a subscription.
 * @export
 * @interface ProductRecurringCreate
 */
export interface ProductRecurringCreate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof ProductRecurringCreate
     */
    metadata?: { [key: string]: MetadataValue1; };
    /**
     * The name of the product.
     * @type {string}
     * @memberof ProductRecurringCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ProductRecurringCreate
     */
    description?: string | null;
    /**
     * 
     * @type {Prices}
     * @memberof ProductRecurringCreate
     */
    prices: Prices;
    /**
     * 
     * @type {Array<string>}
     * @memberof ProductRecurringCreate
     */
    medias?: Array<string> | null;
    /**
     * List of custom fields to attach.
     * @type {Array<AttachedCustomFieldCreate>}
     * @memberof ProductRecurringCreate
     */
    attached_custom_fields?: Array<AttachedCustomFieldCreate>;
    /**
     * The organization ID.
     * @type {string}
     * @memberof ProductRecurringCreate
     */
    organization_id?: string | null;
}

/**
 * 
 * @export
 */
export const ProductSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    NAME: 'name',
    NAME2: '-name',
    PRICE_TYPE: 'price_type',
    PRICE_TYPE2: '-price_type',
    PRICE_AMOUNT_TYPE: 'price_amount_type',
    PRICE_AMOUNT_TYPE2: '-price_amount_type',
    PRICE_AMOUNT: 'price_amount',
    PRICE_AMOUNT2: '-price_amount'
} as const;
export type ProductSortProperty = typeof ProductSortProperty[keyof typeof ProductSortProperty];

/**
 * Schema of a public product.
 * @export
 * @interface ProductStorefront
 */
export interface ProductStorefront {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductStorefront
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductStorefront
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof ProductStorefront
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof ProductStorefront
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof ProductStorefront
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof ProductStorefront
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof ProductStorefront
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof ProductStorefront
     */
    organization_id: string;
    /**
     * List of available prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof ProductStorefront
     */
    prices: Array<ProductPrice>;
    /**
     * The benefits granted by the product.
     * @type {Array<BenefitBase>}
     * @memberof ProductStorefront
     */
    benefits: Array<BenefitBase>;
    /**
     * The medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof ProductStorefront
     */
    medias: Array<ProductMediaFileRead>;
}
/**
 * Schema to update a product.
 * @export
 * @interface ProductUpdate
 */
export interface ProductUpdate {
    /**
     * Key-value object allowing you to store additional information.
     * 
     * The key must be a string with a maximum length of **40 characters**.
     * The value must be either:
     * 
     * * A string with a maximum length of **500 characters**
     * * An integer
     * * A boolean
     * 
     * You can store up to **50 key-value pairs**.
     * @type {{ [key: string]: MetadataValue1; }}
     * @memberof ProductUpdate
     */
    metadata?: { [key: string]: MetadataValue1; } | null;
    /**
     * The name of the product.
     * @type {string}
     * @memberof ProductUpdate
     */
    name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof ProductUpdate
     */
    is_archived?: boolean | null;
    /**
     * 
     * @type {Array<ProductUpdatePricesInner>}
     * @memberof ProductUpdate
     */
    prices?: Array<ProductUpdatePricesInner> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof ProductUpdate
     */
    medias?: Array<string> | null;
    /**
     * List of custom fields to attach.
     * @type {Array<AttachedCustomFieldCreate>}
     * @memberof ProductUpdate
     */
    attached_custom_fields?: Array<AttachedCustomFieldCreate> | null;
}
/**
 * @type ProductUpdatePricesInner
 * @export
 */
export type ProductUpdatePricesInner = ExistingProductPrice | ProductPriceOneTimeCustomCreate | ProductPriceOneTimeFixedCreate | ProductPriceOneTimeFreeCreate | ProductPriceRecurringFixedCreate | ProductPriceRecurringFreeCreate;

/**
 * @type Properties
 * @export
 */
export type Properties = BenefitGrantAdsProperties | BenefitGrantDiscordProperties | BenefitGrantDownloadablesProperties | BenefitGrantGitHubRepositoryProperties | BenefitGrantLicenseKeysProperties | object;

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
     * @type {boolean}
     * @memberof Repository
     */
    is_private: boolean;
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
    description: string | null;
    /**
     * 
     * @type {number}
     * @memberof Repository
     */
    stars: number | null;
    /**
     * 
     * @type {string}
     * @memberof Repository
     */
    license: string | null;
    /**
     * 
     * @type {string}
     * @memberof Repository
     */
    homepage: string | null;
    /**
     * 
     * @type {RepositoryProfileSettings}
     * @memberof Repository
     */
    profile_settings: RepositoryProfileSettings | null;
    /**
     * 
     * @type {ExternalOrganization}
     * @memberof Repository
     */
    organization: ExternalOrganization;
    /**
     * 
     * @type {Organization}
     * @memberof Repository
     */
    internal_organization: Organization | null;
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
    avatar_url: string | null;
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
 * @type RepositoryNameFilter
 * Filter by name.
 * @export
 */
export type RepositoryNameFilter = Array<string> | string;

/**
 * @type RepositoryNameFilter1
 * Filter by repository name.
 * @export
 */
export type RepositoryNameFilter1 = Array<string> | string;

/**
 * 
 * @export
 * @interface RepositoryProfileSettings
 */
export interface RepositoryProfileSettings {
    /**
     * 
     * @type {string}
     * @memberof RepositoryProfileSettings
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof RepositoryProfileSettings
     */
    cover_image_url?: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettings
     */
    featured_organizations?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettings
     */
    highlighted_subscription_tiers?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettings
     */
    links?: Array<string> | null;
}
/**
 * 
 * @export
 * @interface RepositoryProfileSettingsUpdate
 */
export interface RepositoryProfileSettingsUpdate {
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryProfileSettingsUpdate
     */
    set_description?: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof RepositoryProfileSettingsUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryProfileSettingsUpdate
     */
    set_cover_image_url?: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof RepositoryProfileSettingsUpdate
     */
    cover_image_url?: string | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettingsUpdate
     */
    featured_organizations?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettingsUpdate
     */
    highlighted_subscription_tiers?: Array<string> | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettingsUpdate
     */
    links?: Array<string> | null;
}

/**
 * 
 * @export
 */
export const RepositorySortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    NAME: 'name',
    NAME2: '-name',
    STARS: 'stars',
    STARS2: '-stars'
} as const;
export type RepositorySortProperty = typeof RepositorySortProperty[keyof typeof RepositorySortProperty];

/**
 * 
 * @export
 * @interface RepositoryUpdate
 */
export interface RepositoryUpdate {
    /**
     * 
     * @type {RepositoryProfileSettingsUpdate}
     * @memberof RepositoryUpdate
     */
    profile_settings?: RepositoryProfileSettingsUpdate | null;
}
/**
 * 
 * @export
 * @interface ResourceNotFound
 */
export interface ResourceNotFound {
    /**
     * 
     * @type {string}
     * @memberof ResourceNotFound
     */
    error: ResourceNotFoundErrorEnum;
    /**
     * 
     * @type {string}
     * @memberof ResourceNotFound
     */
    detail: string;
}


/**
 * @export
 */
export const ResourceNotFoundErrorEnum = {
    RESOURCE_NOT_FOUND: 'ResourceNotFound'
} as const;
export type ResourceNotFoundErrorEnum = typeof ResourceNotFoundErrorEnum[keyof typeof ResourceNotFoundErrorEnum];

/**
 * @type ResponseFilesUpdate
 * 
 * @export
 */
export type ResponseFilesUpdate = { service: 'downloadable' } & DownloadableFileRead | { service: 'organization_avatar' } & OrganizationAvatarFileRead | { service: 'product_media' } & ProductMediaFileRead;
/**
 * @type ResponseFilesUploaded
 * 
 * @export
 */
export type ResponseFilesUploaded = { service: 'downloadable' } & DownloadableFileRead | { service: 'organization_avatar' } & OrganizationAvatarFileRead | { service: 'product_media' } & ProductMediaFileRead;
/**
 * @type ResponseOauth2Authorize
 * 
 * @export
 */
export type ResponseOauth2Authorize = { sub_type: 'organization' } & AuthorizeResponseOrganization | { sub_type: 'user' } & AuthorizeResponseUser;
/**
 * @type ResponseOauth2Userinfo
 * @export
 */
export type ResponseOauth2Userinfo = UserInfoOrganization | UserInfoUser;

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
     * @type {User}
     * @memberof Reward
     */
    user?: User | null;
    /**
     * 
     * @type {Organization}
     * @memberof Reward
     */
    organization?: Organization | null;
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
     * 
     * @type {string}
     * @memberof Reward
     */
    paid_at?: string | null;
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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotification
     */
    type: RewardPaidNotificationTypeEnum;
    /**
     * 
     * @type {RewardPaidNotificationPayload}
     * @memberof RewardPaidNotification
     */
    payload: RewardPaidNotificationPayload;
}


/**
 * @export
 */
export const RewardPaidNotificationTypeEnum = {
    REWARD_PAID_NOTIFICATION: 'RewardPaidNotification'
} as const;
export type RewardPaidNotificationTypeEnum = typeof RewardPaidNotificationTypeEnum[keyof typeof RewardPaidNotificationTypeEnum];

/**
 * 
 * @export
 * @interface RewardPaidNotificationPayload
 */
export interface RewardPaidNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotificationPayload
     */
    paid_out_amount: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {number}
     * @memberof RewardPaidNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotificationPayload
     */
    issue_id: string;
    /**
     * 
     * @type {string}
     * @memberof RewardPaidNotificationPayload
     */
    pledge_id: string;
}

/**
 * 
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
    avatar_url: string | null;
}
/**
 * 
 * @export
 * @interface S3DownloadURL
 */
export interface S3DownloadURL {
    /**
     * 
     * @type {string}
     * @memberof S3DownloadURL
     */
    url: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof S3DownloadURL
     */
    headers?: { [key: string]: string; };
    /**
     * 
     * @type {string}
     * @memberof S3DownloadURL
     */
    expires_at: string;
}
/**
 * 
 * @export
 * @interface S3FileCreateMultipart
 */
export interface S3FileCreateMultipart {
    /**
     * 
     * @type {Array<S3FileCreatePart>}
     * @memberof S3FileCreateMultipart
     */
    parts: Array<S3FileCreatePart>;
}
/**
 * 
 * @export
 * @interface S3FileCreatePart
 */
export interface S3FileCreatePart {
    /**
     * 
     * @type {number}
     * @memberof S3FileCreatePart
     */
    number: number;
    /**
     * 
     * @type {number}
     * @memberof S3FileCreatePart
     */
    chunk_start: number;
    /**
     * 
     * @type {number}
     * @memberof S3FileCreatePart
     */
    chunk_end: number;
    /**
     * 
     * @type {string}
     * @memberof S3FileCreatePart
     */
    checksum_sha256_base64?: string | null;
}
/**
 * 
 * @export
 * @interface S3FileUploadCompletedPart
 */
export interface S3FileUploadCompletedPart {
    /**
     * 
     * @type {number}
     * @memberof S3FileUploadCompletedPart
     */
    number: number;
    /**
     * 
     * @type {string}
     * @memberof S3FileUploadCompletedPart
     */
    checksum_etag: string;
    /**
     * 
     * @type {string}
     * @memberof S3FileUploadCompletedPart
     */
    checksum_sha256_base64: string | null;
}
/**
 * 
 * @export
 * @interface S3FileUploadMultipart
 */
export interface S3FileUploadMultipart {
    /**
     * 
     * @type {string}
     * @memberof S3FileUploadMultipart
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof S3FileUploadMultipart
     */
    path: string;
    /**
     * 
     * @type {Array<S3FileUploadPart>}
     * @memberof S3FileUploadMultipart
     */
    parts: Array<S3FileUploadPart>;
}
/**
 * 
 * @export
 * @interface S3FileUploadPart
 */
export interface S3FileUploadPart {
    /**
     * 
     * @type {number}
     * @memberof S3FileUploadPart
     */
    number: number;
    /**
     * 
     * @type {number}
     * @memberof S3FileUploadPart
     */
    chunk_start: number;
    /**
     * 
     * @type {number}
     * @memberof S3FileUploadPart
     */
    chunk_end: number;
    /**
     * 
     * @type {string}
     * @memberof S3FileUploadPart
     */
    checksum_sha256_base64?: string | null;
    /**
     * 
     * @type {string}
     * @memberof S3FileUploadPart
     */
    url: string;
    /**
     * 
     * @type {string}
     * @memberof S3FileUploadPart
     */
    expires_at: string;
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof S3FileUploadPart
     */
    headers?: { [key: string]: string; };
}

/**
 * 
 * @export
 */
export const Scope = {
    OPENID: 'openid',
    PROFILE: 'profile',
    EMAIL: 'email',
    USERREAD: 'user:read',
    ADMIN: 'admin',
    WEB_DEFAULT: 'web_default',
    ORGANIZATIONSREAD: 'organizations:read',
    ORGANIZATIONSWRITE: 'organizations:write',
    CUSTOM_FIELDSREAD: 'custom_fields:read',
    CUSTOM_FIELDSWRITE: 'custom_fields:write',
    DISCOUNTSREAD: 'discounts:read',
    DISCOUNTSWRITE: 'discounts:write',
    CHECKOUT_LINKSREAD: 'checkout_links:read',
    CHECKOUT_LINKSWRITE: 'checkout_links:write',
    CHECKOUTSREAD: 'checkouts:read',
    CHECKOUTSWRITE: 'checkouts:write',
    PRODUCTSREAD: 'products:read',
    PRODUCTSWRITE: 'products:write',
    BENEFITSREAD: 'benefits:read',
    BENEFITSWRITE: 'benefits:write',
    FILESREAD: 'files:read',
    FILESWRITE: 'files:write',
    SUBSCRIPTIONSREAD: 'subscriptions:read',
    SUBSCRIPTIONSWRITE: 'subscriptions:write',
    CUSTOMERSREAD: 'customers:read',
    CUSTOMERSWRITE: 'customers:write',
    CUSTOMER_SESSIONSWRITE: 'customer_sessions:write',
    ORDERSREAD: 'orders:read',
    METRICSREAD: 'metrics:read',
    WEBHOOKSREAD: 'webhooks:read',
    WEBHOOKSWRITE: 'webhooks:write',
    EXTERNAL_ORGANIZATIONSREAD: 'external_organizations:read',
    LICENSE_KEYSREAD: 'license_keys:read',
    LICENSE_KEYSWRITE: 'license_keys:write',
    REPOSITORIESREAD: 'repositories:read',
    REPOSITORIESWRITE: 'repositories:write',
    ISSUESREAD: 'issues:read',
    ISSUESWRITE: 'issues:write',
    CUSTOMER_PORTALREAD: 'customer_portal:read',
    CUSTOMER_PORTALWRITE: 'customer_portal:write'
} as const;
export type Scope = typeof Scope[keyof typeof Scope];


/**
 * 
 * @export
 */
export const State = {
    OPEN: 'open',
    CLOSED: 'closed'
} as const;
export type State = typeof State[keyof typeof State];


/**
 * 
 * @export
 */
export const Status = {
    CREATED: 'created',
    ONBOARDING_STARTED: 'onboarding_started',
    UNDER_REVIEW: 'under_review',
    ACTIVE: 'active'
} as const;
export type Status = typeof Status[keyof typeof Status];

/**
 * Schema of a public storefront.
 * @export
 * @interface Storefront
 */
export interface Storefront {
    /**
     * 
     * @type {Organization}
     * @memberof Storefront
     */
    organization: Organization;
    /**
     * 
     * @type {Array<ProductStorefront>}
     * @memberof Storefront
     */
    products: Array<ProductStorefront>;
    /**
     * 
     * @type {ProductStorefront}
     * @memberof Storefront
     */
    donation_product: ProductStorefront | null;
    /**
     * 
     * @type {StorefrontCustomers}
     * @memberof Storefront
     */
    customers: StorefrontCustomers;
}
/**
 * 
 * @export
 * @interface StorefrontCustomer
 */
export interface StorefrontCustomer {
    /**
     * 
     * @type {string}
     * @memberof StorefrontCustomer
     */
    name: string;
}
/**
 * 
 * @export
 * @interface StorefrontCustomers
 */
export interface StorefrontCustomers {
    /**
     * 
     * @type {number}
     * @memberof StorefrontCustomers
     */
    total: number;
    /**
     * 
     * @type {Array<StorefrontCustomer>}
     * @memberof StorefrontCustomers
     */
    customers: Array<StorefrontCustomer>;
}

/**
 * 
 * @export
 */
export const SubType = {
    USER: 'user',
    ORGANIZATION: 'organization'
} as const;
export type SubType = typeof SubType[keyof typeof SubType];

/**
 * 
 * @export
 * @interface Subscription
 */
export interface Subscription {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Subscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof Subscription
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof Subscription
     */
    amount: number | null;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    currency: string | null;
    /**
     * 
     * @type {SubscriptionRecurringInterval}
     * @memberof Subscription
     */
    recurring_interval: SubscriptionRecurringInterval;
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
    current_period_end: string | null;
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
    started_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    ended_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    customer_id: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    price_id: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    discount_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    checkout_id: string | null;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof Subscription
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * Key-value object storing custom field values.
     * @type {object}
     * @memberof Subscription
     */
    custom_field_data?: object;
    /**
     * 
     * @type {SubscriptionCustomer}
     * @memberof Subscription
     */
    customer: SubscriptionCustomer;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     * @deprecated
     */
    user_id: string;
    /**
     * 
     * @type {SubscriptionUser}
     * @memberof Subscription
     */
    user: SubscriptionUser;
    /**
     * 
     * @type {Product}
     * @memberof Subscription
     */
    product: Product;
    /**
     * 
     * @type {ProductPriceRecurring}
     * @memberof Subscription
     */
    price: ProductPriceRecurring;
    /**
     * 
     * @type {SubscriptionDiscount}
     * @memberof Subscription
     */
    discount: SubscriptionDiscount | null;
}


/**
 * 
 * @export
 * @interface SubscriptionCustomer
 */
export interface SubscriptionCustomer {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof SubscriptionCustomer
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionCustomer
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof SubscriptionCustomer
     */
    id: string;
    /**
     * 
     * @type {{ [key: string]: MetadataValue; }}
     * @memberof SubscriptionCustomer
     */
    metadata: { [key: string]: MetadataValue; };
    /**
     * 
     * @type {string}
     * @memberof SubscriptionCustomer
     */
    email: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionCustomer
     */
    email_verified: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionCustomer
     */
    name: string | null;
    /**
     * 
     * @type {Address}
     * @memberof SubscriptionCustomer
     */
    billing_address: Address | null;
    /**
     * 
     * @type {Array<string>}
     * @memberof SubscriptionCustomer
     */
    tax_id: Array<string> | null;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionCustomer
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionCustomer
     */
    readonly avatar_url: string;
}
/**
 * @type SubscriptionDiscount
 * 
 * @export
 */
export type SubscriptionDiscount = DiscountFixedOnceForeverDurationBase | DiscountFixedRepeatDurationBase | DiscountPercentageOnceForeverDurationBase | DiscountPercentageRepeatDurationBase;
/**
 * @type SubscriptionIDFilter
 * Filter by subscription ID.
 * @export
 */
export type SubscriptionIDFilter = Array<string> | string;


/**
 * 
 * @export
 */
export const SubscriptionRecurringInterval = {
    MONTH: 'month',
    YEAR: 'year'
} as const;
export type SubscriptionRecurringInterval = typeof SubscriptionRecurringInterval[keyof typeof SubscriptionRecurringInterval];


/**
 * 
 * @export
 */
export const SubscriptionSortProperty = {
    CUSTOMER: 'customer',
    CUSTOMER2: '-customer',
    STATUS: 'status',
    STATUS2: '-status',
    STARTED_AT: 'started_at',
    STARTED_AT2: '-started_at',
    CURRENT_PERIOD_END: 'current_period_end',
    CURRENT_PERIOD_END2: '-current_period_end',
    AMOUNT: 'amount',
    AMOUNT2: '-amount',
    PRODUCT: 'product',
    PRODUCT2: '-product',
    DISCOUNT: 'discount',
    DISCOUNT2: '-discount'
} as const;
export type SubscriptionSortProperty = typeof SubscriptionSortProperty[keyof typeof SubscriptionSortProperty];


/**
 * 
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
 * @interface SubscriptionUser
 */
export interface SubscriptionUser {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    public_name: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    avatar_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    github_username?: string | null;
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
    pledger: Pledger | null;
}



/**
 * List of supported tax ID formats.
 * 
 * Ref: https://docs.stripe.com/billing/customer/tax-ids#supported-tax-id
 * @export
 */
export const TaxIDFormat = {
    AD_NRT: 'ad_nrt',
    AE_TRN: 'ae_trn',
    AR_CUIT: 'ar_cuit',
    AU_ABN: 'au_abn',
    AU_ARN: 'au_arn',
    BG_UIC: 'bg_uic',
    BH_VAT: 'bh_vat',
    BO_TIN: 'bo_tin',
    BR_CNPJ: 'br_cnpj',
    BR_CPF: 'br_cpf',
    CA_BN: 'ca_bn',
    CA_GST_HST: 'ca_gst_hst',
    CA_PST_BC: 'ca_pst_bc',
    CA_PST_MB: 'ca_pst_mb',
    CA_PST_SK: 'ca_pst_sk',
    CA_QST: 'ca_qst',
    CH_UID: 'ch_uid',
    CH_VAT: 'ch_vat',
    CL_TIN: 'cl_tin',
    CN_TIN: 'cn_tin',
    CO_NIT: 'co_nit',
    CR_TIN: 'cr_tin',
    DE_STN: 'de_stn',
    DO_RCN: 'do_rcn',
    EC_RUC: 'ec_ruc',
    EG_TIN: 'eg_tin',
    ES_CIF: 'es_cif',
    EU_OSS_VAT: 'eu_oss_vat',
    EU_VAT: 'eu_vat',
    GB_VAT: 'gb_vat',
    GE_VAT: 'ge_vat',
    HK_BR: 'hk_br',
    HR_OIB: 'hr_oib',
    HU_TIN: 'hu_tin',
    ID_NPWP: 'id_npwp',
    IL_VAT: 'il_vat',
    IN_GST: 'in_gst',
    IS_VAT: 'is_vat',
    JP_CN: 'jp_cn',
    JP_RN: 'jp_rn',
    JP_TRN: 'jp_trn',
    KE_PIN: 'ke_pin',
    KR_BRN: 'kr_brn',
    KZ_BIN: 'kz_bin',
    LI_UID: 'li_uid',
    MX_RFC: 'mx_rfc',
    MY_FRP: 'my_frp',
    MY_ITN: 'my_itn',
    MY_SST: 'my_sst',
    NG_TIN: 'ng_tin',
    NO_VAT: 'no_vat',
    NO_VOEC: 'no_voec',
    NZ_GST: 'nz_gst',
    OM_VAT: 'om_vat',
    PE_RUC: 'pe_ruc',
    PH_TIN: 'ph_tin',
    RO_TIN: 'ro_tin',
    RS_PIB: 'rs_pib',
    RU_INN: 'ru_inn',
    RU_KPP: 'ru_kpp',
    SA_VAT: 'sa_vat',
    SG_GST: 'sg_gst',
    SG_UEN: 'sg_uen',
    SI_TIN: 'si_tin',
    SV_NIT: 'sv_nit',
    TH_VAT: 'th_vat',
    TR_TIN: 'tr_tin',
    TW_VAT: 'tw_vat',
    UA_VAT: 'ua_vat',
    US_EIN: 'us_ein',
    UY_RUC: 'uy_ruc',
    VE_RIF: 've_rif',
    VN_TIN: 'vn_tin',
    ZA_VAT: 'za_vat'
} as const;
export type TaxIDFormat = typeof TaxIDFormat[keyof typeof TaxIDFormat];

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
    id: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotification
     */
    type: TeamAdminMemberPledgedNotificationTypeEnum;
    /**
     * 
     * @type {TeamAdminMemberPledgedNotificationPayload}
     * @memberof TeamAdminMemberPledgedNotification
     */
    payload: TeamAdminMemberPledgedNotificationPayload;
}


/**
 * @export
 */
export const TeamAdminMemberPledgedNotificationTypeEnum = {
    TEAM_ADMIN_MEMBER_PLEDGED_NOTIFICATION: 'TeamAdminMemberPledgedNotification'
} as const;
export type TeamAdminMemberPledgedNotificationTypeEnum = typeof TeamAdminMemberPledgedNotificationTypeEnum[keyof typeof TeamAdminMemberPledgedNotificationTypeEnum];

/**
 * 
 * @export
 * @interface TeamAdminMemberPledgedNotificationPayload
 */
export interface TeamAdminMemberPledgedNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    team_member_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    team_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    pledge_amount: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    issue_url: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    issue_title: string;
    /**
     * 
     * @type {number}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    issue_number: number;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    issue_org_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    issue_repo_name: string;
    /**
     * 
     * @type {string}
     * @memberof TeamAdminMemberPledgedNotificationPayload
     */
    pledge_id: string;
}
/**
 * 
 * @export
 * @interface TokenResponse
 */
export interface TokenResponse {
    /**
     * 
     * @type {string}
     * @memberof TokenResponse
     */
    access_token: string;
    /**
     * 
     * @type {string}
     * @memberof TokenResponse
     */
    token_type: TokenResponseTokenTypeEnum;
    /**
     * 
     * @type {number}
     * @memberof TokenResponse
     */
    expires_in: number;
    /**
     * 
     * @type {string}
     * @memberof TokenResponse
     */
    refresh_token: string | null;
    /**
     * 
     * @type {string}
     * @memberof TokenResponse
     */
    scope: string;
    /**
     * 
     * @type {string}
     * @memberof TokenResponse
     */
    id_token: string;
}


/**
 * @export
 */
export const TokenResponseTokenTypeEnum = {
    BEARER: 'Bearer'
} as const;
export type TokenResponseTokenTypeEnum = typeof TokenResponseTokenTypeEnum[keyof typeof TokenResponseTokenTypeEnum];

/**
 * 
 * @export
 * @interface Transaction
 */
export interface Transaction {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Transaction
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    modified_at: string | null;
    /**
     * The ID of the object.
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
     * @type {PolarModelsTransactionPaymentProcessor}
     * @memberof Transaction
     */
    processor: PolarModelsTransactionPaymentProcessor | null;
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
     * @type {PlatformFeeType}
     * @memberof Transaction
     */
    platform_fee_type: PlatformFeeType | null;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    pledge_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    issue_reward_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    order_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    payout_transaction_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    incurred_by_transaction_id: string | null;
    /**
     * 
     * @type {TransactionPledge}
     * @memberof Transaction
     */
    pledge: TransactionPledge | null;
    /**
     * 
     * @type {TransactionIssueReward}
     * @memberof Transaction
     */
    issue_reward: TransactionIssueReward | null;
    /**
     * 
     * @type {TransactionOrder}
     * @memberof Transaction
     */
    order: TransactionOrder | null;
    /**
     * 
     * @type {Array<TransactionEmbedded>}
     * @memberof Transaction
     */
    account_incurred_transactions: Array<TransactionEmbedded>;
    /**
     * 
     * @type {number}
     * @memberof Transaction
     */
    incurred_amount: number;
    /**
     * 
     * @type {number}
     * @memberof Transaction
     */
    gross_amount: number;
    /**
     * 
     * @type {number}
     * @memberof Transaction
     */
    net_amount: number;
}


/**
 * 
 * @export
 * @interface TransactionDetails
 */
export interface TransactionDetails {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionDetails
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    modified_at: string | null;
    /**
     * The ID of the object.
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
     * @type {PolarModelsTransactionPaymentProcessor}
     * @memberof TransactionDetails
     */
    processor: PolarModelsTransactionPaymentProcessor | null;
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
     * @type {PlatformFeeType}
     * @memberof TransactionDetails
     */
    platform_fee_type: PlatformFeeType | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    pledge_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    issue_reward_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    order_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    payout_transaction_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    incurred_by_transaction_id: string | null;
    /**
     * 
     * @type {TransactionPledge}
     * @memberof TransactionDetails
     */
    pledge: TransactionPledge | null;
    /**
     * 
     * @type {TransactionIssueReward}
     * @memberof TransactionDetails
     */
    issue_reward: TransactionIssueReward | null;
    /**
     * 
     * @type {TransactionOrder}
     * @memberof TransactionDetails
     */
    order: TransactionOrder | null;
    /**
     * 
     * @type {Array<TransactionEmbedded>}
     * @memberof TransactionDetails
     */
    account_incurred_transactions: Array<TransactionEmbedded>;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    incurred_amount: number;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    gross_amount: number;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    net_amount: number;
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
 * @interface TransactionEmbedded
 */
export interface TransactionEmbedded {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionEmbedded
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof TransactionEmbedded
     */
    id: string;
    /**
     * 
     * @type {TransactionType}
     * @memberof TransactionEmbedded
     */
    type: TransactionType;
    /**
     * 
     * @type {PolarModelsTransactionPaymentProcessor}
     * @memberof TransactionEmbedded
     */
    processor: PolarModelsTransactionPaymentProcessor | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    currency: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionEmbedded
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    account_currency: string;
    /**
     * 
     * @type {number}
     * @memberof TransactionEmbedded
     */
    account_amount: number;
    /**
     * 
     * @type {PlatformFeeType}
     * @memberof TransactionEmbedded
     */
    platform_fee_type: PlatformFeeType | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    pledge_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    issue_reward_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    order_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    payout_transaction_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    incurred_by_transaction_id: string | null;
}


/**
 * 
 * @export
 * @interface TransactionExternalOrganization
 */
export interface TransactionExternalOrganization {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionExternalOrganization
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionExternalOrganization
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof TransactionExternalOrganization
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof TransactionExternalOrganization
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof TransactionExternalOrganization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionExternalOrganization
     */
    avatar_url: string;
    /**
     * 
     * @type {boolean}
     * @memberof TransactionExternalOrganization
     */
    is_personal: boolean;
}


/**
 * 
 * @export
 * @interface TransactionIssue
 */
export interface TransactionIssue {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionIssue
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssue
     */
    modified_at: string | null;
    /**
     * The ID of the object.
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
     * @type {TransactionExternalOrganization}
     * @memberof TransactionIssue
     */
    organization: TransactionExternalOrganization;
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
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionIssueReward
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionIssueReward
     */
    modified_at: string | null;
    /**
     * The ID of the object.
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
 * @interface TransactionOrder
 */
export interface TransactionOrder {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionOrder
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrder
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof TransactionOrder
     */
    id: string;
    /**
     * 
     * @type {TransactionProduct}
     * @memberof TransactionOrder
     */
    product: TransactionProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof TransactionOrder
     */
    product_price: ProductPrice;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrder
     */
    subscription_id: string | null;
}
/**
 * 
 * @export
 * @interface TransactionOrganization
 */
export interface TransactionOrganization {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionOrganization
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrganization
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof TransactionOrganization
     */
    id: string;
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
    slug: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrganization
     */
    avatar_url: string | null;
}
/**
 * 
 * @export
 * @interface TransactionPledge
 */
export interface TransactionPledge {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionPledge
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionPledge
     */
    modified_at: string | null;
    /**
     * The ID of the object.
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
 * @interface TransactionProduct
 */
export interface TransactionProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionProduct
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof TransactionProduct
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionProduct
     */
    organization_id: string | null;
    /**
     * 
     * @type {TransactionOrganization}
     * @memberof TransactionProduct
     */
    organization: TransactionOrganization | null;
}
/**
 * 
 * @export
 * @interface TransactionRepository
 */
export interface TransactionRepository {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionRepository
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionRepository
     */
    modified_at: string | null;
    /**
     * The ID of the object.
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
 */
export const TransactionSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    AMOUNT: 'amount',
    AMOUNT2: '-amount'
} as const;
export type TransactionSortProperty = typeof TransactionSortProperty[keyof typeof TransactionSortProperty];


/**
 * Type of transactions.
 * @export
 */
export const TransactionType = {
    PAYMENT: 'payment',
    PROCESSOR_FEE: 'processor_fee',
    REFUND: 'refund',
    DISPUTE: 'dispute',
    DISPUTE_REVERSAL: 'dispute_reversal',
    BALANCE: 'balance',
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
 * @interface Unauthorized
 */
export interface Unauthorized {
    /**
     * 
     * @type {string}
     * @memberof Unauthorized
     */
    error: UnauthorizedErrorEnum;
    /**
     * 
     * @type {string}
     * @memberof Unauthorized
     */
    detail: string;
}


/**
 * @export
 */
export const UnauthorizedErrorEnum = {
    UNAUTHORIZED: 'Unauthorized'
} as const;
export type UnauthorizedErrorEnum = typeof UnauthorizedErrorEnum[keyof typeof UnauthorizedErrorEnum];

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
    funding_goal?: CurrencyAmount | null;
    /**
     * 
     * @type {number}
     * @memberof UpdateIssue
     */
    upfront_split_to_contributors?: number | null;
    /**
     * 
     * @type {boolean}
     * @memberof UpdateIssue
     */
    set_upfront_split_to_contributors?: boolean | null;
}
/**
 * 
 * @export
 * @interface User
 */
export interface User {
    /**
     * 
     * @type {string}
     * @memberof User
     */
    public_name: string;
    /**
     * 
     * @type {string}
     * @memberof User
     */
    avatar_url: string | null;
}
/**
 * 
 * @export
 * @interface UserBase
 */
export interface UserBase {
    /**
     * 
     * @type {string}
     * @memberof UserBase
     */
    email: string;
    /**
     * 
     * @type {string}
     * @memberof UserBase
     */
    avatar_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserBase
     */
    account_id: string | null;
}
/**
 * 
 * @export
 * @interface UserInfoOrganization
 */
export interface UserInfoOrganization {
    /**
     * 
     * @type {string}
     * @memberof UserInfoOrganization
     */
    sub: string;
    /**
     * 
     * @type {string}
     * @memberof UserInfoOrganization
     */
    name?: string | null;
}
/**
 * 
 * @export
 * @interface UserInfoUser
 */
export interface UserInfoUser {
    /**
     * 
     * @type {string}
     * @memberof UserInfoUser
     */
    sub: string;
    /**
     * 
     * @type {string}
     * @memberof UserInfoUser
     */
    name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserInfoUser
     */
    email?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof UserInfoUser
     */
    email_verified?: boolean | null;
}
/**
 * 
 * @export
 * @interface UserRead
 */
export interface UserRead {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof UserRead
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    modified_at: string | null;
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
    avatar_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserRead
     */
    account_id: string | null;
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
     * @type {Array<OAuthAccountRead>}
     * @memberof UserRead
     */
    oauth_accounts: Array<OAuthAccountRead>;
}
/**
 * 
 * @export
 * @interface UserScopes
 */
export interface UserScopes {
    /**
     * 
     * @type {Array<Scope>}
     * @memberof UserScopes
     */
    scopes: Array<Scope>;
}
/**
 * 
 * @export
 * @interface UserSetAccount
 */
export interface UserSetAccount {
    /**
     * 
     * @type {string}
     * @memberof UserSetAccount
     */
    account_id: string;
}
/**
 * 
 * @export
 * @interface UserSignupAttribution
 */
export interface UserSignupAttribution {
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    intent?: UserSignupAttributionIntentEnum | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    order?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    subscription?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    pledge?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    from_storefront?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    path?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    host?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    utm_source?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    utm_medium?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSignupAttribution
     */
    utm_campaign?: string | null;
}


/**
 * @export
 */
export const UserSignupAttributionIntentEnum = {
    CREATOR: 'creator',
    PLEDGE: 'pledge',
    PURCHASE: 'purchase',
    SUBSCRIPTION: 'subscription',
    NEWSLETTER_SUBSCRIPTION: 'newsletter_subscription'
} as const;
export type UserSignupAttributionIntentEnum = typeof UserSignupAttributionIntentEnum[keyof typeof UserSignupAttributionIntentEnum];

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
 * @interface ValidatedLicenseKey
 */
export interface ValidatedLicenseKey {
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     * @deprecated
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    customer_id: string;
    /**
     * 
     * @type {LicenseKeyUser}
     * @memberof ValidatedLicenseKey
     */
    user: LicenseKeyUser;
    /**
     * 
     * @type {LicenseKeyCustomer}
     * @memberof ValidatedLicenseKey
     */
    customer: LicenseKeyCustomer;
    /**
     * The benefit ID.
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    key: string;
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    display_key: string;
    /**
     * 
     * @type {LicenseKeyStatus}
     * @memberof ValidatedLicenseKey
     */
    status: LicenseKeyStatus;
    /**
     * 
     * @type {number}
     * @memberof ValidatedLicenseKey
     */
    limit_activations: number | null;
    /**
     * 
     * @type {number}
     * @memberof ValidatedLicenseKey
     */
    usage: number;
    /**
     * 
     * @type {number}
     * @memberof ValidatedLicenseKey
     */
    limit_usage: number | null;
    /**
     * 
     * @type {number}
     * @memberof ValidatedLicenseKey
     */
    validations: number;
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    last_validated_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof ValidatedLicenseKey
     */
    expires_at: string | null;
    /**
     * 
     * @type {LicenseKeyActivationBase}
     * @memberof ValidatedLicenseKey
     */
    activation?: LicenseKeyActivationBase | null;
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
 * Sent when a new benefit is created.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookBenefitCreatedPayload
 */
export interface WebhookBenefitCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookBenefitCreatedPayload
     */
    type: WebhookBenefitCreatedPayloadTypeEnum;
    /**
     * 
     * @type {Benefit}
     * @memberof WebhookBenefitCreatedPayload
     */
    data: Benefit;
}


/**
 * @export
 */
export const WebhookBenefitCreatedPayloadTypeEnum = {
    BENEFIT_CREATED: 'benefit.created'
} as const;
export type WebhookBenefitCreatedPayloadTypeEnum = typeof WebhookBenefitCreatedPayloadTypeEnum[keyof typeof WebhookBenefitCreatedPayloadTypeEnum];

/**
 * Sent when a new benefit grant is created.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookBenefitGrantCreatedPayload
 */
export interface WebhookBenefitGrantCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookBenefitGrantCreatedPayload
     */
    type: WebhookBenefitGrantCreatedPayloadTypeEnum;
    /**
     * 
     * @type {BenefitGrantWebhook}
     * @memberof WebhookBenefitGrantCreatedPayload
     */
    data: BenefitGrantWebhook;
}


/**
 * @export
 */
export const WebhookBenefitGrantCreatedPayloadTypeEnum = {
    BENEFIT_GRANT_CREATED: 'benefit_grant.created'
} as const;
export type WebhookBenefitGrantCreatedPayloadTypeEnum = typeof WebhookBenefitGrantCreatedPayloadTypeEnum[keyof typeof WebhookBenefitGrantCreatedPayloadTypeEnum];

/**
 * Sent when a new benefit grant is revoked.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookBenefitGrantRevokedPayload
 */
export interface WebhookBenefitGrantRevokedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookBenefitGrantRevokedPayload
     */
    type: WebhookBenefitGrantRevokedPayloadTypeEnum;
    /**
     * 
     * @type {BenefitGrantWebhook}
     * @memberof WebhookBenefitGrantRevokedPayload
     */
    data: BenefitGrantWebhook;
}


/**
 * @export
 */
export const WebhookBenefitGrantRevokedPayloadTypeEnum = {
    BENEFIT_GRANT_REVOKED: 'benefit_grant.revoked'
} as const;
export type WebhookBenefitGrantRevokedPayloadTypeEnum = typeof WebhookBenefitGrantRevokedPayloadTypeEnum[keyof typeof WebhookBenefitGrantRevokedPayloadTypeEnum];

/**
 * Sent when a new benefit grant is updated.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookBenefitGrantUpdatedPayload
 */
export interface WebhookBenefitGrantUpdatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookBenefitGrantUpdatedPayload
     */
    type: WebhookBenefitGrantUpdatedPayloadTypeEnum;
    /**
     * 
     * @type {BenefitGrantWebhook}
     * @memberof WebhookBenefitGrantUpdatedPayload
     */
    data: BenefitGrantWebhook;
}


/**
 * @export
 */
export const WebhookBenefitGrantUpdatedPayloadTypeEnum = {
    BENEFIT_GRANT_UPDATED: 'benefit_grant.updated'
} as const;
export type WebhookBenefitGrantUpdatedPayloadTypeEnum = typeof WebhookBenefitGrantUpdatedPayloadTypeEnum[keyof typeof WebhookBenefitGrantUpdatedPayloadTypeEnum];

/**
 * Sent when a benefit is updated.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookBenefitUpdatedPayload
 */
export interface WebhookBenefitUpdatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookBenefitUpdatedPayload
     */
    type: WebhookBenefitUpdatedPayloadTypeEnum;
    /**
     * 
     * @type {Benefit}
     * @memberof WebhookBenefitUpdatedPayload
     */
    data: Benefit;
}


/**
 * @export
 */
export const WebhookBenefitUpdatedPayloadTypeEnum = {
    BENEFIT_UPDATED: 'benefit.updated'
} as const;
export type WebhookBenefitUpdatedPayloadTypeEnum = typeof WebhookBenefitUpdatedPayloadTypeEnum[keyof typeof WebhookBenefitUpdatedPayloadTypeEnum];

/**
 * Sent when a new checkout is created.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookCheckoutCreatedPayload
 */
export interface WebhookCheckoutCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookCheckoutCreatedPayload
     */
    type: WebhookCheckoutCreatedPayloadTypeEnum;
    /**
     * 
     * @type {Checkout}
     * @memberof WebhookCheckoutCreatedPayload
     */
    data: Checkout;
}


/**
 * @export
 */
export const WebhookCheckoutCreatedPayloadTypeEnum = {
    CHECKOUT_CREATED: 'checkout.created'
} as const;
export type WebhookCheckoutCreatedPayloadTypeEnum = typeof WebhookCheckoutCreatedPayloadTypeEnum[keyof typeof WebhookCheckoutCreatedPayloadTypeEnum];

/**
 * Sent when a checkout is updated.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookCheckoutUpdatedPayload
 */
export interface WebhookCheckoutUpdatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookCheckoutUpdatedPayload
     */
    type: WebhookCheckoutUpdatedPayloadTypeEnum;
    /**
     * 
     * @type {Checkout}
     * @memberof WebhookCheckoutUpdatedPayload
     */
    data: Checkout;
}


/**
 * @export
 */
export const WebhookCheckoutUpdatedPayloadTypeEnum = {
    CHECKOUT_UPDATED: 'checkout.updated'
} as const;
export type WebhookCheckoutUpdatedPayloadTypeEnum = typeof WebhookCheckoutUpdatedPayloadTypeEnum[keyof typeof WebhookCheckoutUpdatedPayloadTypeEnum];

/**
 * A webhook delivery for a webhook event.
 * @export
 * @interface WebhookDelivery
 */
export interface WebhookDelivery {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof WebhookDelivery
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookDelivery
     */
    modified_at: string | null;
    /**
     * The webhook delivery ID.
     * @type {string}
     * @memberof WebhookDelivery
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof WebhookDelivery
     */
    http_code?: number | null;
    /**
     * Whether the delivery was successful.
     * @type {boolean}
     * @memberof WebhookDelivery
     */
    succeeded: boolean;
    /**
     * 
     * @type {WebhookEvent}
     * @memberof WebhookDelivery
     */
    webhook_event: WebhookEvent;
}
/**
 * A webhook endpoint.
 * @export
 * @interface WebhookEndpoint
 */
export interface WebhookEndpoint {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    modified_at: string | null;
    /**
     * The webhook endpoint ID.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    id: string;
    /**
     * The URL where the webhook events will be sent.
     * @type {string}
     * @memberof WebhookEndpoint
     */
    url: string;
    /**
     * 
     * @type {WebhookFormat}
     * @memberof WebhookEndpoint
     */
    format: WebhookFormat;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    user_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    organization_id?: string | null;
    /**
     * The events that will trigger the webhook.
     * @type {Array<WebhookEventType>}
     * @memberof WebhookEndpoint
     */
    events: Array<WebhookEventType>;
}


/**
 * Schema to create a webhook endpoint.
 * @export
 * @interface WebhookEndpointCreate
 */
export interface WebhookEndpointCreate {
    /**
     * The URL where the webhook events will be sent.
     * @type {string}
     * @memberof WebhookEndpointCreate
     */
    url: string;
    /**
     * 
     * @type {WebhookFormat}
     * @memberof WebhookEndpointCreate
     */
    format: WebhookFormat;
    /**
     * The secret used to sign the webhook events.
     * @type {string}
     * @memberof WebhookEndpointCreate
     */
    secret: string;
    /**
     * The events that will trigger the webhook.
     * @type {Array<WebhookEventType>}
     * @memberof WebhookEndpointCreate
     */
    events: Array<WebhookEventType>;
    /**
     * The organization ID.
     * @type {string}
     * @memberof WebhookEndpointCreate
     */
    organization_id?: string | null;
}


/**
 * Schema to update a webhook endpoint.
 * @export
 * @interface WebhookEndpointUpdate
 */
export interface WebhookEndpointUpdate {
    /**
     * The URL where the webhook events will be sent.
     * @type {string}
     * @memberof WebhookEndpointUpdate
     */
    url?: string | null;
    /**
     * 
     * @type {WebhookFormat}
     * @memberof WebhookEndpointUpdate
     */
    format?: WebhookFormat | null;
    /**
     * The secret used to sign the webhook events.
     * @type {string}
     * @memberof WebhookEndpointUpdate
     */
    secret?: string | null;
    /**
     * The events that will trigger the webhook.
     * @type {Array<WebhookEventType>}
     * @memberof WebhookEndpointUpdate
     */
    events?: Array<WebhookEventType> | null;
}


/**
 * A webhook event.
 * 
 * An event represent something that happened in the system
 * that should be sent to the webhook endpoint.
 * 
 * It can be delivered multiple times until it's marked as succeeded,
 * each one creating a new delivery.
 * @export
 * @interface WebhookEvent
 */
export interface WebhookEvent {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof WebhookEvent
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookEvent
     */
    modified_at: string | null;
    /**
     * The webhook event ID.
     * @type {string}
     * @memberof WebhookEvent
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof WebhookEvent
     */
    last_http_code?: number | null;
    /**
     * 
     * @type {boolean}
     * @memberof WebhookEvent
     */
    succeeded?: boolean | null;
    /**
     * The payload of the webhook event.
     * @type {string}
     * @memberof WebhookEvent
     */
    payload: string;
}

/**
 * 
 * @export
 */
export const WebhookEventType = {
    CHECKOUT_CREATED: 'checkout.created',
    CHECKOUT_UPDATED: 'checkout.updated',
    ORDER_CREATED: 'order.created',
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    SUBSCRIPTION_ACTIVE: 'subscription.active',
    SUBSCRIPTION_CANCELED: 'subscription.canceled',
    SUBSCRIPTION_REVOKED: 'subscription.revoked',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    BENEFIT_CREATED: 'benefit.created',
    BENEFIT_UPDATED: 'benefit.updated',
    BENEFIT_GRANT_CREATED: 'benefit_grant.created',
    BENEFIT_GRANT_UPDATED: 'benefit_grant.updated',
    BENEFIT_GRANT_REVOKED: 'benefit_grant.revoked',
    ORGANIZATION_UPDATED: 'organization.updated',
    PLEDGE_CREATED: 'pledge.created',
    PLEDGE_UPDATED: 'pledge.updated'
} as const;
export type WebhookEventType = typeof WebhookEventType[keyof typeof WebhookEventType];


/**
 * 
 * @export
 */
export const WebhookFormat = {
    RAW: 'raw',
    DISCORD: 'discord',
    SLACK: 'slack'
} as const;
export type WebhookFormat = typeof WebhookFormat[keyof typeof WebhookFormat];

/**
 * Sent when a new order is created.
 * 
 * **Discord & Slack support:** Full
 * @export
 * @interface WebhookOrderCreatedPayload
 */
export interface WebhookOrderCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookOrderCreatedPayload
     */
    type: WebhookOrderCreatedPayloadTypeEnum;
    /**
     * 
     * @type {Order}
     * @memberof WebhookOrderCreatedPayload
     */
    data: Order;
}


/**
 * @export
 */
export const WebhookOrderCreatedPayloadTypeEnum = {
    ORDER_CREATED: 'order.created'
} as const;
export type WebhookOrderCreatedPayloadTypeEnum = typeof WebhookOrderCreatedPayloadTypeEnum[keyof typeof WebhookOrderCreatedPayloadTypeEnum];

/**
 * Sent when a organization is updated.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookOrganizationUpdatedPayload
 */
export interface WebhookOrganizationUpdatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookOrganizationUpdatedPayload
     */
    type: WebhookOrganizationUpdatedPayloadTypeEnum;
    /**
     * 
     * @type {Organization}
     * @memberof WebhookOrganizationUpdatedPayload
     */
    data: Organization;
}


/**
 * @export
 */
export const WebhookOrganizationUpdatedPayloadTypeEnum = {
    ORGANIZATION_UPDATED: 'organization.updated'
} as const;
export type WebhookOrganizationUpdatedPayloadTypeEnum = typeof WebhookOrganizationUpdatedPayloadTypeEnum[keyof typeof WebhookOrganizationUpdatedPayloadTypeEnum];

/**
 * Sent when a new pledge is created. Note that this does mean that the pledge has been paid yet.
 * 
 * **Discord & Slack support:** Full
 * @export
 * @interface WebhookPledgeCreatedPayload
 */
export interface WebhookPledgeCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookPledgeCreatedPayload
     */
    type: WebhookPledgeCreatedPayloadTypeEnum;
    /**
     * 
     * @type {Pledge}
     * @memberof WebhookPledgeCreatedPayload
     */
    data: Pledge;
}


/**
 * @export
 */
export const WebhookPledgeCreatedPayloadTypeEnum = {
    PLEDGE_CREATED: 'pledge.created'
} as const;
export type WebhookPledgeCreatedPayloadTypeEnum = typeof WebhookPledgeCreatedPayloadTypeEnum[keyof typeof WebhookPledgeCreatedPayloadTypeEnum];

/**
 * Sent when a pledge is updated.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookPledgeUpdatedPayload
 */
export interface WebhookPledgeUpdatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookPledgeUpdatedPayload
     */
    type: WebhookPledgeUpdatedPayloadTypeEnum;
    /**
     * 
     * @type {Pledge}
     * @memberof WebhookPledgeUpdatedPayload
     */
    data: Pledge;
}


/**
 * @export
 */
export const WebhookPledgeUpdatedPayloadTypeEnum = {
    PLEDGE_UPDATED: 'pledge.updated'
} as const;
export type WebhookPledgeUpdatedPayloadTypeEnum = typeof WebhookPledgeUpdatedPayloadTypeEnum[keyof typeof WebhookPledgeUpdatedPayloadTypeEnum];

/**
 * Sent when a new product is created.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookProductCreatedPayload
 */
export interface WebhookProductCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookProductCreatedPayload
     */
    type: WebhookProductCreatedPayloadTypeEnum;
    /**
     * 
     * @type {Product}
     * @memberof WebhookProductCreatedPayload
     */
    data: Product;
}


/**
 * @export
 */
export const WebhookProductCreatedPayloadTypeEnum = {
    PRODUCT_CREATED: 'product.created'
} as const;
export type WebhookProductCreatedPayloadTypeEnum = typeof WebhookProductCreatedPayloadTypeEnum[keyof typeof WebhookProductCreatedPayloadTypeEnum];

/**
 * Sent when a product is updated.
 * 
 * **Discord & Slack support:** Basic
 * @export
 * @interface WebhookProductUpdatedPayload
 */
export interface WebhookProductUpdatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookProductUpdatedPayload
     */
    type: WebhookProductUpdatedPayloadTypeEnum;
    /**
     * 
     * @type {Product}
     * @memberof WebhookProductUpdatedPayload
     */
    data: Product;
}


/**
 * @export
 */
export const WebhookProductUpdatedPayloadTypeEnum = {
    PRODUCT_UPDATED: 'product.updated'
} as const;
export type WebhookProductUpdatedPayloadTypeEnum = typeof WebhookProductUpdatedPayloadTypeEnum[keyof typeof WebhookProductUpdatedPayloadTypeEnum];

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
    message?: string | null;
    /**
     * 
     * @type {string}
     * @memberof WebhookResponse
     */
    job_id?: string | null;
}
/**
 * Sent when a subscription becomes active,
 * whether because it's a new paid subscription or because payment was recovered.
 * 
 * **Discord & Slack support:** Full
 * @export
 * @interface WebhookSubscriptionActivePayload
 */
export interface WebhookSubscriptionActivePayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookSubscriptionActivePayload
     */
    type: WebhookSubscriptionActivePayloadTypeEnum;
    /**
     * 
     * @type {Subscription}
     * @memberof WebhookSubscriptionActivePayload
     */
    data: Subscription;
}


/**
 * @export
 */
export const WebhookSubscriptionActivePayloadTypeEnum = {
    SUBSCRIPTION_ACTIVE: 'subscription.active'
} as const;
export type WebhookSubscriptionActivePayloadTypeEnum = typeof WebhookSubscriptionActivePayloadTypeEnum[keyof typeof WebhookSubscriptionActivePayloadTypeEnum];

/**
 * Sent when a subscription is canceled by the user.
 * They might still have access until the end of the current period.
 * 
 * **Discord & Slack support:** Full
 * @export
 * @interface WebhookSubscriptionCanceledPayload
 */
export interface WebhookSubscriptionCanceledPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookSubscriptionCanceledPayload
     */
    type: WebhookSubscriptionCanceledPayloadTypeEnum;
    /**
     * 
     * @type {Subscription}
     * @memberof WebhookSubscriptionCanceledPayload
     */
    data: Subscription;
}


/**
 * @export
 */
export const WebhookSubscriptionCanceledPayloadTypeEnum = {
    SUBSCRIPTION_CANCELED: 'subscription.canceled'
} as const;
export type WebhookSubscriptionCanceledPayloadTypeEnum = typeof WebhookSubscriptionCanceledPayloadTypeEnum[keyof typeof WebhookSubscriptionCanceledPayloadTypeEnum];

/**
 * Sent when a new subscription is created.
 * 
 * **Discord & Slack support:** Full
 * @export
 * @interface WebhookSubscriptionCreatedPayload
 */
export interface WebhookSubscriptionCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookSubscriptionCreatedPayload
     */
    type: WebhookSubscriptionCreatedPayloadTypeEnum;
    /**
     * 
     * @type {Subscription}
     * @memberof WebhookSubscriptionCreatedPayload
     */
    data: Subscription;
}


/**
 * @export
 */
export const WebhookSubscriptionCreatedPayloadTypeEnum = {
    SUBSCRIPTION_CREATED: 'subscription.created'
} as const;
export type WebhookSubscriptionCreatedPayloadTypeEnum = typeof WebhookSubscriptionCreatedPayloadTypeEnum[keyof typeof WebhookSubscriptionCreatedPayloadTypeEnum];

/**
 * Sent when a subscription is revoked, the user looses access immediately.
 * Happens when the subscription is canceled, or payment is past due.
 * 
 * **Discord & Slack support:** Full
 * @export
 * @interface WebhookSubscriptionRevokedPayload
 */
export interface WebhookSubscriptionRevokedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookSubscriptionRevokedPayload
     */
    type: WebhookSubscriptionRevokedPayloadTypeEnum;
    /**
     * 
     * @type {Subscription}
     * @memberof WebhookSubscriptionRevokedPayload
     */
    data: Subscription;
}


/**
 * @export
 */
export const WebhookSubscriptionRevokedPayloadTypeEnum = {
    SUBSCRIPTION_REVOKED: 'subscription.revoked'
} as const;
export type WebhookSubscriptionRevokedPayloadTypeEnum = typeof WebhookSubscriptionRevokedPayloadTypeEnum[keyof typeof WebhookSubscriptionRevokedPayloadTypeEnum];

/**
 * Sent when a subscription is updated. This event fires for all changes to the subscription, including renewals.
 * 
 * If you want more specific events, you can listen to `subscription.active`, `subscription.canceled`, and `subscription.revoked`.
 * 
 * To listen specifically for renewals, you can listen to `order.created` events and check the `billing_reason` field.
 * 
 * **Discord & Slack support:** On cancellation and revocation. Renewals are skipped.
 * @export
 * @interface WebhookSubscriptionUpdatedPayload
 */
export interface WebhookSubscriptionUpdatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookSubscriptionUpdatedPayload
     */
    type: WebhookSubscriptionUpdatedPayloadTypeEnum;
    /**
     * 
     * @type {Subscription}
     * @memberof WebhookSubscriptionUpdatedPayload
     */
    data: Subscription;
}


/**
 * @export
 */
export const WebhookSubscriptionUpdatedPayloadTypeEnum = {
    SUBSCRIPTION_UPDATED: 'subscription.updated'
} as const;
export type WebhookSubscriptionUpdatedPayloadTypeEnum = typeof WebhookSubscriptionUpdatedPayloadTypeEnum[keyof typeof WebhookSubscriptionUpdatedPayloadTypeEnum];

