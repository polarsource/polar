from polar.context import PolarContext
from polar.enums import Platforms
from polar.models.pull_request import PullRequest
from polar.postgres import AsyncSession
from polar.pull_request.signals import pull_request_created, pull_request_updated
from polar.integrations.github.service.dependency import github_dependency
from polar.repository.service import repository as repository_service
from polar.organization.service import organization as organization_service
from polar.issue.service import issue as issue_service
from polar.worker import enqueue_job


@pull_request_created.connect
async def pull_request_created_trigger_reverse_references(
    context: PolarContext, *, item: PullRequest, session: AsyncSession
):
    await pull_request_find_reverse_references(session, item)


@pull_request_updated.connect
async def pull_request_updated_trigger_reverse_references(
    context: PolarContext, *, item: PullRequest, session: AsyncSession
):
    await pull_request_find_reverse_references(session, item)


async def pull_request_find_reverse_references(
    session: AsyncSession,
    item: PullRequest,
) -> None:
    """
    Find links to issues within the same repository, and re-crawl those issues for
    references. When crawling, this PR should be found.

    This is needed as there are no webooks on new issue timeline events, and we're
    using this as a proxy for when a new crawl is needed.
    """

    if not item.body:
        return

    repo = await repository_service.get(session, item.repository_id)
    if not repo:
        return

    org = await organization_service.get(session, item.organization_id)
    if not org:
        return

    deps = github_dependency.parse_dependencies(item.body)

    for dep in deps:
        # Find deps in same repository, and trigger syncs for the issue
        is_same_owner = dep.owner is None or dep.owner == org.name
        is_same_repo = dep.repo is None or dep.repo == repo.name

        if not is_same_owner or not is_same_repo:
            continue

        linked_issue = await issue_service.get_by_number(
            session,
            Platforms.github,
            organization_id=org.id,
            repository_id=repo.id,
            number=dep.number,
        )
        if not linked_issue:
            continue

        # Schedule sync for this issue
        await enqueue_job("github.issue.sync.issue_references", linked_issue.id)
