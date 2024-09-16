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
    type: AlreadyCanceledSubscriptionTypeEnum;
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
export const AlreadyCanceledSubscriptionTypeEnum = {
    ALREADY_CANCELED_SUBSCRIPTION: 'AlreadyCanceledSubscription'
} as const;
export type AlreadyCanceledSubscriptionTypeEnum = typeof AlreadyCanceledSubscriptionTypeEnum[keyof typeof AlreadyCanceledSubscriptionTypeEnum];

/**
 * 
 * @export
 * @interface AlreadySubscribed
 */
export interface AlreadySubscribed {
    /**
     * 
     * @type {string}
     * @memberof AlreadySubscribed
     */
    type: AlreadySubscribedTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof AlreadySubscribed
     */
    detail: string;
}


/**
 * @export
 */
export const AlreadySubscribedTypeEnum = {
    ALREADY_SUBSCRIBED: 'AlreadySubscribed'
} as const;
export type AlreadySubscribedTypeEnum = typeof AlreadySubscribedTypeEnum[keyof typeof AlreadySubscribedTypeEnum];

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
     * @type {BylineProfile}
     * @memberof Article
     */
    byline: BylineProfile;
    /**
     * 
     * @type {ArticleVisibility}
     * @memberof Article
     */
    visibility: ArticleVisibility;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    user_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    organization_id: string;
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
    published_at: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof Article
     */
    paid_subscribers_only: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    paid_subscribers_only_ends_at: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof Article
     */
    is_preview: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Article
     */
    is_pinned: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Article
     */
    notify_subscribers: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    notifications_sent_at: string | null;
    /**
     * 
     * @type {number}
     * @memberof Article
     */
    email_sent_to_count: number | null;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    og_image_url: string | null;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    og_description: string | null;
}



/**
 * 
 * @export
 */
export const ArticleByline = {
    USER: 'user',
    ORGANIZATION: 'organization'
} as const;
export type ArticleByline = typeof ArticleByline[keyof typeof ArticleByline];

/**
 * 
 * @export
 * @interface ArticleCreate
 */
export interface ArticleCreate {
    /**
     * Title of the article.
     * @type {string}
     * @memberof ArticleCreate
     */
    title: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    slug?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    body?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    body_base64?: string | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof ArticleCreate
     */
    organization_id?: string | null;
    /**
     * If the user or organization should be credited in the byline.
     * @type {ArticleByline}
     * @memberof ArticleCreate
     */
    byline?: ArticleByline;
    /**
     * 
     * @type {ArticleVisibility}
     * @memberof ArticleCreate
     */
    visibility?: ArticleVisibility;
    /**
     * Set to true to only make this article available for subscribers to a paid subscription tier in the organization.
     * @type {boolean}
     * @memberof ArticleCreate
     */
    paid_subscribers_only?: boolean;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    paid_subscribers_only_ends_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    published_at?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleCreate
     */
    notify_subscribers?: boolean | null;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleCreate
     */
    is_pinned?: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    og_image_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    og_description?: string | null;
}


/**
 * 
 * @export
 * @interface ArticlePreview
 */
export interface ArticlePreview {
    /**
     * Email address to send the preview to. The user must be registered on Polar.
     * @type {string}
     * @memberof ArticlePreview
     */
    email: string;
}
/**
 * 
 * @export
 * @interface ArticleReceivers
 */
export interface ArticleReceivers {
    /**
     * 
     * @type {number}
     * @memberof ArticleReceivers
     */
    free_subscribers: number;
    /**
     * 
     * @type {number}
     * @memberof ArticleReceivers
     */
    premium_subscribers: number;
    /**
     * 
     * @type {number}
     * @memberof ArticleReceivers
     */
    organization_members: number;
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
    title?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    body?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    body_base64?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    slug?: string | null;
    /**
     * 
     * @type {ArticleByline}
     * @memberof ArticleUpdate
     */
    byline?: ArticleByline | null;
    /**
     * 
     * @type {ArticleVisibility}
     * @memberof ArticleUpdate
     */
    visibility?: ArticleVisibility | null;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    paid_subscribers_only?: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    paid_subscribers_only_ends_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    published_at?: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    notify_subscribers?: boolean | null;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    is_pinned?: boolean | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    og_image_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    og_description?: string | null;
}



/**
 * 
 * @export
 */
export const ArticleVisibility = {
    PUBLIC: 'public',
    HIDDEN: 'hidden',
    PRIVATE: 'private'
} as const;
export type ArticleVisibility = typeof ArticleVisibility[keyof typeof ArticleVisibility];

/**
 * @type ArticleVisibilityFilter
 * Filter by visibility.
 * @export
 */
export type ArticleVisibilityFilter = Array<ArticleVisibility> | ArticleVisibility;

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
    username: string;
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
    PRODUCTSREAD: 'products:read',
    PRODUCTSWRITE: 'products:write',
    BENEFITSREAD: 'benefits:read',
    BENEFITSWRITE: 'benefits:write',
    FILESREAD: 'files:read',
    FILESWRITE: 'files:write',
    SUBSCRIPTIONSREAD: 'subscriptions:read',
    SUBSCRIPTIONSWRITE: 'subscriptions:write',
    ORDERSREAD: 'orders:read',
    METRICSREAD: 'metrics:read',
    ARTICLESREAD: 'articles:read',
    ARTICLESWRITE: 'articles:write',
    WEBHOOKSREAD: 'webhooks:read',
    WEBHOOKSWRITE: 'webhooks:write',
    EXTERNAL_ORGANIZATIONSREAD: 'external_organizations:read',
    LICENSE_KEYSREAD: 'license_keys:read',
    LICENSE_KEYSWRITE: 'license_keys:write',
    REPOSITORIESREAD: 'repositories:read',
    REPOSITORIESWRITE: 'repositories:write',
    ISSUESREAD: 'issues:read',
    ISSUESWRITE: 'issues:write',
    USERBENEFITSREAD: 'user:benefits:read',
    USERORDERSREAD: 'user:orders:read',
    USERSUBSCRIPTIONSREAD: 'user:subscriptions:read',
    USERSUBSCRIPTIONSWRITE: 'user:subscriptions:write',
    USERDOWNLOADABLESREAD: 'user:downloadables:read',
    USERLICENSE_KEYSREAD: 'user:license_keys:read',
    USERADVERTISEMENT_CAMPAIGNSREAD: 'user:advertisement_campaigns:read',
    USERADVERTISEMENT_CAMPAIGNSWRITE: 'user:advertisement_campaigns:write'
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
     * Current state of the pledge
     * @type {PledgeState}
     * @memberof BackofficePledge
     */
    state: PledgeState;
    /**
     * Type of pledge
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
     * The issue that the pledge was made towards
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
     * The pledge that the reward was split from
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
export type Benefit = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository | BenefitLicenseKeys;

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
     * @type {BenefitAdsProperties}
     * @memberof BenefitAdsSubscriber
     */
    properties: BenefitAdsProperties;
    /**
     * 
     * @type {Array<BenefitGrantAds>}
     * @memberof BenefitAdsSubscriber
     */
    grants: Array<BenefitGrantAds>;
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
 * A benefit of type `articles`.
 * 
 * Use it to grant access to posts.
 * @export
 * @interface BenefitArticles
 */
export interface BenefitArticles {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitArticles
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitArticles
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitArticles
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitArticles
     */
    type: BenefitArticlesTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitArticles
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitArticles
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitArticles
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitArticles
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitArticlesProperties}
     * @memberof BenefitArticles
     */
    properties: BenefitArticlesProperties;
}


/**
 * @export
 */
export const BenefitArticlesTypeEnum = {
    ARTICLES: 'articles'
} as const;
export type BenefitArticlesTypeEnum = typeof BenefitArticlesTypeEnum[keyof typeof BenefitArticlesTypeEnum];

