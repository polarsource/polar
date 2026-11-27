"""Loading a polymorphic support case through the base-class repository must
populate the concrete subclass's own columns inline. Otherwise reading them
emits a second, lazy query — which fails under async as a greenlet IO error.
"""

from datetime import timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from polar.kit.utils import utc_now
from polar.models import BackofficeUser, Customer, Organization, Product
from polar.models.support_case import (
    DisputeSupportCase,
    ReviewAppealSupportCase,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
)
from polar.postgres import AsyncSession
from polar.support_case.repository import (
    SupportCaseParticipantRepository,
    SupportCaseRepository,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_appeal_case,
    create_dispute_case,
)


@pytest.mark.anyio
class TestGetById:
    async def test_loads_dispute_subclass_column(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        dispute_id = case.dispute_id
        session.expunge_all()

        loaded = await SupportCaseRepository.from_session(session).get_by_id(case.id)

        assert isinstance(loaded, DisputeSupportCase)
        assert loaded.dispute_id == dispute_id

    async def test_loads_appeal_subclass_column(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        organization_review_id = case.organization_review_id
        session.expunge_all()

        loaded = await SupportCaseRepository.from_session(session).get_by_id(case.id)

        assert isinstance(loaded, ReviewAppealSupportCase)
        assert loaded.organization_review_id == organization_review_id


@pytest.mark.anyio
class TestPlatformParticipant:
    async def test_backoffice_upsert_preserves_participant(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        backoffice_user: BackofficeUser,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        repository = SupportCaseParticipantRepository.from_session(session)
        first_read = utc_now()
        first = await repository.upsert_platform_read(
            case.id, backoffice_user.id, read_at=first_read
        )

        latest_read = first_read + timedelta(seconds=1)
        updated = await repository.upsert_platform_read(
            case.id, backoffice_user.id, read_at=latest_read
        )

        assert updated.id == first.id
        assert updated.backoffice_platform_user_id == backoffice_user.id
        assert updated.last_read_at == latest_read

    @pytest.mark.parametrize(
        "kind",
        [SupportCaseParticipantKind.platform, SupportCaseParticipantKind.merchant],
    )
    async def test_rejects_invalid_subject(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        kind: SupportCaseParticipantKind,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        staff = BackofficeUser(email="staff@example.com")
        await save_fixture(staff)
        merchant = kind == SupportCaseParticipantKind.merchant

        with pytest.raises(
            IntegrityError, match="support_case_participants_subject_matches_kind_check"
        ):
            async with session.begin_nested():
                await save_fixture(
                    SupportCaseParticipant(
                        case=case,
                        kind=kind,
                        organization=organization if merchant else None,
                        backoffice_platform_user=staff if merchant else None,
                    )
                )
