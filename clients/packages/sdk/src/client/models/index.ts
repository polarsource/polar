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
    modified_at?: string;
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
    image_url_dark?: string;
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
    items?: Array<AdvertisementCampaign>;
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
    paid_subscribers_only?: boolean;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    paid_subscribers_only_ends_at?: string;
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
     * @type {string}
     * @memberof Article
     */
    og_image_url?: string;
    /**
     * 
     * @type {string}
     * @memberof Article
     */
    og_description?: string;
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
    slug?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    body?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    body_base64?: string;
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
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    paid_subscribers_only_ends_at?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    published_at?: string;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleCreate
     */
    notify_subscribers?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleCreate
     */
    is_pinned?: boolean;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    og_image_url?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleCreate
     */
    og_description?: string;
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
 * @interface ArticleUnsubscribeResponse
 */
export interface ArticleUnsubscribeResponse {
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUnsubscribeResponse
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
    body_base64?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    slug?: string;
    /**
     * 
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
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    paid_subscribers_only?: boolean;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    paid_subscribers_only_ends_at?: string;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    published_at?: string;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    set_published_at?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    notify_subscribers?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    is_pinned?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    set_og_image_url?: boolean;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    og_image_url?: string;
    /**
     * 
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    set_og_description?: boolean;
    /**
     * 
     * @type {string}
     * @memberof ArticleUpdate
     */
    og_description?: string;
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
     * @type {Platforms}
     * @memberof AuthorizeOrganization
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeOrganization
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof AuthorizeOrganization
     */
    avatar_url: string;
    /**
     * 
     * @type {boolean}
     * @memberof AuthorizeOrganization
     */
    is_personal: boolean;
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
    sub?: AuthorizeOrganization;
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
    sub?: AuthorizeUser;
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
    avatar_url?: string;
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
     * Amount pledged towards the issue
     * @type {CurrencyAmount}
     * @memberof BackofficePledge
     */
    amount: CurrencyAmount;
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
    refunded_at?: string;
    /**
     * 
     * @type {string}
     * @memberof BackofficePledge
     */
    scheduled_payout_at?: string;
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
    pledger?: Pledger;
    /**
     * 
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
    user?: User;
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
     * 
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
    modified_at?: string;
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
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitAdsCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitAdsCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitAdsCreate
     */
    type: BenefitAdsCreateTypeEnum;
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
    modified_at?: string;
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
    description?: string;
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
    properties?: BenefitAdsProperties;
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
    modified_at?: string;
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
    modified_at?: string;
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
    description?: string;
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
    modified_at?: string;
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
export type BenefitCreate = { type: 'ads' } & BenefitAdsCreate | { type: 'custom' } & BenefitCustomCreate | { type: 'discord' } & BenefitDiscordCreate | { type: 'downloadables' } & BenefitDownloadablesCreate | { type: 'github_repository' } & BenefitGitHubRepositoryCreate;
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
    modified_at?: string;
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
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitCustomCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitCustomCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitCustomCreate
     */
    type: BenefitCustomCreateTypeEnum;
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
     * @type {string}
     * @memberof BenefitCustomProperties
     */
    note?: string;
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
    modified_at?: string;
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
     * @type {string}
     * @memberof BenefitCustomSubscriberProperties
     */
    note?: string;
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
    description?: string;
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
    properties?: BenefitCustomProperties;
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
    modified_at?: string;
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
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitDiscordCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDiscordCreate
     */
    type: BenefitDiscordCreateTypeEnum;
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
    modified_at?: string;
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
    description?: string;
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
    properties?: BenefitDiscordCreateProperties;
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
    modified_at?: string;
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
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitDownloadablesCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadablesCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitDownloadablesCreate
     */
    type: BenefitDownloadablesCreateTypeEnum;
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
    modified_at?: string;
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
    description?: string;
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
    properties?: BenefitDownloadablesCreateProperties;
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
    modified_at?: string;
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
     * The description of the benefit. Will be displayed on products having this benefit.
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreate
     */
    type: BenefitGitHubRepositoryCreateTypeEnum;
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
    repository_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    repository_owner?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGitHubRepositoryCreateProperties
     */
    repository_name?: string;
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
    repository_id?: string;
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
    modified_at?: string;
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
    description?: string;
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
    properties?: BenefitGitHubRepositoryCreateProperties;
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
    modified_at?: string;
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
    granted_at?: string;
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
    revoked_at?: string;
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
    subscription_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrant
     */
    order_id?: string;
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
    modified_at?: string;
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
    granted_at?: string;
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
    revoked_at?: string;
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
    subscription_id?: string;
    /**
     * 
     * @type {string}
     * @memberof BenefitGrantAds
     */
    order_id?: string;
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
    advertisement_campaign_id?: string;
}
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
    DOWNLOADABLES: 'downloadables'
} as const;
export type BenefitType = typeof BenefitType[keyof typeof BenefitType];

/**
 * @type BenefitUpdate
 * @export
 */
