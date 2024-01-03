from dataclasses import dataclass
from typing import Any

import pytest

from polar.authz.service import AccessType, Anonymous, Authz, Subject
from polar.models.issue import Issue
from polar.models.issue_reward import IssueReward
from polar.models.organization import Organization
from polar.models.pledge import Pledge, PledgeState
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import (
    create_issue,
    create_organization,
    create_repository,
    create_user,
)


@pytest.mark.asyncio
async def test_can_read_repository_private(
    session: AsyncSession,
    repository: Repository,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
) -> None:
    repository.is_private = True
    await repository.save(session)

    # then
    session.expunge_all()

    authz = Authz(session)

    assert (
        await authz.can(
            Anonymous(),
            AccessType.read,
            repository,
        )
        is False
    )

    assert (
        await authz.can(
            user,
            AccessType.read,
            repository,
        )
        is True
    )

    assert (
        await authz.can(
            user_second,
            AccessType.read,
            repository,
        )
        is False
    )


@pytest.mark.asyncio
async def test_can_read_repository_public(
    session: AsyncSession,
    repository: Repository,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
) -> None:
    repository.is_private = False
    await repository.save(session)

    # then
    session.expunge_all()

    authz = Authz(session)

    assert (
        await authz.can(
            Anonymous(),
            AccessType.read,
            repository,
        )
        is True
    )

    assert (
        await authz.can(
            user,
            AccessType.read,
            repository,
        )
        is True
    )

    assert (
        await authz.can(
            user_second,
            AccessType.read,
            repository,
        )
        is True
    )


@pytest.mark.asyncio
async def test_can_write_repository(
    session: AsyncSession,
    repository: Repository,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
) -> None:
    repository.is_private = False
    await repository.save(session)

    # then
    session.expunge_all()

    assert (
        await Authz(session).can(
            Anonymous(),
            AccessType.write,
            repository,
        )
        is False
    )

    user_organization.is_admin = False
    await user_organization.save(session)
    assert (
        await Authz(session).can(
            user,
            AccessType.write,
            repository,
        )
        is False
    )

    user_organization.is_admin = True
    await user_organization.save(session)
    assert (
        await Authz(session).can(
            user,
            AccessType.write,
            repository,
        )
        is True
    )

    assert (
        await Authz(session).can(
            user_second,
            AccessType.write,
            repository,
        )
        is False
    )


@pytest.mark.asyncio
async def test_can_write_organization(
    session: AsyncSession,
    organization: Organization,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
) -> None:
    # then
    session.expunge_all()

    assert (
        await Authz(session).can(
            Anonymous(),
            AccessType.write,
            organization,
        )
        is False
    )

    user_organization.is_admin = False
    await user_organization.save(session)
    assert (
        await Authz(session).can(
            user,
            AccessType.write,
            organization,
        )
        is False
    )

    user_organization.is_admin = True
    await user_organization.save(session)
    assert (
        await Authz(session).can(
            user,
            AccessType.write,
            organization,
        )
        is True
    )

    assert (
        await Authz(session).can(
            user_second,
            AccessType.write,
            organization,
        )
        is False
    )


@pytest.mark.asyncio
async def test_can_read_issue_public_repository(
    session: AsyncSession,
    repository: Repository,
    issue: Issue,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
) -> None:
    repository.is_private = False
    await repository.save(session)

    # then
    session.expunge_all()

    authz = Authz(session)

    assert (
        await authz.can(
            Anonymous(),
            AccessType.read,
            issue,
        )
        is True
    )

    user_organization.is_admin = False
    await user_organization.save(session)
    assert (
        await authz.can(
            user,
            AccessType.read,
            issue,
        )
        is True
    )

    user_organization.is_admin = True
    await user_organization.save(session)
    assert (
        await authz.can(
            user,
            AccessType.read,
            issue,
        )
        is True
    )

    assert (
        await authz.can(
            user_second,
            AccessType.read,
            issue,
        )
        is True
    )


@pytest.mark.asyncio
async def test_can_read_issue_private_repository(
    session: AsyncSession,
    repository: Repository,
    issue: Issue,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
) -> None:
    repository.is_private = True
    await repository.save(session)

    # then
    session.expunge_all()

    authz = Authz(session)

    assert (
        await authz.can(
            Anonymous(),
            AccessType.read,
            issue,
        )
        is False
    )

    user_organization.is_admin = False
    await user_organization.save(session)
    assert (
        await authz.can(
            user,
            AccessType.read,
            issue,
        )
        is True
    )

    user_organization.is_admin = True
    await user_organization.save(session)
    assert (
        await authz.can(
            user,
            AccessType.read,
            issue,
        )
        is True
    )

    assert (
        await authz.can(
            user_second,
            AccessType.read,
            issue,
        )
        is False
    )