/**
 * Properties for a benefit of type `articles`.
 * @export
 * @interface BenefitArticlesProperties
 */
export interface BenefitArticlesProperties {
    /**
     * Whether the user can access paid articles.
     * @type {boolean}
     * @memberof BenefitArticlesProperties
     */
    paid_articles: boolean;
}
/**
 * 
 * @export
 * @interface BenefitArticlesSubscriber
 */
export interface BenefitArticlesSubscriber {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitArticlesSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitArticlesSubscriber
     */
    modified_at: string | null;
    /**
     * The ID of the benefit.
     * @type {string}
     * @memberof BenefitArticlesSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitArticlesSubscriber
     */
    type: BenefitArticlesSubscriberTypeEnum;
    /**
     * The description of the benefit.
     * @type {string}
     * @memberof BenefitArticlesSubscriber
     */
    description: string;
    /**
     * Whether the benefit is selectable when creating a product.
     * @type {boolean}
     * @memberof BenefitArticlesSubscriber
     */
    selectable: boolean;
    /**
     * Whether the benefit is deletable.
     * @type {boolean}
     * @memberof BenefitArticlesSubscriber
     */
    deletable: boolean;
    /**
     * The ID of the organization owning the benefit.
     * @type {string}
     * @memberof BenefitArticlesSubscriber
     */
    organization_id: string;
    /**
     * 
     * @type {BenefitArticlesSubscriberProperties}
     * @memberof BenefitArticlesSubscriber
     */
    properties: BenefitArticlesSubscriberProperties;
}


/**
 * @export
 */
export const BenefitArticlesSubscriberTypeEnum = {
    ARTICLES: 'articles'
} as const;
export type BenefitArticlesSubscriberTypeEnum = typeof BenefitArticlesSubscriberTypeEnum[keyof typeof BenefitArticlesSubscriberTypeEnum];

/**
 * Properties available to subscribers for a benefit of type `articles`.
 * @export
 * @interface BenefitArticlesSubscriberProperties
 */
export interface BenefitArticlesSubscriberProperties {
    /**
     * Whether the user can access paid articles.
     * @type {boolean}
     * @memberof BenefitArticlesSubscriberProperties
     */
    paid_articles: boolean;
}
/**
 * 
 * @export
 * @interface BenefitArticlesUpdate
 */
export interface BenefitArticlesUpdate {
    /**
     * 
     * @type {string}
     * @memberof BenefitArticlesUpdate
     */
    description?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitArticlesUpdate
     */
    type: BenefitArticlesUpdateTypeEnum;
}


/**
 * @export
 */
export const BenefitArticlesUpdateTypeEnum = {
    ARTICLES: 'articles'
} as const;
export type BenefitArticlesUpdateTypeEnum = typeof BenefitArticlesUpdateTypeEnum[keyof typeof BenefitArticlesUpdateTypeEnum];

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
     * The type of the benefit.
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
     * Whether the benefit is taxable.
     * @type {boolean}
     * @memberof BenefitCustom
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
     * Whether the benefit is taxable.
     * @type {boolean}
     * @memberof BenefitCustomCreate
     */
    is_tax_applicable: boolean;
    /**
     * 
     * @type {BenefitCustomProperties}
     * @memberof BenefitCustomCreate
     */
    properties: BenefitCustomProperties;
}


/**
 * @export
 */
export const BenefitCustomCreateTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type BenefitCustomCreateTypeEnum = typeof BenefitCustomCreateTypeEnum[keyof typeof BenefitCustomCreateTypeEnum];

/**
 * Properties for a benefit of type `custom`.
 * @export
 * @interface BenefitCustomProperties
 */
export interface BenefitCustomProperties {
    /**
     * 
     * @type {BenefitCustomPropertiesNote}
     * @memberof BenefitCustomProperties
     */
    note: BenefitCustomPropertiesNote | null;
}
/**
 * @type BenefitCustomPropertiesNote
 * Private note to be shared with users who have this benefit granted.
 * @export
 */
export type BenefitCustomPropertiesNote = string;

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
     * @type {Array<BenefitGrant>}
     * @memberof BenefitCustomSubscriber
     */
    grants: Array<BenefitGrant>;
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
     * @type {BenefitCustomPropertiesNote}
     * @memberof BenefitCustomSubscriberProperties
     */
    note: BenefitCustomPropertiesNote | null;
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
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    repository_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    repository_owner?: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    repository_name?: string | null;
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
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryProperties
     */
    repository_id: string | null;
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
 * A grant of a benefit to a user.
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
     * The properties of the grant.
     * @type {object}
     * @memberof BenefitGrant
     */
    properties: object;
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
     * The ID of the user concerned by this grant.
     * @type {string}
     * @memberof BenefitGrant
     */
    user_id: string;
    /**
     * The ID of the benefit concerned by this grant.
     * @type {string}
     * @memberof BenefitGrant
     */
    benefit_id: string;
}
/**
 * 
 * @export
 * @interface BenefitGrantAds
 */
export interface BenefitGrantAds {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitGrantAds
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantAds
     */
    modified_at: string | null;
    /**
     * The ID of the grant.
     * @type {string}
     * @memberof BenefitGrantAds
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantAds
     */
    granted_at?: string | null;
    /**
     * Whether the benefit is granted.
     * @type {boolean}
     * @memberof BenefitGrantAds
     */
    is_granted: boolean;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantAds
     */
    revoked_at?: string | null;
    /**
     * Whether the benefit is revoked.
     * @type {boolean}
     * @memberof BenefitGrantAds
     */
    is_revoked: boolean;
    /**
     * 
     * @type {BenefitGrantAdsProperties}
     * @memberof BenefitGrantAds
     */
    properties: BenefitGrantAdsProperties;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantAds
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantAds
     */
    order_id: string | null;
    /**
     * The ID of the user concerned by this grant.
     * @type {string}
     * @memberof BenefitGrantAds
     */
    user_id: string;
    /**
     * The ID of the benefit concerned by this grant.
     * @type {string}
     * @memberof BenefitGrantAds
     */
    benefit_id: string;
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
    advertisement_campaign_id?: string | null;
}
/**
 * 
 * @export
 * @interface BenefitGrantLicenseKeys
 */
export interface BenefitGrantLicenseKeys {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    modified_at: string | null;
    /**
     * The ID of the grant.
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    granted_at?: string | null;
    /**
     * Whether the benefit is granted.
     * @type {boolean}
     * @memberof BenefitGrantLicenseKeys
     */
    is_granted: boolean;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    revoked_at?: string | null;
    /**
     * Whether the benefit is revoked.
     * @type {boolean}
     * @memberof BenefitGrantLicenseKeys
     */
    is_revoked: boolean;
    /**
     * 
     * @type {BenefitGrantLicenseKeysProperties}
     * @memberof BenefitGrantLicenseKeys
     */
    properties: BenefitGrantLicenseKeysProperties;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    subscription_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    order_id: string | null;
    /**
     * The ID of the user concerned by this grant.
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    user_id: string;
    /**
     * The ID of the benefit concerned by this grant.
     * @type {string}
     * @memberof BenefitGrantLicenseKeys
     */
    benefit_id: string;
}
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
    license_key_id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantLicenseKeysProperties
     */
    display_key: string;
}
/**
 * @type BenefitIDFilter
 * Filter by given benefit ID. 
 * @export
 */
export type BenefitIDFilter = Array<string> | string;

/**
 * @type BenefitIDFilter1
 * Filter products granting specific benefit.
 * @export
 */
export type BenefitIDFilter1 = Array<string> | string;

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
    enable_user_admin: boolean;
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
     * @type {BenefitLicenseKeysSubscriberProperties}
     * @memberof BenefitLicenseKeysSubscriber
     */
    properties: BenefitLicenseKeysSubscriberProperties;
    /**
     * 
     * @type {Array<BenefitGrantLicenseKeys>}
     * @memberof BenefitLicenseKeysSubscriber
     */
    grants: Array<BenefitGrantLicenseKeys>;
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
 * @interface BenefitPreconditionErrorNotification
 */
