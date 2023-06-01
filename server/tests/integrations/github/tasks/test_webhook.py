from __future__ import annotations

from typing import Any
from datetime import datetime

import pytest
from pytest_mock import MockerFixture
from arq.connections import ArqRedis

from polar.integrations.github import service
from polar.integrations.github import client as github
from polar.kit import utils
from polar.models.organization import Organization
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms
from polar.postgres import AsyncSession, AsyncSessionLocal
from polar.integrations.github.tasks import webhook as webhook_tasks
from polar.repository.schemas import RepositoryCreate
from polar.worker import JobContext, PolarWorkerContext
from tests.fixtures.webhook import TestWebhook, TestWebhookFactory
from polar.integrations.github.service.repository import (
    github_repository as github_repository_service,
)

FAKE_CTX: JobContext = {
    "redis": ArqRedis(),
    "job_id": "fake_job_id",
    "job_try": 1,
    "enqueue_time": datetime.utcnow(),
    "score": 0,
}


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
    github_webhook: TestWebhookFactory,
    status: Organization.Status = Organization.Status.ACTIVE,
) -> Organization:
    hook = github_webhook.create("installation.created")
    event = github.webhooks.parse_obj("installation", hook.json)
    if not isinstance(event, github.webhooks.InstallationCreated):
        raise Exception("unexpected type")

    account = event.installation.account
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
    async with AsyncSessionLocal() as session:
        org = await service.github_organization.upsert(session, create_schema)
        org.status = status
        session.add(org)
        await session.commit()
        return org


async def create_repositories(github_webhook: TestWebhookFactory) -> None:
    org = await create_org(github_webhook, status=Organization.Status.ACTIVE)
    hook = github_webhook.create("installation_repositories.added")

    parsed = github.webhooks.parse_obj("installation_repositories", hook.json)
    if not isinstance(parsed, github.webhooks.InstallationRepositoriesAdded):
        raise Exception("unexpected webhook payload")

    async with AsyncSessionLocal() as session:
        for repo in parsed.repositories_added:
            await github_repository_service.upsert(
                session,
                RepositoryCreate(
                    platform=Platforms.github,
                    external_id=repo.id,
                    organization_id=org.id,
                    name=repo.name,
                    is_private=repo.private,
                ),
            )


async def create_issue(github_webhook: TestWebhookFactory) -> TestWebhook:
    await create_repositories(github_webhook)
    hook = github_webhook.create("issues.opened")
    await webhook_tasks.issue_opened(
        FAKE_CTX,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )
    return hook


async def create_pr(github_webhook: TestWebhookFactory) -> TestWebhook:
    await create_repositories(github_webhook)
    hook = github_webhook.create("pull_request.opened")
    await webhook_tasks.pull_request_opened(
        FAKE_CTX,
        "pull_request",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )
    return hook


