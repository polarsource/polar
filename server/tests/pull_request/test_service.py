from datetime import datetime
import random
from typing import List, Tuple, TypedDict
import pytest
from polar.enums import Platforms

from polar.kit.utils import generate_uuid
from polar.models.organization import Organization
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository
from polar.pull_request.service import pull_request
from polar.postgres import AsyncSession


async def get_org_repo(session: AsyncSession) -> Tuple[Organization, Repository]:
    org_id = generate_uuid()

    org = await Organization.create(
        session,
        id=org_id,
        platform=Platforms.github,
        name="test",
        external_id=random.randint(1, 1000000),
        is_personal=True,
        installation_id=random.randint(1, 1000000),
        installation_created_at=datetime.now(),
    )

    repo_id = generate_uuid()

    repo = await Repository.create(
        session,
        id=repo_id,
        organization_id=org_id,
        platform=Platforms.github,
        name="test",
        external_id=random.randint(1, 1000000),
        is_private=True,
    )

    await session.commit()
    await session.refresh(org)
    await session.refresh(repo)

    return (org, repo)


@pytest.mark.asyncio
async def test_find_prs_for_issue(subtests, session: AsyncSession) -> None:
    create = [
        {"title": "A", "body": "Foo fixes #123"},
        {"title": "B", "body": "Foo fixes #1234"},
        {"title": "C", "body": "Resolved #123! This is a PR. close #40"},
    ]

    (org, repo) = await get_org_repo(session)

    # Create Org and Repo

    for c in create:
        created = await PullRequest.create(
            session,
            issue_id=generate_uuid(),
            repository_id=repo.id,
            organization_id=org.id,
            platform=Platforms.github,
            external_id=random.randint(1, 1000000),
            number=random.randint(1, 1000000),
            state="open",
            title=c["title"],
            body=c["body"],
            issue_created_at=datetime.now(),
        )
        await session.commit()
        await session.refresh(created)

    Expect = TypedDict("Expect", {"num": int, "prs": List[str]})
    expects: List[Expect] = [
        {"num": 123, "prs": ["A", "C"]},
        {"num": 1234, "prs": ["B"]},
        {"num": 40, "prs": ["C"]},
    ]

    for e in expects:
        with subtests.test("search", num=e["num"]):
            found = await pull_request.list_by_repository_for_issue(
                session, repo.id, e["num"]
            )
            assert [f.title for f in found] == e["prs"]
