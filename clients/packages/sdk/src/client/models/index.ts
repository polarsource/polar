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
    is_details_submitted?: boolean;
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
    subscription_id: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaign
     */
    subscription_benefit_id: string;
    /**
     * 
     * @type {number}
     * @memberof AdvertisementCampaign
     */
    views: number;
    /**
     * 
     * @type {number}
     * @memberof AdvertisementCampaign
     */
    clicks: number;
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
 * @interface AdvertisementCampaignPublic
 */
export interface AdvertisementCampaignPublic {
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaignPublic
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaignPublic
     */
    image_url: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaignPublic
     */
    image_url_dark?: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaignPublic
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementCampaignPublic
     */
    link_url: string;
}
/**
 * 
 * @export
 * @interface AdvertisementDisplay
 */
export interface AdvertisementDisplay {
    /**
     * 
     * @type {string}
     * @memberof AdvertisementDisplay
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementDisplay
     */
    image_url: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementDisplay
     */
    image_url_dark?: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementDisplay
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof AdvertisementDisplay
     */
    link_url: string;
    /**
     * 
     * @type {number}
     * @memberof AdvertisementDisplay
     */
    height?: number;
    /**
     * 
     * @type {number}
     * @memberof AdvertisementDisplay
     */
    width?: number;
}
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
     * Slug of the article to be used in URLs. If no slug is provided one will be generated from the title.
     * @type {string}
     * @memberof ArticleCreate
     */
    slug?: string;
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
    /**
     * If the article should be pinned
     * @type {boolean}
     * @memberof ArticleCreate
     */
    is_pinned?: boolean;
    /**
     * Custom og:image URL value
     * @type {string}
     * @memberof ArticleCreate
     */
    og_image_url?: string;
    /**
     * Custom og:description value
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
     * Set to true for changes to published_at to take effect.
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
    /**
     * If the article should be pinned
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    is_pinned?: boolean;
    /**
     * Set to true for changes to og_image_url to take effect.
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    set_og_image_url?: boolean;
    /**
     * Custom og:image URL value
     * @type {string}
     * @memberof ArticleUpdate
     */
    og_image_url?: string;
    /**
     * Set to true for changes to og_description to take effect.
     * @type {boolean}
     * @memberof ArticleUpdate
     */
    set_og_description?: boolean;
    /**
     * Custom og:description value
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
 * @type BenefitsInner
 * @export
 */
export type BenefitsInner = SubscriptionBenefitArticles | SubscriptionBenefitBase;

/**
 * @type BenefitsInner1
 * @export
 */
export type BenefitsInner1 = SubscriptionBenefitAdsSubscriber | SubscriptionBenefitArticlesSubscriber | SubscriptionBenefitCustomSubscriber | SubscriptionBenefitDiscordSubscriber | SubscriptionBenefitGitHubRepositorySubscriber;

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
 * @interface CreateAdvertisementCampaign
 */
