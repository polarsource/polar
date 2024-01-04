from __future__ import annotations

from typing import Any
from unittest.mock import ANY, patch

import httpx
import pytest
from pytest_mock import MockerFixture

from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.integrations.github import service
from polar.integrations.github.tasks import webhook as webhook_tasks
from polar.kit import utils
from polar.kit.extensions.sqlalchemy import sql
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.organization.schemas import OrganizationCreate
from polar.postgres import AsyncSession
from polar.repository.schemas import RepositoryCreate
from polar.worker import JobContext, PolarWorkerContext
from tests.fixtures import random_objects
from tests.fixtures.webhook import TestWebhook, TestWebhookFactory


async def assert_repository_deleted(
    session: AsyncSession, repo: dict[str, Any]
) -> None:
    record = await service.github_repository.get_by_external_id(session, repo["id"])
    assert record is None


async def assert_repository_exists(session: AsyncSession, repo: dict[str, Any]) -> None:
    repo_id = repo["id"]
    record = await service.github_repository.get_by_external_id(session, repo_id)
    assert record is not None
    assert record.name == repo["name"]
    assert record.is_private == repo["private"]


async def get_asserted_org(session: AsyncSession, **clauses: Any) -> Organization:
    org = await service.github_organization.get_by(session, **clauses)
    assert org
    return org


async def create_org(
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
    status: Organization.Status = Organization.Status.ACTIVE,
) -> Organization:
    hook = github_webhook.create("installation.created")
    event = github.webhooks.parse_obj("installation", hook.json)
    if not isinstance(event, github.models.WebhookInstallationCreated):
        raise Exception("unexpected type")

    account = event.installation.account
    assert isinstance(account, github.models.SimpleUser)
    is_personal = account.type.lower() == "user"
    create_schema = OrganizationCreate(
        platform=Platforms.github,
        name=account.login,
        external_id=account.id,
        avatar_url=account.avatar_url,
        is_personal=is_personal,
        installation_id=event.installation.id,
        installation_created_at=utils.utc_now(),
        installation_updated_at=utils.utc_now(),
        installation_suspended_at=event.installation.suspended_at,
    )
    stmt = (
        sql.insert(Organization)
        .values(**create_schema.dict())
        .on_conflict_do_update(
            index_elements=[Organization.external_id], set_={**create_schema.dict()}
        )
        .returning(Organization)
        .execution_options(populate_existing=True)
    )
    res = await session.execute(stmt)
    org = res.scalars().one()

    org.status = status
    session.add(org)
    await session.commit()
    return org


