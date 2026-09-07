import asyncio
from typing import Any
from uuid import UUID, uuid4

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import delete, func, select

from polar.config import settings
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.models import Account, Organization, User, UserOrganization
from polar.models.member import MemberRole
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import OrganizationRole
from polar.user_organization.service import (
    AlreadyOwner,
    CannotRemoveOrganizationOwner,
    ConcurrentRoleModification,
    InvalidOwnerRoleAssignment,
    NewOwnerNotVerified,
    OrganizationNotFound,
    OrganizationWouldHaveNoAdmins,
    OwnerRoleCannotBeRemoved,
    UserNotMemberOfOrganization,
)
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import (
    SaveFixture,
    get_database_url,
    save_fixture_factory,
)
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_user,
)


@pytest.mark.asyncio
class TestRemoveMemberSafe:
    async def test_remove_member_success(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
    ) -> None:
        user_organization = UserOrganization(
            user=user_second, organization=organization
        )
        await save_fixture(user_organization)

        # Test successful member removal
        await user_organization_service.remove_member_safe(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        # Verify the member was soft deleted
        user_org = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert user_org is None

    async def test_remove_member_organization_not_found(
        self,
        session: Any,
        user: User,
    ) -> None:
        # Test with non-existent organization
        non_existent_org_id = uuid4()

        with pytest.raises(OrganizationNotFound) as exc_info:
            await user_organization_service.remove_member_safe(
                session,
                user_id=user.id,
                organization_id=non_existent_org_id,
            )

        assert exc_info.value.organization_id == non_existent_org_id

    async def test_remove_member_user_not_member(
        self,
        session: Any,
        organization: Organization,
        user: User,
    ) -> None:
        # Test with user who is not a member
        with pytest.raises(UserNotMemberOfOrganization) as exc_info:
            await user_organization_service.remove_member_safe(
                session,
                user_id=user.id,
                organization_id=organization.id,
            )

        assert exc_info.value.user_id == user.id
        assert exc_info.value.organization_id == organization.id

    async def test_remove_member_cannot_remove_owner(
        self,
        session: Any,
        account: Account,
        organization: Organization,
        user: User,
        save_fixture: Any,
    ) -> None:
        from polar.kit.utils import utc_now
        from polar.models import UserOrganization

        owner_user_org = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
            created_at=utc_now(),
        )
        await save_fixture(owner_user_org)

        with pytest.raises(CannotRemoveOrganizationOwner) as exc_info:
            await user_organization_service.remove_member_safe(
                session,
                user_id=user.id,
                organization_id=organization.id,
            )

        assert exc_info.value.user_id == user.id
        assert exc_info.value.organization_id == organization.id

    async def test_remove_member_non_admin_with_account(
        self,
        session: Any,
        account: Account,
        organization: Organization,
        user_second: User,
        save_fixture: Any,
    ) -> None:
        # Create user organization relationship for non-admin user
        from polar.kit.utils import utc_now
        from polar.models import UserOrganization

        user_org_relation = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            created_at=utc_now(),
        )
        await save_fixture(user_org_relation)

        # Test removing a non-admin member from organization with account
        await user_organization_service.remove_member_safe(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        # Verify the member was soft deleted
        user_org: (
            UserOrganization | None
        ) = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert user_org is None


@pytest.mark.asyncio
class TestRemoveMember:
    async def test_remove_member_soft_delete(
        self,
        session: Any,
        organization: Organization,
        user_second: User,
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,
    ) -> None:
        # Use a regular member (user_second / user_organization_second
        # default to role=member). The owner from `user_organization`
        # remains, satisfying the admin-capability invariant.
        await user_organization_service.remove_member(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        user_org = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert user_org is None

        from polar.postgres import sql

        result = await session.execute(
            sql.select(UserOrganization).where(
                UserOrganization.user_id == user_second.id,
                UserOrganization.organization_id == organization.id,
            )
        )
        deleted_user_org: UserOrganization | None = result.scalar_one_or_none()
        assert deleted_user_org is not None
        assert deleted_user_org.deleted_at is not None

    async def test_enqueues_polar_self_member_removal(
        self,
        mocker: MockerFixture,
        session: Any,
        organization: Organization,
        user_second: User,
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,
    ) -> None:
        enqueue_remove_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_remove_member"
        )

        await user_organization_service.remove_member(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        enqueue_remove_member_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            external_id=str(user_second.id),
        )

    async def test_does_not_enqueue_when_member_not_found(
        self,
        mocker: MockerFixture,
        session: Any,
        organization: Organization,
        user: User,
    ) -> None:
        enqueue_remove_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_remove_member"
        )

        await user_organization_service.remove_member(
            session,
            user_id=user.id,
            organization_id=organization.id,
        )

        enqueue_remove_member_mock.assert_not_called()

    async def test_admin_capability_invariant_rejects_last_admin_removal(
        self,
        session: Any,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # The fixture's `user_organization` is the only admin-capable user
        # in the org (role=owner). Raw `remove_member` bypasses the
        # owner-non-removable guard in `remove_member_safe`, so the
        # admin-capability invariant must catch it directly.
        with pytest.raises(OrganizationWouldHaveNoAdmins) as exc_info:
            await user_organization_service.remove_member(
                session,
                user_id=user.id,
                organization_id=organization.id,
            )

        assert exc_info.value.organization_id == organization.id

    async def test_admin_capability_invariant_allows_member_removal(
        self,
        session: Any,
        organization: Organization,
        user_second: User,
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,
    ) -> None:
        # Removing a non-admin-capable user (member) doesn't reduce the
        # admin-capable count — should be allowed even via raw
        # `remove_member`.
        await user_organization_service.remove_member(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        user_org = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert user_org is None


async def _attempt_member_removal(
    sessionmaker: AsyncSessionMaker, user_id: UUID, organization_id: UUID
) -> bool:
    async with sessionmaker() as session:
        try:
            await user_organization_service.remove_member(
                session,
                user_id=user_id,
                organization_id=organization_id,
            )
        except OrganizationWouldHaveNoAdmins:
            await session.rollback()
            return False
        await session.commit()
        return True


async def _attempt_role_change(
    sessionmaker: AsyncSessionMaker, user_id: UUID, organization_id: UUID
) -> bool:
    async with sessionmaker() as session:
        try:
            await user_organization_service.set_role(
                session,
                user_id=user_id,
                organization_id=organization_id,
                role=OrganizationRole.member,
            )
        except OrganizationWouldHaveNoAdmins:
            await session.rollback()
            return False
        await session.commit()
        return True


@pytest.mark.asyncio
class TestConcurrentRemoval:
    async def test_admin_capability_invariant_under_concurrency(
        self, worker_id: str
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_remove_member_concurrency",
            pool_size=4,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            owner = await create_user(save_fixture)
            admin = await create_user(save_fixture)
            account = await create_account(save_fixture, owner)
            organization = await create_organization(save_fixture, account)
            setup_session.add(
                UserOrganization(
                    user=owner,
                    organization=organization,
                    role=OrganizationRole.owner,
                )
            )
            setup_session.add(
                UserOrganization(
                    user=admin,
                    organization=organization,
                    role=OrganizationRole.admin,
                )
            )
            await setup_session.commit()

        try:
            results = await asyncio.gather(
                _attempt_member_removal(sessionmaker, owner.id, organization.id),
                _attempt_member_removal(sessionmaker, admin.id, organization.id),
            )

            async with sessionmaker() as session:
                remaining = (
                    await session.execute(
                        select(func.count(UserOrganization.user_id)).where(
                            UserOrganization.organization_id == organization.id,
                            UserOrganization.role.in_(
                                [OrganizationRole.owner, OrganizationRole.admin]
                            ),
                            UserOrganization.deleted_at.is_(None),
                        )
                    )
                ).scalar_one()

            assert results.count(True) == 1
            assert remaining == 1
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(UserOrganization).where(
                        UserOrganization.organization_id == organization.id
                    )
                )
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id.in_([owner.id, admin.id]))
                )
                await cleanup_session.commit()
            await engine.dispose()


