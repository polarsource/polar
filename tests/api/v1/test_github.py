from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar import actions
from polar.api.v1.github import queue
from polar.config import settings
from polar.postgres import AsyncSession
from polar.tasks.github import webhook
from tests.fixtures.webhook import TestWebhookFactory

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.organization import Organization


def ensure_dispatched_task(
    github_webhook: TestWebhookFactory,
    event: str,
    handler: MagicMock,
) -> None:
    hook = github_webhook.create(event)
    with hook.request_context():
        webhook_dispatch()

    handler.assert_called_once()
    handler.assert_called_with(hook.id, hook.event, hook.json)


def assert_repository_deleted(repo: dict[str, Any]) -> None:
    record = actions.github_repository.get_by_external_id(repo["id"])
    assert record is None


def assert_repository_exists(repo: dict[str, Any]) -> None:
    repo_id = repo["id"]
    record = actions.github_repository.get_by_external_id(repo_id)
    assert record is not None
    assert record.name == repo["name"]
    assert repo["full_name"] == f"{record.organization_name}/{record.name}"
    assert record.is_private == repo["private"]


def get_asserted_org(**clauses: Any) -> Organization:
    org = actions.github_organization.get_by(**clauses)
    assert org
    return org


# def test_dispatch_installation_created(
#     github_webhook: GithubWebhookFactory, mocker: MockerFixture
# ) -> None:
#     patch = mocker.patch.object
#     mapper = {
#         "installation.created": patch(webhook, "installation_created"),
#         # "installation.suspend": patch(webhook.installation_suspend, "delay"),
#         # "installation.unsuspend": patch(webhook.installation_unsuspend, "delay"),
#         # "installation_repositories.added": patch(webhook.repositories_added, "delay"),
#         # "installation_repositories.removed": patch(
#         #     webhook.repositories_removed, "delay"
#         # ),
#         # "issues.opened": patch(webhook.issue_opened, "delay"),
#         # "issues.labeled": patch(webhook.issue_labeled, "delay"),
#         # "issues.closed": patch(webhook.issue_closed, "delay"),
#         # "pull_request.opened": patch(webhook.pull_request_opened, "delay"),
#         # "pull_request.synchronize": patch(webhook.pull_request_synchronize, "delay"),
#     }
#     for event, handler in mapper.items():
#         ensure_dispatched_task(github_webhook, event, handler)


@pytest.mark.anyio
async def test_installation_created(
    session: AsyncSession, github_webhook: TestWebhookFactory
) -> None:
    from polar.tasks.github.webhook import installation_created

    hook = github_webhook.create("installation.created")
    res = await installation_created("installation", "created", hook.json)


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

    # map(assert_repository_exists, hook["repositories"])


# def test_webhook_installation_suspend(github_webhook: GithubWebhookFactory) -> None:
#     hook = github_webhook.create("installation.suspend")
#     org_id = hook["installation"]["account"]["id"]

#     org = get_asserted_org(external_id=org_id)
#     # TODO: Fix me. Should be ACTIVE by default upon installation
#     assert org.status == org.Status.INACTIVE

#     response = hook.send()
#     assert response.status_code == 200

#     org = get_asserted_org(external_id=org_id)
#     assert org.status == org.Status.SUSPENDED


# def test_webhook_installation_unsuspend(github_webhook: GithubWebhookFactory) -> None:
#     hook = github_webhook.create("installation.unsuspend")
#     org_id = hook["installation"]["account"]["id"]

#     org = get_asserted_org(external_id=org_id)
#     assert org.status == org.Status.SUSPENDED

#     response = hook.send()
#     assert response.status_code == 200

#     org = get_asserted_org(external_id=org_id)
#     assert org.status == org.Status.ACTIVE


# def test_webhook_repositories_added(github_webhook: GithubWebhookFactory) -> None:
#     hook = github_webhook.create("installation_repositories.added")
#     new_repo = hook["repositories_added"][0]

#     repo = actions.github_repository.get_by_external_id(new_repo["id"])
#     assert repo is None

#     response = hook.send()
#     assert response.status_code == 200
#     assert_repository_exists(new_repo)


# def test_webhook_repositories_removed(github_webhook: GithubWebhookFactory) -> None:
#     hook = github_webhook.create("installation_repositories.removed")
#     delete_repo = hook["repositories_removed"][0]

#     # Created at installation
#     assert_repository_exists(delete_repo)

#     response = hook.send()
#     assert response.status_code == 200

#     repo = actions.github_repository.get_by_external_id(delete_repo["id"])
#     assert repo is None
