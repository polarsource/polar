import uuid
from typing import Any

import structlog

from polar import actions
from polar.clients import github
from polar.models import Issue, Organization, PullRequest, Repository
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.issue import IssueRead
from polar.schema.organization import OrganizationCreate
from polar.schema.pull_request import FullPullRequestCreate, PullRequestRead
from polar.schema.repository import CreateRepository
from polar.worker import get_db_session, sync_worker, task

log = structlog.get_logger()


def get_event(scope: str, action: str, payload: dict[str, Any]) -> github.WebhookEvent:
    log.info("github.webhook.received", scope=scope, action=action)
    return github.webhooks.parse_obj(scope, payload)


# ------------------------------------------------------------------------------
# Move to actions
# ------------------------------------------------------------------------------


async def add_repositories(
    session: AsyncSession,
    organization: Organization,
    repositories: list[github.webhooks.InstallationCreatedPropRepositoriesItems],
) -> list[Repository]:
    schemas = []
    for repo in repositories:
        create_schema = CreateRepository(
            platform=Platforms.github,
            external_id=repo.id,
            organization_id=organization.id,
            name=repo.name,
            is_private=repo.private,
        )
        schemas.append(create_schema)

    log.debug("github.repositories.upsert_many", repos=schemas)
    instances = await actions.github_repository.upsert_many(session, schemas)
    return instances


async def remove_repositories(
    session: AsyncSession,
    organization: Organization,
    repositories: list[
        github.webhooks.InstallationRepositoriesRemovedPropRepositoriesRemovedItems
    ],
) -> int:
    # TODO: Implement delete many to avoid N*2 db calls
    count = 0
    for repo in repositories:
        # TODO: All true now, but that will change
        res = await actions.github_repository.delete(session, external_id=repo.id)
        if res:
            count += 1
    return count


async def upsert_issue(
    session: AsyncSession, event: github.webhooks.IssuesOpened
) -> Issue | None:
    repository_id = event.repository.id
    owner_id = event.repository.owner.id

    organization = await actions.github_organization.get_by_external_id(
        session, owner_id
    )
    if not organization:
        # TODO: Raise here
        log.warning(
            "github.webhook.issue.opened",
            error="no organization found",
            organization_id=owner_id,
        )
        return None

    repository = await actions.github_repository.get_by_external_id(
        session, repository_id
    )
    if not repository:
        # TODO: Raise here
        log.warning(
            "github.webhook.issue.opened",
            error="no repository found",
            repository_id=repository_id,
        )
        return None

    record = await actions.github_issue.store(
        session,
        event.issue,
        organization_id=uuid.UUID(organization.id),  # TODO: cast should not be needed
        repository_id=uuid.UUID(repository.id),
    )
    return record


async def upsert_pull_request(
    session: AsyncSession, event: github.webhooks.PullRequestOpened
) -> PullRequest | None:
    repository_id = event.repository.id
    owner_id = event.repository.owner.id

    organization = await actions.github_organization.get_by_external_id(
        session, owner_id
    )
    if not organization:
        # TODO: Raise here
        log.warning(
            "github.webhook.pull_request",
            error="no organization found",
            organization_id=owner_id,
        )
        return None

    repository = await actions.github_repository.get_by_external_id(
        session, repository_id
    )
    if not repository:
        # TODO: Raise here
        log.warning(
            "github.webhook.pull_request",
            error="no repository found",
            repository_id=repository_id,
        )
        return None

    create_schema = FullPullRequestCreate.full_pull_request_from_github(
        event.pull_request,
        organization_id=uuid.UUID(
            organization.id
        ),  # TODO: Fix! For some reason get_by_external_id returns the id as a str!
        repository_id=uuid.UUID(repository.id),
    )
    record = await actions.github_pull_request.upsert(session, create_schema)
    return record


# ------------------------------------------------------------------------------
# REPOSITORIES
# ------------------------------------------------------------------------------