export interface BenefitPreconditionErrorNotification {
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotification
     */
    type: BenefitPreconditionErrorNotificationTypeEnum;
    /**
     * 
     * @type {BenefitPreconditionErrorNotificationPayload}
     * @memberof BenefitPreconditionErrorNotification
     */
    payload: BenefitPreconditionErrorNotificationPayload;
}


/**
 * @export
 */
export const BenefitPreconditionErrorNotificationTypeEnum = {
    BENEFIT_PRECONDITION_ERROR_NOTIFICATION: 'BenefitPreconditionErrorNotification'
} as const;
export type BenefitPreconditionErrorNotificationTypeEnum = typeof BenefitPreconditionErrorNotificationTypeEnum[keyof typeof BenefitPreconditionErrorNotificationTypeEnum];

/**
 * 
 * @export
 * @interface BenefitPreconditionErrorNotificationPayload
 */
export interface BenefitPreconditionErrorNotificationPayload {
    /**
     * 
     * @type {object}
     * @memberof BenefitPreconditionErrorNotificationPayload
     */
    extra_context?: object;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotificationPayload
     */
    subject_template: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotificationPayload
     */
    body_template: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotificationPayload
     */
    scope_name: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotificationPayload
     */
    benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotificationPayload
     */
    benefit_description: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitPreconditionErrorNotificationPayload
     */
    organization_name: string;
}
/**
 * @type BenefitPublicInner
 * @export
 */
export type BenefitPublicInner = BenefitArticles | BenefitBase;


/**
 * 
 * @export
 */
