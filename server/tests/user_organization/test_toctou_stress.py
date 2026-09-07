import asyncio
import uuid
from typing import Any

import pytest
from sqlalchemy import delete, func, select

from polar.config import settings
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.models import Account, Organization, User, UserOrganization
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import OrganizationRole
from polar.user_organization.service import (
    OwnerRoleCannotBeRemoved,
)
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.database import get_database_url, save_fixture_factory
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_user,
)

# Number of fresh-org iterations to run. Each iteration races a real
# `transfer_ownership` against a real `set_role` on the same target. With
# the fix every iteration must end with exactly one owner; the unhedged
# race leaves ~1 in 3 iterations ownerless, so this many overlapping
# transactions reliably exercises the interleave.
ITERATIONS = 15


async def _attempt_set_role_to_member(
    sessionmaker: AsyncSessionMaker,
    *,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
) -> tuple[bool, type[BaseException] | None]:
    async with sessionmaker() as session:
        try:
            await user_organization_service.set_role(
                session,
                user_id=user_id,
                organization_id=organization_id,
                role=OrganizationRole.member,
            )
        except BaseException as e:
            await session.rollback()
            return (False, type(e))
        await session.commit()
        return (True, None)


async def _attempt_transfer_ownership(
    sessionmaker: AsyncSessionMaker,
    *,
    new_owner_user_id: uuid.UUID,
    organization_id: uuid.UUID,
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


async def _owner_count(session: Any, organization_id: uuid.UUID) -> int:
    return (
        await session.execute(
            select(func.count(UserOrganization.user_id)).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.role == OrganizationRole.owner,
                UserOrganization.deleted_at.is_(None),
            )
        )
    ).scalar_one()


async def _admin_capable_count(session: Any, organization_id: uuid.UUID) -> int:
    return (
        await session.execute(
            select(func.count(UserOrganization.user_id)).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.role.in_(
                    [OrganizationRole.owner, OrganizationRole.admin]
                ),
                UserOrganization.deleted_at.is_(None),
            )
        )
    ).scalar_one()


@pytest.mark.asyncio
class TestSetRoleTransferOwnershipStress:
    """
    Real, non-monkeypatched DB-level stress test for the
    `set_role` x `transfer_ownership` race. Each iteration builds a fresh
    org with (owner, admin=target) and fires a real
    `asyncio.gather(transfer_ownership(target -> owner),
    set_role(target -> member))` against the live Postgres.

    The organization-invariant under test: an org ALWAYS has exactly one
    `owner`. Without the conditional UPDATE in `set_role`, ~1 in 3
    overlapping iterations leaves the org with ZERO owners (the
    `transfer_ownership`-promoted owner is silently demoted to `member`
    by the stale unconditional UPDATE).
    """

    async def test_organization_never_left_ownerless_under_concurrent_transfer(
        self, worker_id: str
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_set_role_transfer_stress",
            pool_size=4,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        created_users: list[User] = []
        created_orgs: list[Organization] = []
        created_accounts: list[Account] = []

        try:
            ownerless_iterations = 0
            race_detected_iterations = 0

            for _ in range(ITERATIONS):
                async with sessionmaker() as setup_session:
                    save_fixture = save_fixture_factory(setup_session)
                    owner = await create_user(save_fixture)
                    admin = await create_user(save_fixture)
                    admin.identity_verification_status = (
                        IdentityVerificationStatus.verified
                    )
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
                created_users.extend([owner, admin])
                created_orgs.append(organization)
                created_accounts.append(account)

                transfer_result, set_role_result = await asyncio.gather(
                    _attempt_transfer_ownership(
                        sessionmaker,
                        new_owner_user_id=admin.id,
                        organization_id=organization.id,
                    ),
                    _attempt_set_role_to_member(
                        sessionmaker,
                        user_id=admin.id,
                        organization_id=organization.id,
                    ),
                )

                async with sessionmaker() as verify_session:
                    owners = await _owner_count(verify_session, organization.id)
                    admin_capable = await _admin_capable_count(
                        verify_session, organization.id
                    )

                # transfer_ownership must always succeed (its promote is
                # unconditional, and `admin` starts non-owner).
                assert transfer_result[0] is True, transfer_result

                if owners == 0:
                    ownerless_iterations += 1
                # The race being *exercised* surfaces as set_role rejecting
                # the demotion of the now-owner with OwnerRoleCannotBeRemoved.
                if (
                    set_role_result[0] is False
                    and set_role_result[1] is OwnerRoleCannotBeRemoved
                ):
                    race_detected_iterations += 1

                # Invariant: exactly one owner, and never fewer than one
                # admin-capable user, regardless of interleaving.
                assert owners == 1, (
                    f"BUG: organization {organization.id} left with {owners} "
                    f"owners after concurrent transfer_ownership + set_role "
                    f"(transfer={transfer_result}, set_role={set_role_result})"
                )
                assert admin_capable >= 1

            # Sanity: the invariant held for every iteration.
            assert ownerless_iterations == 0
            # Defence-in-depth: confirm the race path was actually
            # exercised at least once (otherwise the regression net is
            # vacuous). With ITERATIONS overlapping transactions this is
            # overwhelmingly likely; the deterministic repro in
            # test_service.py guarantees it independently.
            assert race_detected_iterations > 0, (
                "Race never triggered in stress run; the test did not "
                "exercise the TOCTOU path."
            )
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(UserOrganization).where(
                        UserOrganization.organization_id.in_(
                            [o.id for o in created_orgs]
                        )
                    )
                )
                await cleanup_session.execute(
                    delete(Organization).where(
                        Organization.id.in_([o.id for o in created_orgs])
                    )
                )
                await cleanup_session.execute(
                    delete(Account).where(
                        Account.id.in_([a.id for a in created_accounts])
                    )
                )
                await cleanup_session.execute(
                    delete(User).where(User.id.in_([u.id for u in created_users]))
                )
                await cleanup_session.commit()
            await engine.dispose()