export type BenefitUpdate = BenefitAdsUpdate | BenefitArticlesUpdate | BenefitCustomUpdate | BenefitDiscordUpdate | BenefitDownloadablesUpdate | BenefitGitHubRepositoryUpdate;

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
    url?: string;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    customer_email?: string;
    /**
     * 
     * @type {string}
     * @memberof Checkout
     */
    customer_name?: string;
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
    customer_email?: string;
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
    /**
     * 
     * @type {Array<string>}
     * @memberof CreatePersonalAccessToken
     */
    scopes?: Array<CreatePersonalAccessTokenScopesEnum>;
}


/**
 * @export
 */
export const CreatePersonalAccessTokenScopesEnum = {
    ARTICLESREAD: 'articles:read',
    USERREAD: 'user:read',
    ORGANIZATIONSREAD: 'organizations:read'
} as const;
export type CreatePersonalAccessTokenScopesEnum = typeof CreatePersonalAccessTokenScopesEnum[keyof typeof CreatePersonalAccessTokenScopesEnum];

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
     * 
     * @type {string}
     * @memberof CreatePledgePayLater
     */
    on_behalf_of_organization_id?: string;
    /**
     * 
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
     * The customers credit balance. A negative value means that Polar owes this customer money (credit), a positive number means that the customer owes Polar money (debit).
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
     * Amount in the currencies smallest unit (cents if currency is USD)
     * @type {number}
     * @memberof CurrencyAmount
     */
    amount: number;
}
/**
 * 
 * @export
 * @interface CustomDomainExchangeRequest
 */
export interface CustomDomainExchangeRequest {
    /**
     * 
     * @type {string}
     * @memberof CustomDomainExchangeRequest
     */
    token: string;
    /**
     * 
     * @type {string}
     * @memberof CustomDomainExchangeRequest
     */
    secret: string;
}
/**
 * 
 * @export
 * @interface CustomDomainExchangeResponse
 */
export interface CustomDomainExchangeResponse {
    /**
     * 
     * @type {string}
     * @memberof CustomDomainExchangeResponse
     */
    token: string;
    /**
     * 
     * @type {string}
     * @memberof CustomDomainExchangeResponse
     */
    expires_at: string;
}
/**
 * 
 * @export
 * @interface CustomDomainForwardResponse
 */
export interface CustomDomainForwardResponse {
    /**
     * 
     * @type {string}
     * @memberof CustomDomainForwardResponse
     */
    token: string;
}
/**
 * @type Data
 * @export
 */
export type Data = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository;

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
     * 
     * @type {string}
     * @memberof Donation
     */
    id: string;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof Donation
     */
    amount: CurrencyAmount;
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
     * @type {string}
     * @memberof Donation
     */
    created_at: string;
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
     * 
     * @type {DonationCurrencyAmount}
     * @memberof DonationCreateStripePaymentIntent
     */
    amount: DonationCurrencyAmount;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    setup_future_usage?: DonationCreateStripePaymentIntentSetupFutureUsageEnum;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    on_behalf_of_organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    message?: string;
    /**
     * 
     * @type {string}
     * @memberof DonationCreateStripePaymentIntent
     */
    issue_id?: string;
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
 * @interface DonationCurrencyAmount
 */
export interface DonationCurrencyAmount {
    /**
     * Three letter currency code (eg: USD)
     * @type {string}
     * @memberof DonationCurrencyAmount
     */
    currency: string;
    /**
     * Amount in the currencies smallest unit (cents if currency is USD)
     * @type {number}
     * @memberof DonationCurrencyAmount
     */
    amount: number;
}
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
     * @type {CurrencyAmount}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    amount: CurrencyAmount;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    fee: CurrencyAmount;
    /**
     * 
     * @type {CurrencyAmount}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    amount_including_fee: CurrencyAmount;
    /**
     * 
     * @type {string}
     * @memberof DonationStripePaymentIntentMutationResponse
     */
    client_secret?: string;
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
     * 
     * @type {DonationCurrencyAmount}
     * @memberof DonationUpdateStripePaymentIntent
     */
    amount: DonationCurrencyAmount;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    setup_future_usage?: DonationUpdateStripePaymentIntentSetupFutureUsageEnum;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    on_behalf_of_organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    message?: string;
    /**
     * 
     * @type {string}
     * @memberof DonationUpdateStripePaymentIntent
     */
    issue_id?: string;
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
 * @interface FileCreate
 */
export interface FileCreate {
    /**
     * 
     * @type {string}
     * @memberof FileCreate
     */
    organization_id: string | null;
    /**
     * 
     * @type {string}
     * @memberof FileCreate
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof FileCreate
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof FileCreate
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof FileCreate
     */
    checksum_sha256_base64: string | null;
    /**
     * 
     * @type {S3FileCreateMultipart}
     * @memberof FileCreate
     */
    upload: S3FileCreateMultipart;
    /**
     * 
     * @type {FileServiceTypes}
     * @memberof FileCreate
     */
    service?: FileServiceTypes;
}
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
    extension: string;
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
    size_readable?: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    storage_version?: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    checksum_etag?: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    checksum_sha256_base64?: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    checksum_sha256_hex?: string;
    /**
     * 
     * @type {string}
     * @memberof FileDownload
     */
    last_modified_at?: string;
    /**
     * 
     * @type {S3DownloadURL}
     * @memberof FileDownload
     */
    download: S3DownloadURL;
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
 * @interface FileRead
 */
