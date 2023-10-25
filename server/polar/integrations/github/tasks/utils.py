from collections.abc import Sequence
from uuid import UUID

import structlog

from polar.integrations.github import client as github
from polar.integrations.github import service
from polar.models import Issue, Organization, PullRequest, Repository
from polar.postgres import AsyncSession
from polar.pull_request.schemas import FullPullRequestCreate

log = structlog.get_logger()

# ------------------------------------------------------------------------------
# TODO: Move all of this to service(s) except for true utils
# ------------------------------------------------------------------------------


async def get_organization_and_repo(
    session: AsyncSession,
    organization_id: UUID,
    repository_id: UUID,
) -> tuple[Organization, Repository]:
    organization = await service.github_organization.get(session, organization_id)
    if not organization:
        log.warning("no organization found", organization_id=organization_id)
        raise ValueError("no organization found")

    repository = await service.github_repository.get(session, repository_id)
    if not repository:
        log.warning("no repository found", repository_id=organization_id)
        raise ValueError("no repository found")

    return (organization, repository)


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


async def get_event_org_repo(
    session: AsyncSession,
    event: github.webhooks.IssuesOpened
    | github.webhooks.IssuesEdited
    | github.webhooks.IssuesClosed
    | github.webhooks.IssuesDeleted
    | github.webhooks.PullRequestOpened
    | github.webhooks.PullRequestEdited
    | github.webhooks.PullRequestClosed
    | github.webhooks.PullRequestReopened
    | github.webhooks.PullRequestSynchronize
    | github.webhooks.IssuesReopened,
) -> tuple[Organization, Repository] | None:
    repository_id = event.repository.id
    owner_id = event.repository.owner.id

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

    return (organization, repository)


async def get_event_issue(
    session: AsyncSession,
    event: github.webhooks.IssuesOpened
    | github.webhooks.IssuesEdited
    | github.webhooks.IssuesClosed
    | github.webhooks.IssuesDeleted,
) -> Issue | None:
    return await service.github_issue.get_by_external_id(session, event.issue.id)


async def upsert_issue(
    session: AsyncSession,
    event: github.webhooks.IssuesOpened
    | github.webhooks.IssuesEdited
    | github.webhooks.IssuesClosed
    | github.webhooks.IssuesDeleted
    | github.webhooks.IssuesReopened,
) -> Issue | None:
    owner_id = event.repository.owner.id
    repository_id = event.repository.id
    org_repo = await get_event_org_repo(session, event)
    if not org_repo:
        log.warning(
            "github.webhook.upsert_issue",
            error="organization or repository not found",
            owner_id=owner_id,
            repository_id=repository_id,
        )
        return None

    (org, repo) = org_repo

    record = await service.github_issue.store(
        session, data=event.issue, organization=org, repository=repo
    )
    return record


async def upsert_pull_request(
    session: AsyncSession,
    event: github.webhooks.PullRequestOpened
    | github.webhooks.PullRequestEdited
    | github.webhooks.PullRequestClosed
    | github.webhooks.PullRequestReopened
    | github.webhooks.PullRequestSynchronize,
) -> PullRequest | None:
    owner_id = event.repository.owner.id
    repository_id = event.repository.id
    org_repo = await get_event_org_repo(session, event)
    if not org_repo:
        log.warning(
            "github.webhook.upsert_issue",
            error="organization or repository not found",
            owner_id=owner_id,
            repository_id=repository_id,
        )
        return None

    (org, repo) = org_repo

    create_schema = FullPullRequestCreate.full_pull_request_from_github(
        event.pull_request, org, repo
    )

    records = await service.github_pull_request.store_many_full(
        session, [event.pull_request], organization=org, repository=repo
    )
    return records[0] if len(records) == 1 else None