@pytest.mark.asyncio
class TestConcurrentDemotion:
    async def test_admin_capability_invariant_under_concurrency(
        self, worker_id: str
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_set_role_concurrency",
            pool_size=4,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            owner = await create_user(save_fixture)
            admin = await create_user(save_fixture)
            account = await create_account(save_fixture, owner)
            organization = await create_organization(save_fixture, account)
            setup_session.add(
                UserOrganization(
                    user=owner,
                    organization=organization,
                    role=OrganizationRole.owner,
                )
            )
            setup_session.add(
                UserOrganization(
                    user=admin,
                    organization=organization,
                    role=OrganizationRole.admin,
                )
            )
            await setup_session.commit()

        try:
            results = await asyncio.gather(
                _attempt_member_removal(sessionmaker, owner.id, organization.id),
                _attempt_role_change(sessionmaker, admin.id, organization.id),
            )

            async with sessionmaker() as session:
                remaining = (
                    await session.execute(
                        select(func.count(UserOrganization.user_id)).where(
                            UserOrganization.organization_id == organization.id,
                            UserOrganization.role.in_(
                                [OrganizationRole.owner, OrganizationRole.admin]
                            ),
                            UserOrganization.deleted_at.is_(None),
                        )
                    )
                ).scalar_one()

            assert results.count(True) == 1
            assert remaining == 1
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(UserOrganization).where(
                        UserOrganization.organization_id == organization.id
                    )
                )
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id.in_([owner.id, admin.id]))
                )
                await cleanup_session.commit()
            await engine.dispose()


