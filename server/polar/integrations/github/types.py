from typing import Literal, TypedDict

from githubkit.versions.latest.models import (
    AddedToProjectIssueEvent,
    AppPermissions,
    ConvertedNoteToIssueIssueEvent,
    DemilestonedIssueEvent,
    Enterprise,
    FullRepository,
    Installation,
    InstallationRepositoriesGetResponse200,
    Issue,
    IssueEvent,
    IssuePropPullRequest,
    Label,
    LabeledIssueEvent,
    LockedIssueEvent,
    Milestone,
    MilestonedIssueEvent,
    MovedColumnInProjectIssueEvent,
    OrganizationFull,
    PrivateUser,
    PublicUser,
    PullRequest,
    PullRequestSimple,
    RemovedFromProjectIssueEvent,
    RenamedIssueEvent,
    Repository,
    RepositoryInvitation,
    RepositoryPropPermissions,
    RepositoryWebhooks,
    ReviewDismissedIssueEvent,
    ReviewRequestedIssueEvent,
    ReviewRequestRemovedIssueEvent,
    SimpleUser,
    SimpleUserWebhooks,
    StateChangeIssueEvent,
    TimelineAssignedIssueEvent,
    TimelineCommentEvent,
    TimelineCommitCommentedEvent,
    TimelineCommittedEvent,
    TimelineCrossReferencedEvent,
    TimelineLineCommentedEvent,
    TimelineReviewedEvent,
    TimelineUnassignedIssueEvent,
    UnlabeledIssueEvent,
    UserInstallationsGetResponse200,
    WebhookInstallationCreated,
    WebhookInstallationDeleted,
    WebhookInstallationNewPermissionsAccepted,
    WebhookInstallationRepositoriesAdded,
    WebhookInstallationRepositoriesAddedPropRepositoriesRemovedItems,
    WebhookInstallationRepositoriesRemoved,
    WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems,
    WebhookInstallationSuspend,
    WebhookInstallationUnsuspend,
    WebhookIssuesAssigned,
    WebhookIssuesClosed,
    WebhookIssuesClosedPropIssue,
    WebhookIssuesDeleted,
    WebhookIssuesDeletedPropIssue,
    WebhookIssuesEdited,
    WebhookIssuesEditedPropIssue,
    WebhookIssuesLabeled,
    WebhookIssuesLabeledPropIssuePropLabelsItems,
    WebhookIssuesOpened,
    WebhookIssuesOpenedPropIssue,
    WebhookIssuesReopened,
    WebhookIssuesReopenedPropIssue,
    WebhookIssuesTransferred,
    WebhookIssuesTransferredPropChangesPropNewIssue,
    WebhookIssuesTransferredPropChangesPropNewRepository,
    WebhookIssuesUnassigned,
    WebhookIssuesUnlabeled,
    WebhookIssuesUnlabeledPropIssuePropLabelsItems,
    WebhookOrganizationMemberAdded,
    WebhookOrganizationMemberRemoved,
    WebhookOrganizationRenamed,
    WebhookPublic,
    WebhookPullRequestClosed,
    WebhookPullRequestClosedPropPullRequest,
    WebhookPullRequestEdited,
    WebhookPullRequestEditedPropPullRequest,
    WebhookPullRequestOpened,
    WebhookPullRequestOpenedPropPullRequest,
    WebhookPullRequestReopened,
    WebhookPullRequestReopenedPropPullRequest,
    WebhookPullRequestSynchronize,
    WebhookPullRequestSynchronizePropPullRequest,
    WebhookRepositoryArchived,
    WebhookRepositoryDeleted,
    WebhookRepositoryEdited,
    WebhookRepositoryRenamed,
    WebhookRepositoryTransferred,
)
from pydantic import TypeAdapter


class AppPermissionsType(TypedDict, total=False):
    """App Permissions

    The permissions granted to the user access token.

    Examples:
        {'contents': 'read', 'issues': 'read', 'deployments': 'write', 'single_file':
    'read'}
    """

    actions: Literal["read", "write"]
    administration: Literal["read", "write"]
    checks: Literal["read", "write"]
    codespaces: Literal["read", "write"]
    contents: Literal["read", "write"]
    dependabot_secrets: Literal["read", "write"]
    deployments: Literal["read", "write"]
    environments: Literal["read", "write"]
    issues: Literal["read", "write"]
    metadata: Literal["read", "write"]
    packages: Literal["read", "write"]
    pages: Literal["read", "write"]
    pull_requests: Literal["read", "write"]
    repository_custom_properties: Literal["read", "write"]
    repository_hooks: Literal["read", "write"]
    repository_projects: Literal["read", "write", "admin"]
    secret_scanning_alerts: Literal["read", "write"]
    secrets: Literal["read", "write"]
    security_events: Literal["read", "write"]
    single_file: Literal["read", "write"]
    statuses: Literal["read", "write"]
    vulnerability_alerts: Literal["read", "write"]
    workflows: Literal["write"]
    members: Literal["read", "write"]
    organization_administration: Literal["read", "write"]
    organization_custom_roles: Literal["read", "write"]
    organization_custom_org_roles: Literal["read", "write"]
    organization_custom_properties: Literal["read", "write", "admin"]
    organization_copilot_seat_management: Literal["write"]
    organization_announcement_banners: Literal["read", "write"]
    organization_events: Literal["read"]
    organization_hooks: Literal["read", "write"]
    organization_personal_access_tokens: Literal["read", "write"]
    organization_personal_access_token_requests: Literal["read", "write"]
    organization_plan: Literal["read"]
    organization_projects: Literal["read", "write", "admin"]
    organization_packages: Literal["read", "write"]
    organization_secrets: Literal["read", "write"]
    organization_self_hosted_runners: Literal["read", "write"]
    organization_user_blocking: Literal["read", "write"]
    team_discussions: Literal["read", "write"]
    email_addresses: Literal["read", "write"]
    followers: Literal["read", "write"]
    git_ssh_keys: Literal["read", "write"]
    gpg_keys: Literal["read", "write"]
    interaction_limits: Literal["read", "write"]
    profile: Literal["write"]
    starring: Literal["read", "write"]


