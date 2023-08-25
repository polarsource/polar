import json
import os
import time
from datetime import datetime
from typing import Any

import pytest
from arq import ArqRedis
from pytest_mock import MockerFixture

from polar.integrations.github import tasks
from polar.integrations.github.tasks import webhook as webhook_tasks
from polar.models.organization import Organization
from polar.models.user import OAuthAccount, User
from polar.models.user_organization import UserOrganization
from polar.notifications.service import (
    notifications,
)
from polar.postgres import AsyncSession, AsyncSessionLocal
from polar.worker import JobContext, PolarWorkerContext

FAKE_CTX: JobContext = {
    "redis": ArqRedis(),
    "job_id": "fake_job_id",
    "job_try": 1,
    "enqueue_time": datetime.utcnow(),
    "score": 0,
}


@pytest.mark.asyncio
@pytest.mark.vcr
async def test_installation_no_notifications(
    session: AsyncSession,
    mocker: MockerFixture,
) -> None:
    """
    This test uses real recorded traffic, saved in "casettes".
    To re-generate the casette. Run the test with --record-mode=rewrite.

    Example:
        pytest -k test_installation_no_notifications --record-mode=rewrite
    """

    async def in_process_enqueue_job(pool, name, *args, **kwargs) -> None:  # type: ignore  # noqa: E501
        if name == "github.repo.sync.issues":
            return await tasks.repo.sync_repository_issues(
                kwargs["polar_context"], *args, **kwargs
            )
        if name == "github.repo.sync.pull_requests":
            return await tasks.repo.sync_repository_pull_requests(
                kwargs["polar_context"], *args, **kwargs
            )
        elif name == "github.issue.sync.issue_references":
            return await tasks.issue.issue_sync_issue_references(
                kwargs["polar_context"], *args, **kwargs
            )
        elif name == "github.repo.sync.issue_references":
            return await tasks.repo.repo_sync_issue_references(
                kwargs["polar_context"], *args, **kwargs
            )
        elif name == "github.issue.sync.issue_dependencies":
            return None  # skip
        else:
            raise Exception(f"unexpected job: {name}")

    with open(
        "tests/integrations/github/tasks/testdata/github_webhook_installation_created_open-testing.json",
        "r",
    ) as fp:
        cassette: dict[str, Any] = json.loads(fp.read())

    mocker.patch("arq.connections.ArqRedis.enqueue_job", new=in_process_enqueue_job)

    async with AsyncSessionLocal() as session:
        # Create user to match requesting user
        user = await User.create(
            session=session,
            username=cassette["sender"]["login"],
            email="test_installation_no_notifications@test.polar.se",
            accepted_terms_of_service=True,
        )

        await OAuthAccount.create(
            session=session,
            platform="github",
            access_token=os.environ.get("POLAR_TEST_GITHUB_ACCESS_TOKEN", "ghu_xxx"),
            expires_at=round(time.time() + 60 * 60 * 24),
            refresh_token=os.environ.get("POLAR_TEST_GITHUB_REFRESH_TOKEN", "ghr_xxx"),
            account_id=str(cassette["sender"]["id"]),
            account_email="test_installation_no_notifications@test.polar.se",
            user_id=user.id,
        )

        await session.commit()
        await session.flush()

        # Create a new github installation
        await webhook_tasks.installation_created(
            FAKE_CTX,
            "installation",
            "created",
            cassette,
            polar_context=PolarWorkerContext(),
        )

        # Find org
        org = await Organization.find_by(
            session=session, name=cassette["installation"]["account"]["login"]
        )
        assert org is not None

        member = await UserOrganization.find_by(
            session=session,
            user_id=user.id,
            organization_id=org.id,
        )
        assert member is not None

        # no notifications
        notifs = await notifications.get_for_user(session, user_id=user.id)
        assert len(notifs) == 0