async def _attempt_set_role(
    sessionmaker: AsyncSessionMaker,
    *,
    user_id: UUID,
    organization_id: UUID,
    role: OrganizationRole,
) -> tuple[bool, type[BaseException] | None]:
    """
    Run `set_role` in its own session and transaction, returning
    `(succeeded, exception_type)`. Mirrors `_attempt_member_removal` /
    `_attempt_role_change` so the race tests can drive real concurrent
    transactions against the live Postgres.
    """
    async with sessionmaker() as session:
        try:
            await user_organization_service.set_role(
                session,
                user_id=user_id,
                organization_id=organization_id,
                role=role,
            )
        except BaseException as e:
            await session.rollback()
            return (False, type(e))
        await session.commit()
        return (True, None)


async def _attempt_transfer_ownership(
    sessionmaker: AsyncSessionMaker,
    *,
    new_owner_user_id: UUID,
    organization_id: UUID,
) -> tuple[bool, type[BaseException] | None]:
    async with sessionmaker() as session:
        try:
            await user_organization_service.transfer_ownership(
                session,
                new_owner_user_id=new_owner_user_id,
                organization_id=organization_id,
            )
        except BaseException as e:
            await session.rollback()
            return (False, type(e))
        await session.commit()
        return (True, None)


def _install_gated_assert(
    mocker: MockerFixture,
    *,
    staged_event: asyncio.Event,
    proceed_event: asyncio.Event,
) -> None:
    """
    Patch `_assert_admin_capability_after_loss` so the FIRST call sets
    `staged_event` (signalling `set_role` has done its unlocked read and
    is about to run the admin-capability guard) and then awaits
    `proceed_event` before continuing. Subsequent calls pass through
    unmodified. This pins the `set_role` x `transfer_ownership` TOCTOU
    interleaving deterministically: the read happens before the
    concurrent transaction commits, the write happens after.
    """
    original_assert = type(
        user_organization_service
    )._assert_admin_capability_after_loss
    call_count = 0

    async def gated_assert(
        session: Any, *, user_id: UUID, organization_id: UUID
    ) -> None:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            staged_event.set()
            await proceed_event.wait()
        await original_assert(
            user_organization_service,
            session,
            user_id=user_id,
            organization_id=organization_id,
        )

    mocker.patch.object(
        user_organization_service,
        "_assert_admin_capability_after_loss",
        side_effect=gated_assert,
    )