@pytest.mark.asyncio
async def test_can_write_issue(
    session: AsyncSession,
    issue: Issue,
    user: User,
    user_second: User,
    user_organization: UserOrganization,
) -> None:
    # then
    session.expunge_all()

    assert (
        await Authz(session).can(
            Anonymous(),
            AccessType.write,
            issue,
        )
        is False
    )

    user_organization.is_admin = False
    await user_organization.save(session)
    assert (
        await Authz(session).can(
            user,
            AccessType.write,
            issue,
        )
        is False
    )

    user_organization.is_admin = True
    await user_organization.save(session)
    assert (
        await Authz(session).can(
            user,
            AccessType.write,
            issue,
        )
        is True
    )

    assert (
        await Authz(session).can(
            user_second,
            AccessType.write,
            issue,
        )
        is False
    )


@pytest.mark.asyncio
async def test_can_read_organization(
    session: AsyncSession,
    organization: Organization,
    user: User,
) -> None:
    # then
    session.expunge_all()

    authz = Authz(session)

    assert (
        await authz.can(
            Anonymous(),
            AccessType.read,
            organization,
        )
        is True
    )

    assert (
        await authz.can(
            user,
            AccessType.read,
            organization,
        )
        is True
    )


@pytest.mark.asyncio
async def test_can_read_issue_reward(
    subtests: Any,
    session: AsyncSession,
) -> None:
    # then (this is not perfect, some initialization happens after this)
    session.expunge_all()

    authz = Authz(session)

    @dataclass
    class TestCase:
        subject: Subject
        expected: bool
        is_reward_receiver: bool | None = None
        is_pledge_issue_member: bool | None = None
        is_pledge_issue_member_admin: bool = False

    for idx, tc in enumerate(
        [
            TestCase(subject=Anonymous(), expected=False),
            TestCase(
                subject=await create_user(session),
                is_reward_receiver=True,
                expected=True,
            ),
            TestCase(
                subject=await create_user(session),
                is_reward_receiver=False,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                is_reward_receiver=False,
                is_pledge_issue_member=False,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                is_reward_receiver=False,
                is_pledge_issue_member=True,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                is_reward_receiver=False,
                is_pledge_issue_member=True,
                is_pledge_issue_member_admin=True,
                expected=True,
            ),
        ]
    ):
        with subtests.test(
            msg=f"subject={type(tc.subject)} is_reward_receiver={tc.is_reward_receiver} is_pledge_issue_member={tc.is_pledge_issue_member}",  # noqa: E501
            id=idx,
        ):
            org = await create_organization(session)
            repo = await create_repository(session, org)
            issue = await create_issue(session, org, repo)

            reward = await IssueReward(
                issue_id=issue.id,
                share_thousands=700,
            ).save(session)

            if tc.is_reward_receiver and isinstance(tc.subject, User):
                reward.user_id = tc.subject.id
                await reward.save(session)

            if tc.is_pledge_issue_member and isinstance(tc.subject, User):
                await UserOrganization(
                    user_id=tc.subject.id,
                    organization_id=org.id,
                    is_admin=tc.is_pledge_issue_member_admin,
                ).save(session)

            assert (
                await authz.can(
                    tc.subject,
                    AccessType.read,
                    reward,
                )
                is tc.expected
            )


