from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.config import settings
from polar.customer_email_update.service import (
    TOKEN_PREFIX,
    CustomerEmailUpdateService,
    InvalidCustomerEmailUpdate,
)
from polar.exceptions import PolarRequestValidationError
from polar.integrations.stripe.service import StripeService
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.utils import utc_now
from polar.member.repository import MemberRepository
from polar.models import Customer, Organization
from polar.models.customer import CustomerType
from polar.models.customer_email_verification import CustomerEmailVerification
from polar.models.member import Member, MemberRole
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.fixture(autouse=True)
def mock_enqueue_email(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.customer_email_update.service.enqueue_email_template")


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.customer_email_update.service.stripe_service", new=mock)
    return mock


async def _create_verification(
    save_fixture: SaveFixture,
    customer: Customer,
    email: str = "new@example.com",
) -> tuple[CustomerEmailVerification, str]:
    token, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix=TOKEN_PREFIX
    )
    record = CustomerEmailVerification(
        email=email,
        token_hash=token_hash,
        customer_id=customer.id,
        organization_id=customer.organization_id,
    )
    await save_fixture(record)
    return record, token


@pytest.mark.asyncio
class TestRequestEmailUpdate:
    async def test_rejects_team_customer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="team@example.com"
        )
        customer.type = CustomerType.team
        await save_fixture(customer)

        service = CustomerEmailUpdateService()
        with pytest.raises(PolarRequestValidationError):
            await service.request_email_update(session, customer, "new@example.com")

    async def test_rejects_same_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="same@example.com"
        )

        service = CustomerEmailUpdateService()
        with pytest.raises(PolarRequestValidationError):
            await service.request_email_update(session, customer, "Same@Example.com")

    async def test_cancels_existing_pending_verification(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="old@example.com"
        )
        # Create an existing pending verification
        await _create_verification(save_fixture, customer, "pending@example.com")

        service = CustomerEmailUpdateService()
        record, token = await service.request_email_update(
            session, customer, "new@example.com"
        )

        # Old record should be deleted, only new one remains
        stmt = select(CustomerEmailVerification).where(
            CustomerEmailVerification.customer_id == customer.id
        )
        result = await session.execute(stmt)
        records = list(result.scalars().all())
        assert len(records) == 1
        assert records[0].email == "new@example.com"
        assert records[0].expires_at > utc_now()

    async def test_creates_verification_record(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="current@example.com"
        )

        service = CustomerEmailUpdateService()
        record, token = await service.request_email_update(
            session, customer, "new@example.com"
        )

        assert record.email == "new@example.com"
        assert record.customer_id == customer.id
        assert record.organization_id == customer.organization_id
        assert token.startswith(TOKEN_PREFIX)

        # Verify token hash matches
        expected_hash = get_token_hash(token, secret=settings.SECRET)
        assert record.token_hash == expected_hash


@pytest.mark.asyncio
class TestCheckToken:
    async def test_valid_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="check@example.com"
        )
        _record, token = await _create_verification(save_fixture, customer)

        service = CustomerEmailUpdateService()
        assert await service.check_token(session, token) is True

    async def test_invalid_token(
        self,
        session: AsyncSession,
    ) -> None:
        service = CustomerEmailUpdateService()
        assert await service.check_token(session, "polar_cev_bogustoken") is False

    async def test_expired_token(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="expired@example.com"
        )
        record, token = await _create_verification(save_fixture, customer)

        # Manually expire the record
        record.expires_at = utc_now() - timedelta(minutes=1)
        await save_fixture(record)

        service = CustomerEmailUpdateService()
        assert await service.check_token(session, token) is False


@pytest.mark.asyncio
class TestVerify:
    async def test_invalid_token_raises(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="test@example.com"
        )
        service = CustomerEmailUpdateService()
        with pytest.raises(InvalidCustomerEmailUpdate):
            await service.verify(session, "polar_cev_bogustoken")

    async def test_expired_token_raises(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, email="expired@example.com"
        )
        record, token = await _create_verification(save_fixture, customer)
        record.expires_at = utc_now() - timedelta(minutes=1)
        await save_fixture(record)

        service = CustomerEmailUpdateService()
        with pytest.raises(InvalidCustomerEmailUpdate):
            await service.verify(session, token)

    async def test_email_already_taken(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="original@example.com",
            stripe_customer_id="STRIPE_1",
        )
        # Another customer already has the target email
        await create_customer(
            save_fixture,
            organization=organization,
            email="taken@example.com",
            stripe_customer_id="STRIPE_2",
        )

        _record, token = await _create_verification(
            save_fixture, customer, "taken@example.com"
        )

        service = CustomerEmailUpdateService()
        with pytest.raises(PolarRequestValidationError):
            await service.verify(session, token)

        # Verification record should be deleted
        stmt = select(CustomerEmailVerification).where(
            CustomerEmailVerification.customer_id == customer.id
        )
        result = await session.execute(stmt)
        assert result.scalars().first() is None

    async def test_happy_path(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mock_enqueue_email: MagicMock,
        stripe_service_mock: MagicMock,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="old@example.com",
        )

        _record, token = await _create_verification(
            save_fixture, customer, "new@example.com"
        )

        service = CustomerEmailUpdateService()
        updated_customer = await service.verify(session, token)

        # Email updated
        assert updated_customer.email == "new@example.com"
        assert updated_customer.email_verified is True

        # Notification sent to old email
        mock_enqueue_email.assert_called_once()
        call_args = mock_enqueue_email.call_args
        assert call_args[1]["to_email_addr"] == "old@example.com"

        # Stripe synced
        stripe_service_mock.update_customer.assert_called_once_with(
            customer.stripe_customer_id, email="new@example.com"
        )

        # Verification record should be deleted
        stmt = select(CustomerEmailVerification).where(
            CustomerEmailVerification.customer_id == customer.id
        )
        result = await session.execute(stmt)
        assert result.scalars().first() is None

    async def test_no_stripe_sync_without_stripe_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        stripe_service_mock: MagicMock,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="nostripe@example.com",
            stripe_customer_id=None,
        )

        _record, token = await _create_verification(
            save_fixture, customer, "new@example.com"
        )

        service = CustomerEmailUpdateService()
        await service.verify(session, token)

        stripe_service_mock.update_customer.assert_not_called()

    async def test_no_notification_when_no_old_email(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mock_enqueue_email: MagicMock,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="has-email@example.com",
            stripe_customer_id=None,
        )
        # Simulate a customer with no old email
        customer.email = None
        await save_fixture(customer)

        _record, token = await _create_verification(
            save_fixture, customer, "brand-new@example.com"
        )

        service = CustomerEmailUpdateService()
        await service.verify(session, token)

        # No notification should be sent when there's no old email
        mock_enqueue_email.assert_not_called()

    async def test_syncs_owner_member_email_even_when_drifted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Verify flow must repair drifted owner.email, matching
        customer_service.update."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            email="correct@example.com",
            stripe_customer_id=None,
        )
        owner = Member(
            customer_id=customer.id,
            organization_id=organization.id,
            email="drifted@example.com",
            role=MemberRole.owner,
        )
        await save_fixture(owner)

        _record, token = await _create_verification(
            save_fixture, customer, "verified@example.com"
        )

        service = CustomerEmailUpdateService()
        await service.verify(session, token)
        await session.flush()
        await session.refresh(owner)

        assert owner.email == "verified@example.com"
        repository = MemberRepository.from_session(session)
        members = await repository.list_by_customer(session, customer.id)
        assert len([m for m in members if m.role == MemberRole.owner]) == 1