def app_permissions_from_github(permissions: AppPermissions) -> AppPermissionsType:
    ta = TypeAdapter(AppPermissionsType)

    # future proofing for if the two models fall out of sync
    supported_keys = AppPermissionsType.__dict__["__annotations__"].keys()

    return ta.validate_python(
        permissions.model_dump(
            include=supported_keys,
            exclude_unset=True,
            exclude_none=True,
            exclude_defaults=True,
        )
    )


__all__ = [
    "AddedToProjectIssueEvent",
    "app_permissions_from_github",
    "AppPermissionsType",
    "AppPermissions",
    "ConvertedNoteToIssueIssueEvent",
    "DemilestonedIssueEvent",
    "Enterprise",
    "FullRepository",
    "Installation",
    "InstallationRepositoriesGetResponse200",
    "Issue",
    "IssueEvent",
    "IssuePropPullRequest",
    "Label",
    "LabeledIssueEvent",
    "LockedIssueEvent",
    "Milestone",
    "MilestonedIssueEvent",
    "MovedColumnInProjectIssueEvent",
    "OrganizationFull",
    "SimpleUserWebhooks",
    "PrivateUser",
    "PublicUser",
    "PullRequest",
    "PullRequestSimple",
    "RemovedFromProjectIssueEvent",
    "RenamedIssueEvent",
    "Repository",
    "RepositoryInvitation",
    "RepositoryPropPermissions",
    "RepositoryWebhooks",
    "ReviewDismissedIssueEvent",
    "ReviewRequestedIssueEvent",
    "ReviewRequestRemovedIssueEvent",
    "SimpleUser",
    "StateChangeIssueEvent",
    "TimelineAssignedIssueEvent",
    "TimelineCommentEvent",
    "TimelineCommitCommentedEvent",
    "TimelineCommittedEvent",
    "TimelineCrossReferencedEvent",
    "TimelineLineCommentedEvent",
    "TimelineReviewedEvent",
    "TimelineUnassignedIssueEvent",
    "UnlabeledIssueEvent",
    "UserInstallationsGetResponse200",
    "WebhookInstallationCreated",
    "WebhookInstallationDeleted",
    "WebhookInstallationNewPermissionsAccepted",
    "WebhookInstallationRepositoriesAdded",
    "WebhookInstallationRepositoriesAddedPropRepositoriesRemovedItems",
    "WebhookInstallationRepositoriesRemoved",
    "WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems",
    "WebhookInstallationSuspend",
    "WebhookInstallationUnsuspend",
    "WebhookIssuesAssigned",
    "WebhookIssuesClosed",
    "WebhookIssuesClosedPropIssue",
    "WebhookIssuesDeleted",
    "WebhookIssuesDeletedPropIssue",
    "WebhookIssuesEdited",
    "WebhookIssuesEditedPropIssue",
    "WebhookIssuesLabeled",
    "WebhookIssuesLabeledPropIssuePropLabelsItems",
    "WebhookIssuesOpened",
    "WebhookIssuesOpenedPropIssue",
    "WebhookIssuesReopened",
    "WebhookIssuesReopenedPropIssue",
    "WebhookIssuesTransferred",
    "WebhookIssuesTransferredPropChangesPropNewIssue",
    "WebhookIssuesTransferredPropChangesPropNewRepository",
    "WebhookIssuesUnassigned",
    "WebhookIssuesUnlabeled",
    "WebhookIssuesUnlabeledPropIssuePropLabelsItems",
    "WebhookOrganizationMemberAdded",
    "WebhookOrganizationMemberRemoved",
    "WebhookOrganizationRenamed",
    "WebhookPublic",
    "WebhookPullRequestClosed",
    "WebhookPullRequestClosedPropPullRequest",
    "WebhookPullRequestEdited",
    "WebhookPullRequestEditedPropPullRequest",
    "WebhookPullRequestOpened",
    "WebhookPullRequestOpenedPropPullRequest",
    "WebhookPullRequestReopened",
    "WebhookPullRequestReopenedPropPullRequest",
    "WebhookPullRequestSynchronize",
    "WebhookPullRequestSynchronizePropPullRequest",
    "WebhookRepositoryArchived",
    "WebhookRepositoryDeleted",
    "WebhookRepositoryEdited",
    "WebhookRepositoryRenamed",
    "WebhookRepositoryTransferred",
]
