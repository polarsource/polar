from collections.abc import Sequence
from typing import Any
from uuid import UUID

import structlog

from polar.context import ExecutionContext
from polar.exceptions import PolarError
from polar.integrations.github import client as github
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.organization.hooks import OrganizationHook, organization_upserted
from polar.postgres import AsyncSession
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    enqueue_job,
    task,
)

from .. import service
from .utils import (
    get_organization_and_repo,
)

log = structlog.get_logger()


class GitHubTasksWebhookError(PolarError):
    ...


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
    event: github.webhooks.OrganizationRenamed,
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

        await organization.save(session)

        return dict(success=True)


async def organization_synchronize_members(
    session: AsyncSession,
    event: github.webhooks.OrganizationMemberAdded
    | github.webhooks.OrganizationMemberRemoved,
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        if not event.installation:
            return dict(success=False)

        organization = await service.github_organization.get_by_external_id(
            session, event.organization.id
        )
        if not organization:
            return dict(success=False)

        await service.github_organization.synchronize_members(session, organization)
        return dict(success=True)


@task(name="github.webhook.organization.renamed")
async def organizations_renamed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.OrganizationRenamed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await organization_updated(session, parsed)


@task(name="github.webhook.organization.member_added")
async def organizations_member_added(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.OrganizationMemberAdded):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await organization_synchronize_members(session, parsed)


@task(name="github.webhook.organization.member_removed")
async def organizations_member_removed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.OrganizationMemberRemoved):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await organization_synchronize_members(session, parsed)


# ------------------------------------------------------------------------------
# REPOSITORIES
# ------------------------------------------------------------------------------


async def repositories_changed(
    session: AsyncSession,
    event: github.webhooks.InstallationRepositoriesAdded
    | github.webhooks.InstallationRepositoriesRemoved
    | github.webhooks.InstallationCreated,
) -> None:
    with ExecutionContext(is_during_installation=True):
        removed: Sequence[
            github.webhooks.InstallationRepositoriesRemovedPropRepositoriesRemovedItems
            | github.webhooks.InstallationRepositoriesAddedPropRepositoriesRemovedItems
            | github.webhooks.InstallationRepositoriesRemovedPropRepositoriesRemovedItems
        ] = (
            []
            if isinstance(event, github.webhooks.InstallationCreated)
            else event.repositories_removed
        )

        org = await create_from_installation(
            session,
            event.installation,
            removed,
        )

        # Sync permission for the installing user
        sender = await service.github_user.get_user_by_github_id(
            session, event.sender.id
        )
        if sender:
            await service.github_user.sync_github_orgs(session, user=sender)

        # send after members have been added
        await organization_upserted.call(OrganizationHook(session, org))


async def create_from_installation(
    session: AsyncSession,
    installation: github.rest.Installation | github.webhooks.Installation,
    removed: Sequence[
        github.webhooks.InstallationRepositoriesRemovedPropRepositoriesRemovedItems
        | github.webhooks.InstallationRepositoriesAddedPropRepositoriesRemovedItems
        | github.webhooks.InstallationRepositoriesRemovedPropRepositoriesRemovedItems
    ],
) -> Organization:
    account = installation.account
    if not account:
        raise Exception("installation has no account")
    if isinstance(account, github.rest.Enterprise):
        raise Exception("enterprise accounts is not supported")

    organization = await service.github_organization.create_or_update_from_github(
        session, account, installation=installation
    )
    # Un-delete if previously deleted
    organization.deleted_at = None
    await organization.save(session)

    if removed:
        await remove_repositories(session, removed)

    await service.github_repository.install_for_organization(
        session, organization, installation.id
    )

    return organization


async def remove_repositories(
    session: AsyncSession,
    repositories: Sequence[
        github.webhooks.InstallationRepositoriesRemovedPropRepositoriesRemovedItems
        | github.webhooks.InstallationRepositoriesAddedPropRepositoriesRemovedItems
        | github.webhooks.InstallationRepositoriesRemovedPropRepositoriesRemovedItems
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.InstallationRepositoriesAdded):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repositories_changed(session, parsed)


@task(name="github.webhook.installation_repositories.removed")
async def repositories_removed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.InstallationRepositoriesRemoved):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repositories_changed(session, parsed)


@task(name="github.webhook.public")
async def repositories_public(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PublicEvent):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.renamed")
async def repositories_renamed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.RepositoryRenamed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.edited")
async def repositories_redited(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.RepositoryEdited):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.deleted")
async def repositories_deleted(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.RepositoryDeleted):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_deleted(session, parsed)


@task(name="github.webhook.repository.archived")
async def repositories_archived(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.RepositoryArchived):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_updated(session, parsed)


