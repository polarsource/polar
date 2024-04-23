from collections.abc import Sequence
from typing import Any, Literal
from uuid import UUID

import structlog

from polar.context import ExecutionContext
from polar.eventstream.service import publish_members
from polar.exceptions import PolarError
from polar.integrations.github import client as github
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.locker import Locker
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.organization.hooks import OrganizationHook, organization_upserted
from polar.postgres import AsyncSession
from polar.redis import redis
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    QueueName,
    enqueue_job,
    task,
)

from .. import service, types
from ..service.members import github_members_service
from .utils import (
    get_organization_and_repo,
    github_rate_limit_retry,
)

log = structlog.get_logger()


class GitHubTasksWebhookError(PolarError): ...


class UnknownRepositoryTransferOrganization(GitHubTasksWebhookError):
    """
    This error may be triggered by `repository_transferred` when we handle
    a `repository.transferred` event, if the target organization is unknown to us.

    This shouldn't happen since GitHub only triggers the event for target organization
    that actually installed the application. Otherwise, we shouldn't have been pinged.

    Ref: https://docs.github.com/en/webhooks/webhook-events-and-payloads?actionType=transferred#repository
    """

    def __init__(self, repository_id: UUID, new_organization_external_id: int) -> None:
        self.repository_id = repository_id
        self.new_organization_external_id = new_organization_external_id
        message = "Tried to handle a repository transfer to an unknown organization"
        super().__init__(message)


class IssueTransferMissingOrganization(GitHubTasksWebhookError):
    """
    This error may be triggered by `handle_issue_transferred` when we handle
    a `issues.transferred` event, if the event doesn't embed the target organization ID.
    """

    def __init__(self, issue_id: UUID) -> None:
        self.issue_id = issue_id
        message = "Tried to handle an issue transfer but the organization is missing"
        super().__init__(message)


class UnknownIssueTransferOrganization(GitHubTasksWebhookError):
    """
    This error may be triggered by `handle_issue_transferred` when we handle
    a `issues.transferred` event, if the target organization is unknown to us.

    This shouldn't happen since GitHub doesn't allow to transfer issue
    between organizations.
    """

    def __init__(self, issue_id: UUID, new_organization_external_id: int) -> None:
        self.issue_id = issue_id
        self.new_organization_external_id = new_organization_external_id
        message = "Tried to handle an issue transfer to an unknown organization"
        super().__init__(message)


# ------------------------------------------------------------------------------
# ORGANIZATIONS
# ------------------------------------------------------------------------------


