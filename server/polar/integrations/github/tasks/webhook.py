from typing import Any

import structlog

from polar.integrations.github import client as github
from polar.issue.schemas import IssueRead
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms
from polar.pull_request.schemas import PullRequestRead
from polar.postgres import AsyncSessionLocal, AsyncSession
from polar.worker import JobContext, enqueue_job, task

from .. import service
from .utils import (
    add_repositories,
    remove_repositories,
    upsert_issue,
    upsert_pull_request,
)

log = structlog.get_logger()


def get_event(scope: str, action: str, payload: dict[str, Any]) -> github.WebhookEvent:
    log.info("github.webhook.received", scope=scope, action=action)
    return github.webhooks.parse_obj(scope, payload)


# ------------------------------------------------------------------------------
# REPOSITORIES
# ------------------------------------------------------------------------------


async def repositories_changed(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    # TODO: Verify that this works even for personal Github accounts?
    organization = await service.github_organization.get_by_external_id(
        session, event.installation.account.id
    )
    if not organization:
        log.critical(
            "suspicuous github webhook!",
            webhook_id=event.id,
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
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await repositories_changed(session, scope, action, payload)


@task(name="github.webhook.installation_repositories.removed")
async def repositories_removed(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await repositories_changed(session, scope, action, payload)


# ------------------------------------------------------------------------------
# ISSUES
# ------------------------------------------------------------------------------


async def handle_issue(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    issue = await upsert_issue(session, event)
    if not issue:
        # TODO: Handle better
        return dict(success=False, reason="Could not save issue")

    # Trigger references sync job
    await enqueue_job(
        "github.repo.sync.issue_references", issue.organization_id, issue.repository_id
    )

    # TODO: Comment instead? Via event trigger too?
    # service.github_issue.add_actions(installation["id"], issue)
    schema = IssueRead.from_orm(issue)
    return dict(success=True, issue=schema.dict())


@task("github.webhook.issues.opened")
async def issue_opened(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_issue(session, scope, action, payload)


@task("github.webhook.issues.edited")
async def issue_edited(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_issue(session, scope, action, payload)


@task("github.webhook.issues.closed")
async def issue_closed(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_issue(session, scope, action, payload)


@task("github.webhook.issues.labeled")
async def issue_labeled(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await issue_labeled_async(session, scope, action, payload)


async def issue_labeled_async(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    # TODO: Change from upsert here?
    # Potentially not since we might have race conditions between
    # webhooks for installations and our own historical syncing vs.
    # new issues coming in via other events in the meantime.
    event = get_event(scope, action, payload)
    issue = await upsert_issue(session, event)
    if not issue:
        # TODO: Handle better
        return dict(success=False, reason="Could not save issue")

    schema = IssueRead.from_orm(issue)
    return dict(success=True, issue=schema.dict())


# ------------------------------------------------------------------------------
# PULL REQUESTS
# ------------------------------------------------------------------------------


async def handle_pull_request(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    pr = await upsert_pull_request(session, event)
    if not pr:
        return dict(success=False, reason="Could not save PR")

    schema = PullRequestRead.from_orm(pr)
    return dict(success=True, pull_request=schema.dict())


@task("github.webhook.pull_request.opened")
async def pull_request_opened(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_pull_request(session, scope, action, payload)


@task("github.webhook.pull_request.edited")
async def pull_request_edited(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_pull_request(session, scope, action, payload)


@task("github.webhook.pull_request.closed")
async def pull_request_closed(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_pull_request(session, scope, action, payload)


@task("github.webhook.pull_request.reopened")
async def pull_request_reopened(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_pull_request(session, scope, action, payload)


@task("github.webhook.pull_request.synchronize")
async def pull_request_synchronize(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        return await handle_pull_request(session, scope, action, payload)


# ------------------------------------------------------------------------------
# INSTALLATION
# ------------------------------------------------------------------------------


@task("github.webhook.installation.created")
async def installation_created(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    # TODO: Handle user permission?

    async with AsyncSessionLocal() as session:

        payload = github.patch_unset("requester", payload)
        event = get_event(scope, action, payload)

        # TODO: Move this into its own schema helper
        account = event.installation.account
        is_personal = account.type.lower() == "user"
        create_schema = OrganizationCreate(
            platform=Platforms.github,
            name=account.login,
            external_id=account.id,
            avatar_url=account.avatar_url,
            is_personal=is_personal,
            is_site_admin=account.site_admin,
            installation_id=event.installation.id,
            installation_created_at=event.installation.created_at,
            installation_updated_at=event.installation.updated_at,
            installation_suspended_at=event.installation.suspended_at,
        )
        organization = await service.github_organization.upsert(session, create_schema)
        await add_repositories(session, organization, event.repositories)
        return dict(success=True)


@task("github.webhook.installation.deleted")
async def installation_delete(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        event = get_event(scope, action, payload)
        await service.github_organization.remove(session, event.installation.id)
        return dict(success=True)


@task("github.webhook.installation.suspend")
async def installation_suspend(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        event = get_event(scope, action, payload)

        await service.github_organization.suspend(
            session,
            event.installation.id,
            event.installation.suspended_by,
            event.installation.suspended_at,
            event.sender.id,
        )
        return dict(success=True)


@task("github.webhook.installation.unsuspend")
async def installation_unsuspend(
    ctx: JobContext, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with AsyncSessionLocal() as session:
        event = get_event(scope, action, payload)

        await service.github_organization.unsuspend(session, event.installation.id)
        return dict(success=True)