@task(name="github.webhook.repository.transferred")
async def repositories_transferred(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.RepositoryTransferred):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionMaker(ctx) as session:
            await repository_transferred(session, parsed)


async def repository_updated(
    session: AsyncSession,
    event: github.webhooks.PublicEvent
    | github.webhooks.RepositoryRenamed
    | github.webhooks.RepositoryEdited
    | github.webhooks.RepositoryArchived,
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

        await repository.save(session)

        return dict(success=True)


async def repository_deleted(
    session: AsyncSession,
    event: github.webhooks.RepositoryDeleted,
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

        await repository.save(session)

        return dict(success=True)


async def repository_transferred(
    session: AsyncSession,
    event: github.webhooks.RepositoryTransferred,
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

        repository.organization = new_organization
        # GitHub triggers the `installation_repositories.removed` event
        # from the source installation, so make sure it's not deleted
        repository.deleted_at = None
        await repository.save(session)

        return dict(success=True)


# ------------------------------------------------------------------------------
# ISSUES
# ------------------------------------------------------------------------------


async def handle_issue(
    session: AsyncSession,
    scope: str,
    action: str,
    event: github.webhooks.IssuesOpened
    | github.webhooks.IssuesEdited
    | github.webhooks.IssuesClosed
    | github.webhooks.IssuesReopened
    | github.webhooks.IssuesDeleted,
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
    await enqueue_job(
        "github.repo.sync.issue_references", issue.organization_id, issue.repository_id
    )

    return issue


async def handle_issue_transferred(
    session: AsyncSession,
    scope: str,
    action: str,
    event: github.webhooks.IssuesTransferred,
) -> Issue | None:
    old_issue_id = event.issue.id
    old_issue = await service.github_issue.get_by_external_id(session, old_issue_id)
    if not old_issue:
        return None

    new_repository_data = event.changes.new_repository

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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesOpened):
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesReopened):
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesEdited):
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesClosed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_issue(session, scope, action, parsed)


@task("github.webhook.issues.deleted")
async def issue_deleted(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesDeleted):
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesTransferred):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_issue_transferred(session, scope, action, parsed)


@task("github.webhook.issues.labeled")
async def issue_labeled(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesLabeled):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await issue_labeled_async(session, scope, action, parsed)


@task("github.webhook.issues.unlabeled")
async def issue_unlabeled(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesUnlabeled):
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
    event: github.webhooks.IssuesLabeled | github.webhooks.IssuesUnlabeled,
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesAssigned):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await issue_assigned_async(session, scope, action, parsed)


@task("github.webhook.issues.unassigned")
async def issue_unassigned(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesUnassigned):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await issue_assigned_async(session, scope, action, parsed)


async def issue_assigned_async(
    session: AsyncSession,
    scope: str,
    action: str,
    event: github.webhooks.IssuesAssigned | github.webhooks.IssuesUnassigned,
) -> None:
    issue = await service.github_issue.get_by_external_id(session, event.issue.id)
    if not issue:
        log.warn(
            "github.webhook.issue_assigned_async.not_found", external_id=event.issue.id
        )
        return

    # modify assignee
    stmt = (
        sql.Update(Issue)
        .where(Issue.id == issue.id)
        .values(
            assignee=github.jsonify(event.issue.assignee),
            assignees=github.jsonify(event.issue.assignees),
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
    event: github.webhooks.PullRequestOpened
    | github.webhooks.PullRequestEdited
    | github.webhooks.PullRequestClosed
    | github.webhooks.PullRequestReopened
    | github.webhooks.PullRequestSynchronize,
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestOpened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.edited")
async def pull_request_edited(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestEdited):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.closed")
async def pull_request_closed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestClosed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.reopened")
async def pull_request_reopened(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestReopened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.synchronize")
async def pull_request_synchronize(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestSynchronize):
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
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with ExecutionContext(is_during_installation=True):
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationCreated):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await repositories_changed(session, event)


@task("github.webhook.installation.deleted")
async def installation_delete(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationDeleted):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            org = await service.github_organization.get_by_external_id(
                session, event.installation.account.id
            )
            if not org:
                return
            await service.github_organization.remove(session, org.id)


@task("github.webhook.installation.suspend")
async def installation_suspend(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationSuspend):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await service.github_organization.suspend(
                session,
                event.installation.id,
                event.installation.suspended_by.id,
                event.installation.suspended_at,
                event.sender.id,
            )


@task("github.webhook.installation.unsuspend")
async def installation_unsuspend(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> None:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationUnsuspend):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionMaker(ctx) as session:
            await service.github_organization.unsuspend(session, event.installation.id)
