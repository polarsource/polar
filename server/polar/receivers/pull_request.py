from polar.enums import Platforms
from polar.integrations.github.service.url import github_url
from polar.issue.service import issue as issue_service
from polar.organization.service import organization as organization_service
from polar.pull_request.hooks import PullRequestHook, pull_request_upserted
from polar.repository.service import repository as repository_service
from polar.worker import enqueue_job


async def pull_request_find_reverse_references(
    hook: PullRequestHook,
) -> None:
    """
    Find links to issues within the same repository, and re-crawl those issues for
    references. When crawling, this PR should be found.

    This is needed as there are no webooks on new issue timeline events, and we're
    using this as a proxy for when a new crawl is needed.
    """

    session = hook.session
    item = hook.pull_request

    if not item.body:
        return

    repo = await repository_service.get(session, item.repository_id)
    if not repo:
        return

    org = await organization_service.get(session, item.organization_id)
    if not org:
        return

    urls = github_url.parse_urls(item.body)

    for url in urls:
        # Find deps in same repository, and trigger syncs for the issue
        is_same_owner = url.owner is None or url.owner == org.name
        is_same_repo = url.repo is None or url.repo == repo.name

        if not is_same_owner or not is_same_repo:
            continue

        linked_issue = await issue_service.get_by_number(
            session,
            Platforms.github,
            organization_id=org.id,
            repository_id=repo.id,
            number=url.number,
        )
        if not linked_issue:
            continue

        # Schedule sync for this issue
        enqueue_job("github.issue.sync.issue_references", linked_issue.id)


pull_request_upserted.add(pull_request_find_reverse_references)
