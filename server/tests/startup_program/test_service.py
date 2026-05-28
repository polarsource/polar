import uuid

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.config import settings
from polar.enums import SubscriptionRecurringInterval
from polar.models import Organization, Product
from polar.models.discount import DiscountDuration, DiscountPercentage
from polar.postgres import AsyncSession
from polar.startup_program.service import (
    DISCOUNT_BASIS_POINTS,
    DISCOUNT_DURATION_IN_MONTHS,
    DISCOUNT_ID_KEY,
    DISCOUNT_MAX_REDEMPTIONS,
    StartupProgramError,
    StartupProgramStatus,
)
from polar.startup_program.service import startup_program as startup_program_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_customer,
    create_member,
    create_product,
)


@pytest_asyncio.fixture
async def scale_product(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        name="Scale",
    )


@pytest.fixture
def configure_startup_program(
    monkeypatch: pytest.MonkeyPatch,
    organization: Organization,
    scale_product: Product,
) -> None:
    # ``organization`` plays the role of Polar's own organization.
    monkeypatch.setattr(settings, "POLAR_ORGANIZATION_ID", str(organization.id))
    monkeypatch.setattr(settings, "POLAR_SCALE_PRODUCT_ID", str(scale_product.id))


@pytest.mark.asyncio
class TestMarkInvited:
    async def test_raises_when_not_configured(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(settings, "POLAR_ORGANIZATION_ID", str(organization.id))
        monkeypatch.setattr(settings, "POLAR_SCALE_PRODUCT_ID", "")
        customer = await create_customer(save_fixture, organization=organization)

        with pytest.raises(StartupProgramError):
            await startup_program_service.mark_invited(session, customer)

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_creates_discount_and_stores_pointer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        scale_product: Product,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, external_id=str(uuid.uuid4())
        )

        discount = await startup_program_service.mark_invited(session, customer)

        assert isinstance(discount, DiscountPercentage)
        assert discount.basis_points == DISCOUNT_BASIS_POINTS
        assert discount.duration == DiscountDuration.repeating
        assert discount.duration_in_months == DISCOUNT_DURATION_IN_MONTHS
        assert discount.max_redemptions == DISCOUNT_MAX_REDEMPTIONS
        assert discount.organization_id == organization.id
        assert scale_product in discount.products

        assert customer.user_metadata[DISCOUNT_ID_KEY] == str(discount.id)

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_creates_fresh_discount_when_previous_was_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Re-inviting an org whose discount was deleted creates a new one."""
        customer = await create_customer(
            save_fixture, organization=organization, external_id=str(uuid.uuid4())
        )

        first = await startup_program_service.mark_invited(session, customer)
        first.set_deleted_at()
        await save_fixture(first)

        second = await startup_program_service.mark_invited(session, customer)

        assert second.id != first.id
        assert customer.user_metadata[DISCOUNT_ID_KEY] == str(second.id)

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_is_idempotent(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture, organization=organization, external_id=str(uuid.uuid4())
        )

        first = await startup_program_service.mark_invited(session, customer)
        second = await startup_program_service.mark_invited(session, customer)

        assert first.id == second.id

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_sends_welcome_email_to_members(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        enqueue_mock = mocker.patch(
            "polar.startup_program.service.enqueue_email_template"
        )
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(organization_second.id),
        )
        await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            email="founder@acme.ai",
        )

        await startup_program_service.mark_invited(session, customer)

        assert enqueue_mock.call_count == 1
        call_kwargs = enqueue_mock.call_args.kwargs
        assert call_kwargs["to_email_addr"] == "founder@acme.ai"
        assert "Startup Program" in call_kwargs["subject"]

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_rejects_customer_from_other_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization_second: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization_second,
            external_id=str(uuid.uuid4()),
        )

        with pytest.raises(StartupProgramError):
            await startup_program_service.mark_invited(session, customer)


@pytest.mark.asyncio
class TestGetStatus:
    """``get_status`` derives the status from the customer's stored discount."""

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_invited_when_discount_unused(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        external_organization_id = uuid.uuid4()
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )
        await startup_program_service.mark_invited(session, customer)

        status = await startup_program_service.get_status(
            session, external_organization_id
        )

        assert status == StartupProgramStatus.invited

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_consumed_when_discount_redeemed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        external_organization_id = uuid.uuid4()
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )
        discount = await startup_program_service.mark_invited(session, customer)
        discount.redemptions_count = 1
        await save_fixture(discount)

        status = await startup_program_service.get_status(
            session, external_organization_id
        )

        assert status == StartupProgramStatus.consumed

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_no_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        external_organization_id = uuid.uuid4()
        await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )

        status = await startup_program_service.get_status(
            session, external_organization_id
        )

        assert status is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_no_customer(
        self,
        session: AsyncSession,
    ) -> None:
        status = await startup_program_service.get_status(session, uuid.uuid4())
        assert status is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_discount_soft_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        """Soft-deleting the discount revokes the invitation."""
        external_organization_id = uuid.uuid4()
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )
        discount = await startup_program_service.mark_invited(session, customer)

        discount.set_deleted_at()
        await save_fixture(discount)

        status = await startup_program_service.get_status(
            session, external_organization_id
        )

        assert status is None


@pytest.mark.asyncio
class TestResolveCheckoutDiscountId:
    @pytest.mark.usefixtures("configure_startup_program")
    async def test_returns_discount_when_invited(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        scale_product: Product,
    ) -> None:
        external_organization_id = uuid.uuid4()
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )
        discount = await startup_program_service.mark_invited(session, customer)

        resolved = await startup_program_service.resolve_checkout_discount_id(
            session,
            organization_id=external_organization_id,
            product_id=str(scale_product.id),
        )

        assert resolved == discount.id

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_product_is_not_scale(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        external_organization_id = uuid.uuid4()
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )
        await startup_program_service.mark_invited(session, customer)

        resolved = await startup_program_service.resolve_checkout_discount_id(
            session,
            organization_id=external_organization_id,
            product_id=str(uuid.uuid4()),
        )

        assert resolved is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_no_discount(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        scale_product: Product,
    ) -> None:
        external_organization_id = uuid.uuid4()
        await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )

        resolved = await startup_program_service.resolve_checkout_discount_id(
            session,
            organization_id=external_organization_id,
            product_id=str(scale_product.id),
        )

        assert resolved is None

    @pytest.mark.usefixtures("configure_startup_program")
    async def test_none_when_fully_redeemed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        scale_product: Product,
    ) -> None:
        external_organization_id = uuid.uuid4()
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=str(external_organization_id),
        )
        discount = await startup_program_service.mark_invited(session, customer)

        discount.redemptions_count = discount.max_redemptions or 1
        await save_fixture(discount)

        resolved = await startup_program_service.resolve_checkout_discount_id(
            session,
            organization_id=external_organization_id,
            product_id=str(scale_product.id),
        )

        assert resolved is None
