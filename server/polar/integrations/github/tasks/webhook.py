from datetime import datetime
from typing import Any, Union

import structlog
from polar.context import ExecutionContext

from polar.integrations.github import client as github
from polar.issue.schemas import IssueRead
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms
from polar.pull_request.schemas import PullRequestRead
from polar.postgres import AsyncSessionLocal, AsyncSession
from polar.worker import JobContext, PolarWorkerContext, enqueue_job, task

from .. import service
from .utils import (
    add_repositories,
    remove_repositories,
    upsert_issue,
    upsert_pull_request,
    get_organization_and_repo,
)

log = structlog.get_logger()


# ------------------------------------------------------------------------------
# REPOSITORIES
# ------------------------------------------------------------------------------


async def repositories_changed(
    session: AsyncSession,
    scope: str,
    action: str,
    event: Union[
        github.webhooks.InstallationRepositoriesAdded,
        github.webhooks.InstallationRepositoriesRemoved,
    ],
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        if not event.installation:
            return dict(success=False)

        organization = await service.github_organization.get_by_external_id(
            session, event.installation.account.id
        )
        if not organization:
            log.critical(
                "suspicuous github webhook!",
                github_event=f"{scope}.{action}",
                organization=event.installation.account.login,
            )
            return dict(success=False)

        if event.repositories_added:
            await add_repositories(
                session, organization, event.installation.id, event.repositories_added
            )

        if event.repositories_removed:
            await remove_repositories(session, event.repositories_removed)

        return dict(success=True)


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
        async with AsyncSessionLocal() as session:
            await repositories_changed(session, scope, action, parsed)


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
        async with AsyncSessionLocal() as session:
            await repositories_changed(session, scope, action, parsed)


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
        async with AsyncSessionLocal() as session:
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
        async with AsyncSessionLocal() as session:
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
        async with AsyncSessionLocal() as session:
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
        async with AsyncSessionLocal() as session:
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
        async with AsyncSessionLocal() as session:
            await repository_updated(session, parsed)


async def repository_updated(
    session: AsyncSession,
    event: Union[
        github.webhooks.PublicEvent,
        github.webhooks.RepositoryRenamed,
        github.webhooks.RepositoryEdited,
        github.webhooks.RepositoryArchived,
    ],
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


# ------------------------------------------------------------------------------
# ISSUES
# ------------------------------------------------------------------------------


async def handle_issue(
    session: AsyncSession,
    scope: str,
    action: str,
    event: Union[
        github.webhooks.IssuesOpened,
        github.webhooks.IssuesEdited,
        github.webhooks.IssuesClosed,
    ],
) -> dict[str, Any]:
    issue = await upsert_issue(session, event)
    if not issue:
        raise Exception(f"failed to save issue external_id={event.issue.id}")

    # Trigger references sync job for entire repository
    await enqueue_job(
        "github.repo.sync.issue_references", issue.organization_id, issue.repository_id
    )

    schema = IssueRead.from_orm(issue)
    return dict(success=True, issue=schema.dict())


@task("github.webhook.issues.opened")
async def issue_opened(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesOpened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_issue(session, scope, action, parsed)


@task("github.webhook.issues.edited")
async def issue_edited(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesEdited):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_issue(session, scope, action, parsed)


@task("github.webhook.issues.closed")
async def issue_closed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesClosed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_issue(session, scope, action, parsed)


@task("github.webhook.issues.labeled")
async def issue_labeled(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesLabeled):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await issue_labeled_async(session, scope, action, parsed)


@task("github.webhook.issues.unlabeled")
async def issue_unlabeled(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesUnlabeled):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await issue_labeled_async(session, scope, action, parsed)


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
        return False

    # Abort. Let automatic embedding handle it.
    if repo.pledge_badge_auto_embed:
        return False

    if embed:
        return await service.github_issue.embed_badge(
            session, organization=org, repository=repo, issue=issue
        )

    return await service.github_issue.remove_badge(
        session, organization=org, repository=repo, issue=issue
    )


async def issue_labeled_async(
    session: AsyncSession,
    scope: str,
    action: str,
    event: Union[
        github.webhooks.IssuesLabeled,
        github.webhooks.IssuesUnlabeled,
    ],
) -> dict[str, Any]:
    issue = await service.github_issue.get_by_external_id(session, event.issue.id)
    if not issue:
        # TODO: Handle better
        return dict(success=False, reason="issue not found")

    embedded_before_update = issue.has_pledge_badge_label

    labels = github.jsonify(event.issue.labels)
    # TODO: Improve typing here
    issue.labels = labels  # type: ignore
    issue.issue_modified_at = event.issue.updated_at
    issue.has_pledge_badge_label = Issue.contains_pledge_badge_label(labels)
    session.add(issue)
    await session.commit()

    should_embed = issue.has_pledge_badge_label
    if embedded_before_update != should_embed:
        # Only remove or add badge in case of label change
        await update_issue_embed(session, issue=issue, embed=should_embed)

    schema = IssueRead.from_orm(issue)
    return dict(success=True, issue=schema.dict())


@task("github.webhook.issues.assigned")
async def issue_assigned(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesAssigned):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await issue_assigned_async(session, scope, action, parsed)


@task("github.webhook.issues.unassigned")
async def issue_unassigned(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesUnassigned):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await issue_assigned_async(session, scope, action, parsed)


async def issue_assigned_async(
    session: AsyncSession,
    scope: str,
    action: str,
    event: Union[
        github.webhooks.IssuesAssigned,
        github.webhooks.IssuesUnassigned,
    ],
) -> dict[str, Any]:
    issue = await service.github_issue.get_by_external_id(session, event.issue.id)
    if not issue:
        # TODO: Handle better
        return dict(success=False, reason="issue not found")

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

    # get for return
    issue = await service.github_issue.get_by_external_id(session, event.issue.id)
    if not issue:
        # TODO: Handle better
        return dict(success=False, reason="issue not found")

    schema = IssueRead.from_orm(issue)
    return dict(success=True, issue=schema.dict())


# ------------------------------------------------------------------------------
# PULL REQUESTS
# ------------------------------------------------------------------------------


async def handle_pull_request(
    session: AsyncSession,
    scope: str,
    action: str,
    event: Union[
        github.webhooks.PullRequestOpened,
        github.webhooks.PullRequestEdited,
        github.webhooks.PullRequestClosed,
        github.webhooks.PullRequestReopened,
        github.webhooks.PullRequestSynchronize,
    ],
) -> dict[str, Any]:
    pr = await upsert_pull_request(session, event)
    if not pr:
        return dict(success=False, reason="Could not save PR")

    schema = PullRequestRead.from_orm(pr)
    return dict(success=True, pull_request=schema.dict())


@task("github.webhook.pull_request.opened")
async def pull_request_opened(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestOpened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.edited")
async def pull_request_edited(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestEdited):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.closed")
async def pull_request_closed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestClosed):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.reopened")
async def pull_request_reopened(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestReopened):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_pull_request(session, scope, action, parsed)


@task("github.webhook.pull_request.synchronize")
async def pull_request_synchronize(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.PullRequestSynchronize):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await handle_pull_request(session, scope, action, parsed)


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
) -> dict[str, Any]:
    with ExecutionContext(is_during_installation=True):
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationCreated):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            # TODO: Remove this once the following issue is resolved:
            # https://github.com/yanyongyu/githubkit/issues/14
            if event.requester is None:
                event.requester = github.utils.UNSET

            if isinstance(event.installation.created_at, int):
                event.installation.created_at = datetime.fromtimestamp(
                    event.installation.created_at
                )

            if isinstance(event.installation.updated_at, int):
                event.installation.updated_at = datetime.fromtimestamp(
                    event.installation.updated_at
                )

            account = event.installation.account

            # If the org is previously deleted, un-delete it
            prev = await service.github_organization.get_by_external_id(
                session, account.id
            )
            if prev and prev.deleted_at is not None:
                prev.deleted_at = None
                await prev.save(session)

            is_personal = account.type.lower() == "user"
            create_schema = OrganizationCreate(
                platform=Platforms.github,
                name=account.login,
                external_id=account.id,
                avatar_url=account.avatar_url,
                is_personal=is_personal,
                installation_id=event.installation.id,
                installation_created_at=event.installation.created_at,
                installation_updated_at=event.installation.updated_at,
                installation_suspended_at=event.installation.suspended_at,
            )
            organization = await service.github_organization.upsert(
                session, create_schema
            )

            # Sync permission for the installing user
            sender = await service.github_user.get_user_by_github_id(
                session, event.sender.id
            )
            if sender:
                await service.github_user.sync_github_admin_orgs(session, user=sender)

            if event.repositories:
                await add_repositories(
                    session, organization, event.installation.id, event.repositories
                )

            return dict(success=True)


@task("github.webhook.installation.deleted")
async def installation_delete(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationDeleted):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            org = await service.github_organization.get_by_external_id(
                session, event.installation.account.id
            )
            if org:
                await service.github_organization.remove(session, org.id)

            return dict(success=True)


@task("github.webhook.installation.suspend")
async def installation_suspend(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationSuspend):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            await service.github_organization.suspend(
                session,
                event.installation.id,
                event.installation.suspended_by.id,
                event.installation.suspended_at,
                event.sender.id,
            )
            return dict(success=True)


@task("github.webhook.installation.unsuspend")
async def installation_unsuspend(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context():
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationUnsuspend):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            await service.github_organization.unsuspend(session, event.installation.id)
            return dict(success=True)