export const BenefitType = {
    CUSTOM: 'custom',
    ARTICLES: 'articles',
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
export type BenefitUpdate = BenefitAdsUpdate | BenefitArticlesUpdate | BenefitCustomUpdate | BenefitDiscordUpdate | BenefitDownloadablesUpdate | BenefitGitHubRepositoryUpdate | BenefitLicenseKeysUpdate;

/**
 * 
 * @export
 * @interface BylineProfile
 */
export interface BylineProfile {
    /**
     * 
     * @type {string}
     * @memberof BylineProfile
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof BylineProfile
     */
    avatar_url: string | null;
}
/**
 * A checkout session.
 * @export
 * @interface Checkout
 */
export interface Checkout {
    /**
     * The ID of the checkout.
     * @type {string}
     * @memberof Checkout
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    customer_email: string | null;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    customer_name: string | null;
    /**
     * 
     * @type {Product}
     * @memberof Checkout
     */
    product: Product;
    /**
     * 
     * @type {ProductPrice}
     * @memberof Checkout
     */
    product_price: ProductPrice;
}
/**
 * 
 * @export
 * @interface CheckoutCreate
 */
export interface CheckoutCreate {
    /**
     * ID of the product price to subscribe to.
     * @type {string}
     * @memberof CheckoutCreate
     */
    product_price_id: string;
    /**
     * URL where the customer will be redirected after a successful subscription. You can add the `session_id={CHECKOUT_SESSION_ID}` query parameter to retrieve the checkout session id.
     * @type {string}
     * @memberof CheckoutCreate
     */
    success_url: string;
    /**
     * 
     * @type {string}
     * @memberof CheckoutCreate
     */
    customer_email?: string | null;
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
 * 
 * @export
 * @interface Donation
 */
export interface Donation {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof Donation
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof Donation
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof Donation
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof Donation
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof Donation
     */
    currency: string;
    /**
     * 
     * @type {string}
     * @memberof Donation
     */
    message: string | null;
    /**
     * 
     * @type {Donor}
     * @memberof Donation
     */
    donor: Donor | null;
    /**
     * 
     * @type {string}
     * @memberof Donation
     */
    email: string;
    /**
     * 
     * @type {Issue}
     * @memberof Donation
     */
    issue: Issue | null;
}
/**
 * 
 * @export
 * @interface DonationCreateStripePaymentIntent
 */
export interface DonationCreateStripePaymentIntent {
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    to_organization_id: string;
    /**
     * The donators email address. Receipts will be sent to this address.
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    email: string;
    /**
     * The amount in cents.
     * @type {number}
     * @memberof DonationCreateStripePaymentIntent
     */
    amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    currency?: string;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    setup_future_usage?: DonationCreateStripePaymentIntentSetupFutureUsageEnum | null;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    on_behalf_of_organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    message?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    issue_id?: string | null;
}


/**
 * @export
 */
export const DonationCreateStripePaymentIntentSetupFutureUsageEnum = {
    ON_SESSION: 'on_session'
} as const;
export type DonationCreateStripePaymentIntentSetupFutureUsageEnum = typeof DonationCreateStripePaymentIntentSetupFutureUsageEnum[keyof typeof DonationCreateStripePaymentIntentSetupFutureUsageEnum];

/**
 * 
 * @export
 * @interface DonationOrganization
 */
export interface DonationOrganization {
    /**
     * 
     * @type {string}
     * @memberof DonationOrganization
     */
    id: string;
    /**
     * 
     * @type {Platforms}
     * @memberof DonationOrganization
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof DonationOrganization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof DonationOrganization
     */
    avatar_url: string;
    /**
     * 
     * @type {boolean}
     * @memberof DonationOrganization
     */
    is_personal: boolean;
}



/**
 * 
 * @export
 */
export const DonationSortProperty = {
    AMOUNT: 'amount',
    AMOUNT2: '-amount',
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at'
} as const;
export type DonationSortProperty = typeof DonationSortProperty[keyof typeof DonationSortProperty];

/**
 * 
 * @export
 * @interface DonationStatistics
 */
export interface DonationStatistics {
    /**
     * 
     * @type {Array<DonationStatisticsPeriod>}
     * @memberof DonationStatistics
     */
    periods: Array<DonationStatisticsPeriod>;
}
/**
 * 
 * @export
 * @interface DonationStatisticsPeriod
 */
export interface DonationStatisticsPeriod {
    /**
     * 
     * @type {string}
     * @memberof DonationStatisticsPeriod
     */
    start_date: string;
    /**
     * 
     * @type {string}
     * @memberof DonationStatisticsPeriod
     */
    end_date: string;
    /**
     * 
     * @type {number}
     * @memberof DonationStatisticsPeriod
     */
    sum: number;
}
/**
 * 
 * @export
 * @interface DonationStripePaymentIntentMutationResponse
 */
export interface DonationStripePaymentIntentMutationResponse {
    /**
     * 
     * @type {string}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    payment_intent_id: string;
    /**
     * 
     * @type {number}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    currency: string;
    /**
     * 
     * @type {string}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    client_secret: string | null;
}
/**
 * 
 * @export
 * @interface DonationUpdateStripePaymentIntent
 */
export interface DonationUpdateStripePaymentIntent {
    /**
     * The donators email address. Receipts will be sent to this address.
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    email: string;
    /**
     * The amount in cents.
     * @type {number}
     * @memberof DonationUpdateStripePaymentIntent
     */
    amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    currency?: string;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    setup_future_usage?: DonationUpdateStripePaymentIntentSetupFutureUsageEnum | null;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    on_behalf_of_organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    message?: string | null;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    issue_id?: string | null;
}


/**
 * @export
 */
export const DonationUpdateStripePaymentIntentSetupFutureUsageEnum = {
    ON_SESSION: 'on_session'
} as const;
export type DonationUpdateStripePaymentIntentSetupFutureUsageEnum = typeof DonationUpdateStripePaymentIntentSetupFutureUsageEnum[keyof typeof DonationUpdateStripePaymentIntentSetupFutureUsageEnum];

/**
 * 
 * @export
 * @interface DonationUser
 */
export interface DonationUser {
    /**
     * 
     * @type {string}
     * @memberof DonationUser
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof DonationUser
     */
    public_name: string;
    /**
     * 
     * @type {string}
     * @memberof DonationUser
     */
    avatar_url: string | null;
}
/**
 * @type Donor
 * @export
 */
export type Donor = DonationOrganization | DonationUser;

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
     * 
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
     * @type {Array<IssueReferenceRead>}
     * @memberof Entry
     */
    references: Array<IssueReferenceRead> | null;
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
    branch_name?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ExternalGitHubCommitReference
     */
    message?: string | null;
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
     * 
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
 * @interface FileNotFound
 */
export interface FileNotFound {
    /**
     * 
     * @type {string}
     * @memberof FileNotFound
     */
    type: FileNotFoundTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof FileNotFound
     */
    detail: string;
}


/**
 * @export
 */
export const FileNotFoundTypeEnum = {
    FILE_NOT_FOUND: 'FileNotFound'
} as const;
export type FileNotFoundTypeEnum = typeof FileNotFoundTypeEnum[keyof typeof FileNotFoundTypeEnum];

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
     * 
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
 * @interface FreeSubscriptionUpgrade
 */
export interface FreeSubscriptionUpgrade {
    /**
     * 
     * @type {string}
     * @memberof FreeSubscriptionUpgrade
     */
    type: FreeSubscriptionUpgradeTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof FreeSubscriptionUpgrade
     */
    detail: string;
}


/**
 * @export
 */
export const FreeSubscriptionUpgradeTypeEnum = {
    FREE_SUBSCRIPTION_UPGRADE: 'FreeSubscriptionUpgrade'
} as const;
export type FreeSubscriptionUpgradeTypeEnum = typeof FreeSubscriptionUpgradeTypeEnum[keyof typeof FreeSubscriptionUpgradeTypeEnum];

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
     * Issue platform (currently always GitHub)
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
     * The repository that the issue is in
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
    pull_request_reference?: PullRequestReference | null;
    /**
     * 
     * @type {ExternalGitHubPullRequestReference}
     * @memberof IssueReferenceRead
     */
    external_github_pull_request_reference?: ExternalGitHubPullRequestReference | null;
    /**
     * 
     * @type {ExternalGitHubCommitReference}
     * @memberof IssueReferenceRead
     */
    external_github_commit_reference?: ExternalGitHubCommitReference | null;
}



/**
 * 
 * @export
 */
export const IssueReferenceType = {
    PULL_REQUEST: 'pull_request',
    EXTERNAL_GITHUB_PULL_REQUEST: 'external_github_pull_request',
    EXTERNAL_GITHUB_COMMIT: 'external_github_commit'
} as const;
export type IssueReferenceType = typeof IssueReferenceType[keyof typeof IssueReferenceType];


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
     */
    user_id: string;
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
    user_id?: string | null;
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
     */
    user_id: string;
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
 * @interface ListResourceArticle
 */
export interface ListResourceArticle {
    /**
     * 
     * @type {Array<Article>}
     * @memberof ListResourceArticle
     */
    items: Array<Article>;
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
 * @interface ListResourceDonation
 */
export interface ListResourceDonation {
    /**
     * 
     * @type {Array<Donation>}
     * @memberof ListResourceDonation
     */
    items: Array<Donation>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceDonation
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
 * @interface ListResourceOrganizationCustomer
 */
export interface ListResourceOrganizationCustomer {
    /**
     * 
     * @type {Array<OrganizationCustomer>}
     * @memberof ListResourceOrganizationCustomer
     */
    items: Array<OrganizationCustomer>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceOrganizationCustomer
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
 * @interface ListResourcePublicDonation
 */
export interface ListResourcePublicDonation {
    /**
     * 
     * @type {Array<PublicDonation>}
     * @memberof ListResourcePublicDonation
     */
    items: Array<PublicDonation>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourcePublicDonation
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
    items: Array<PullRequest>;
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
 * @interface ListResourceTrafficReferrer
 */
export interface ListResourceTrafficReferrer {
    /**
     * 
     * @type {Array<TrafficReferrer>}
     * @memberof ListResourceTrafficReferrer
     */
    items: Array<TrafficReferrer>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceTrafficReferrer
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
 * @interface ListResourceUserAdvertisementCampaign
 */
export interface ListResourceUserAdvertisementCampaign {
    /**
     * 
     * @type {Array<UserAdvertisementCampaign>}
     * @memberof ListResourceUserAdvertisementCampaign
     */
    items: Array<UserAdvertisementCampaign>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceUserAdvertisementCampaign
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceUserBenefit
 */
export interface ListResourceUserBenefit {
    /**
     * 
     * @type {Array<UserBenefit>}
     * @memberof ListResourceUserBenefit
     */
    items: Array<UserBenefit>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceUserBenefit
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceUserOrder
 */
export interface ListResourceUserOrder {
    /**
     * 
     * @type {Array<UserOrder>}
     * @memberof ListResourceUserOrder
     */
    items: Array<UserOrder>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceUserOrder
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceUserSubscription
 */
export interface ListResourceUserSubscription {
    /**
     * 
     * @type {Array<UserSubscription>}
     * @memberof ListResourceUserSubscription
     */
    items: Array<UserSubscription>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceUserSubscription
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
 * @interface MaintainerDonationReceivedNotification
 */
export interface MaintainerDonationReceivedNotification {
    /**
     * 
     * @type {string}
     * @memberof MaintainerDonationReceivedNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerDonationReceivedNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerDonationReceivedNotification
     */
    type: MaintainerDonationReceivedNotificationTypeEnum;
    /**
     * 
     * @type {MaintainerDonationReceivedNotificationPayload}
     * @memberof MaintainerDonationReceivedNotification
     */
    payload: MaintainerDonationReceivedNotificationPayload;
}


/**
 * @export
 */
export const MaintainerDonationReceivedNotificationTypeEnum = {
    MAINTAINER_DONATION_RECEIVED: 'MaintainerDonationReceived'
} as const;
export type MaintainerDonationReceivedNotificationTypeEnum = typeof MaintainerDonationReceivedNotificationTypeEnum[keyof typeof MaintainerDonationReceivedNotificationTypeEnum];

/**
 * 
 * @export
 * @interface MaintainerDonationReceivedNotificationPayload
 */
export interface MaintainerDonationReceivedNotificationPayload {
    /**
     * 
     * @type {string}
     * @memberof MaintainerDonationReceivedNotificationPayload
     */
    organization_name: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerDonationReceivedNotificationPayload
     */
    donation_amount: string;
    /**
     * 
     * @type {string}
     * @memberof MaintainerDonationReceivedNotificationPayload
     */
    donation_id: string;
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
    tier_price_amount: number;
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
     * Type of the metric, useful to know the unit or format of the value.
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
     * Limits for the hour interval.
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    hour: MetricsIntervalLimit;
    /**
     * Limits for the day interval.
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    day: MetricsIntervalLimit;
    /**
     * Limits for the week interval.
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    week: MetricsIntervalLimit;
    /**
     * Limits for the month interval.
     * @type {MetricsIntervalLimit}
     * @memberof MetricsIntervalsLimits
     */
    month: MetricsIntervalLimit;
    /**
     * Limits for the year interval.
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
     * Limits for each interval.
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
     * Information about the returned metrics.
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
    type: NotPermittedTypeEnum;
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
export const NotPermittedTypeEnum = {
    NOT_PERMITTED: 'NotPermitted'
} as const;
export type NotPermittedTypeEnum = typeof NotPermittedTypeEnum[keyof typeof NotPermittedTypeEnum];

/**
 * @type NotificationsInner
 * 
 * @export
 */
export type NotificationsInner = { type: 'BenefitPreconditionErrorNotification' } & BenefitPreconditionErrorNotification | { type: 'MaintainerAccountReviewedNotification' } & MaintainerAccountReviewedNotification | { type: 'MaintainerAccountUnderReviewNotification' } & MaintainerAccountUnderReviewNotification | { type: 'MaintainerCreateAccountNotification' } & MaintainerCreateAccountNotification | { type: 'MaintainerDonationReceived' } & MaintainerDonationReceivedNotification | { type: 'MaintainerNewPaidSubscriptionNotification' } & MaintainerNewPaidSubscriptionNotification | { type: 'MaintainerNewProductSaleNotification' } & MaintainerNewProductSaleNotification | { type: 'MaintainerPledgeConfirmationPendingNotification' } & MaintainerPledgeConfirmationPendingNotification | { type: 'MaintainerPledgeCreatedNotification' } & MaintainerPledgeCreatedNotification | { type: 'MaintainerPledgePaidNotification' } & MaintainerPledgePaidNotification | { type: 'MaintainerPledgePendingNotification' } & MaintainerPledgePendingNotification | { type: 'MaintainerPledgedIssueConfirmationPendingNotification' } & MaintainerPledgedIssueConfirmationPendingNotification | { type: 'MaintainerPledgedIssuePendingNotification' } & MaintainerPledgedIssuePendingNotification | { type: 'PledgerPledgePendingNotification' } & PledgerPledgePendingNotification | { type: 'RewardPaidNotification' } & RewardPaidNotification | { type: 'TeamAdminMemberPledgedNotification' } & TeamAdminMemberPledgedNotification;
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
    DISCORD: 'discord',
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
     * @type {string}
     * @memberof Order
     */
    user_id: string;
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
    subscription_id: string | null;
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
     * @type {OrderSubscription}
     * @memberof Order
     */
    subscription: OrderSubscription | null;
}
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
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof OrderProduct
     */
    type: SubscriptionTierType | null;
    /**
     * 
     * @type {boolean}
     * @memberof OrderProduct
     */
    is_highlighted: boolean | null;
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
    USER: 'user',
    USER2: '-user',
    PRODUCT: 'product',
    PRODUCT2: '-product',
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
    user_id: string;
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
    price_id: string | null;
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
    github_username: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrderUser
     */
    avatar_url: string | null;
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
     * If this organizations accepts donations
     * @type {boolean}
     * @memberof Organization
     */
    donations_enabled: boolean;
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
     * 
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
     * @type {boolean}
     * @memberof OrganizationCreate
     */
    donations_enabled?: boolean;
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
 * @interface OrganizationCustomer
 */
export interface OrganizationCustomer {
    /**
     * 
     * @type {string}
     * @memberof OrganizationCustomer
     */
    public_name: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationCustomer
     */
    github_username: string | null;
    /**
     * 
     * @type {string}
     * @memberof OrganizationCustomer
     */
    avatar_url: string | null;
}

/**
 * 
 * @export
 */
export const OrganizationCustomerType = {
    FREE_SUBSCRIPTION: 'free_subscription',
    PAID_SUBSCRIPTION: 'paid_subscription',
    ORDER: 'order',
    DONATION: 'donation'
} as const;
export type OrganizationCustomerType = typeof OrganizationCustomerType[keyof typeof OrganizationCustomerType];

/**
 * 
 * @export
 * @interface OrganizationFeatureSettings
 */
export interface OrganizationFeatureSettings {
    /**
     * If this organization has articles enabled
     * @type {boolean}
     * @memberof OrganizationFeatureSettings
     */
    articles_enabled?: boolean;
    /**
     * If this organization has subscriptions enabled
     * @type {boolean}
     * @memberof OrganizationFeatureSettings
     */
    subscriptions_enabled?: boolean;
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
    name: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationMember
     */
    github_username: string | null;
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
     * If this organization has a profile enabled
     * @type {boolean}
     * @memberof OrganizationProfileSettings
     */
    enabled?: boolean;
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
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    donations_enabled?: boolean;
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
    expires_at: string;
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
    expires_in?: string;
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
     * Current state of the pledge
     * @type {PledgeState}
     * @memberof Pledge
     */
    state: PledgeState;
    /**
     * Type of pledge
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
     * The issue that the pledge was made towards
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
     * @type {SubscriptionTierType}
     * @memberof Product
     */
    type: SubscriptionTierType | null;
    /**
     * 
     * @type {boolean}
     * @memberof Product
     */
    is_highlighted: boolean | null;
    /**
     * List of available prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof Product
     */
    prices: Array<ProductPrice>;
    /**
     * The benefits granted by the product.
     * @type {Array<BenefitPublicInner>}
     * @memberof Product
     */
    benefits: Array<BenefitPublicInner>;
    /**
     * The medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof Product
     */
    medias: Array<ProductMediaFileRead>;
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
     * 
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
     * @type {Array<ProductPriceOneTimeCreate>}
     * @memberof ProductOneTimeCreate
     */
    prices: Array<ProductPriceOneTimeCreate>;
    /**
     * 
     * @type {Array<string>}
     * @memberof ProductOneTimeCreate
     */
    medias?: Array<string> | null;
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
 * A one-time price for a product.
 * @export
 * @interface ProductPriceOneTime
 */
export interface ProductPriceOneTime {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceOneTime
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTime
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceOneTime
     */
    id: string;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceOneTime
     */
    price_amount: number;
    /**
     * The currency.
     * @type {string}
     * @memberof ProductPriceOneTime
     */
    price_currency: string;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceOneTime
     */
    is_archived: boolean;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceOneTime
     */
    type: ProductPriceOneTimeTypeEnum;
}


/**
 * @export
 */
export const ProductPriceOneTimeTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeTypeEnum = typeof ProductPriceOneTimeTypeEnum[keyof typeof ProductPriceOneTimeTypeEnum];

/**
 * Schema to create a one-time product price.
 * @export
 * @interface ProductPriceOneTimeCreate
 */
export interface ProductPriceOneTimeCreate {
    /**
     * 
     * @type {string}
     * @memberof ProductPriceOneTimeCreate
     */
    type: ProductPriceOneTimeCreateTypeEnum;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceOneTimeCreate
     */
    price_amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof ProductPriceOneTimeCreate
     */
    price_currency?: string;
}


/**
 * @export
 */
export const ProductPriceOneTimeCreateTypeEnum = {
    ONE_TIME: 'one_time'
} as const;
export type ProductPriceOneTimeCreateTypeEnum = typeof ProductPriceOneTimeCreateTypeEnum[keyof typeof ProductPriceOneTimeCreateTypeEnum];

/**
 * A recurring price for a product, i.e. a subscription.
 * @export
 * @interface ProductPriceRecurring
 */
export interface ProductPriceRecurring {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof ProductPriceRecurring
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurring
     */
    modified_at: string | null;
    /**
     * The ID of the price.
     * @type {string}
     * @memberof ProductPriceRecurring
     */
    id: string;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceRecurring
     */
    price_amount: number;
    /**
     * The currency.
     * @type {string}
     * @memberof ProductPriceRecurring
     */
    price_currency: string;
    /**
     * Whether the price is archived and no longer available.
     * @type {boolean}
     * @memberof ProductPriceRecurring
     */
    is_archived: boolean;
    /**
     * The type of the price.
     * @type {string}
     * @memberof ProductPriceRecurring
     */
    type: ProductPriceRecurringTypeEnum;
    /**
     * 
     * @type {ProductPriceRecurringInterval}
     * @memberof ProductPriceRecurring
     */
    recurring_interval: ProductPriceRecurringInterval | null;
}


/**
 * @export
 */
export const ProductPriceRecurringTypeEnum = {
    RECURRING: 'recurring'
} as const;
export type ProductPriceRecurringTypeEnum = typeof ProductPriceRecurringTypeEnum[keyof typeof ProductPriceRecurringTypeEnum];

/**
 * Schema to create a recurring product price, i.e. a subscription.
 * @export
 * @interface ProductPriceRecurringCreate
 */
export interface ProductPriceRecurringCreate {
    /**
     * 
     * @type {string}
     * @memberof ProductPriceRecurringCreate
     */
    type: ProductPriceRecurringCreateTypeEnum;
    /**
     * The recurring interval of the price.
     * @type {ProductPriceRecurringInterval}
     * @memberof ProductPriceRecurringCreate
     */
    recurring_interval: ProductPriceRecurringInterval;
    /**
     * The price in cents.
     * @type {number}
     * @memberof ProductPriceRecurringCreate
     */
    price_amount: number;
    /**
     * The currency. Currently, only `usd` is supported.
     * @type {string}
     * @memberof ProductPriceRecurringCreate
     */
    price_currency?: string;
}


/**
 * @export
 */
export const ProductPriceRecurringCreateTypeEnum = {
    RECURRING: 'recurring'
} as const;
export type ProductPriceRecurringCreateTypeEnum = typeof ProductPriceRecurringCreateTypeEnum[keyof typeof ProductPriceRecurringCreateTypeEnum];


/**
 * 
 * @export
 */
export const ProductPriceRecurringInterval = {
    MONTH: 'month',
    YEAR: 'year'
} as const;
export type ProductPriceRecurringInterval = typeof ProductPriceRecurringInterval[keyof typeof ProductPriceRecurringInterval];


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
     * List of available prices for this product.
     * @type {Array<ProductPriceRecurringCreate>}
     * @memberof ProductRecurringCreate
     */
    prices: Array<ProductPriceRecurringCreate>;
    /**
     * 
     * @type {Array<string>}
     * @memberof ProductRecurringCreate
     */
    medias?: Array<string> | null;
    /**
     * The organization ID.
     * @type {string}
     * @memberof ProductRecurringCreate
     */
    organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof ProductRecurringCreate
     * @deprecated
     */
    type: ProductRecurringCreateTypeEnum;
    /**
     * 
     * @type {boolean}
     * @memberof ProductRecurringCreate
     * @deprecated
     */
    is_highlighted?: boolean;
}


/**
 * @export
 */
export const ProductRecurringCreateTypeEnum = {
    INDIVIDUAL: 'individual',
    BUSINESS: 'business'
} as const;
export type ProductRecurringCreateTypeEnum = typeof ProductRecurringCreateTypeEnum[keyof typeof ProductRecurringCreateTypeEnum];

/**
 * Schema to update a product.
 * @export
 * @interface ProductUpdate
 */
export interface ProductUpdate {
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
    is_highlighted?: boolean | null;
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
}
/**
 * @type ProductUpdatePricesInner
 * @export
 */
export type ProductUpdatePricesInner = ExistingProductPrice | ProductPriceOneTimeCreate | ProductPriceRecurringCreate;

/**
 * 
 * @export
 * @interface PublicDonation
 */
export interface PublicDonation {
    /**
     * 
     * @type {string}
     * @memberof PublicDonation
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof PublicDonation
     */
    amount: number;
    /**
     * 
     * @type {string}
     * @memberof PublicDonation
     */
    currency: string;
    /**
     * 
     * @type {string}
     * @memberof PublicDonation
     */
    message: string | null;
    /**
     * 
     * @type {Donor}
     * @memberof PublicDonation
     */
    donor: Donor | null;
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
    author?: Author | null;
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
    merged_at?: string | null;
    /**
     * 
     * @type {string}
     * @memberof PullRequestReference
     */
    closed_at?: string | null;
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
    type: ResourceNotFoundTypeEnum;
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
export const ResourceNotFoundTypeEnum = {
    RESOURCE_NOT_FOUND: 'ResourceNotFound'
} as const;
export type ResourceNotFoundTypeEnum = typeof ResourceNotFoundTypeEnum[keyof typeof ResourceNotFoundTypeEnum];

/**
 * @type ResponseBenefitsCreate
 * @export
 */
export type ResponseBenefitsCreate = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository | BenefitLicenseKeys;

/**
 * @type ResponseBenefitsGet
 * @export
 */
export type ResponseBenefitsGet = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository | BenefitLicenseKeys;

/**
 * @type ResponseBenefitsUpdate
 * @export
 */
export type ResponseBenefitsUpdate = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository | BenefitLicenseKeys;

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
 * @type ResponseUsersBenefitsGet
 * 
 * @export
 */
export type ResponseUsersBenefitsGet = { type: 'ads' } & BenefitAdsSubscriber | { type: 'articles' } & BenefitArticlesSubscriber | { type: 'custom' } & BenefitCustomSubscriber | { type: 'discord' } & BenefitDiscordSubscriber | { type: 'downloadables' } & BenefitDownloadablesSubscriber | { type: 'github_repository' } & BenefitGitHubRepositorySubscriber | { type: 'license_keys' } & BenefitLicenseKeysSubscriber;
/**
 * 
 * @export
 * @interface Reward
 */
export interface Reward {
    /**
     * The pledge that the reward was split from
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
    PRODUCTSREAD: 'products:read',
    PRODUCTSWRITE: 'products:write',
    BENEFITSREAD: 'benefits:read',
    BENEFITSWRITE: 'benefits:write',
    FILESREAD: 'files:read',
    FILESWRITE: 'files:write',
    SUBSCRIPTIONSREAD: 'subscriptions:read',
    SUBSCRIPTIONSWRITE: 'subscriptions:write',
    ORDERSREAD: 'orders:read',
    METRICSREAD: 'metrics:read',
    ARTICLESREAD: 'articles:read',
    ARTICLESWRITE: 'articles:write',
    WEBHOOKSREAD: 'webhooks:read',
    WEBHOOKSWRITE: 'webhooks:write',
    EXTERNAL_ORGANIZATIONSREAD: 'external_organizations:read',
    LICENSE_KEYSREAD: 'license_keys:read',
    LICENSE_KEYSWRITE: 'license_keys:write',
    REPOSITORIESREAD: 'repositories:read',
    REPOSITORIESWRITE: 'repositories:write',
    ISSUESREAD: 'issues:read',
    ISSUESWRITE: 'issues:write',
    USERBENEFITSREAD: 'user:benefits:read',
    USERORDERSREAD: 'user:orders:read',
    USERSUBSCRIPTIONSREAD: 'user:subscriptions:read',
    USERSUBSCRIPTIONSWRITE: 'user:subscriptions:write',
    USERDOWNLOADABLESREAD: 'user:downloadables:read',
    USERLICENSE_KEYSREAD: 'user:license_keys:read',
    USERADVERTISEMENT_CAMPAIGNSREAD: 'user:advertisement_campaigns:read',
    USERADVERTISEMENT_CAMPAIGNSWRITE: 'user:advertisement_campaigns:write'
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
    user_id: string;
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
    price_id: string | null;
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
     * @type {ProductPrice}
     * @memberof Subscription
     */
    price: ProductPrice | null;
}


/**
 * Request schema for creating a subscription by email.
 * @export
 * @interface SubscriptionCreateEmail
 */
export interface SubscriptionCreateEmail {
    /**
     * The email address of the user.
     * @type {string}
     * @memberof SubscriptionCreateEmail
     */
    email: string;
    /**
     * The ID of the product. **Must be the free subscription tier**.
     * @type {string}
     * @memberof SubscriptionCreateEmail
     */
    product_id: string;
}
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
export const SubscriptionSortProperty = {
    USER: 'user',
    USER2: '-user',
    STATUS: 'status',
    STATUS2: '-status',
    STARTED_AT: 'started_at',
    STARTED_AT2: '-started_at',
    CURRENT_PERIOD_END: 'current_period_end',
    CURRENT_PERIOD_END2: '-current_period_end',
    PRICE_AMOUNT: 'price_amount',
    PRICE_AMOUNT2: '-price_amount',
    SUBSCRIPTION_TIER_TYPE: 'subscription_tier_type',
    SUBSCRIPTION_TIER_TYPE2: '-subscription_tier_type',
    PRODUCT: 'product',
    PRODUCT2: '-product'
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
 */
export const SubscriptionTierType = {
    FREE: 'free',
    INDIVIDUAL: 'individual',
    BUSINESS: 'business'
} as const;
export type SubscriptionTierType = typeof SubscriptionTierType[keyof typeof SubscriptionTierType];

/**
 * @type SubscriptionTierTypeFilter
 * Filter by subscription tier type.
 * @export
 */
export type SubscriptionTierTypeFilter = Array<SubscriptionTierType> | SubscriptionTierType;

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
    github_username: string | null;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    avatar_url: string | null;
}
/**
 * Result of a subscription import operation.
 * @export
 * @interface SubscriptionsImported
 */
export interface SubscriptionsImported {
    /**
     * 
     * @type {number}
     * @memberof SubscriptionsImported
     */
    count: number;
}
/**
 * 
 * @export
 * @interface SummaryPledge
 */
export interface SummaryPledge {
    /**
     * Type of pledge
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
 * @interface TrackPageView
 */
export interface TrackPageView {
    /**
     * 
     * @type {string}
     * @memberof TrackPageView
     */
    location_href: string;
    /**
     * 
     * @type {string}
     * @memberof TrackPageView
     */
    article_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof TrackPageView
     */
    organization_id?: string | null;
    /**
     * 
     * @type {string}
     * @memberof TrackPageView
     */
    referrer?: string | null;
}
/**
 * 
 * @export
 * @interface TrackPageViewResponse
 */
export interface TrackPageViewResponse {
    /**
     * 
     * @type {boolean}
     * @memberof TrackPageViewResponse
     */
    ok: boolean;
}
/**
 * 
 * @export
 * @interface TrafficReferrer
 */
export interface TrafficReferrer {
    /**
     * 
     * @type {string}
     * @memberof TrafficReferrer
     */
    referrer: string;
    /**
     * 
     * @type {number}
     * @memberof TrafficReferrer
     */
    views: number;
}
/**
 * 
 * @export
 * @interface TrafficStatistics
 */
export interface TrafficStatistics {
    /**
     * 
     * @type {Array<TrafficStatisticsPeriod>}
     * @memberof TrafficStatistics
     */
    periods: Array<TrafficStatisticsPeriod>;
}
/**
 * 
 * @export
 * @interface TrafficStatisticsPeriod
 */
export interface TrafficStatisticsPeriod {
    /**
     * 
     * @type {string}
     * @memberof TrafficStatisticsPeriod
     */
    start_date: string;
    /**
     * 
     * @type {string}
     * @memberof TrafficStatisticsPeriod
     */
    end_date: string;
    /**
     * 
     * @type {number}
     * @memberof TrafficStatisticsPeriod
     */
    views: number;
    /**
     * 
     * @type {string}
     * @memberof TrafficStatisticsPeriod
     */
    article_id: string | null;
}
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
    processor: PaymentProcessor | null;
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
    donation_id: string | null;
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
     * @type {TransactionDonation}
     * @memberof Transaction
     */
    donation: TransactionDonation | null;
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
    processor: PaymentProcessor | null;
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
    donation_id: string | null;
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
     * @type {TransactionDonation}
     * @memberof TransactionDetails
     */
    donation: TransactionDonation | null;
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
 * @interface TransactionDonation
 */
export interface TransactionDonation {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionDonation
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDonation
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof TransactionDonation
     */
    id: string;
    /**
     * 
     * @type {TransactionOrganization}
     * @memberof TransactionDonation
     */
    to_organization: TransactionOrganization | null;
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
     * 
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
     * @type {PaymentProcessor}
     * @memberof TransactionEmbedded
     */
    processor: PaymentProcessor | null;
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
    donation_id: string | null;
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
     * 
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
     * 
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
     * 
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
     * 
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
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof TransactionProduct
     */
    type: SubscriptionTierType | null;
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
    type: UnauthorizedTypeEnum;
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
export const UnauthorizedTypeEnum = {
    UNAUTHORIZED: 'Unauthorized'
} as const;
export type UnauthorizedTypeEnum = typeof UnauthorizedTypeEnum[keyof typeof UnauthorizedTypeEnum];

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
    username: string;
    /**
     * 
     * @type {string}
     * @memberof User
     */
    avatar_url: string;
}
/**
 * 
 * @export
 * @interface UserAdvertisementCampaign
 */
export interface UserAdvertisementCampaign {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    user_id: string;
    /**
     * 
     * @type {number}
     * @memberof UserAdvertisementCampaign
     */
    views: number;
    /**
     * 
     * @type {number}
     * @memberof UserAdvertisementCampaign
     */
    clicks: number;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    image_url: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    image_url_dark: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaign
     */
    link_url: string;
}
/**
 * 
 * @export
 * @interface UserAdvertisementCampaignCreate
 */
export interface UserAdvertisementCampaignCreate {
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignCreate
     */
    image_url: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignCreate
     */
    image_url_dark?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignCreate
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignCreate
     */
    link_url: string;
}
/**
 * 
 * @export
 * @interface UserAdvertisementCampaignEnable
 */
export interface UserAdvertisementCampaignEnable {
    /**
     * The benefit ID.
     * @type {string}
     * @memberof UserAdvertisementCampaignEnable
     */
    benefit_id: string;
}
/**
 * 
 * @export
 * @interface UserAdvertisementCampaignUpdate
 */
export interface UserAdvertisementCampaignUpdate {
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignUpdate
     */
    image_url?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignUpdate
     */
    image_url_dark?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignUpdate
     */
    text?: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignUpdate
     */
    link_url?: string | null;
}

/**
 * 
 * @export
 */
export const UserAdvertisementSortProperty = {
    CREATED_AT: 'created_at',
    CREATED_AT2: '-created_at',
    VIEWS: 'views',
    VIEWS2: '-views',
    CLICKS: 'clicks',
    CLICKS2: '-clicks'
} as const;
export type UserAdvertisementSortProperty = typeof UserAdvertisementSortProperty[keyof typeof UserAdvertisementSortProperty];

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
    username: string;
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
 * @type UserBenefit
 * 
 * @export
 */
export type UserBenefit = { type: 'ads' } & BenefitAdsSubscriber | { type: 'articles' } & BenefitArticlesSubscriber | { type: 'custom' } & BenefitCustomSubscriber | { type: 'discord' } & BenefitDiscordSubscriber | { type: 'downloadables' } & BenefitDownloadablesSubscriber | { type: 'github_repository' } & BenefitGitHubRepositorySubscriber | { type: 'license_keys' } & BenefitLicenseKeysSubscriber;

/**
 * 
 * @export
 */
export const UserBenefitSortProperty = {
    GRANTED_AT: 'granted_at',
    GRANTED_AT2: '-granted_at',
    TYPE: 'type',
    TYPE2: '-type',
    ORGANIZATION: 'organization',
    ORGANIZATION2: '-organization'
} as const;
export type UserBenefitSortProperty = typeof UserBenefitSortProperty[keyof typeof UserBenefitSortProperty];

/**
 * 
 * @export
 * @interface UserFreeSubscriptionCreate
 */
export interface UserFreeSubscriptionCreate {
    /**
     * ID of the free tier to subscribe to.
     * @type {string}
     * @memberof UserFreeSubscriptionCreate
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserFreeSubscriptionCreate
     */
    customer_email?: string | null;
}
/**
 * @type UserIDFilter
 * Filter by customer\'s user ID.
 * @export
 */
export type UserIDFilter = Array<string> | string;

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
    name: string | null;
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
    name: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserInfoUser
     */
    email: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof UserInfoUser
     */
    email_verified: boolean | null;
}
/**
 * 
 * @export
 * @interface UserOrder
 */
export interface UserOrder {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof UserOrder
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrder
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserOrder
     */
    id: string;
    /**
     * 
     * @type {number}
     * @memberof UserOrder
     */
    amount: number;
    /**
     * 
     * @type {number}
     * @memberof UserOrder
     */
    tax_amount: number;
    /**
     * 
     * @type {string}
     * @memberof UserOrder
     */
    currency: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrder
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrder
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrder
     */
    product_price_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrder
     */
    subscription_id: string | null;
    /**
     * 
     * @type {UserOrderProduct}
     * @memberof UserOrder
     */
    product: UserOrderProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof UserOrder
     */
    product_price: ProductPrice;
    /**
     * 
     * @type {UserOrderSubscription}
     * @memberof UserOrder
     */
    subscription: UserOrderSubscription | null;
}
/**
 * Order's invoice data.
 * @export
 * @interface UserOrderInvoice
 */
export interface UserOrderInvoice {
    /**
     * The URL to the invoice.
     * @type {string}
     * @memberof UserOrderInvoice
     */
    url: string;
}
/**
 * 
 * @export
 * @interface UserOrderProduct
 */
export interface UserOrderProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof UserOrderProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrderProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof UserOrderProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof UserOrderProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrderProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof UserOrderProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof UserOrderProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof UserOrderProduct
     */
    organization_id: string;
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof UserOrderProduct
     */
    type: SubscriptionTierType | null;
    /**
     * 
     * @type {boolean}
     * @memberof UserOrderProduct
     */
    is_highlighted: boolean | null;
    /**
     * List of available prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof UserOrderProduct
     */
    prices: Array<ProductPrice>;
    /**
     * The benefits granted by the product.
     * @type {Array<BenefitPublicInner>}
     * @memberof UserOrderProduct
     */
    benefits: Array<BenefitPublicInner>;
    /**
     * The medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof UserOrderProduct
     */
    medias: Array<ProductMediaFileRead>;
}



/**
 * 
 * @export
 */
export const UserOrderSortProperty = {
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
export type UserOrderSortProperty = typeof UserOrderSortProperty[keyof typeof UserOrderSortProperty];

/**
 * 
 * @export
 * @interface UserOrderSubscription
 */
export interface UserOrderSubscription {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof UserOrderSubscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    modified_at: string | null;
    /**
     * The ID of the object.
     * @type {string}
     * @memberof UserOrderSubscription
     */
    id: string;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof UserOrderSubscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    current_period_end: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof UserOrderSubscription
     */
    cancel_at_period_end: boolean;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    started_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    ended_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    price_id: string | null;
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
 */
export const UserSignupType = {
    MAINTAINER: 'maintainer',
    BACKER: 'backer',
    IMPORTED: 'imported'
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
 * @interface UserSubscription
 */
export interface UserSubscription {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof UserSubscription
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    modified_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    id: string;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof UserSubscription
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    current_period_end: string | null;
    /**
     * 
     * @type {boolean}
     * @memberof UserSubscription
     */
    cancel_at_period_end: boolean;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    started_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    ended_at: string | null;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    product_id: string;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    price_id: string | null;
    /**
     * 
     * @type {UserSubscriptionProduct}
     * @memberof UserSubscription
     */
    product: UserSubscriptionProduct;
    /**
     * 
     * @type {ProductPrice}
     * @memberof UserSubscription
     */
    price: ProductPrice | null;
}


/**
 * 
 * @export
 * @interface UserSubscriptionProduct
 */
export interface UserSubscriptionProduct {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof UserSubscriptionProduct
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof UserSubscriptionProduct
     */
    modified_at: string | null;
    /**
     * The ID of the product.
     * @type {string}
     * @memberof UserSubscriptionProduct
     */
    id: string;
    /**
     * The name of the product.
     * @type {string}
     * @memberof UserSubscriptionProduct
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof UserSubscriptionProduct
     */
    description: string | null;
    /**
     * Whether the product is a subscription tier.
     * @type {boolean}
     * @memberof UserSubscriptionProduct
     */
    is_recurring: boolean;
    /**
     * Whether the product is archived and no longer available.
     * @type {boolean}
     * @memberof UserSubscriptionProduct
     */
    is_archived: boolean;
    /**
     * The ID of the organization owning the product.
     * @type {string}
     * @memberof UserSubscriptionProduct
     */
    organization_id: string;
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof UserSubscriptionProduct
     */
    type: SubscriptionTierType | null;
    /**
     * 
     * @type {boolean}
     * @memberof UserSubscriptionProduct
     */
    is_highlighted: boolean | null;
    /**
     * List of available prices for this product.
     * @type {Array<ProductPrice>}
     * @memberof UserSubscriptionProduct
     */
    prices: Array<ProductPrice>;
    /**
     * The benefits granted by the product.
     * @type {Array<BenefitPublicInner>}
     * @memberof UserSubscriptionProduct
     */
    benefits: Array<BenefitPublicInner>;
    /**
     * The medias associated to the product.
     * @type {Array<ProductMediaFileRead>}
     * @memberof UserSubscriptionProduct
     */
    medias: Array<ProductMediaFileRead>;
}



/**
 * 
 * @export
 */
export const UserSubscriptionSortProperty = {
    STARTED_AT: 'started_at',
    STARTED_AT2: '-started_at',
    PRICE_AMOUNT: 'price_amount',
    PRICE_AMOUNT2: '-price_amount',
    STATUS: 'status',
    STATUS2: '-status',
    ORGANIZATION: 'organization',
    ORGANIZATION2: '-organization',
    PRODUCT: 'product',
    PRODUCT2: '-product'
} as const;
export type UserSubscriptionSortProperty = typeof UserSubscriptionSortProperty[keyof typeof UserSubscriptionSortProperty];

/**
 * 
 * @export
 * @interface UserSubscriptionUpdate
 */
export interface UserSubscriptionUpdate {
    /**
     * 
     * @type {string}
     * @memberof UserSubscriptionUpdate
     */
    product_price_id: string;
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
     */
    user_id: string;
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
     * The webhook event sent by this delivery.
     * @type {WebhookEvent}
     * @memberof WebhookDelivery
     */
    webhook_event: WebhookEvent;
}
/**
 * Sent when a new donation is created.
 * 
 * **Discord & Slack support:** Full
 * @export
 * @interface WebhookDonationCreatedPayload
 */
export interface WebhookDonationCreatedPayload {
    /**
     * 
     * @type {string}
     * @memberof WebhookDonationCreatedPayload
     */
    type: WebhookDonationCreatedPayloadTypeEnum;
    /**
     * 
     * @type {Donation}
     * @memberof WebhookDonationCreatedPayload
     */
    data: Donation;
}


/**
 * @export
 */
export const WebhookDonationCreatedPayloadTypeEnum = {
    DONATION_CREATED: 'donation.created'
} as const;
export type WebhookDonationCreatedPayloadTypeEnum = typeof WebhookDonationCreatedPayloadTypeEnum[keyof typeof WebhookDonationCreatedPayloadTypeEnum];

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
     * The format of the webhook payload.
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
     * The format of the webhook payload.
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
     * The format of the webhook payload.
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
    ORDER_CREATED: 'order.created',
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    PRODUCT_CREATED: 'product.created',
    PRODUCT_UPDATED: 'product.updated',
    BENEFIT_CREATED: 'benefit.created',
    BENEFIT_UPDATED: 'benefit.updated',
    ORGANIZATION_UPDATED: 'organization.updated',
    PLEDGE_CREATED: 'pledge.created',
    PLEDGE_UPDATED: 'pledge.updated',
    DONATION_CREATED: 'donation.created'
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
 * Sent when a new subscription is updated. This event fires if the subscription is cancelled, both immediately and if the subscription is cancelled at the end of the current period.
 * 
 * **Discord & Slack support:** On cancellation
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

