from __future__ import annotations

from typing import Any

import pytest

from polar.integrations.github import actions
from polar.integrations.github import client as github
from polar.models.organization import Organization
from polar.organization.schemas import OrganizationCreate
from polar.enums import Platforms
from polar.postgres import AsyncSession, AsyncSessionLocal
from tests.fixtures.webhook import TestWebhook, TestWebhookFactory


async def assert_repository_deleted(
    session: AsyncSession, repo: dict[str, Any]
) -> None:
    record = await actions.github_repository.get_by_external_id(session, repo["id"])
    assert record is None


async def assert_repository_exists(session: AsyncSession, repo: dict[str, Any]) -> None:
    repo_id = repo["id"]
    record = await actions.github_repository.get_by_external_id(session, repo_id)
    assert record is not None
    assert record.name == repo["name"]
    assert record.is_private == repo["private"]


async def get_asserted_org(session: AsyncSession, **clauses: Any) -> Organization:
    org = await actions.github_organization.get_by(session, **clauses)
    assert org
    return org


async def create_org(
    github_webhook: TestWebhookFactory,
    status: Organization.Status = Organization.Status.ACTIVE,
) -> Organization:
    hook = github_webhook.create("installation.created")
    hook = github.patch_unset("requester", hook.json)
    event: github.webhooks.InstallationCreated = github.webhooks.parse_obj(
        "installation", hook
    )

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
    async with AsyncSessionLocal() as session:
        org = await actions.github_organization.upsert(session, create_schema)
        org.status = status
        session.add(org)
        await session.commit()
        return org


async def create_repositories(github_webhook: TestWebhookFactory) -> TestWebhook:
    await create_org(github_webhook, status=Organization.Status.ACTIVE)
    hook = github_webhook.create("installation_repositories.added")
    response = await hook.send()
    assert response.status_code == 200
    return hook


async def create_issue(github_webhook: TestWebhookFactory) -> TestWebhook:
    await create_repositories(github_webhook)
    hook = github_webhook.create("issues.opened")
    response = await hook.send()
    assert response.status_code == 200
    return hook


async def create_pr(github_webhook: TestWebhookFactory) -> TestWebhook:
    await create_repositories(github_webhook)
    hook = github_webhook.create("pull_request.opened")
    response = await hook.send()
    assert response.status_code == 200
    return hook


@pytest.mark.anyio
async def test_webhook_installation_created(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    hook = github_webhook.create("installation.created")
    installation_id = hook["installation"]["id"]
    account = hook["installation"]["account"]
    response = await hook.send()
    assert response.status_code == 200

    org = await actions.github_organization.get_by(
        session, installation_id=installation_id
    )

    assert org is not None
    assert org.external_id == account["id"]
    assert org.name == account["login"]

    for repo in hook["repositories"]:
        await assert_repository_exists(session, repo)


@pytest.mark.anyio
async def test_webhook_installation_suspend(github_webhook: TestWebhookFactory) -> None:
    org = await create_org(github_webhook, status=Organization.Status.INACTIVE)

    hook = github_webhook.create("installation.suspend")
    org_id = hook["installation"]["account"]["id"]
    response = await hook.send()
    assert response.status_code == 200

    async with AsyncSessionLocal() as session:
        org = await get_asserted_org(session, external_id=org_id)
        assert org.status == org.Status.SUSPENDED


@pytest.mark.anyio
async def test_webhook_installation_unsuspend(
    github_webhook: TestWebhookFactory,
) -> None:
    org = await create_org(github_webhook, status=Organization.Status.SUSPENDED)

    hook = github_webhook.create("installation.unsuspend")
    org_id = hook["installation"]["account"]["id"]
    response = await hook.send()
    assert response.status_code == 200

    async with AsyncSessionLocal() as session:
        org = await get_asserted_org(session, external_id=org_id)
        assert org.status == org.Status.ACTIVE


@pytest.mark.anyio
async def test_webhook_installation_delete(github_webhook: TestWebhookFactory) -> None:
    hook = github_webhook.create("installation.deleted")
    org_id = hook["installation"]["account"]["id"]

    org = await create_org(github_webhook, status=Organization.Status.ACTIVE)
    assert org
    assert org.external_id == org_id

    response = await hook.send()
    assert response.status_code == 200

    async with AsyncSessionLocal() as session:
        fetched = await actions.github_organization.get_by(session, external_id=org_id)
        assert fetched is None


@pytest.mark.anyio
async def test_webhook_repositories_added(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    hook = github_webhook.create("installation_repositories.added")
    new_repo = hook["repositories_added"][0]

    repo = await actions.github_repository.get_by_external_id(session, new_repo["id"])
    assert repo is None

    await create_repositories(github_webhook)
    await assert_repository_exists(session, new_repo)


@pytest.mark.anyio
async def test_webhook_repositories_removed(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    hook = github_webhook.create("installation_repositories.removed")
    delete_repo = hook["repositories_removed"][0]

    await create_repositories(github_webhook)
    await assert_repository_exists(session, delete_repo)

    response = await hook.send()
    assert response.status_code == 200

    repo = await actions.github_repository.get_by_external_id(
        session, delete_repo["id"]
    )
    assert repo is None


@pytest.mark.anyio
async def test_webhook_issues_opened(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    await create_repositories(github_webhook)
    hook = github_webhook.create("issues.opened")
    issue_id = hook["issue"]["id"]

    issue = await actions.github_issue.get_by_external_id(session, issue_id)
    assert issue is None

    response = await hook.send()
    assert response.status_code == 200

    issue = await actions.github_issue.get_by_external_id(session, issue_id)
    assert issue is not None


@pytest.mark.anyio
async def test_webhook_issues_closed(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    hook = github_webhook.create("issues.closed")
    response = await hook.send()
    assert response.status_code == 200


@pytest.mark.anyio
async def test_webhook_issues_labeled(github_webhook: TestWebhookFactory) -> None:
    await create_repositories(github_webhook)
    hook = await create_issue(github_webhook)

    issue_id = hook["issue"]["id"]
    async with AsyncSessionLocal() as session:
        issue = await actions.github_issue.get_by_external_id(session, issue_id)
        assert issue is not None
        assert issue.labels is None

    hook = github_webhook.create("issues.labeled")
    response = await hook.send()
    assert response.status_code == 200

    async with AsyncSessionLocal() as session:
        issue = await actions.github_issue.get_by_external_id(session, issue_id)
        assert issue.labels[0]["name"] == hook["issue"]["labels"][0]["name"]


@pytest.mark.anyio
async def test_webhook_pull_request_opened(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    hook = github_webhook.create("pull_request.opened")
    pr_id = hook["pull_request"]["id"]

    pr = await actions.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is None

    await create_pr(github_webhook)

    pr = await actions.github_pull_request.get_by_external_id(session, pr_id)
    assert pr is not None

    assert pr.additions == 3
    assert pr.deletions == 1


@pytest.mark.anyio
async def test_webhook_pull_request_synchronize(
    github_webhook: TestWebhookFactory,
) -> None:
    await create_pr(github_webhook)
    hook = github_webhook.create("pull_request.synchronize")
    pr_id = hook["pull_request"]["id"]

    async with AsyncSessionLocal() as session:
        pr = await actions.github_pull_request.get_by_external_id(session, pr_id)
        assert pr.merge_commit_sha is None

    await hook.send()

    async with AsyncSessionLocal() as session:
        pr = await actions.github_pull_request.get_by_external_id(session, pr_id)
        assert pr.merge_commit_sha is not None