@pytest.mark.asyncio
class TestSetRoleTransferOwnershipRace:
    """
    Deterministic, event-driven repro for the `set_role` x
    `transfer_ownership` TOCTOU race. With the fix the org always keeps
    exactly one owner; `set_role` raises a meaningful guard instead of
    silently demoting the newly-promoted owner.
    """

    async def test_set_role_aborts_when_concurrent_transfer_promotes_target(
        self, worker_id: str, mocker: MockerFixture
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_set_role_transfer_toctou",
            pool_size=4,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            owner = await create_user(save_fixture)
            admin = await create_user(save_fixture)
            admin.identity_verification_status = IdentityVerificationStatus.verified
            await save_fixture(admin)
            account = await create_account(save_fixture, owner)
            organization = await create_organization(save_fixture, account)
            setup_session.add(
                UserOrganization(
                    user=owner,
                    organization=organization,
                    role=OrganizationRole.owner,
                )
            )
            setup_session.add(
                UserOrganization(
                    user=admin,
                    organization=organization,
                    role=OrganizationRole.admin,
                )
            )
            await setup_session.commit()

        staged_event = asyncio.Event()
        proceed_event = asyncio.Event()
        _install_gated_assert(
            mocker, staged_event=staged_event, proceed_event=proceed_event
        )

        try:
            # `set_role(admin -> member)` reads `admin` (unlocked), then
            # parks at the gated admin-capability guard.
            set_role_task = asyncio.create_task(
                _attempt_set_role(
                    sessionmaker,
                    user_id=admin.id,
                    organization_id=organization.id,
                    role=OrganizationRole.member,
                )
            )
            await staged_event.wait()

            # The concurrent `transfer_ownership` commits and promotes
            # `admin` to `owner` while `set_role` is parked past its read.
            succeeded_transfer, transfer_exc = await _attempt_transfer_ownership(
                sessionmaker,
                new_owner_user_id=admin.id,
                organization_id=organization.id,
            )
            proceed_event.set()

            succeeded_set_role, set_role_exc = await set_role_task

            async with sessionmaker() as verify_session:
                admin_uo = await user_organization_service.get_by_user_and_org(
                    verify_session, admin.id, organization.id
                )
                owner_uo = await user_organization_service.get_by_user_and_org(
                    verify_session, owner.id, organization.id
                )
                owner_count = (
                    await verify_session.execute(
                        select(func.count(UserOrganization.user_id)).where(
                            UserOrganization.organization_id == organization.id,
                            UserOrganization.role == OrganizationRole.owner,
                            UserOrganization.deleted_at.is_(None),
                        )
                    )
                ).scalar_one()

            assert succeeded_transfer is True, transfer_exc
            # The demotion must be aborted, not silently applied to the
            # now-`owner` row.
            assert succeeded_set_role is False
            assert set_role_exc is OwnerRoleCannotBeRemoved
            assert admin_uo is not None
            assert admin_uo.role == OrganizationRole.owner
            assert owner_uo is not None
            assert owner_uo.role == OrganizationRole.admin
            assert owner_count == 1
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(UserOrganization).where(
                        UserOrganization.organization_id == organization.id
                    )
                )
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id.in_([owner.id, admin.id]))
                )
                await cleanup_session.commit()
            await engine.dispose()