@pytest.mark.asyncio
async def test_can_read_pledge(
    subtests: Any,
    session: AsyncSession,
) -> None:
    authz = Authz(session)

    # then (this is not perfect, some initialization happens after this)
    session.expunge_all()

    @dataclass
    class TestCase:
        subject: Subject
        expected: bool
        is_pledging_user: bool = False
        is_pledging_org_member: bool = False
        is_pledging_org_member_admin: bool = False
        receiving_org_member: bool = False
        receiving_org_member_admin: bool = False

    for idx, tc in enumerate(
        [
            TestCase(subject=Anonymous(), expected=False),
            TestCase(
                subject=await create_user(session),
                is_pledging_user=False,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                is_pledging_user=True,
                expected=True,
            ),
            TestCase(
                subject=await create_user(session),
                is_pledging_org_member=False,
                is_pledging_org_member_admin=False,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                is_pledging_org_member=True,
                is_pledging_org_member_admin=True,
                expected=True,
            ),
            TestCase(
                subject=await create_user(session),
                receiving_org_member=True,
                receiving_org_member_admin=False,
                expected=True,
            ),
            TestCase(
                subject=await create_user(session),
                receiving_org_member=True,
                receiving_org_member_admin=True,
                expected=True,
            ),
        ]
    ):
        with subtests.test(
            msg=f"subject={type(tc.subject)} is_pledging_user={tc.is_pledging_user} is_pledging_org_member={tc.is_pledging_org_member} receiving_org_member={tc.receiving_org_member}",  # noqa: E501
            id=idx,
        ):
            org = await create_organization(session)
            repo = await create_repository(session, org)
            issue = await create_issue(session, org, repo)

            pledge = await Pledge(
                issue_id=issue.id,
                amount=12345,
                fee=0,
                repository_id=repo.id,
                organization_id=org.id,
                state=PledgeState.created,
            ).save(session)

            if tc.is_pledging_user and isinstance(tc.subject, User):
                pledge.by_user_id = tc.subject.id
                await pledge.save(session)

            if tc.receiving_org_member and isinstance(tc.subject, User):
                await UserOrganization(
                    user_id=tc.subject.id,
                    organization_id=org.id,
                    is_admin=tc.receiving_org_member_admin,
                ).save(session)

            if tc.is_pledging_org_member and isinstance(tc.subject, User):
                pledging_org = await create_organization(session)

                pledge.by_organization_id = pledging_org.id
                await pledge.save(session)

                await UserOrganization(
                    user_id=tc.subject.id,
                    organization_id=pledging_org.id,
                    is_admin=tc.is_pledging_org_member_admin,
                ).save(session)

            assert (
                await authz.can(
                    tc.subject,
                    AccessType.read,
                    pledge,
                )
                is tc.expected
            )


@pytest.mark.asyncio
async def test_can_write_pledge(
    subtests: Any,
    session: AsyncSession,
) -> None:
    authz = Authz(session)

    # then (this is not perfect, some initialization happens after this)
    session.expunge_all()

    @dataclass
    class TestCase:
        subject: Subject
        expected: bool
        is_pledging_user: bool = False
        is_pledging_org_member: bool = False
        is_pledging_org_member_admin: bool = False
        receiving_org_member: bool = False
        receiving_org_member_admin: bool = False

    for idx, tc in enumerate(
        [
            TestCase(subject=Anonymous(), expected=False),
            TestCase(
                subject=await create_user(session),
                is_pledging_user=False,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                is_pledging_user=True,
                expected=True,
            ),
            TestCase(
                subject=await create_user(session),
                is_pledging_org_member=False,
                is_pledging_org_member_admin=False,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                is_pledging_org_member=True,
                is_pledging_org_member_admin=True,
                expected=True,
            ),
            TestCase(
                subject=await create_user(session),
                receiving_org_member=True,
                receiving_org_member_admin=False,
                expected=False,
            ),
            TestCase(
                subject=await create_user(session),
                receiving_org_member=True,
                receiving_org_member_admin=True,
                expected=True,
            ),
        ]
    ):
        with subtests.test(
            msg=f"subject={type(tc.subject)} is_pledging_user={tc.is_pledging_user} is_pledging_org_member={tc.is_pledging_org_member} receiving_org_member={tc.receiving_org_member}",  # noqa: E501
            id=idx,
        ):
            org = await create_organization(session)
            repo = await create_repository(session, org)
            issue = await create_issue(session, org, repo)

            pledge = await Pledge(
                issue_id=issue.id,
                amount=12345,
                fee=0,
                repository_id=repo.id,
                organization_id=org.id,
                state=PledgeState.created,
            ).save(session)

            if tc.is_pledging_user and isinstance(tc.subject, User):
                pledge.by_user_id = tc.subject.id
                await pledge.save(session)

            if tc.receiving_org_member and isinstance(tc.subject, User):
                await UserOrganization(
                    user_id=tc.subject.id,
                    organization_id=org.id,
                    is_admin=tc.receiving_org_member_admin,
                ).save(session)

            if tc.is_pledging_org_member and isinstance(tc.subject, User):
                pledging_org = await create_organization(session)

                pledge.by_organization_id = pledging_org.id
                await pledge.save(session)

                await UserOrganization(
                    user_id=tc.subject.id,
                    organization_id=pledging_org.id,
                    is_admin=tc.is_pledging_org_member_admin,
                ).save(session)

            assert (
                await authz.can(
                    tc.subject,
                    AccessType.write,
                    pledge,
                )
                is tc.expected
            )