async def create_repositories(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> Organization:
    org = await create_org(session, github_webhook, status=Organization.Status.ACTIVE)
    hook = github_webhook.create("installation_repositories.added")

    parsed = github.webhooks.parse_obj("installation_repositories", hook.json)
    if not isinstance(parsed, github.models.WebhookInstallationRepositoriesAdded):
        raise Exception("unexpected webhook payload")

    for repo in parsed.repositories_added:
        create_schema = RepositoryCreate(
            platform=Platforms.github,
            external_id=repo.id,
            organization_id=org.id,
            name=repo.name,
            is_private=repo.private,
        )

        stmt = (
            sql.insert(Repository)
            .values(**create_schema.dict())
            .on_conflict_do_nothing()
        )
        await session.execute(stmt)
        await session.commit()
    return org


async def create_issue(
    job_context: JobContext, session: AsyncSession, github_webhook: TestWebhookFactory
) -> TestWebhook:
    await create_repositories(session, github_webhook)
    hook = github_webhook.create("issues.opened")

    await webhook_tasks.issue_opened(
        job_context,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )
    return hook


async def create_pr(
    job_context: JobContext, session: AsyncSession, github_webhook: TestWebhookFactory
) -> TestWebhook:
    await create_repositories(session, github_webhook)
    hook = github_webhook.create("pull_request.opened")

    await webhook_tasks.pull_request_opened(
        job_context,
        "pull_request",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )
    return hook


@pytest.mark.asyncio
async def test_webhook_installation_suspend(
    job_context: JobContext,
    session: AsyncSession,
    mocker: MockerFixture,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    org = await create_org(session, github_webhook, status=Organization.Status.INACTIVE)

    hook = github_webhook.create("installation.suspend")
    org_id = hook["installation"]["account"]["id"]

    # then
    session.expunge_all()

    await webhook_tasks.installation_suspend(
        job_context,
        "installation",
        "suspend",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    org = await get_asserted_org(session, external_id=org_id)
    assert org.status == org.Status.SUSPENDED


@pytest.mark.asyncio
async def test_webhook_installation_unsuspend(
    job_context: JobContext,
    session: AsyncSession,
    mocker: MockerFixture,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    org = await create_org(
        session, github_webhook, status=Organization.Status.SUSPENDED
    )

    hook = github_webhook.create("installation.unsuspend")
    org_id = hook["installation"]["account"]["id"]

    # then
    session.expunge_all()

    await webhook_tasks.installation_unsuspend(
        job_context,
        "installation",
        "unsuspend",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    org = await get_asserted_org(session, external_id=org_id)
    assert org.status == org.Status.ACTIVE


@pytest.mark.asyncio
async def test_webhook_installation_delete(
    job_context: JobContext,
    session: AsyncSession,
    mocker: MockerFixture,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    hook = github_webhook.create("installation.deleted")
    org_id = hook["installation"]["account"]["id"]

    org = await create_org(session, github_webhook, status=Organization.Status.ACTIVE)
    assert org
    assert org.external_id == org_id

    # then
    session.expunge_all()

    await webhook_tasks.installation_delete(
        job_context,
        "installation",
        "deleted",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    fetched = await service.github_organization.get_by(session, external_id=org_id)
    assert fetched is not None
    assert fetched.deleted_at is not None

    # Normal get should fail
    fetched_get = await service.github_organization.get(session, fetched.id)
    assert fetched_get is None

    # un-delete (fixes other tests)
    fetched.deleted_at = None
    await fetched.save(session)


def hook_as_obj(
    hook: github.models.WebhookInstallationRepositoriesAdded,
) -> github.models.InstallationRepositoriesGetResponse200:
    return github.models.InstallationRepositoriesGetResponse200(
        total_count=len(hook.repositories_added),
        repositories=[
            github.models.Repository(
                id=repo.id,
                node_id=repo.node_id,
                name=repo.name,
                full_name=repo.full_name,
                private=repo.private,
                # dummy values
                license_=None,
                organization=None,
                forks=0,
                permissions=github.models.RepositoryPropPermissions(
                    admin=True,
                    pull=True,
                    push=True,
                    maintain=True,
                    triage=True,
                ),
                owner=github.models.SimpleUser(
                    login="xx",
                    id=123,
                    node_id="what",
                    avatar_url="xxx",
                    gravatar_id=None,
                    url="xxx",
                    html_url="xxx",
                    followers_url="xxx",
                    following_url="xxx",
                    gists_url="xxx",
                    starred_url="xxx",
                    subscriptions_url="xxx",
                    organizations_url="xxx",
                    repos_url="xxx",
                    events_url="xxx",
                    received_events_url="xxx",
                    type="xxx",
                    site_admin=False,
                ),
                html_url="xx",
                description=None,
                fork=False,
                url="xx",
                archive_url="xx",
                assignees_url="xx",
                blobs_url="xx",
                branches_url="xx",
                collaborators_url="xx",
                comments_url="xx",
                commits_url="xx",
                compare_url="xx",
                contents_url="xx",
                contributors_url="xx",
                deployments_url="xx",
                downloads_url="xx",
                events_url="xx",
                forks_url="xx",
                git_commits_url="xx",
                git_refs_url="xx",
                git_tags_url="xx",
                git_url="xx",
                issue_comment_url="xx",
                issue_events_url="xx",
                issues_url="xx",
                keys_url="xx",
                labels_url="xx",
                languages_url="xx",
                merges_url="xx",
                milestones_url="xx",
                notifications_url="xx",
                pulls_url="xx",
                releases_url="xx",
                ssh_url="xx",
                stargazers_url="xx",
                statuses_url="xx",
                subscribers_url="xx",
                subscription_url="xx",
                tags_url="xx",
                teams_url="xx",
                trees_url="xx",
                clone_url="xx",
                mirror_url=None,
                hooks_url="xx",
                svn_url="xx",
                homepage=None,
                language=None,
                forks_count=0,
                stargazers_count=0,
                watchers_count=0,
                size=0,
                default_branch="main",
                open_issues_count=20,
                is_template=False,
                topics=[],
                has_issues=True,
                has_projects=True,
                has_wiki=True,
                has_pages=True,
                has_downloads=True,
                has_discussions=True,
                archived=False,
                disabled=False,
                visibility="private",
                pushed_at=None,
                created_at=None,
                updated_at=None,
                allow_rebase_merge=True,
                template_repository=None,
                temp_clone_token=None,
                allow_squash_merge=True,
                allow_auto_merge=True,
                delete_branch_on_merge=True,
                allow_update_branch=True,
                use_squash_pr_title_as_default=True,
                squash_merge_commit_title="PR_TITLE",
                squash_merge_commit_message="PR_BODY",
                merge_commit_title="PR_TITLE",
                merge_commit_message="PR_BODY",
                allow_merge_commit=True,
                allow_forking=True,
                web_commit_signoff_required=True,
                subscribers_count=123,
                network_count=123,
                open_issues=123,
                watchers=123,
                master_branch="main",
                starred_at="",
                anonymous_access_enabled=True,
            )
            for repo in hook.repositories_added
        ],
        repository_selection="x",
    )


@pytest.mark.asyncio
async def test_webhook_repositories_added(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    hook = github_webhook.create("installation_repositories.added")
    new_repo = hook["repositories_added"][0]

    # def lister(*args: Any, **kwargs: Any) -> httpx.Response:
    parsed = github.webhooks.parse_obj("installation_repositories", hook.json)
    if not isinstance(parsed, github.models.WebhookInstallationRepositoriesAdded):
        raise Exception("wat")

    # fake it
    x = hook_as_obj(parsed)

    response_mock = mocker.patch(
        "githubkit.core.GitHubCore._arequest",
        side_effect=[
            httpx.Response(
                200,
                request=httpx.Request("POST", ""),
                content=x.json(),
            ),
        ],
    )

    # then
    session.expunge_all()

    repo = await service.github_repository.get_by_external_id(session, new_repo["id"])
    assert repo is None

    await webhook_tasks.repositories_added(
        job_context,
        "installation_repositories",
        "added",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    await assert_repository_exists(session, new_repo)

    response_mock.assert_called()


@pytest.mark.asyncio
async def test_webhook_repositories_removed(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    hook = github_webhook.create("installation_repositories.removed")
    delete_repo = hook["repositories_removed"][0]

    await create_repositories(session, github_webhook)
    await assert_repository_exists(session, delete_repo)

    # fake it
    response_mock = mocker.patch(
        "githubkit.core.GitHubCore._arequest",
        side_effect=[
            httpx.Response(
                200,
                request=httpx.Request("POST", ""),
                content=github.models.InstallationRepositoriesGetResponse200(
                    total_count=0, repositories=[], repository_selection="x"
                ).json(),
            ),
        ],
    )

    # then
    session.expunge_all()

    await webhook_tasks.repositories_removed(
        job_context,
        "installation_repositories",
        "removed",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    repo = await service.github_repository.get_by_external_id(
        session, delete_repo["id"]
    )
    assert repo is not None
    assert repo.deleted_at is not None

    repo_get = await service.github_repository.get(session, repo.id)
    assert repo_get is None

    response_mock.assert_called()


@pytest.mark.asyncio
async def test_webhook_issues_opened(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    await create_repositories(session, github_webhook)
    hook = github_webhook.create("issues.opened")
    issue_id = hook["issue"]["id"]

    # then
    session.expunge_all()

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    await webhook_tasks.issue_opened(
        job_context,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None


@pytest.mark.asyncio
async def test_webhook_issues_closed(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    # create issue
    await create_repositories(session, github_webhook)
    hook = github_webhook.create("issues.opened")
    issue_id = hook["issue"]["id"]

    # then
    session.expunge_all()

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    await webhook_tasks.issue_opened(
        job_context,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None

    # close it

    hook = github_webhook.create("issues.closed")
    await webhook_tasks.issue_closed(
        job_context,
        "issues",
        "closed",
        hook.json,
        polar_context=PolarWorkerContext(),
    )
    # TODO: Actually do a test here


@pytest.mark.asyncio
async def test_webhook_issues_labeled(
    job_context: JobContext,
    session: AsyncSession,
    mocker: MockerFixture,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    await create_repositories(session, github_webhook)
    hook = await create_issue(job_context, session, github_webhook)

    # then
    session.expunge_all()

    issue_id = hook["issue"]["id"]
    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None
    assert issue.labels is None

    hook = github_webhook.create("issues.labeled")
    await webhook_tasks.issue_labeled(
        job_context,
        "issues",
        "labeled",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None
    assert issue.labels is not None
    assert isinstance(issue.labels, list)
    assert issue.labels[0]["name"] == hook["issue"]["labels"][0]["name"]


@pytest.mark.asyncio
async def test_webhook_pull_request_opened(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    hook = github_webhook.create("pull_request.opened")
    pr_id = hook["pull_request"]["id"]

    # then
    session.expunge_all()

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is None

    await create_pr(job_context, session, github_webhook)

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is not None

    assert pr.additions == 3
    assert pr.deletions == 1


@pytest.mark.asyncio
async def test_webhook_pull_request_edited(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    # then
    session.expunge_all()

    hook = github_webhook.create("pull_request.edited")
    pr_id = hook["pull_request"]["id"]

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is None

    await create_repositories(session, github_webhook)
    hook = github_webhook.create("pull_request.edited")
    await webhook_tasks.pull_request_edited(
        job_context,
        "pull_request",
        "edited",
        hook.json,
        polar_context=PolarWorkerContext(),
    )


@pytest.mark.asyncio
async def test_webhook_pull_request_synchronize(
    job_context: JobContext,
    session: AsyncSession,
    mocker: MockerFixture,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    await create_pr(job_context, session, github_webhook)

    # then
    session.expunge_all()

    hook = github_webhook.create("pull_request.synchronize")
    pr_id = hook["pull_request"]["id"]

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is not None
    assert pr.merge_commit_sha is None

    await webhook_tasks.pull_request_synchronize(
        job_context,
        "pull_request",
        "synchronize",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is not None
    assert pr.merge_commit_sha is not None


@pytest.mark.asyncio
async def test_webhook_issues_deleted(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    await create_repositories(session, github_webhook)

    # then
    session.expunge_all()

    # first create an issue
    hook = github_webhook.create("issues.opened")
    issue_id = hook["issue"]["id"]

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    await webhook_tasks.issue_opened(
        job_context,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None

    # then delete it

    deleted_hook = github_webhook.create("issues.deleted")
    issue_id = hook["issue"]["id"]

    await webhook_tasks.issue_deleted(
        job_context,
        "issues",
        "deleted",
        deleted_hook.json,
        polar_context=PolarWorkerContext(),
    )

    # TODO: maybe it makes more sense for this API to not return the issue?
    issue_ext = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue_ext is not None
    assert issue_ext.id == issue.id

    id = issue.id

    issue_get = await service.github_issue.get(session, id)
    assert issue_get is None

    issue_get_deleted = await service.github_issue.get(session, id, allow_deleted=True)
    assert issue_get_deleted is not None


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_webhook_opened_with_label(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    embed_mock = mocker.patch(
        "polar.integrations.github.service.github_issue.embed_badge"
    )

    org = await create_repositories(session, github_webhook)
    org.onboarded_at = utils.utc_now()
    await org.save(session)

    # first create an issue
    hook = github_webhook.create("issues.opened_with_polar_label")
    issue_id = hook["issue"]["id"]

    # then
    session.expunge_all()

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    await webhook_tasks.issue_opened(
        job_context,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None

    assert issue.labels is not None
    assert isinstance(issue.labels, list)
    assert issue.labels[0]["name"] == "Fund"

    assert issue.contains_pledge_badge_label(issue.labels, "Fund") is True
    assert issue.has_pledge_badge_label is True

    embed_mock.assert_called_once_with(
        ANY,  # session
        organization=ANY,
        repository=ANY,
        issue=ANY,
        triggered_from_label=True,
    )


@pytest.mark.asyncio
@patch("polar.config.settings.GITHUB_BADGE_EMBED", True)
async def test_webhook_labeled_remove_badge_body(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
) -> None:
    async def in_process_enqueue_job(name, *args, **kwargs) -> None:  # type: ignore  # noqa: E501
        if name == "github.issue.sync.issue_references":
            return None  # skip
        if name == "github.issue.sync.issue_dependencies":
            return None  # skip
        if name == "github.repo.sync.issue_references":
            return None  # skip
        else:
            raise Exception(f"unexpected job: {name}")

    mocker.patch("polar.worker._enqueue_job", new=in_process_enqueue_job)

    embed_mock = mocker.patch(
        "polar.integrations.github.service.github_issue.embed_badge"
    )

    org = await create_repositories(session, github_webhook)
    org.onboarded_at = utils.utc_now()
    await org.save(session)

    # first create an issue labeled with "polar" label
    hook = github_webhook.create("issues.opened_with_polar_label")
    issue_id = hook["issue"]["id"]

    # then
    session.expunge_all()

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    await webhook_tasks.issue_opened(
        job_context,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None

    assert issue.labels is not None
    assert isinstance(issue.labels, list)
    assert issue.labels[0]["name"] == "Fund"

    assert issue.contains_pledge_badge_label(issue.labels, "Fund") is True
    assert issue.has_pledge_badge_label is True

    # add badge
    embed_mock.assert_called_once_with(
        ANY,  # session
        organization=ANY,
        repository=ANY,
        issue=ANY,
        triggered_from_label=True,
    )

    embed_mock.reset_mock()

    # receive edit without badge in body, still with label

    hook = github_webhook.create("issues.edited_with_polar_label_no_badge_body")

    await webhook_tasks.issue_edited(
        job_context,
        "issues",
        "edited",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None
    assert issue.labels is not None
    assert isinstance(issue.labels, list)
    assert issue.labels[0]["name"] == "Fund"
    assert issue.contains_pledge_badge_label(issue.labels, "Fund") is True

    # assert badge is added again

    embed_mock.assert_called_once_with(
        ANY,  # session
        organization=ANY,
        repository=ANY,
        issue=ANY,
        triggered_from_label=True,
    )


@pytest.mark.asyncio
async def test_webhook_organization_renamed(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
    organization: Organization,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    hook = github_webhook.create("organization.renamed")
    hook["organization"]["id"] = organization.external_id

    # then
    session.expunge_all()

    await webhook_tasks.organizations_renamed(
        job_context,
        "organization",
        "renamed",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    updated_organization = await service.github_organization.get_by_external_id(
        session, organization.external_id
    )
    assert updated_organization is not None
    assert updated_organization.name == hook["organization"]["login"]


@pytest.mark.asyncio
async def test_webhook_repository_transferred(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
    repository: Repository,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    new_organization = await random_objects.create_organization(session)

    hook = github_webhook.create("repository.transferred")
    hook["repository"]["id"] = repository.external_id
    hook["repository"]["owner"]["id"] = new_organization.external_id

    # then
    session.expunge_all()

    await webhook_tasks.repositories_transferred(
        job_context,
        "repository",
        "transferred",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    updated_repository = await service.github_repository.get_by_external_id(
        session, repository.external_id
    )
    assert updated_repository is not None
    assert updated_repository.organization_id == new_organization.id


@pytest.mark.asyncio
async def test_webhook_issue_transferred(
    job_context: JobContext,
    mocker: MockerFixture,
    session: AsyncSession,
    github_webhook: TestWebhookFactory,
    organization: Organization,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("polar.worker._enqueue_job")

    old_repository = await random_objects.create_repository(
        session, organization, is_private=False
    )
    old_issue = await random_objects.create_issue(session, organization, old_repository)
    old_issue.funding_goal = 10_000

    new_repository = await random_objects.create_repository(
        session, organization, is_private=False
    )
    new_issue = await random_objects.create_issue(session, organization, new_repository)

    hook = github_webhook.create("issues.transferred")
    hook["issue"]["id"] = old_issue.external_id
    hook["changes"]["new_issue"]["id"] = new_issue.external_id
    hook["changes"]["new_repository"]["id"] = new_repository.external_id
    hook["changes"]["new_repository"]["owner"]["id"] = organization.external_id

    # then
    session.expunge_all()

    await webhook_tasks.issue_transferred(
        job_context,
        "issues",
        "transferred",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    updated_new_issue = await service.github_issue.get_by_external_id(
        session, new_issue.external_id
    )
    assert updated_new_issue is not None
    assert updated_new_issue.funding_goal == 10_000

    updated_old_issue = await service.github_issue.get_by_external_id(
        session, old_issue.external_id
    )
    assert updated_old_issue is not None
    assert updated_old_issue.deleted_at is not None