@pytest.mark.asyncio
class TestConcurrentRoleModification:
    """
    When a concurrent `set_role` wins the race and changes the target's
    role to a non-`owner` role, the loser's conditional `UPDATE` matches
    no rows; the re-read surfaces a retryable `ConcurrentRoleModification`
    (409) instead of silently overwriting the committed role.
    """

    async def test_concurrent_set_role_to_non_owner_role_raises_conflict(
        self, worker_id: str, mocker: MockerFixture
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_set_role_concurrent_conflict",
            pool_size=4,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            owner = await create_user(save_fixture)
            admin = await create_user(save_fixture)
            account = await create_account(save_fixture, owner)
            organization = await create_organization(save_fixture, account)
            setup_session.add(
                UserOrganization(
                    user=owner,
                    organization=organization,
                    role=OrganizationRole.owner,
                )
            )
            setup_session.add(
                UserOrganization(
                    user=admin,
                    organization=organization,
                    role=OrganizationRole.admin,
                )
            )
            await setup_session.commit()

        staged_event = asyncio.Event()
        proceed_event = asyncio.Event()
        _install_gated_assert(
            mocker, staged_event=staged_event, proceed_event=proceed_event
        )

        try:
            # The losing `set_role` (admin -> finance) reads `admin` then
            # parks at the gated guard, holding a stale snapshot.
            losing_task = asyncio.create_task(
                _attempt_set_role(
                    sessionmaker,
                    user_id=admin.id,
                    organization_id=organization.id,
                    role=OrganizationRole.finance,
                )
            )
            await staged_event.wait()

            # The winning `set_role` (admin -> member) commits while the
            # loser is parked, changing the row's role to `member`.
            succeeded_winner, winner_exc = await _attempt_set_role(
                sessionmaker,
                user_id=admin.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )
            proceed_event.set()

            succeeded_loser, loser_exc = await losing_task

            async with sessionmaker() as verify_session:
                admin_uo = await user_organization_service.get_by_user_and_org(
                    verify_session, admin.id, organization.id
                )
                owner_count = (
                    await verify_session.execute(
                        select(func.count(UserOrganization.user_id)).where(
                            UserOrganization.organization_id == organization.id,
                            UserOrganization.role == OrganizationRole.owner,
                            UserOrganization.deleted_at.is_(None),
                        )
                    )
                ).scalar_one()

            assert succeeded_winner is True, winner_exc
            assert succeeded_loser is False
            assert loser_exc is ConcurrentRoleModification
            assert admin_uo is not None
            # The winner's role change is the one that sticks; the loser's
            # finance assignment is rejected, not silently applied.
            assert admin_uo.role == OrganizationRole.member
            assert owner_count == 1
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(UserOrganization).where(
                        UserOrganization.organization_id == organization.id
                    )
                )
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(
                    delete(User).where(User.id.in_([owner.id, admin.id]))
                )
                await cleanup_session.commit()
            await engine.dispose()


@pytest.mark.asyncio
class TestListByOrg:
    async def test_list_by_org_excludes_deleted(
        self,
        session: Any,
        organization: Organization,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        user_organization_second: UserOrganization,
    ) -> None:
        # Initially should return both members (owner + member).
        members = await user_organization_service.list_by_org(session, organization.id)
        assert len(members) == 2

        # Soft-delete the regular member; the owner stays so the
        # admin-capability invariant is satisfied.
        await user_organization_service.remove_member(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
        )

        members = await user_organization_service.list_by_org(session, organization.id)
        assert len(members) == 1
        assert members[0].user_id == user.id