@pytest.mark.asyncio
async def test_webhook_installation_suspend(
    mocker: MockerFixture, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    org = await create_org(github_webhook, status=Organization.Status.INACTIVE)

    hook = github_webhook.create("installation.suspend")
    org_id = hook["installation"]["account"]["id"]
    await webhook_tasks.installation_suspend(
        FAKE_CTX,
        "installation",
        "suspend",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    async with AsyncSessionLocal() as session:
        org = await get_asserted_org(session, external_id=org_id)
        assert org.status == org.Status.SUSPENDED


@pytest.mark.asyncio
async def test_webhook_installation_unsuspend(
    mocker: MockerFixture,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    org = await create_org(github_webhook, status=Organization.Status.SUSPENDED)

    hook = github_webhook.create("installation.unsuspend")
    org_id = hook["installation"]["account"]["id"]
    await webhook_tasks.installation_unsuspend(
        FAKE_CTX,
        "installation",
        "unsuspend",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    async with AsyncSessionLocal() as session:
        org = await get_asserted_org(session, external_id=org_id)
        assert org.status == org.Status.ACTIVE


@pytest.mark.asyncio
async def test_webhook_installation_delete(
    mocker: MockerFixture, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    hook = github_webhook.create("installation.deleted")
    org_id = hook["installation"]["account"]["id"]

    org = await create_org(github_webhook, status=Organization.Status.ACTIVE)
    assert org
    assert org.external_id == org_id

    await webhook_tasks.installation_delete(
        FAKE_CTX,
        "installation",
        "deleted",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    async with AsyncSessionLocal() as session:
        fetched = await service.github_organization.get_by(session, external_id=org_id)
        assert fetched is not None
        assert fetched.deleted_at is not None

        # Normal get should fail
        fetched_get = await service.github_organization.get(session, fetched.id)
        assert fetched_get is None

        # un-delete (fixes other tests)
        fetched.deleted_at = None
        await fetched.save(session)


@pytest.mark.asyncio
async def test_webhook_repositories_added(
    mocker: MockerFixture, session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    hook = github_webhook.create("installation_repositories.added")
    new_repo = hook["repositories_added"][0]

    repo = await service.github_repository.get_by_external_id(session, new_repo["id"])
    assert repo is None

    await create_repositories(github_webhook)
    await assert_repository_exists(session, new_repo)


@pytest.mark.asyncio
async def test_webhook_repositories_removed(
    mocker: MockerFixture, session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    hook = github_webhook.create("installation_repositories.removed")
    delete_repo = hook["repositories_removed"][0]

    await create_repositories(github_webhook)
    await assert_repository_exists(session, delete_repo)

    await webhook_tasks.repositories_removed(
        FAKE_CTX,
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


@pytest.mark.asyncio
async def test_webhook_issues_opened(
    mocker: MockerFixture, session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    await create_repositories(github_webhook)
    hook = github_webhook.create("issues.opened")
    issue_id = hook["issue"]["id"]

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    await webhook_tasks.issue_opened(
        FAKE_CTX,
        "issues",
        "opened",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None


@pytest.mark.asyncio
async def test_webhook_issues_closed(
    mocker: MockerFixture, session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    hook = github_webhook.create("issues.closed")
    await webhook_tasks.issue_closed(
        FAKE_CTX,
        "issues",
        "closed",
        hook.json,
        polar_context=PolarWorkerContext(),
    )
    # TODO: Actually do a test here


@pytest.mark.asyncio
async def test_webhook_issues_labeled(
    mocker: MockerFixture, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    await create_repositories(github_webhook)
    hook = await create_issue(github_webhook)

    issue_id = hook["issue"]["id"]
    async with AsyncSessionLocal() as session:
        issue = await service.github_issue.get_by_external_id(session, issue_id)
        assert issue is not None
        assert issue.labels is None

    hook = github_webhook.create("issues.labeled")
    await webhook_tasks.issue_labeled(
        FAKE_CTX,
        "issues",
        "labeled",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    async with AsyncSessionLocal() as session:
        issue = await service.github_issue.get_by_external_id(session, issue_id)
        assert issue is not None
        assert issue.labels is not None
        assert issue.labels[0]["name"] == hook["issue"]["labels"][0]["name"]


@pytest.mark.asyncio
async def test_webhook_pull_request_opened(
    mocker: MockerFixture, session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    hook = github_webhook.create("pull_request.opened")
    pr_id = hook["pull_request"]["id"]

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is None

    await create_pr(github_webhook)

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is not None

    assert pr.additions == 3
    assert pr.deletions == 1


@pytest.mark.asyncio
async def test_webhook_pull_request_edited(
    mocker: MockerFixture, session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    hook = github_webhook.create("pull_request.edited")
    pr_id = hook["pull_request"]["id"]

    pr = await service.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is None

    await create_repositories(github_webhook)
    hook = github_webhook.create("pull_request.edited")
    await webhook_tasks.pull_request_edited(
        FAKE_CTX,
        "pull_request",
        "edited",
        hook.json,
        polar_context=PolarWorkerContext(),
    )


@pytest.mark.asyncio
async def test_webhook_pull_request_synchronize(
    mocker: MockerFixture,
    github_webhook: TestWebhookFactory,
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    await create_pr(github_webhook)
    hook = github_webhook.create("pull_request.synchronize")
    pr_id = hook["pull_request"]["id"]

    async with AsyncSessionLocal() as session:
        pr = await service.github_pull_request.get_by_external_id(session, pr_id)
        assert pr is not None
        assert pr.merge_commit_sha is None

    await webhook_tasks.pull_request_synchronize(
        FAKE_CTX,
        "pull_request",
        "synchronize",
        hook.json,
        polar_context=PolarWorkerContext(),
    )

    async with AsyncSessionLocal() as session:
        pr = await service.github_pull_request.get_by_external_id(session, pr_id)
        assert pr is not None
        assert pr.merge_commit_sha is not None


@pytest.mark.asyncio
async def test_webhook_issues_deleted(
    mocker: MockerFixture, session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    # Capture and prevent any calls to enqueue_job
    mocker.patch("arq.connections.ArqRedis.enqueue_job")

    await create_repositories(github_webhook)

    # first create an issue
    hook = github_webhook.create("issues.opened")
    issue_id = hook["issue"]["id"]

    issue = await service.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    await webhook_tasks.issue_opened(
        FAKE_CTX,
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
        FAKE_CTX,
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