async def organization_updated(
    session: AsyncSession,
    event: types.WebhookOrganizationRenamed,
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        if not event.installation:
            return dict(success=False)

        organization = await service.github_organization.get_by_external_id(
            session, event.organization.id
        )
        if not organization:
            return dict(success=False)

        organization.name = event.organization.login
        organization.avatar_url = event.organization.avatar_url

        session.add(organization)

        return dict(success=True)


@github_rate_limit_retry
async def organization_synchronize_members(
    session: AsyncSession,
    event: types.WebhookOrganizationMemberAdded
    | types.WebhookOrganizationMemberRemoved,
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        if not event.installation:
            return dict(success=False)

        organization = await service.github_organization.get_by_external_id(
            session, event.organization.id
        )
        if not organization:
            return dict(success=False)

        await github_members_service.synchronize_members(session, organization)
        return dict(success=True)


@task(name="github.webhook.organization.renamed")
async def organizations_renamed(
    ctx: JobContext,
    scope: Literal["organization"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookOrganizationRenamed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await organization_updated(session, parsed)


@task(name="github.webhook.organization.member_added")
async def organizations_member_added(
    ctx: JobContext,
    scope: Literal["organization"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookOrganizationMemberAdded):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await organization_synchronize_members(session, parsed)


@task(name="github.webhook.organization.member_removed")
async def organizations_member_removed(
    ctx: JobContext,
    scope: Literal["organization"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookOrganizationMemberRemoved):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await organization_synchronize_members(session, parsed)


# ------------------------------------------------------------------------------
# REPOSITORIES
# ------------------------------------------------------------------------------


@github_rate_limit_retry
async def repositories_changed(
    session: AsyncSession,
    event: types.WebhookInstallationRepositoriesAdded
    | types.WebhookInstallationRepositoriesRemoved
    | types.WebhookInstallationCreated,
) -> None:
    locker = Locker(redis)

    with ExecutionContext(is_during_installation=True):
        removed: Sequence[
            types.WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems
            | types.WebhookInstallationRepositoriesAddedPropRepositoriesRemovedItems
            | types.WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems
        ] = (
            []
            if isinstance(event, types.WebhookInstallationCreated)
            else event.repositories_removed
        )

        org = await get_or_create_org_from_installation(
            session,
            event.installation,
            removed,
        )

        # Sync permission for the installing user
        sender = await service.github_user.get_user_by_github_id(
            session, event.sender.id
        )
        if sender:
            await service.github_user.sync_github_orgs(session, locker, user=sender)

        # send after members have been added
        await organization_upserted.call(OrganizationHook(session, org))


@github_rate_limit_retry
async def get_or_create_org_from_installation(
    session: AsyncSession,
    installation: types.Installation,
    removed: Sequence[
        types.WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems
        | types.WebhookInstallationRepositoriesAddedPropRepositoriesRemovedItems
        | types.WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems
    ],
) -> Organization:
    organization = await service.github_organization.install_from_webhook(
        session, installation
    )

    if removed:
        await remove_repositories(session, removed)

    await service.github_repository.install_for_organization(session, organization)

    return organization


async def remove_repositories(
    session: AsyncSession,
    repositories: Sequence[
        types.WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems
        | types.WebhookInstallationRepositoriesAddedPropRepositoriesRemovedItems
        | types.WebhookInstallationRepositoriesRemovedPropRepositoriesRemovedItems
    ],
) -> None:
    for repo in repositories:
        if not repo.id:
            continue
        r = await service.github_repository.get_by_external_id(session, repo.id)
        if not r:
            continue

        await service.github_repository.soft_delete(session, r.id)


@task("github.webhook.installation_repositories.added")
async def repositories_added(
    ctx: JobContext,
    scope: Literal["installation_repositories"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookInstallationRepositoriesAdded):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repositories_changed(session, parsed)


@task(name="github.webhook.installation_repositories.removed")
async def repositories_removed(
    ctx: JobContext,
    scope: Literal["installation_repositories"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookInstallationRepositoriesRemoved):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repositories_changed(session, parsed)


@task(name="github.webhook.public")
async def repositories_public(
    ctx: JobContext,
    scope: Literal["public"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookPublic):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.renamed")
async def repositories_renamed(
    ctx: JobContext,
    scope: Literal["repository"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookRepositoryRenamed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.edited")
async def repositories_redited(
    ctx: JobContext,
    scope: Literal["repository"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookRepositoryEdited):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.deleted")
async def repositories_deleted(
    ctx: JobContext,
    scope: Literal["repository"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookRepositoryDeleted):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_deleted(session, parsed)


@task(name="github.webhook.repository.archived")
async def repositories_archived(
    ctx: JobContext,
    scope: Literal["repository"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookRepositoryArchived):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.transferred")
async def repositories_transferred(
    ctx: JobContext,
    scope: Literal["repository"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookRepositoryTransferred):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_transferred(session, parsed)


async def repository_updated(
    session: AsyncSession,
    event: types.WebhookPublic
    | types.WebhookRepositoryRenamed
    | types.WebhookRepositoryEdited
    | types.WebhookRepositoryArchived,
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        if not event.installation:
            return dict(success=False)

        repository = await service.github_repository.get_by_external_id(
            session, event.repository.id
        )
        if not repository:
            return dict(success=False)

        repository.is_private = event.repository.visibility == "private"
        repository.name = event.repository.name
        repository.is_archived = event.repository.archived

        session.add(repository)

        return dict(success=True)


async def repository_deleted(
    session: AsyncSession,
    event: types.WebhookRepositoryDeleted,
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        if not event.installation:
            return dict(success=False)

        repository = await service.github_repository.get_by_external_id(
            session, event.repository.id
        )
        if not repository:
            return dict(success=False)

        if not repository.deleted_at:
            repository.deleted_at = utc_now()

        session.add(repository)

        return dict(success=True)


async def repository_transferred(
    session: AsyncSession,
    event: types.WebhookRepositoryTransferred,
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        if not event.installation:
            return dict(success=False)

        repository = await service.github_repository.get_by_external_id(
            session, event.repository.id
        )
        if not repository:
            # We don't know this repository yet, we can stop here:
            # it'll be handled by `installation_repositories.added` event.
            return dict(success=False)

        new_organization_id = event.repository.owner.id
        new_organization = await service.github_organization.get_by_external_id(
            session, new_organization_id
        )

        if new_organization is None:
            raise UnknownRepositoryTransferOrganization(
                repository.id, new_organization_id
            )

        await service.github_repository.rename_deleted_repository_with_same_name(
            session,
            new_organization,
            event.repository,
        )

        repository.organization = new_organization
        # GitHub triggers the `installation_repositories.removed` event
        # from the source installation, so make sure it's not deleted
        repository.deleted_at = None
        session.add(repository)

        return dict(success=True)


# ------------------------------------------------------------------------------
# ISSUES
# ------------------------------------------------------------------------------


async def handle_issue(
    session: AsyncSession,
    scope: str,
    action: str,
    event: types.WebhookIssuesOpened
    | types.WebhookIssuesEdited
    | types.WebhookIssuesClosed
    | types.WebhookIssuesReopened
    | types.WebhookIssuesDeleted,
) -> Issue:
    owner_id = event.repository.owner.id
    repository_id = event.repository.id

    organization = await service.github_organization.get_by_external_id(
        session, owner_id
    )
    if not organization:
        raise Exception(
            f"failed to save issue (org not found) external_id={event.issue.id}"
        )

    repository = await service.github_repository.get_by_external_id(
        session, repository_id
    )
    if not repository:
        raise Exception(
            f"failed to save issue (repo not found) external_id={event.issue.id}"
        )

    issue = await service.github_issue.store(
        session, data=event.issue, organization=organization, repository=repository
    )

    if not issue:
        raise Exception(f"failed to save issue external_id={event.issue.id}")

    # Trigger references sync job for entire repository
    enqueue_job(
        "github.repo.sync.issue_references",
        issue.organization_id,
        issue.repository_id,
        queue_name=QueueName.github_crawl,
    )

    return issue


async def handle_issue_transferred(
    session: AsyncSession,
    scope: str,
    action: str,
    event: types.WebhookIssuesTransferred,
) -> Issue | None:
    old_issue_id = event.issue.id
    old_issue = await service.github_issue.get_by_external_id(session, old_issue_id)
    if not old_issue:
        return None

    new_repository_data = event.changes.new_repository

    if new_repository_data.owner is None:
        raise IssueTransferMissingOrganization(old_issue.id)

    organization_id = new_repository_data.owner.id
    organization = await service.github_organization.get_by_external_id(
        session, organization_id
    )
    if organization is None:
        raise UnknownIssueTransferOrganization(old_issue.id, organization_id)

    repository = await service.github_repository.create_or_update_from_github(
        session, organization, new_repository_data
    )

    # The new issue may have already been created following `issues.added` webhook
    new_issue = await service.github_issue.create_or_update_from_github(
        session, organization, repository, event.changes.new_issue
    )

    new_issue = await service.github_issue.transfer(session, old_issue, new_issue)

    await service.github_issue.soft_delete(session, old_issue.id)

    return new_issue


@task("github.webhook.issues.opened")
async def issue_opened(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesOpened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            issue = await handle_issue(session, scope, action, parsed)

            # Add badge if has label
            if issue.has_pledge_badge_label:
                await update_issue_embed(session, issue=issue, embed=True)


@task("github.webhook.issues.reopened")
async def issue_reopened(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesReopened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            issue = await handle_issue(session, scope, action, parsed)

            # Add badge if has label
            if issue.has_pledge_badge_label:
                await update_issue_embed(session, issue=issue, embed=True)


@task("github.webhook.issues.edited")
async def issue_edited(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesEdited):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            issue = await handle_issue(session, scope, action, parsed)

            # Add badge if has label
            if issue.has_pledge_badge_label:
                await update_issue_embed(session, issue=issue, embed=True)


@task("github.webhook.issues.closed")
async def issue_closed(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesClosed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_issue(session, scope, action, parsed)


@task("github.webhook.issues.deleted")
async def issue_deleted(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesDeleted):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            # Save last known version
            await handle_issue(session, scope, action, parsed)

            # Mark as deleted
            issue = await service.github_issue.get_by_external_id(
                session, parsed.issue.id
            )
            if not issue:
                return None

            await service.github_issue.soft_delete(session, issue.id)


@task("github.webhook.issues.transferred")
async def issue_transferred(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesTransferred):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_issue_transferred(session, scope, action, parsed)


@task("github.webhook.issues.labeled")
async def issue_labeled(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesLabeled):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await issue_labeled_async(session, scope, action, parsed)


@task("github.webhook.issues.unlabeled")
async def issue_unlabeled(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesUnlabeled):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await issue_labeled_async(session, scope, action, parsed)


async def update_issue_embed(
    session: AsyncSession,
    *,
    issue: Issue,
    embed: bool = False,
) -> bool:
    try:
        org, repo = await get_organization_and_repo(
            session, issue.organization_id, issue.repository_id
        )
    except ValueError:
        log.error(
            "github.webhook.issues.badge",
            error="no org/repo",
            issue_id=issue.id,
        )
        return False

    if embed:
        res = await service.github_issue.embed_badge(
            session,
            organization=org,
            repository=repo,
            issue=issue,
            triggered_from_label=True,
        )
        log.info(
            "github.webhook.issues.badge.embed",
            success=res,
            issue_id=issue.id,
        )
        return res

    # Do not remove the badge if automatic badging is enabled
    if repo.pledge_badge_auto_embed:
        return False

    # TODO: Implement logging here too as with `embed`
    # However, we need to first update `remove_badge` to return a true bool
    return await service.github_issue.remove_badge(
        session,
        organization=org,
        repository=repo,
        issue=issue,
        triggered_from_label=True,
    )


async def issue_labeled_async(
    session: AsyncSession,
    scope: str,
    action: str,
    event: types.WebhookIssuesLabeled | types.WebhookIssuesUnlabeled,
) -> None:
    issue = await service.github_issue.get_by_external_id(session, event.issue.id)
    if not issue:
        log.warn(
            "github.webhook.issue_labeled_async.not_found", external_id=event.issue.id
        )
        return

    repository = await service.github_repository.get(session, issue.repository_id)
    assert repository is not None

    labels = event.issue.labels
    if not labels:
        labels = []

    had_polar_label = issue.has_pledge_badge_label
    issue = await service.github_issue.set_labels(session, issue, repository, labels)

    log.info(
        "github.webhook.issues.label",
        action=action,
        issue_id=issue.id,
        label=event.label.name if event.label else None,
        had_polar_label=had_polar_label,
        should_have_polar_label=issue.has_pledge_badge_label,
    )

    # Add/remove polar badge if label has changed
    if (
        event.label
        and event.label.name.lower() == repository.pledge_badge_label.lower()
    ):
        await update_issue_embed(
            session, issue=issue, embed=issue.has_pledge_badge_label
        )


@task("github.webhook.issues.assigned")
async def issue_assigned(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesAssigned):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await issue_assigned_async(session, scope, action, parsed)


@task("github.webhook.issues.unassigned")
async def issue_unassigned(
    ctx: JobContext,
    scope: Literal["issues"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookIssuesUnassigned):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await issue_assigned_async(session, scope, action, parsed)


async def issue_assigned_async(
    session: AsyncSession,
    scope: str,
    action: str,
    event: types.WebhookIssuesAssigned | types.WebhookIssuesUnassigned,
) -> None:
    issue = await service.github_issue.get_by_external_id(session, event.issue.id)
    if not issue:
        log.warn(
            "github.webhook.issue_assigned_async.not_found", external_id=event.issue.id
        )
        return

    # modify assignee

    assignee = event.issue.assignee
    assignees = event.issue.assignees

    stmt = (
        sql.Update(Issue)
        .where(Issue.id == issue.id)
        .values(
            assignee=assignee.model_dump(mode="json") if assignee else None,
            assignees=[
                assignee.model_dump(mode="json") for assignee in assignees if assignee
            ],
            issue_modified_at=event.issue.updated_at,
        )
    )
    await session.execute(stmt)
    await session.commit()


# ------------------------------------------------------------------------------
# PULL REQUESTS
# ------------------------------------------------------------------------------


async def handle_pull_request(
    session: AsyncSession,
    scope: str,
    action: str,
    event: types.WebhookPullRequestOpened
    | types.WebhookPullRequestEdited
    | types.WebhookPullRequestClosed
    | types.WebhookPullRequestReopened
    | types.WebhookPullRequestSynchronize,
) -> None:
    owner_id = event.repository.owner.id
    repository_id = event.repository.id

    organization = await service.github_organization.get_by_external_id(
        session, owner_id
    )
    if not organization:
        return None

    repository = await service.github_repository.get_by_external_id(
        session, repository_id
    )
    if not repository:
        return None

    await service.github_pull_request.store_many_full(
        session, [event.pull_request], organization=organization, repository=repository
    )

    return


@task("github.webhook.pull_request.opened")
async def pull_request_opened(
    ctx: JobContext,
    scope: Literal["pull_request"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookPullRequestOpened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.edited")
async def pull_request_edited(
    ctx: JobContext,
    scope: Literal["pull_request"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookPullRequestEdited):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.closed")
async def pull_request_closed(
    ctx: JobContext,
    scope: Literal["pull_request"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookPullRequestClosed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.reopened")
async def pull_request_reopened(
    ctx: JobContext,
    scope: Literal["pull_request"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookPullRequestReopened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.synchronize")
async def pull_request_synchronize(
    ctx: JobContext,
    scope: Literal["pull_request"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, types.WebhookPullRequestSynchronize):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


# ------------------------------------------------------------------------------
# INSTALLATION
# ------------------------------------------------------------------------------


@task("github.webhook.installation.created")
async def installation_created(
    ctx: JobContext,
    scope: Literal["installation"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with ExecutionContext(is_during_installation=True):
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, types.WebhookInstallationCreated):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            # repositories_changed also installs the organization
            await repositories_changed(session, event)


@task("github.webhook.installation.new_permissions_accepted")
async def installation_new_permissions_accepted(
    ctx: JobContext,
    scope: Literal["installation"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with ExecutionContext(is_during_installation=True):
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, types.WebhookInstallationNewPermissionsAccepted):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        installation_account = event.installation.account
        if installation_account is None:
            return

        async with AsyncSessionMaker(ctx) as session:
            # create/update organization object
            # this will also update organization.installation_permissions
            organization = await service.github_organization.install_from_webhook(
                session,
                event.installation,
            )

            await publish_members(
                session=session,
                key="organization.updated",
                payload={
                    "organization_id": organization.id,
                },
                organization_id=organization.id,
            )


@task("github.webhook.installation.deleted")
async def installation_delete(
    ctx: JobContext,
    scope: Literal["installation"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, types.WebhookInstallationDeleted):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        installation_account = event.installation.account
        if installation_account is None:
            return

        async with AsyncSessionMaker(ctx) as session:
            org = await service.github_organization.get_by_external_id(
                session, installation_account.id
            )
            if not org:
                return
            await service.github_organization.remove(session, org.id)


@task("github.webhook.installation.suspend")
async def installation_suspend(
    ctx: JobContext,
    scope: Literal["installation"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, types.WebhookInstallationSuspend):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            suspended_by = event.installation.suspended_by
            await service.github_organization.suspend(
                session,
                event.installation.id,
                suspended_by.id if suspended_by is not None else None,
                event.installation.suspended_at,
                event.sender.id,
            )


@task("github.webhook.installation.unsuspend")
async def installation_unsuspend(
    ctx: JobContext,
    scope: Literal["installation"],
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, types.WebhookInstallationUnsuspend):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await service.github_organization.unsuspend(session, event.installation.id)
