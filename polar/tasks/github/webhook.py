from typing import Any

import structlog

from polar import actions
from polar.clients import github
from polar.models import Organization, Repository
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.organization import CreateOrganization
from polar.schema.repository import CreateRepository
from polar.worker import asyncify_task, task

log = structlog.get_logger()


def get_event(scope: str, action: str, payload: dict[str, Any]) -> github.WebhookEvent:
    log.info("Celery task got event", scope=scope, action=action)
    return github.webhooks.parse_obj(scope, payload)


# ------------------------------------------------------------------------------
# Move to actions
# ------------------------------------------------------------------------------


async def add_repositories(
    session: AsyncSession,
    organization: Organization,
    repositories: list[dict[str, Any]],
) -> list[Repository]:
    schemas = []
    for repo in repositories:
        create_schema = CreateRepository(
            platform=Platforms.github,
            external_id=repo["id"],
            organization_id=organization.id,
            organization_name=organization.name,
            name=repo["name"],
            is_private=repo["private"],
        )
        schemas.append(create_schema)

    log.debug("github.repositories.upsert_many", repos=schemas)
    instances = await actions.github_repository.upsert_many(session, schemas)
    return instances


async def remove_repositories(
    session: AsyncSession,
    organization: Organization,
    repositories: list[dict[str, Any]],
) -> int:
    # TODO: Implement delete many to avoid N*2 db calls
    count = 0
    for repo in repositories:
        # TODO: All true now, but that will change
        res = await actions.github_repository.delete(session, external_id=repo["id"])
        if res:
            count += 1
    return count


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
    await add_repositories(session, organization, payload["repositories"])
    return dict(success=True)


# ------------------------------------------------------------------------------
# ISSUES
# ------------------------------------------------------------------------------


@task(name="github.webhook.issues.opened")
@asyncify_task(with_session=True)
async def issues_opened(
    session: AsyncSession, scope: str, action: str, payload: dict[str, Any]
) -> dict[str, Any]:
    event = get_event(scope, action, payload)
    return {"success": True, "message": "Called celery task"}