async def repositories_changed(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
        event = get_event(scope, action, payload)
        # TODO: Verify that this works even for personal Github accounts?
        organization = await actions.github_organization.get_by_external_id(
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


@task(name="github.webhook.repository.added")
@sync_worker()
async def repositories_added(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await repositories_changed(scope, action, payload)


@task(name="github.webhook.repository.removed")
async def repositories_removed(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await repositories_changed(scope, action, payload)


# ------------------------------------------------------------------------------
# ISSUES
# ------------------------------------------------------------------------------


async def handle_issue(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
        event = get_event(scope, action, payload)
        issue = await upsert_issue(session, event)
        if not issue:
            # TODO: Handle better
            return dict(success=False, reason="Could not save issue")

        # TODO: Comment instead? Via event trigger too?
        # actions.github_issue.add_actions(installation["id"], issue)
        schema = IssueRead.from_orm(issue)
        return dict(success=True, issue=schema.dict())


@task(name="github.webhook.issue.created")
@sync_worker()
async def issue_opened(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_issue(scope, action, payload)


@task(name="github.webhook.issue.edited")
@sync_worker()
async def issue_edited(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_issue(scope, action, payload)


@task(name="github.webhook.issue.closed")
@sync_worker()
async def issue_closed(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_issue(scope, action, payload)


@task(name="github.webhook.issue.labeled")
@sync_worker()
async def issue_labeled(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await issue_labeled_async(scope, action, payload)


async def issue_labeled_async(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
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
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
        event = get_event(scope, action, payload)
        pr = await upsert_pull_request(session, event)
        if not pr:
            return dict(success=False, reason="Could not save PR")

        schema = PullRequestRead.from_orm(pr)
        return dict(success=True, pull_request=schema.dict())


@task(name="github.webhook.pull_request.created")
@sync_worker()
async def pull_request_opened(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_pull_request(scope, action, payload)


@task(name="github.webhook.pull_request.edited")
@sync_worker()
async def pull_request_edited(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_pull_request(scope, action, payload)


@task(name="github.webhook.pull_request.closed")
@sync_worker()
async def pull_request_closed(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_pull_request(scope, action, payload)


@task(name="github.webhook.pull_request.reopened")
@sync_worker()
async def pull_request_reopened(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_pull_request(scope, action, payload)


@task(name="github.webhook.pull_request.synchronize")
@sync_worker()
async def pull_request_synchronize(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await pull_request_synchronize_async(scope, action, payload)


async def pull_request_synchronize_async(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
        event = get_event(scope, action, payload)
        pr = await upsert_pull_request(session, event)
        if not pr:
            return dict(success=False, reason="Could not sync PR")

        schema = PullRequestRead.from_orm(pr)
        return dict(success=True, pull_request=schema.dict())


# ------------------------------------------------------------------------------
# INSTALLATION
# ------------------------------------------------------------------------------


@task(name="github.webhook.installation.created")
@sync_worker()
async def installation_created(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    # TODO: Handle user permission?

    async with get_db_session() as session:

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
            installation_modified_at=event.installation.updated_at,
            installation_suspended_at=event.installation.suspended_at,
        )
        organization = await actions.github_organization.upsert(session, create_schema)
        await add_repositories(session, organization, event.repositories)
        return dict(success=True)


@task(name="github.webhook.installation.deleted")
@sync_worker()
async def installation_delete(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
        event = get_event(scope, action, payload)
        await actions.github_organization.remove(session, event.installation.id)
        return dict(success=True)


@task(name="github.webhook.installation.suspended")
@sync_worker()
async def installation_suspend(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
        event = get_event(scope, action, payload)

        await actions.github_organization.suspend(
            session,
            event.installation.id,
            event.installation.suspended_by,
            event.installation.suspended_at,
            event.sender.id,
        )
        return dict(success=True)


@task(name="github.webhook.installation.unsuspended")
@sync_worker()
async def installation_unsuspend(
    scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    async with get_db_session() as session:
        event = get_event(scope, action, payload)

        await actions.github_organization.unsuspend(session, event.installation.id)
        return dict(success=True)