export interface FileRead {
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    extension: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    path: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    mime_type: string;
    /**
     * 
     * @type {number}
     * @memberof FileRead
     */
    size: number;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    size_readable?: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    storage_version?: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    checksum_etag?: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    checksum_sha256_base64?: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    checksum_sha256_hex?: string;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    last_modified_at?: string;
    /**
     * 
     * @type {FileServiceTypes}
     * @memberof FileRead
     */
    service: FileServiceTypes;
    /**
     * 
     * @type {boolean}
     * @memberof FileRead
     */
    is_uploaded: boolean;
    /**
     * 
     * @type {string}
     * @memberof FileRead
     */
    created_at: string;
}

/**
 * 
 * @export
 */
export const FileServiceTypes = {
    DOWNLOADABLE: 'downloadable'
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
    extension: string;
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
    size_readable?: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    storage_version?: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    checksum_etag?: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    checksum_sha256_base64?: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    checksum_sha256_hex?: string;
    /**
     * 
     * @type {string}
     * @memberof FileUpload
     */
    last_modified_at?: string;
    /**
     * 
     * @type {S3FileUploadMultipart}
     * @memberof FileUpload
     */
    upload: S3FileUploadMultipart;
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
    body?: string;
    /**
     * 
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
     * 
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
     * 
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
    upfront_split_to_contributors?: number;
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
export type ItemsInner = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository;

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
 * @interface ListResourceAnnotatedUnionBenefitArticlesSubscriberBenefitAdsSubscriberBenefitDiscordSubscriberBenefitCustomSubscriberBenefitGitHubRepositorySubscriberBenefitDownloadablesSubscriberDiscriminatorMergeJSONSchema
 */
export interface ListResourceAnnotatedUnionBenefitArticlesSubscriberBenefitAdsSubscriberBenefitDiscordSubscriberBenefitCustomSubscriberBenefitGitHubRepositorySubscriberBenefitDownloadablesSubscriberDiscriminatorMergeJSONSchema {
    /**
     * 
     * @type {Array<UserBenefit>}
     * @memberof ListResourceAnnotatedUnionBenefitArticlesSubscriberBenefitAdsSubscriberBenefitDiscordSubscriberBenefitCustomSubscriberBenefitGitHubRepositorySubscriberBenefitDownloadablesSubscriberDiscriminatorMergeJSONSchema
     */
    items?: Array<UserBenefit>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceAnnotatedUnionBenefitArticlesSubscriberBenefitAdsSubscriberBenefitDiscordSubscriberBenefitCustomSubscriberBenefitGitHubRepositorySubscriberBenefitDownloadablesSubscriberDiscriminatorMergeJSONSchema
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
 * @interface ListResourceBenefitGrant
 */
export interface ListResourceBenefitGrant {
    /**
     * 
     * @type {Array<BenefitGrant>}
     * @memberof ListResourceBenefitGrant
     */
    items?: Array<BenefitGrant>;
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
    items?: Array<Donation>;
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
    items?: Array<DownloadableRead>;
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
 * @interface ListResourceFileRead
 */
export interface ListResourceFileRead {
    /**
     * 
     * @type {Array<FileRead>}
     * @memberof ListResourceFileRead
     */
    items?: Array<FileRead>;
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
 * @interface ListResourceOAuth2Client
 */
export interface ListResourceOAuth2Client {
    /**
     * 
     * @type {Array<OAuth2Client>}
     * @memberof ListResourceOAuth2Client
     */
    items?: Array<OAuth2Client>;
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
    items?: Array<Order>;
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
 * @interface ListResourceOrganizationCustomer
 */
export interface ListResourceOrganizationCustomer {
    /**
     * 
     * @type {Array<OrganizationCustomer>}
     * @memberof ListResourceOrganizationCustomer
     */
    items?: Array<OrganizationCustomer>;
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
 * @interface ListResourceProduct
 */
export interface ListResourceProduct {
    /**
     * 
     * @type {Array<Product>}
     * @memberof ListResourceProduct
     */
    items?: Array<Product>;
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
    items?: Array<PublicDonation>;
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
 * @interface ListResourceTrafficReferrer
 */
export interface ListResourceTrafficReferrer {
    /**
     * 
     * @type {Array<TrafficReferrer>}
     * @memberof ListResourceTrafficReferrer
     */
    items?: Array<TrafficReferrer>;
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
 * @interface ListResourceUnionBenefitArticlesBenefitAdsBenefitCustomBenefitDiscordBenefitGitHubRepositoryBenefitDownloadables
 */
export interface ListResourceUnionBenefitArticlesBenefitAdsBenefitCustomBenefitDiscordBenefitGitHubRepositoryBenefitDownloadables {
    /**
     * 
     * @type {Array<ItemsInner>}
     * @memberof ListResourceUnionBenefitArticlesBenefitAdsBenefitCustomBenefitDiscordBenefitGitHubRepositoryBenefitDownloadables
     */
    items?: Array<ItemsInner>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceUnionBenefitArticlesBenefitAdsBenefitCustomBenefitDiscordBenefitGitHubRepositoryBenefitDownloadables
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
    items?: Array<UserAdvertisementCampaign>;
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
 * @interface ListResourceUserOrder
 */
export interface ListResourceUserOrder {
    /**
     * 
     * @type {Array<UserOrder>}
     * @memberof ListResourceUserOrder
     */
    items?: Array<UserOrder>;
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
    items?: Array<UserSubscription>;
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
    items?: Array<WebhookDelivery>;
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
    items?: Array<WebhookEndpoint>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceWebhookEndpoint
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceWebhookIntegration
 */
export interface ListResourceWebhookIntegration {
    /**
     * 
     * @type {Array<WebhookIntegration>}
     * @memberof ListResourceWebhookIntegration
     */
    items?: Array<WebhookIntegration>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceWebhookIntegration
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
    /**
     * 
     * @type {string}
     * @memberof MagicLinkRequest
     */
    return_to?: string;
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
    pledger_name?: string;
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
    pledge_id?: string;
    /**
     * 
     * @type {PledgeType}
     * @memberof MaintainerPledgeCreatedNotificationPayload
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
export type NotificationsInner = { type: 'BenefitPreconditionErrorNotification' } & BenefitPreconditionErrorNotification | { type: 'MaintainerAccountReviewedNotification' } & MaintainerAccountReviewedNotification | { type: 'MaintainerAccountUnderReviewNotification' } & MaintainerAccountUnderReviewNotification | { type: 'MaintainerCreateAccountNotification' } & MaintainerCreateAccountNotification | { type: 'MaintainerDonationReceived' } & MaintainerDonationReceivedNotification | { type: 'MaintainerNewPaidSubscriptionNotification' } & MaintainerNewPaidSubscriptionNotification | { type: 'MaintainerPledgeConfirmationPendingNotification' } & MaintainerPledgeConfirmationPendingNotification | { type: 'MaintainerPledgeCreatedNotification' } & MaintainerPledgeCreatedNotification | { type: 'MaintainerPledgePaidNotification' } & MaintainerPledgePaidNotification | { type: 'MaintainerPledgePendingNotification' } & MaintainerPledgePendingNotification | { type: 'MaintainerPledgedIssueConfirmationPendingNotification' } & MaintainerPledgedIssueConfirmationPendingNotification | { type: 'MaintainerPledgedIssuePendingNotification' } & MaintainerPledgedIssuePendingNotification | { type: 'PledgerPledgePendingNotification' } & PledgerPledgePendingNotification | { type: 'RewardPaidNotification' } & RewardPaidNotification | { type: 'TeamAdminMemberPledgedNotification' } & TeamAdminMemberPledgedNotification;
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
    client_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    logo_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    tos_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2Client
     */
    policy_uri?: string;
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
    modified_at?: string;
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
    client_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    logo_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    tos_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfiguration
     */
    policy_uri?: string;
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
    client_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    logo_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    tos_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientConfigurationUpdate
     */
    policy_uri?: string;
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
    modified_at?: string;
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
    client_name?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    client_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    logo_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    tos_uri?: string;
    /**
     * 
     * @type {string}
     * @memberof OAuth2ClientPublic
     */
    policy_uri?: string;
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
    modified_at?: string;
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
    DISCORD: 'discord'
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
    modified_at?: string;
    /**
     * 
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
    subscription_id?: string;
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
    subscription?: OrderSubscription;
}
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
    modified_at?: string;
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
    description?: string;
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
    type?: SubscriptionTierType;
    /**
     * 
     * @type {boolean}
     * @memberof OrderProduct
     */
    is_highlighted?: boolean;
}
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
    modified_at?: string;
    /**
     * 
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
    current_period_end?: string;
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
    started_at?: string;
    /**
     * 
     * @type {string}
     * @memberof OrderSubscription
     */
    ended_at?: string;
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
    price_id?: string;
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
    github_username?: string;
    /**
     * 
     * @type {string}
     * @memberof OrderUser
     */
    avatar_url?: string;
}
/**
 * 
 * @export
 * @interface OrdersStatistics
 */
export interface OrdersStatistics {
    /**
     * 
     * @type {Array<OrdersStatisticsPeriod>}
     * @memberof OrdersStatistics
     */
    periods: Array<OrdersStatisticsPeriod>;
}
/**
 * 
 * @export
 * @interface OrdersStatisticsPeriod
 */
export interface OrdersStatisticsPeriod {
    /**
     * 
     * @type {string}
     * @memberof OrdersStatisticsPeriod
     */
    date: string;
    /**
     * 
     * @type {number}
     * @memberof OrdersStatisticsPeriod
     */
    orders: number;
    /**
     * 
     * @type {number}
     * @memberof OrdersStatisticsPeriod
     */
    earnings: number;
    /**
     * 
     * @type {number}
     * @memberof OrdersStatisticsPeriod
     */
    expected_orders: number;
    /**
     * 
     * @type {number}
     * @memberof OrdersStatisticsPeriod
     */
    expected_earnings: number;
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
     * 
     * @type {boolean}
     * @memberof Organization
     */
    is_personal: boolean;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    bio?: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    pretty_name?: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    company?: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    blog?: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    location?: string;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    email?: string;
    /**
     * 
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
     * 
     * @type {string}
     * @memberof Organization
     */
    account_id?: string;
    /**
     * Whether the organization has the Polar GitHub App installed for repositories or not.
     * @type {boolean}
     * @memberof Organization
     */
    has_app_installed: boolean;
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    custom_domain?: string;
    /**
     * If this organization has a public Polar page
     * @type {boolean}
     * @memberof Organization
     */
    public_page_enabled: boolean;
    /**
     * If this organizations accepts donations
     * @type {boolean}
     * @memberof Organization
     */
    donations_enabled: boolean;
    /**
     * If this organization should make donation timestamps publicly available
     * @type {boolean}
     * @memberof Organization
     */
    public_donation_timestamps: boolean;
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
    /**
     * 
     * @type {string}
     * @memberof Organization
     */
    billing_email?: string;
    /**
     * 
     * @type {number}
     * @memberof Organization
     */
    total_monthly_spending_limit?: number;
    /**
     * 
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
    github_username?: string;
    /**
     * 
     * @type {string}
     * @memberof OrganizationCustomer
     */
    avatar_url?: string;
}

/**
 * 
 * @export
 */
export const OrganizationCustomerType = {
    SUBSCRIPTION: 'subscription',
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
 * @interface OrganizationProfileSettings
 */
export interface OrganizationProfileSettings {
    /**
     * 
     * @type {string}
     * @memberof OrganizationProfileSettings
     */
    description?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof OrganizationProfileSettings
     */
    featured_projects?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OrganizationProfileSettings
     */
    featured_organizations?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof OrganizationProfileSettings
     */
    links?: Array<string>;
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
     * @type {number}
     * @memberof OrganizationUpdate
     */
    total_monthly_spending_limit?: number;
    /**
     * 
     * @type {number}
     * @memberof OrganizationUpdate
     */
    per_user_monthly_spending_limit?: number;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    donations_enabled?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof OrganizationUpdate
     */
    public_donation_timestamps?: boolean;
    /**
     * 
     * @type {OrganizationProfileSettings}
     * @memberof OrganizationUpdate
     */
    profile_settings?: OrganizationProfileSettings;
    /**
     * 
     * @type {OrganizationFeatureSettings}
     * @memberof OrganizationUpdate
     */
    feature_settings?: OrganizationFeatureSettings;
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
 * Type of fees applied by Polar, and billed to the users.
 * @export
 */
export const PlatformFeeType = {
    PLATFORM: 'platform',
    PAYMENT: 'payment',
    SUBSCRIPTION: 'subscription',
    INVOICE: 'invoice',
    CROSS_BORDER_TRANSFER: 'cross_border_transfer',
    PAYOUT: 'payout',
    ACCOUNT: 'account'
} as const;
export type PlatformFeeType = typeof PlatformFeeType[keyof typeof PlatformFeeType];


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
     * Amount pledged towards the issue
     * @type {CurrencyAmount}
     * @memberof Pledge
     */
    amount: CurrencyAmount;
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
    refunded_at?: string;
    /**
     * 
     * @type {string}
     * @memberof Pledge
     */
    scheduled_payout_at?: string;
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
    pledger?: Pledger;
    /**
     * 
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
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentCreate
     */
    setup_future_usage?: PledgeStripePaymentIntentCreateSetupFutureUsageEnum;
    /**
     * 
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
     * 
     * @type {string}
     * @memberof PledgeStripePaymentIntentUpdate
     */
    setup_future_usage?: PledgeStripePaymentIntentUpdateSetupFutureUsageEnum;
    /**
     * 
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
    pledge_id?: string;
    /**
     * 
     * @type {PledgeType}
     * @memberof PledgerPledgePendingNotificationPayload
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
 * @type PricesInner
 * 
 * @export
 */
export type PricesInner = { type: 'one_time' } & ProductPriceOneTime | { type: 'recurring' } & ProductPriceRecurring;
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
    modified_at?: string;
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
    description?: string;
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
    type?: SubscriptionTierType;
    /**
     * 
     * @type {boolean}
     * @memberof Product
     */
    is_highlighted?: boolean;
    /**
     * List of available prices for this product.
     * @type {Array<PricesInner>}
     * @memberof Product
     */
    prices: Array<PricesInner>;
    /**
     * The benefits granted by the product.
     * @type {Array<BenefitPublicInner>}
     * @memberof Product
     */
    benefits: Array<BenefitPublicInner>;
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
    description?: string;
    /**
     * List of available prices for this product.
     * @type {Array<ProductPriceOneTimeCreate>}
     * @memberof ProductOneTimeCreate
     */
    prices: Array<ProductPriceOneTimeCreate>;
    /**
     * 
     * @type {string}
     * @memberof ProductOneTimeCreate
     */
    organization_id?: string;
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
    modified_at?: string;
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
    modified_at?: string;
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
    recurring_interval?: ProductPriceRecurringInterval;
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
    description?: string;
    /**
     * List of available prices for this product.
     * @type {Array<ProductPriceRecurringCreate>}
     * @memberof ProductRecurringCreate
     */
    prices: Array<ProductPriceRecurringCreate>;
    /**
     * 
     * @type {string}
     * @memberof ProductRecurringCreate
     */
    organization_id?: string;
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
    name?: string;
    /**
     * 
     * @type {string}
     * @memberof ProductUpdate
     */
    description?: string;
    /**
     * 
     * @type {boolean}
     * @memberof ProductUpdate
     */
    is_highlighted?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof ProductUpdate
     */
    is_archived?: boolean;
    /**
     * 
     * @type {Array<ProductUpdatePricesInner>}
     * @memberof ProductUpdate
     */
    prices?: Array<ProductUpdatePricesInner>;
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
     * @type {CurrencyAmount}
     * @memberof PublicDonation
     */
    amount: CurrencyAmount;
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
    /**
     * 
     * @type {string}
     * @memberof PublicDonation
     */
    created_at: string | null;
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
     * @type {RepositoryProfileSettings}
     * @memberof Repository
     */
    profile_settings: RepositoryProfileSettings | null;
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
    description?: string;
    /**
     * 
     * @type {string}
     * @memberof RepositoryProfileSettings
     */
    cover_image_url?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettings
     */
    featured_organizations?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettings
     */
    highlighted_subscription_tiers?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettings
     */
    links?: Array<string>;
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
    set_description?: boolean;
    /**
     * 
     * @type {string}
     * @memberof RepositoryProfileSettingsUpdate
     */
    description?: string;
    /**
     * 
     * @type {boolean}
     * @memberof RepositoryProfileSettingsUpdate
     */
    set_cover_image_url?: boolean;
    /**
     * 
     * @type {string}
     * @memberof RepositoryProfileSettingsUpdate
     */
    cover_image_url?: string;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettingsUpdate
     */
    featured_organizations?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettingsUpdate
     */
    highlighted_subscription_tiers?: Array<string>;
    /**
     * 
     * @type {Array<string>}
     * @memberof RepositoryProfileSettingsUpdate
     */
    links?: Array<string>;
}
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
    profile_settings?: RepositoryProfileSettingsUpdate;
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
 * @type ResponseBenefitsCreateBenefit
 * @export
 */
export type ResponseBenefitsCreateBenefit = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository;

/**
 * @type ResponseBenefitsGetBenefit
 * @export
 */
export type ResponseBenefitsGetBenefit = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository;

/**
 * @type ResponseBenefitsUpdateBenefit
 * @export
 */
export type ResponseBenefitsUpdateBenefit = BenefitAds | BenefitArticles | BenefitCustom | BenefitDiscord | BenefitDownloadables | BenefitGitHubRepository;

/**
 * @type ResponseOauth2Oauth2Authorize
 * 
 * @export
 */
export type ResponseOauth2Oauth2Authorize = { sub_type: 'organization' } & AuthorizeResponseOrganization | { sub_type: 'user' } & AuthorizeResponseUser;
/**
 * @type ResponseUsersGetBenefit
 * 
 * @export
 */
export type ResponseUsersGetBenefit = { type: 'ads' } & BenefitAdsSubscriber | { type: 'articles' } & BenefitArticlesSubscriber | { type: 'custom' } & BenefitCustomSubscriber | { type: 'discord' } & BenefitDiscordSubscriber | { type: 'downloadables' } & BenefitDownloadablesSubscriber | { type: 'github_repository' } & BenefitGitHubRepositorySubscriber;
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
    user?: User;
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
     * 
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
    avatar_url?: string;
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
    checksum_sha256_base64: string | null;
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
    checksum_sha256_base64?: string;
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
    checksum_sha256_base64: string | null;
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
    ARTICLESREAD: 'articles:read',
    USERREAD: 'user:read',
    ADMIN: 'admin',
    WEB_DEFAULT: 'web_default',
    ORGANIZATIONSREAD: 'organizations:read',
    ORGANIZATIONSWRITE: 'organizations:write',
    CREATORSUBSCRIPTIONSREAD: 'creator:subscriptions:read',
    CREATORSUBSCRIPTIONSWRITE: 'creator:subscriptions:write',
    CREATORPRODUCTSREAD: 'creator:products:read',
    CREATORPRODUCTSWRITE: 'creator:products:write',
    CREATORBENEFITSREAD: 'creator:benefits:read',
    CREATORBENEFITSWRITE: 'creator:benefits:write',
    ORDERSREAD: 'orders:read',
    WEBHOOKSREAD: 'webhooks:read',
    WEBHOOKSWRITE: 'webhooks:write',
    USERBENEFITSREAD: 'user:benefits:read',
    USERORDERSREAD: 'user:orders:read',
    USERSUBSCRIPTIONSREAD: 'user:subscriptions:read',
    USERSUBSCRIPTIONSWRITE: 'user:subscriptions:write',
    USERADVERTISEMENT_CAMPAIGNSREAD: 'user:advertisement_campaigns:read',
    USERADVERTISEMENT_CAMPAIGNSWRITE: 'user:advertisement_campaigns:write',
    CREATORFILESREAD: 'creator:files:read',
    CREATORFILESWRITE: 'creator:files:write',
    BACKERFILESREAD: 'backer:files:read'
} as const;
export type Scope = typeof Scope[keyof typeof Scope];


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
    price_id?: string;
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
     * @type {UserSubscriptionPrice}
     * @memberof Subscription
     */
    price?: UserSubscriptionPrice;
}
/**
 * 
 * @export
 * @interface SubscriptionCreateEmail
 */
export interface SubscriptionCreateEmail {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionCreateEmail
     */
    email: string;
}

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
    github_username?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    avatar_url?: string;
}
/**
 * 
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
    earnings: number;
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
    article_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TrackPageView
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TrackPageView
     */
    referrer?: string;
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
    article_id?: string;
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
    processor?: PaymentProcessor;
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
    platform_fee_type?: PlatformFeeType;
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
    product_price_id?: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    payout_transaction_id?: string;
    /**
     * 
     * @type {string}
     * @memberof Transaction
     */
    incurred_by_transaction_id?: string;
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
     * @type {TransactionOrder}
     * @memberof Transaction
     */
    order?: TransactionOrder;
    /**
     * 
     * @type {TransactionDonation}
     * @memberof Transaction
     */
    donation?: TransactionDonation;
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
    processor?: PaymentProcessor;
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
    platform_fee_type?: PlatformFeeType;
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
    product_price_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    payout_transaction_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionDetails
     */
    incurred_by_transaction_id?: string;
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
     * @type {TransactionOrder}
     * @memberof TransactionDetails
     */
    order?: TransactionOrder;
    /**
     * 
     * @type {TransactionDonation}
     * @memberof TransactionDetails
     */
    donation?: TransactionDonation;
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
    modified_at?: string;
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
    to_organization?: TransactionOrganization;
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
    modified_at?: string;
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
    processor?: PaymentProcessor;
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
    platform_fee_type?: PlatformFeeType;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    pledge_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    issue_reward_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    subscription_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    product_price_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    payout_transaction_id?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionEmbedded
     */
    incurred_by_transaction_id?: string;
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
    modified_at?: string;
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
     * @type {TransactionProductPrice}
     * @memberof TransactionOrder
     */
    product_price: TransactionProductPrice;
    /**
     * 
     * @type {string}
     * @memberof TransactionOrder
     */
    subscription_id?: string;
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
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionProduct
     */
    id: string;
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof TransactionProduct
     */
    type: SubscriptionTierType;
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
    organization_id?: string;
    /**
     * 
     * @type {TransactionOrganization}
     * @memberof TransactionProduct
     */
    organization?: TransactionOrganization;
}
/**
 * 
 * @export
 * @interface TransactionProductPrice
 */
export interface TransactionProductPrice {
    /**
     * Creation timestamp of the object.
     * @type {string}
     * @memberof TransactionProductPrice
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionProductPrice
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof TransactionProductPrice
     */
    id: string;
    /**
     * 
     * @type {ProductPriceType}
     * @memberof TransactionProductPrice
     */
    type: ProductPriceType;
    /**
     * 
     * @type {ProductPriceRecurringInterval}
     * @memberof TransactionProductPrice
     */
    recurring_interval: ProductPriceRecurringInterval;
    /**
     * 
     * @type {number}
     * @memberof TransactionProductPrice
     */
    price_amount: number;
    /**
     * 
     * @type {string}
     * @memberof TransactionProductPrice
     */
    price_currency: string;
    /**
     * 
     * @type {boolean}
     * @memberof TransactionProductPrice
     */
    is_archived: boolean;
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
 * Type of transactions.
 * @export
 */
export const TransactionType = {
    PAYMENT: 'payment',
    PROCESSOR_FEE: 'processor_fee',
    REFUND: 'refund',
    DISPUTE: 'dispute',
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
    modified_at?: string;
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
    image_url_dark?: string;
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
    image_url_dark?: string;
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
     * 
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
    image_url?: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignUpdate
     */
    image_url_dark?: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignUpdate
     */
    text?: string;
    /**
     * 
     * @type {string}
     * @memberof UserAdvertisementCampaignUpdate
     */
    link_url?: string;
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
    avatar_url?: string;
    /**
     * 
     * @type {object}
     * @memberof UserBase
     */
    profile: object;
    /**
     * 
     * @type {string}
     * @memberof UserBase
     */
    account_id?: string;
}
/**
 * @type UserBenefit
 * 
 * @export
 */
export type UserBenefit = { type: 'ads' } & BenefitAdsSubscriber | { type: 'articles' } & BenefitArticlesSubscriber | { type: 'custom' } & BenefitCustomSubscriber | { type: 'discord' } & BenefitDiscordSubscriber | { type: 'downloadables' } & BenefitDownloadablesSubscriber | { type: 'github_repository' } & BenefitGitHubRepositorySubscriber;
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
    customer_email?: string;
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
    modified_at?: string;
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
    subscription_id?: string;
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
    subscription?: UserOrderSubscription;
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
    modified_at?: string;
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
    description?: string;
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
    type?: SubscriptionTierType;
    /**
     * 
     * @type {boolean}
     * @memberof UserOrderProduct
     */
    is_highlighted?: boolean;
    /**
     * List of available prices for this product.
     * @type {Array<PricesInner>}
     * @memberof UserOrderProduct
     */
    prices: Array<PricesInner>;
    /**
     * The benefits granted by the product.
     * @type {Array<BenefitPublicInner>}
     * @memberof UserOrderProduct
     */
    benefits: Array<BenefitPublicInner>;
}
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
    modified_at?: string;
    /**
     * 
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
    current_period_end?: string;
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
    started_at?: string;
    /**
     * 
     * @type {string}
     * @memberof UserOrderSubscription
     */
    ended_at?: string;
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
    price_id?: string;
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
    account_id?: string;
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
    modified_at?: string;
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
    current_period_end?: string;
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
    started_at?: string;
    /**
     * 
     * @type {string}
     * @memberof UserSubscription
     */
    ended_at?: string;
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
    organization_id?: string;
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
    price_id?: string;
    /**
     * 
     * @type {UserSubscriptionProduct}
     * @memberof UserSubscription
     */
    product: UserSubscriptionProduct;
    /**
     * 
     * @type {UserSubscriptionPrice}
     * @memberof UserSubscription
     */
    price?: UserSubscriptionPrice;
}
/**
 * @type UserSubscriptionPrice
 * 
 * @export
 */
export type UserSubscriptionPrice = { type: 'one_time' } & ProductPriceOneTime | { type: 'recurring' } & ProductPriceRecurring;
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
    modified_at?: string;
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
    description?: string;
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
    type?: SubscriptionTierType;
    /**
     * 
     * @type {boolean}
     * @memberof UserSubscriptionProduct
     */
    is_highlighted?: boolean;
    /**
     * List of available prices for this product.
     * @type {Array<PricesInner>}
     * @memberof UserSubscriptionProduct
     */
    prices: Array<PricesInner>;
    /**
     * The benefits granted by the product.
     * @type {Array<BenefitPublicInner>}
     * @memberof UserSubscriptionProduct
     */
    benefits: Array<BenefitPublicInner>;
}
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
 * 
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
     * @type {Data}
     * @memberof WebhookBenefitCreatedPayload
     */
    data: Data;
}


/**
 * @export
 */
export const WebhookBenefitCreatedPayloadTypeEnum = {
    BENEFIT_CREATED: 'benefit.created'
} as const;
export type WebhookBenefitCreatedPayloadTypeEnum = typeof WebhookBenefitCreatedPayloadTypeEnum[keyof typeof WebhookBenefitCreatedPayloadTypeEnum];

/**
 * 
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
     * @type {Data}
     * @memberof WebhookBenefitUpdatedPayload
     */
    data: Data;
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
    modified_at?: string;
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
    http_code?: number;
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
 * 
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
    modified_at?: string;
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
     * @type {string}
     * @memberof WebhookEndpoint
     */
    user_id?: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookEndpoint
     */
    organization_id?: string;
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
     * 
     * @type {string}
     * @memberof WebhookEndpointCreate
     */
    organization_id?: string;
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
    url?: string;
    /**
     * The secret used to sign the webhook events.
     * @type {string}
     * @memberof WebhookEndpointUpdate
     */
    secret?: string;
    /**
     * The events that will trigger the webhook.
     * @type {Array<WebhookEventType>}
     * @memberof WebhookEndpointUpdate
     */
    events?: Array<WebhookEventType>;
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
    modified_at?: string;
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
    last_http_code?: number;
    /**
     * 
     * @type {boolean}
     * @memberof WebhookEvent
     */
    succeeded?: boolean;
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
 * @interface WebhookIntegration
 */
export interface WebhookIntegration {
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegration
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegration
     */
    integration: WebhookIntegrationIntegrationEnum;
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegration
     */
    url: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegration
     */
    organization_id: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegration
     */
    created_at: string;
}


/**
 * @export
 */
export const WebhookIntegrationIntegrationEnum = {
    SLACK: 'slack',
    DISCORD: 'discord'
} as const;
export type WebhookIntegrationIntegrationEnum = typeof WebhookIntegrationIntegrationEnum[keyof typeof WebhookIntegrationIntegrationEnum];

/**
 * 
 * @export
 * @interface WebhookIntegrationCreate
 */
export interface WebhookIntegrationCreate {
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegrationCreate
     */
    integration: WebhookIntegrationCreateIntegrationEnum;
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegrationCreate
     */
    url: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegrationCreate
     */
    organization_id: string;
}


/**
 * @export
 */
export const WebhookIntegrationCreateIntegrationEnum = {
    SLACK: 'slack',
    DISCORD: 'discord'
} as const;
export type WebhookIntegrationCreateIntegrationEnum = typeof WebhookIntegrationCreateIntegrationEnum[keyof typeof WebhookIntegrationCreateIntegrationEnum];

/**
 * 
 * @export
 * @interface WebhookIntegrationUpdate
 */
export interface WebhookIntegrationUpdate {
    /**
     * 
     * @type {string}
     * @memberof WebhookIntegrationUpdate
     */
    url: string;
}
/**
 * 
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
 * 
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
 * 
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
 * 
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
 * 
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
    message?: string;
    /**
     * 
     * @type {string}
     * @memberof WebhookResponse
     */
    job_id?: string;
}
/**
 * 
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
 * 
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