export interface CreateAdvertisementCampaign {
    /**
     * 
     * @type {string}
     * @memberof CreateAdvertisementCampaign
     */
    subscription_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAdvertisementCampaign
     */
    subscription_benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAdvertisementCampaign
     */
    image_url: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAdvertisementCampaign
     */
    image_url_dark?: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAdvertisementCampaign
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof CreateAdvertisementCampaign
     */
    link_url: string;
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
    USERREAD: 'user:read'
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
 * @interface CustomDomainExchangeRequest
 */
export interface CustomDomainExchangeRequest {
    /**
     * 
     * @type {string}
     * @memberof CustomDomainExchangeRequest
     */
    token: string;
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
 * @interface EditAdvertisementCampaign
 */
export interface EditAdvertisementCampaign {
    /**
     * 
     * @type {string}
     * @memberof EditAdvertisementCampaign
     */
    image_url: string;
    /**
     * 
     * @type {string}
     * @memberof EditAdvertisementCampaign
     */
    image_url_dark?: string;
    /**
     * 
     * @type {string}
     * @memberof EditAdvertisementCampaign
     */
    text: string;
    /**
     * 
     * @type {string}
     * @memberof EditAdvertisementCampaign
     */
    link_url: string;
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
 * 
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
export type ItemsInner = SubscriptionBenefitAds | SubscriptionBenefitArticles | SubscriptionBenefitCustom | SubscriptionBenefitDiscord | SubscriptionBenefitGitHubRepository;

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
 * @interface ListResourceAdvertisementCampaign
 */
export interface ListResourceAdvertisementCampaign {
    /**
     * 
     * @type {Array<AdvertisementCampaign>}
     * @memberof ListResourceAdvertisementCampaign
     */
    items?: Array<AdvertisementCampaign>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceAdvertisementCampaign
     */
    pagination: Pagination;
}
/**
 * 
 * @export
 * @interface ListResourceAdvertisementDisplay
 */
export interface ListResourceAdvertisementDisplay {
    /**
     * 
     * @type {Array<AdvertisementDisplay>}
     * @memberof ListResourceAdvertisementDisplay
     */
    items?: Array<AdvertisementDisplay>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceAdvertisementDisplay
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
 * @interface ListResourceSubscriptionSubscriber
 */
export interface ListResourceSubscriptionSubscriber {
    /**
     * 
     * @type {Array<SubscriptionSubscriber>}
     * @memberof ListResourceSubscriptionSubscriber
     */
    items?: Array<SubscriptionSubscriber>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceSubscriptionSubscriber
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
 * @interface ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitAdsSubscriptionBenefitCustomSubscriptionBenefitDiscordSubscriptionBenefitGitHubRepository
 */
export interface ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitAdsSubscriptionBenefitCustomSubscriptionBenefitDiscordSubscriptionBenefitGitHubRepository {
    /**
     * 
     * @type {Array<ItemsInner>}
     * @memberof ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitAdsSubscriptionBenefitCustomSubscriptionBenefitDiscordSubscriptionBenefitGitHubRepository
     */
    items?: Array<ItemsInner>;
    /**
     * 
     * @type {Pagination}
     * @memberof ListResourceUnionSubscriptionBenefitArticlesSubscriptionBenefitAdsSubscriptionBenefitCustomSubscriptionBenefitDiscordSubscriptionBenefitGitHubRepository
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
 * @type NotificationsInner
 * 
 * @export
 */
export type NotificationsInner = { type: 'MaintainerAccountReviewedNotification' } & MaintainerAccountReviewedNotification | { type: 'MaintainerAccountUnderReviewNotification' } & MaintainerAccountUnderReviewNotification | { type: 'MaintainerCreateAccountNotification' } & MaintainerCreateAccountNotification | { type: 'MaintainerNewPaidSubscriptionNotification' } & MaintainerNewPaidSubscriptionNotification | { type: 'MaintainerPledgeConfirmationPendingNotification' } & MaintainerPledgeConfirmationPendingNotification | { type: 'MaintainerPledgeCreatedNotification' } & MaintainerPledgeCreatedNotification | { type: 'MaintainerPledgePaidNotification' } & MaintainerPledgePaidNotification | { type: 'MaintainerPledgePendingNotification' } & MaintainerPledgePendingNotification | { type: 'MaintainerPledgedIssueConfirmationPendingNotification' } & MaintainerPledgedIssueConfirmationPendingNotification | { type: 'MaintainerPledgedIssuePendingNotification' } & MaintainerPledgedIssuePendingNotification | { type: 'PledgerPledgePendingNotification' } & PledgerPledgePendingNotification | { type: 'RewardPaidNotification' } & RewardPaidNotification | { type: 'SubscriptionBenefitPreconditionErrorNotification' } & SubscriptionBenefitPreconditionErrorNotification | { type: 'TeamAdminMemberPledgedNotification' } & TeamAdminMemberPledgedNotification;
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
    account_username: string;
}

/**
 * 
 * @export
 */
export const OAuthPlatform = {
    GITHUB: 'github',
    DISCORD: 'discord'
} as const;
export type OAuthPlatform = typeof OAuthPlatform[keyof typeof OAuthPlatform];

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
export type ResponseSubscriptionsCreateSubscriptionBenefit = SubscriptionBenefitAds | SubscriptionBenefitArticles | SubscriptionBenefitCustom | SubscriptionBenefitDiscord | SubscriptionBenefitGitHubRepository;

/**
 * @type ResponseSubscriptionsLookupSubscriptionBenefit
 * @export
 */
export type ResponseSubscriptionsLookupSubscriptionBenefit = SubscriptionBenefitAds | SubscriptionBenefitArticles | SubscriptionBenefitCustom | SubscriptionBenefitDiscord | SubscriptionBenefitGitHubRepository;

/**
 * @type ResponseSubscriptionsUpdateSubscriptionBenefit
 * @export
 */
export type ResponseSubscriptionsUpdateSubscriptionBenefit = SubscriptionBenefitAds | SubscriptionBenefitArticles | SubscriptionBenefitCustom | SubscriptionBenefitDiscord | SubscriptionBenefitGitHubRepository;

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
 */
export const Status = {
    CREATED: 'created',
    ONBOARDING_STARTED: 'onboarding_started',
    UNREVIEWED: 'unreviewed',
    UNDER_REVIEW: 'under_review',
    ACTIVE: 'active'
} as const;
export type Status = typeof Status[keyof typeof Status];

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
     * @type {string}
     * @memberof SubscribeSession
     */
    organization_subscriber_id?: string;
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
     * ID of the Organization on behalf which you want to subscribe this tier to. You need to be an administrator of the Organization to do this.
     * @type {string}
     * @memberof SubscribeSessionCreate
     */
    organization_subscriber_id?: string;
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
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof Subscription
     */
    subscription_tier_id: string;
    /**
     * 
     * @type {SubscriptionUser}
     * @memberof Subscription
     */
    user: SubscriptionUser;
    /**
     * 
     * @type {SubscriptionOrganization}
     * @memberof Subscription
     */
    organization?: SubscriptionOrganization;
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
 * @interface SubscriptionBenefitAds
 */
export interface SubscriptionBenefitAds {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAds
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAds
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAds
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAds
     */
    type: SubscriptionBenefitAdsTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAds
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitAds
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitAds
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAds
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAds
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitAdsProperties}
     * @memberof SubscriptionBenefitAds
     */
    properties: SubscriptionBenefitAdsProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitAdsTypeEnum = {
    ADS: 'ads'
} as const;
export type SubscriptionBenefitAdsTypeEnum = typeof SubscriptionBenefitAdsTypeEnum[keyof typeof SubscriptionBenefitAdsTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitAdsCreate
 */
export interface SubscriptionBenefitAdsCreate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsCreate
     */
    repository_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsCreate
     */
    type: SubscriptionBenefitAdsCreateTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitAdsProperties}
     * @memberof SubscriptionBenefitAdsCreate
     */
    properties: SubscriptionBenefitAdsProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitAdsCreateTypeEnum = {
    ADS: 'ads'
} as const;
export type SubscriptionBenefitAdsCreateTypeEnum = typeof SubscriptionBenefitAdsCreateTypeEnum[keyof typeof SubscriptionBenefitAdsCreateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitAdsProperties
 */
export interface SubscriptionBenefitAdsProperties {
    /**
     * 
     * @type {number}
     * @memberof SubscriptionBenefitAdsProperties
     */
    image_height?: number;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionBenefitAdsProperties
     */
    image_width?: number;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitAdsSubscriber
 */
export interface SubscriptionBenefitAdsSubscriber {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    type: SubscriptionBenefitAdsSubscriberTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitAdsProperties}
     * @memberof SubscriptionBenefitAdsSubscriber
     */
    properties: SubscriptionBenefitAdsProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitAdsSubscriberTypeEnum = {
    ADS: 'ads'
} as const;
export type SubscriptionBenefitAdsSubscriberTypeEnum = typeof SubscriptionBenefitAdsSubscriberTypeEnum[keyof typeof SubscriptionBenefitAdsSubscriberTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitAdsUpdate
 */
export interface SubscriptionBenefitAdsUpdate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsUpdate
     */
    description?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitAdsUpdate
     */
    type: SubscriptionBenefitAdsUpdateTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitAdsProperties}
     * @memberof SubscriptionBenefitAdsUpdate
     */
    properties?: SubscriptionBenefitAdsProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitAdsUpdateTypeEnum = {
    ADS: 'ads'
} as const;
export type SubscriptionBenefitAdsUpdateTypeEnum = typeof SubscriptionBenefitAdsUpdateTypeEnum[keyof typeof SubscriptionBenefitAdsUpdateTypeEnum];

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
     * @type {boolean}
     * @memberof SubscriptionBenefitArticles
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitArticles
     */
    deletable: boolean;
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
 * @interface SubscriptionBenefitArticlesSubscriber
 */
export interface SubscriptionBenefitArticlesSubscriber {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    type: SubscriptionBenefitArticlesSubscriberTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitArticlesSubscriberProperties}
     * @memberof SubscriptionBenefitArticlesSubscriber
     */
    properties: SubscriptionBenefitArticlesSubscriberProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitArticlesSubscriberTypeEnum = {
    ARTICLES: 'articles'
} as const;
export type SubscriptionBenefitArticlesSubscriberTypeEnum = typeof SubscriptionBenefitArticlesSubscriberTypeEnum[keyof typeof SubscriptionBenefitArticlesSubscriberTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitArticlesSubscriberProperties
 */
export interface SubscriptionBenefitArticlesSubscriberProperties {
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitArticlesSubscriberProperties
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
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitArticlesUpdate
     */
    type: SubscriptionBenefitArticlesUpdateTypeEnum;
}


/**
 * @export
 */
export const SubscriptionBenefitArticlesUpdateTypeEnum = {
    ARTICLES: 'articles'
} as const;
export type SubscriptionBenefitArticlesUpdateTypeEnum = typeof SubscriptionBenefitArticlesUpdateTypeEnum[keyof typeof SubscriptionBenefitArticlesUpdateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitBase
 */
export interface SubscriptionBenefitBase {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitBase
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitBase
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitBase
     */
    id: string;
    /**
     * 
     * @type {SubscriptionBenefitType}
     * @memberof SubscriptionBenefitBase
     */
    type: SubscriptionBenefitType;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitBase
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitBase
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitBase
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitBase
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitBase
     */
    repository_id?: string;
}
/**
 * @type SubscriptionBenefitCreate
 * 
 * @export
 */
export type SubscriptionBenefitCreate = { type: 'ads' } & SubscriptionBenefitAdsCreate | { type: 'custom' } & SubscriptionBenefitCustomCreate | { type: 'discord' } & SubscriptionBenefitDiscordCreate | { type: 'github_repository' } & SubscriptionBenefitGitHubRepositoryCreate;
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
     * @type {boolean}
     * @memberof SubscriptionBenefitCustom
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitCustom
     */
    deletable: boolean;
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
     * @type {SubscriptionBenefitCustomProperties}
     * @memberof SubscriptionBenefitCustom
     */
    properties: SubscriptionBenefitCustomProperties;
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
    /**
     * 
     * @type {SubscriptionBenefitCustomProperties}
     * @memberof SubscriptionBenefitCustomCreate
     */
    properties: SubscriptionBenefitCustomProperties;
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
 * @interface SubscriptionBenefitCustomProperties
 */
export interface SubscriptionBenefitCustomProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomProperties
     */
    note?: string;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitCustomSubscriber
 */
export interface SubscriptionBenefitCustomSubscriber {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    type: SubscriptionBenefitCustomSubscriberTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitCustomSubscriberProperties}
     * @memberof SubscriptionBenefitCustomSubscriber
     */
    properties: SubscriptionBenefitCustomSubscriberProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitCustomSubscriberTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type SubscriptionBenefitCustomSubscriberTypeEnum = typeof SubscriptionBenefitCustomSubscriberTypeEnum[keyof typeof SubscriptionBenefitCustomSubscriberTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitCustomSubscriberProperties
 */
export interface SubscriptionBenefitCustomSubscriberProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitCustomSubscriberProperties
     */
    note?: string;
}
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
     * @type {string}
     * @memberof SubscriptionBenefitCustomUpdate
     */
    type: SubscriptionBenefitCustomUpdateTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitCustomProperties}
     * @memberof SubscriptionBenefitCustomUpdate
     */
    properties?: SubscriptionBenefitCustomProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitCustomUpdateTypeEnum = {
    CUSTOM: 'custom'
} as const;
export type SubscriptionBenefitCustomUpdateTypeEnum = typeof SubscriptionBenefitCustomUpdateTypeEnum[keyof typeof SubscriptionBenefitCustomUpdateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitDiscord
 */
export interface SubscriptionBenefitDiscord {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscord
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscord
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscord
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscord
     */
    type: SubscriptionBenefitDiscordTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscord
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitDiscord
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitDiscord
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscord
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscord
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitDiscordProperties}
     * @memberof SubscriptionBenefitDiscord
     */
    properties: SubscriptionBenefitDiscordProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitDiscordTypeEnum = {
    DISCORD: 'discord'
} as const;
export type SubscriptionBenefitDiscordTypeEnum = typeof SubscriptionBenefitDiscordTypeEnum[keyof typeof SubscriptionBenefitDiscordTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitDiscordCreate
 */
export interface SubscriptionBenefitDiscordCreate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordCreate
     */
    repository_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordCreate
     */
    type: SubscriptionBenefitDiscordCreateTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitDiscordCreateProperties}
     * @memberof SubscriptionBenefitDiscordCreate
     */
    properties: SubscriptionBenefitDiscordCreateProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitDiscordCreateTypeEnum = {
    DISCORD: 'discord'
} as const;
export type SubscriptionBenefitDiscordCreateTypeEnum = typeof SubscriptionBenefitDiscordCreateTypeEnum[keyof typeof SubscriptionBenefitDiscordCreateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitDiscordCreateProperties
 */
export interface SubscriptionBenefitDiscordCreateProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordCreateProperties
     */
    guild_token: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordCreateProperties
     */
    role_id: string;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitDiscordProperties
 */
export interface SubscriptionBenefitDiscordProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordProperties
     */
    guild_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordProperties
     */
    role_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordProperties
     */
    readonly guild_token: string;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitDiscordSubscriber
 */
export interface SubscriptionBenefitDiscordSubscriber {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    type: SubscriptionBenefitDiscordSubscriberTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitDiscordSubscriberProperties}
     * @memberof SubscriptionBenefitDiscordSubscriber
     */
    properties: SubscriptionBenefitDiscordSubscriberProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitDiscordSubscriberTypeEnum = {
    DISCORD: 'discord'
} as const;
export type SubscriptionBenefitDiscordSubscriberTypeEnum = typeof SubscriptionBenefitDiscordSubscriberTypeEnum[keyof typeof SubscriptionBenefitDiscordSubscriberTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitDiscordSubscriberProperties
 */
export interface SubscriptionBenefitDiscordSubscriberProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordSubscriberProperties
     */
    guild_id: string;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitDiscordUpdate
 */
export interface SubscriptionBenefitDiscordUpdate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordUpdate
     */
    description?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitDiscordUpdate
     */
    type: SubscriptionBenefitDiscordUpdateTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitDiscordCreateProperties}
     * @memberof SubscriptionBenefitDiscordUpdate
     */
    properties?: SubscriptionBenefitDiscordCreateProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitDiscordUpdateTypeEnum = {
    DISCORD: 'discord'
} as const;
export type SubscriptionBenefitDiscordUpdateTypeEnum = typeof SubscriptionBenefitDiscordUpdateTypeEnum[keyof typeof SubscriptionBenefitDiscordUpdateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitGitHubRepository
 */
export interface SubscriptionBenefitGitHubRepository {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    type: SubscriptionBenefitGitHubRepositoryTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitGitHubRepositoryProperties}
     * @memberof SubscriptionBenefitGitHubRepository
     */
    properties: SubscriptionBenefitGitHubRepositoryProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitGitHubRepositoryTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type SubscriptionBenefitGitHubRepositoryTypeEnum = typeof SubscriptionBenefitGitHubRepositoryTypeEnum[keyof typeof SubscriptionBenefitGitHubRepositoryTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitGitHubRepositoryCreate
 */
export interface SubscriptionBenefitGitHubRepositoryCreate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryCreate
     */
    description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryCreate
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryCreate
     */
    repository_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryCreate
     */
    type: SubscriptionBenefitGitHubRepositoryCreateTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitGitHubRepositoryCreateProperties}
     * @memberof SubscriptionBenefitGitHubRepositoryCreate
     */
    properties: SubscriptionBenefitGitHubRepositoryCreateProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitGitHubRepositoryCreateTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type SubscriptionBenefitGitHubRepositoryCreateTypeEnum = typeof SubscriptionBenefitGitHubRepositoryCreateTypeEnum[keyof typeof SubscriptionBenefitGitHubRepositoryCreateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitGitHubRepositoryCreateProperties
 */
export interface SubscriptionBenefitGitHubRepositoryCreateProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryCreateProperties
     */
    repository_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryCreateProperties
     */
    permission: SubscriptionBenefitGitHubRepositoryCreatePropertiesPermissionEnum;
}


/**
 * @export
 */
export const SubscriptionBenefitGitHubRepositoryCreatePropertiesPermissionEnum = {
    PULL: 'pull',
    TRIAGE: 'triage',
    PUSH: 'push',
    MAINTAIN: 'maintain',
    ADMIN: 'admin'
} as const;
export type SubscriptionBenefitGitHubRepositoryCreatePropertiesPermissionEnum = typeof SubscriptionBenefitGitHubRepositoryCreatePropertiesPermissionEnum[keyof typeof SubscriptionBenefitGitHubRepositoryCreatePropertiesPermissionEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitGitHubRepositoryProperties
 */
export interface SubscriptionBenefitGitHubRepositoryProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryProperties
     */
    repository_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryProperties
     */
    repository_owner: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryProperties
     */
    repository_name: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryProperties
     */
    permission: SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum;
}


/**
 * @export
 */
export const SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum = {
    PULL: 'pull',
    TRIAGE: 'triage',
    PUSH: 'push',
    MAINTAIN: 'maintain',
    ADMIN: 'admin'
} as const;
export type SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum = typeof SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum[keyof typeof SubscriptionBenefitGitHubRepositoryPropertiesPermissionEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitGitHubRepositorySubscriber
 */
export interface SubscriptionBenefitGitHubRepositorySubscriber {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    type: SubscriptionBenefitGitHubRepositorySubscriberTypeEnum;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    description: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    selectable: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    deletable: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    repository_id?: string;
    /**
     * 
     * @type {SubscriptionBenefitGitHubRepositorySubscriberProperties}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriber
     */
    properties: SubscriptionBenefitGitHubRepositorySubscriberProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitGitHubRepositorySubscriberTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type SubscriptionBenefitGitHubRepositorySubscriberTypeEnum = typeof SubscriptionBenefitGitHubRepositorySubscriberTypeEnum[keyof typeof SubscriptionBenefitGitHubRepositorySubscriberTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitGitHubRepositorySubscriberProperties
 */
export interface SubscriptionBenefitGitHubRepositorySubscriberProperties {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriberProperties
     */
    repository_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriberProperties
     */
    repository_owner: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositorySubscriberProperties
     */
    repository_name: string;
}
/**
 * 
 * @export
 * @interface SubscriptionBenefitGitHubRepositoryUpdate
 */
export interface SubscriptionBenefitGitHubRepositoryUpdate {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryUpdate
     */
    description?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitGitHubRepositoryUpdate
     */
    type: SubscriptionBenefitGitHubRepositoryUpdateTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitGitHubRepositoryCreateProperties}
     * @memberof SubscriptionBenefitGitHubRepositoryUpdate
     */
    properties?: SubscriptionBenefitGitHubRepositoryCreateProperties;
}


/**
 * @export
 */
export const SubscriptionBenefitGitHubRepositoryUpdateTypeEnum = {
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type SubscriptionBenefitGitHubRepositoryUpdateTypeEnum = typeof SubscriptionBenefitGitHubRepositoryUpdateTypeEnum[keyof typeof SubscriptionBenefitGitHubRepositoryUpdateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitPreconditionErrorNotification
 */
export interface SubscriptionBenefitPreconditionErrorNotification {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotification
     */
    id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotification
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotification
     */
    type: SubscriptionBenefitPreconditionErrorNotificationTypeEnum;
    /**
     * 
     * @type {SubscriptionBenefitPreconditionErrorNotificationPayload}
     * @memberof SubscriptionBenefitPreconditionErrorNotification
     */
    payload: SubscriptionBenefitPreconditionErrorNotificationPayload;
}


/**
 * @export
 */
export const SubscriptionBenefitPreconditionErrorNotificationTypeEnum = {
    SUBSCRIPTION_BENEFIT_PRECONDITION_ERROR_NOTIFICATION: 'SubscriptionBenefitPreconditionErrorNotification'
} as const;
export type SubscriptionBenefitPreconditionErrorNotificationTypeEnum = typeof SubscriptionBenefitPreconditionErrorNotificationTypeEnum[keyof typeof SubscriptionBenefitPreconditionErrorNotificationTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionBenefitPreconditionErrorNotificationPayload
 */
export interface SubscriptionBenefitPreconditionErrorNotificationPayload {
    /**
     * 
     * @type {object}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    extra_context?: object;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    subject_template: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    body_template: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    subscription_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    subscription_tier_name: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    subscription_tier_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    subscription_benefit_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    subscription_benefit_description: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionBenefitPreconditionErrorNotificationPayload
     */
    organization_name: string;
}

/**
 * 
 * @export
 */
export const SubscriptionBenefitType = {
    CUSTOM: 'custom',
    ARTICLES: 'articles',
    ADS: 'ads',
    DISCORD: 'discord',
    GITHUB_REPOSITORY: 'github_repository'
} as const;
export type SubscriptionBenefitType = typeof SubscriptionBenefitType[keyof typeof SubscriptionBenefitType];

/**
 * @type SubscriptionBenefitUpdate
 * @export
 */
export type SubscriptionBenefitUpdate = SubscriptionBenefitAdsUpdate | SubscriptionBenefitArticlesUpdate | SubscriptionBenefitCustomUpdate | SubscriptionBenefitDiscordUpdate | SubscriptionBenefitGitHubRepositoryUpdate;

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
 * @interface SubscriptionOrganization
 */
export interface SubscriptionOrganization {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionOrganization
     */
    name: string;
    /**
     * 
     * @type {Platforms}
     * @memberof SubscriptionOrganization
     */
    platform: Platforms;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionOrganization
     */
    avatar_url: string;
}
/**
 * 
 * @export
 * @interface SubscriptionPublicUser
 */
export interface SubscriptionPublicUser {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionPublicUser
     */
    public_name: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionPublicUser
     */
    github_username?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionPublicUser
     */
    avatar_url?: string;
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
 * @interface SubscriptionSubscriber
 */
export interface SubscriptionSubscriber {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    id: string;
    /**
     * 
     * @type {SubscriptionStatus}
     * @memberof SubscriptionSubscriber
     */
    status: SubscriptionStatus;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    current_period_start: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    current_period_end?: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionSubscriber
     */
    cancel_at_period_end: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    started_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    ended_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    price_currency: string;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionSubscriber
     */
    price_amount: number;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    user_id: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionSubscriber
     */
    subscription_tier_id: string;
    /**
     * 
     * @type {SubscriptionTierSubscriber}
     * @memberof SubscriptionSubscriber
     */
    subscription_tier: SubscriptionTierSubscriber;
    /**
     * 
     * @type {SubscriptionOrganization}
     * @memberof SubscriptionSubscriber
     */
    organization?: SubscriptionOrganization;
}
/**
 * 
 * @export
 * @interface SubscriptionSummary
 */
export interface SubscriptionSummary {
    /**
     * 
     * @type {SubscriptionPublicUser}
     * @memberof SubscriptionSummary
     */
    user: SubscriptionPublicUser;
    /**
     * 
     * @type {SubscriptionOrganization}
     * @memberof SubscriptionSummary
     */
    organization?: SubscriptionOrganization;
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
     * @type {Array<BenefitsInner>}
     * @memberof SubscriptionTier
     */
    benefits: Array<BenefitsInner>;
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
    INDIVIDUAL: 'individual',
    BUSINESS: 'business'
} as const;
export type SubscriptionTierCreateTypeEnum = typeof SubscriptionTierCreateTypeEnum[keyof typeof SubscriptionTierCreateTypeEnum];

/**
 * 
 * @export
 * @interface SubscriptionTierSubscriber
 */
export interface SubscriptionTierSubscriber {
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    created_at: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    modified_at?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    id: string;
    /**
     * 
     * @type {SubscriptionTierType}
     * @memberof SubscriptionTierSubscriber
     */
    type: SubscriptionTierType;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    name: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    description?: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionTierSubscriber
     */
    is_highlighted: boolean;
    /**
     * 
     * @type {number}
     * @memberof SubscriptionTierSubscriber
     */
    price_amount: number;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    price_currency: string;
    /**
     * 
     * @type {boolean}
     * @memberof SubscriptionTierSubscriber
     */
    is_archived: boolean;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    organization_id?: string;
    /**
     * 
     * @type {string}
     * @memberof SubscriptionTierSubscriber
     */
    repository_id?: string;
    /**
     * 
     * @type {Array<BenefitsInner1>}
     * @memberof SubscriptionTierSubscriber
     */
    benefits: Array<BenefitsInner1>;
}

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
 * @interface SubscriptionUser
 */
export interface SubscriptionUser {
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
    /**
     * 
     * @type {string}
     * @memberof SubscriptionUser
     */
    email: string;
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
     * @type {TransactionSubscription}
     * @memberof Transaction
     */
    subscription?: TransactionSubscription;
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
    readonly incurred_amount: number;
    /**
     * 
     * @type {number}
     * @memberof Transaction
     */
    readonly gross_amount: number;
    /**
     * 
     * @type {number}
     * @memberof Transaction
     */
    readonly net_amount: number;
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
     * @type {TransactionSubscription}
     * @memberof TransactionDetails
     */
    subscription?: TransactionSubscription;
    /**
     * 
     * @type {Array<TransactionEmbedded>}
     * @memberof TransactionDetails
     */
    account_incurred_transactions: Array<TransactionEmbedded>;
    /**
     * 
     * @type {Array<Transaction>}
     * @memberof TransactionDetails
     */
    paid_transactions: Array<Transaction>;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    readonly incurred_amount: number;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    readonly gross_amount: number;
    /**
     * 
     * @type {number}
     * @memberof TransactionDetails
     */
    readonly net_amount: number;
}
/**
 * 
 * @export
 * @interface TransactionEmbedded
 */
export interface TransactionEmbedded {
    /**
     * 
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
     * @type {Array<string>}
     * @memberof UserScopes
     */
    scopes: Array<string>;
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
