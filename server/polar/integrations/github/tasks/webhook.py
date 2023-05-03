from datetime import datetime
from typing import Any, Union

import structlog
from polar.context import ExecutionContext

from polar.integrations.github import client as github
from polar.issue.schemas import IssueRead
from polar.kit.extensions.sqlalchemy import sql
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
    with ExecutionContext(is_during_installation=True) as ctx:
        if not event.installation:
            return dict(success=False)

        organization = await service.github_organization.get_by_external_id(
            session, event.installation.account.id
        )
        if not organization:
            log.critical(
                "suspicuous github webhook!",
                # webhook_id=event.id,
                github_event=f"{scope}.{action}",
                organization=event.installation.account.login,
            )
            return dict(success=False)

        added, deleted = 0, 0
        if event.repositories_added:
            instances = await add_repositories(
                session, organization, event.repositories_added
            )
            added = len(instances)

        if event.repositories_removed:
            deleted = await remove_repositories(
                session, organization, event.repositories_removed
            )

        return dict(success=True, added=added, removed=deleted)


@task("github.webhook.installation_repositories.added")
async def repositories_added(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context() as context:
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.InstallationRepositoriesAdded):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionLocal() as session:
            return await repositories_changed(session, scope, action, parsed)


@task(name="github.webhook.installation_repositories.removed")
async def repositories_removed(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context() as context:
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.InstallationRepositoriesRemoved):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")
        async with AsyncSessionLocal() as session:
            return await repositories_changed(session, scope, action, parsed)


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
        # TODO: Handle better
        return dict(success=False, reason="Could not save issue")

    # Trigger references sync job for entire repository
    await enqueue_job(
        "github.repo.sync.issue_references", issue.organization_id, issue.repository_id
    )

    # TODO: Comment instead? Via event trigger too?
    # service.github_issue.add_actions(installation["id"], issue)
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
        parsed = github.webhooks.parse_obj(scope, payload)
        if not isinstance(parsed, github.webhooks.IssuesUnlabeled):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            return await issue_labeled_async(session, scope, action, parsed)


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

    # modify labels
    stmt = (
        sql.Update(Issue)
        .where(Issue.id == issue.id)
        .values(labels=github.jsonify(event.issue.labels))
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
                await add_repositories(session, organization, event.repositories)

            return dict(success=True)


@task("github.webhook.installation.deleted")
async def installation_delete(
    ctx: JobContext,
    scope: str,
    action: str,
    payload: dict[str, Any],
    polar_context: PolarWorkerContext,
) -> dict[str, Any]:
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
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
    with polar_context.to_execution_context() as context:
        event = github.webhooks.parse_obj(scope, payload)
        if not isinstance(event, github.webhooks.InstallationUnsuspend):
            log.error("github.webhook.unexpected_type")
            raise Exception("unexpected webhook payload")

        async with AsyncSessionLocal() as session:
            await service.github_organization.unsuspend(session, event.installation.id)
            return dict(success=True)