@pytest.mark.asyncio
class TestSetRole:
    async def test_promote_member_to_admin(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user_second: User,
    ) -> None:
        relation = UserOrganization(
            user_id=user_second.id, organization_id=organization.id
        )
        await save_fixture(relation)

        result = await user_organization_service.set_role(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )

        assert result.role == OrganizationRole.admin

    async def test_demote_last_admin_capable_rejected(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        relation = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )
        await save_fixture(relation)

        with pytest.raises(OrganizationWouldHaveNoAdmins):
            await user_organization_service.set_role(
                session,
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )

    async def test_promotion_syncs_billing_member_role(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        enqueue_update_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_update_member"
        )
        relation = UserOrganization(
            user_id=user_second.id, organization_id=organization.id
        )
        await save_fixture(relation)

        await user_organization_service.set_role(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )

        enqueue_update_member_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            external_id=str(user_second.id),
            name=user_second.email.split("@", 1)[0],
            role=MemberRole.billing_manager,
        )

    async def test_demotion_syncs_billing_member_role(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user_second: User,
        user_organization: UserOrganization,
    ) -> None:
        enqueue_update_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_update_member"
        )
        relation = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )
        await save_fixture(relation)

        await user_organization_service.set_role(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.member,
        )

        enqueue_update_member_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            external_id=str(user_second.id),
            name=user_second.email.split("@", 1)[0],
            role=MemberRole.member,
        )

    async def test_unchanged_role_does_not_sync(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        enqueue_update_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_update_member"
        )
        relation = UserOrganization(
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )
        await save_fixture(relation)

        await user_organization_service.set_role(
            session,
            user_id=user_second.id,
            organization_id=organization.id,
            role=OrganizationRole.admin,
        )

        enqueue_update_member_mock.assert_not_called()

    async def test_owner_role_rejected(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        # `set_role` no longer accepts `owner` for any user — ownership
        # transfers flow through `transfer_ownership`.
        relation = UserOrganization(
            user_id=user_second.id, organization_id=organization.id
        )
        await save_fixture(relation)

        with pytest.raises(InvalidOwnerRoleAssignment):
            await user_organization_service.set_role(
                session,
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )

    async def test_owner_cannot_be_demoted_directly(
        self,
        save_fixture: SaveFixture,
        session: Any,
        account: Account,
        organization: Organization,
        user: User,
    ) -> None:
        relation = UserOrganization(
            user_id=user.id,
            organization_id=organization.id,
            role=OrganizationRole.owner,
        )
        await save_fixture(relation)

        with pytest.raises(OwnerRoleCannotBeRemoved):
            await user_organization_service.set_role(
                session,
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.admin,
            )

    async def test_user_not_member(
        self,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        with pytest.raises(UserNotMemberOfOrganization):
            await user_organization_service.set_role(
                session,
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )


@pytest.mark.asyncio
class TestTransferOwnership:
    async def test_promotes_new_owner_and_demotes_previous(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        await save_fixture(
            UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )
        await save_fixture(
            UserOrganization(
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )
        )
        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        await user_organization_service.transfer_ownership(
            session,
            new_owner_user_id=user_second.id,
            organization_id=organization.id,
        )

        previous = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        new = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert previous is not None
        assert previous.role == OrganizationRole.admin
        assert new is not None
        assert new.role == OrganizationRole.owner

    async def test_syncs_billing_member_role_for_new_owner(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user: User,
        user_second: User,
    ) -> None:
        enqueue_update_member_mock = mocker.patch(
            "polar.user_organization.service.polar_self_service.enqueue_update_member"
        )
        await save_fixture(
            UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )
        await save_fixture(
            UserOrganization(
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )
        )
        user_second.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user_second)

        await user_organization_service.transfer_ownership(
            session,
            new_owner_user_id=user_second.id,
            organization_id=organization.id,
        )

        enqueue_update_member_mock.assert_called_once_with(
            external_customer_id=str(organization.id),
            external_id=str(user_second.id),
            name=user_second.email.split("@", 1)[0],
            role=MemberRole.billing_manager,
        )

    async def test_rejects_unverified_user(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        await save_fixture(
            UserOrganization(
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )
        )
        # user_second left at the default unverified status

        with pytest.raises(NewOwnerNotVerified):
            await user_organization_service.transfer_ownership(
                session,
                new_owner_user_id=user_second.id,
                organization_id=organization.id,
            )

    async def test_allows_unverified_user_in_sandbox(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        mocker.patch(
            "polar.user_organization.service.settings.is_sandbox",
            return_value=True,
        )
        await save_fixture(
            UserOrganization(
                user_id=user_second.id,
                organization_id=organization.id,
                role=OrganizationRole.member,
            )
        )
        # user_second left at the default unverified status

        await user_organization_service.transfer_ownership(
            session,
            new_owner_user_id=user_second.id,
            organization_id=organization.id,
        )

        new = await user_organization_service.get_by_user_and_org(
            session, user_second.id, organization.id
        )
        assert new is not None
        assert new.role == OrganizationRole.owner

    async def test_rejects_non_member(
        self,
        session: Any,
        organization: Organization,
        user_second: User,
    ) -> None:
        with pytest.raises(UserNotMemberOfOrganization):
            await user_organization_service.transfer_ownership(
                session,
                new_owner_user_id=user_second.id,
                organization_id=organization.id,
            )

    async def test_rejects_existing_owner(
        self,
        save_fixture: SaveFixture,
        session: Any,
        organization: Organization,
        user: User,
    ) -> None:
        await save_fixture(
            UserOrganization(
                user_id=user.id,
                organization_id=organization.id,
                role=OrganizationRole.owner,
            )
        )
        user.identity_verification_status = IdentityVerificationStatus.verified
        await save_fixture(user)

        with pytest.raises(AlreadyOwner):
            await user_organization_service.transfer_ownership(
                session,
                new_owner_user_id=user.id,
                organization_id=organization.id,
            )
