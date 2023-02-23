from typing import Any

import structlog
from polar.models import Issue, Organization, PullRequest, Repository
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.issue import IssueSchema
from polar.schema.organization import CreateOrganization
from polar.schema.pull_request import CreatePullRequest, PullRequestSchema
from polar.schema.repository import CreateRepository
from polar.worker import asyncify_task, task

from polar import actions
from polar.clients import github

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
            organization_name=organization.name,
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
        organization.name,
        repository.name,
        event.issue,
        organization_id=organization.id,
        repository_id=repository.id,
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

    create_schema = CreatePullRequest.from_github(
        organization.name,
        repository.name,
        event.pull_request,
        organization_id=organization.id,
        repository_id=repository.id,
    )
    record = await actions.github_pull_request.upsert(session, create_schema)
    return record


# ------------------------------------------------------------------------------
# REPOSITORIES
# ------------------------------------------------------------------------------


async def repositories_changed(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
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
@asyncify_task(with_session=True)
async def repositories_added(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await repositories_changed(session, scope, action, payload)


@task(name="github.webhook.repository.removed")
@asyncify_task(with_session=True)
async def repositories_removed(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
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

    # TODO: Comment instead? Via event trigger too?
    # actions.github_issue.add_actions(installation["id"], issue)
    schema = IssueSchema.from_orm(issue)
    return dict(success=True, issue=schema.dict())


@task(name="github.webhook.issue.created")
@asyncify_task(with_session=True)
async def issue_opened(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_issue(session, scope, action, payload)


@task(name="github.webhook.issue.edited")
@asyncify_task(with_session=True)
async def issue_edited(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    return await handle_issue(session, scope, action, payload)


@task(name="github.webhook.issue.closed")
@asyncify_task(with_session=True)
async def issue_closed(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)

    # TODO: Handle me

    return dict(success=True)


@task(name="github.webhook.issue.labeled")
@asyncify_task(with_session=True)
async def issue_labeled(
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

    schema = IssueSchema.from_orm(issue)
    return dict(success=True, issue=schema.dict())


# ------------------------------------------------------------------------------
# PULL REQUESTS
# ------------------------------------------------------------------------------


@task(name="github.webhook.pull_request.created")
@asyncify_task(with_session=True)
async def pull_request_opened(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    pr = await upsert_pull_request(session, event)
    if not pr:
        return dict(success=False, reason="Could not save PR")

    schema = PullRequestSchema.from_orm(pr)
    return dict(success=True, pull_request=schema.dict())


@task(name="github.webhook.pull_request.synchronize")
@asyncify_task(with_session=True)
async def pull_request_synchronize(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    pr = await upsert_pull_request(session, event)
    if not pr:
        return dict(success=False, reason="Could not sync PR")

    schema = PullRequestSchema.from_orm(pr)
    return dict(success=True, pull_request=schema.dict())


# ------------------------------------------------------------------------------
# INSTALLATION
# ------------------------------------------------------------------------------


@task(name="github.webhook.installation.created")
@asyncify_task(with_session=True)
async def installation_created(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    # TODO: Handle user permission?

    payload = github.patch_unset("requester", payload)
    event = get_event(scope, action, payload)

    # TODO: Move this into its own schema helper
    account = event.installation.account
    is_personal = account.type.lower() == "user"
    create_schema = CreateOrganization(
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
@asyncify_task(with_session=True)
async def installation_delete(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    await actions.github_organization.remove(session, event.installation.id)
    return dict(success=True)


@task(name="github.webhook.installation.suspended")
@asyncify_task(with_session=True)
async def installation_suspend(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
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
@asyncify_task(with_session=True)
async def installation_unsuspend(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)

    await actions.github_organization.unsuspend(session, event.installation.id)
    return dict(success=True)
