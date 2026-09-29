from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from polar.checkout.repository import CheckoutRepository
from polar.kit.address import Address, CountryAlpha2
from polar.kit.utils import utc_now
from polar.models import Checkout, Customer, Organization, Product
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.postgres import AsyncSession
from polar.tax.tax_id import TaxIDFormat
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_discount


@pytest.mark.asyncio
class TestExpireOpenCheckouts:
    async def test_valid(
        self, save_fixture: SaveFixture, session: AsyncSession, product: Product
    ) -> None:
        open_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.open,
            expires_at=utc_now() + timedelta(days=1),
        )
        expired_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.open,
            expires_at=utc_now() - timedelta(days=1),
        )
        successful_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.succeeded,
            expires_at=utc_now() - timedelta(days=1),
        )

        repository = CheckoutRepository.from_session(session)
        expired_checkouts = await repository.expire_open_checkouts()

        # Verify only the expired open checkout is returned
        assert len(expired_checkouts) == 1
        assert expired_checkouts[0] == expired_checkout.id

        # Verify statuses are properly updated
        updated_open_checkout = await repository.get_by_id(open_checkout.id)
        assert updated_open_checkout is not None
        assert updated_open_checkout.status == CheckoutStatus.open

        updated_expired_checkout = await repository.get_by_id(expired_checkout.id)
        assert updated_expired_checkout is not None
        assert updated_expired_checkout.status == CheckoutStatus.expired

        updated_successful_checkout = await repository.get_by_id(successful_checkout.id)
        assert updated_successful_checkout is not None
        assert updated_successful_checkout.status == CheckoutStatus.succeeded


@pytest.mark.asyncio
async def test_for_update_eager_loading(
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    organization: Organization,
) -> None:
    discount = await create_discount(
        save_fixture,
        type=DiscountType.percentage,
        basis_points=5_000,
        duration=DiscountDuration.once,
        organization=organization,
        code="TESTCODE",
        products=[product],
    )
    checkout = await create_checkout(
        save_fixture, products=[product], discount=discount
    )
    assert checkout.product is not None

    repository = CheckoutRepository.from_session(session)

    # Fetch the checkout with for_update and eager loading
    fetched_checkout = await repository.get_by_client_secret(
        checkout.client_secret, for_update=True, options=repository.get_eager_options()
    )

    assert fetched_checkout is not None
    assert fetched_checkout.id == checkout.id
    assert fetched_checkout.product is not None
    assert fetched_checkout.product.attached_custom_fields == []
    for fetched_product in fetched_checkout.products:
        assert fetched_product.product_medias == []
    assert fetched_checkout.discount is not None
    assert fetched_checkout.discount.products == [product]


@pytest.mark.asyncio
class TestAnonymizeExpired:
    async def _create_checkout_with_pii(
        self,
        save_fixture: SaveFixture,
        product: Product,
        *,
        status: CheckoutStatus,
        created_at: datetime,
        customer: Customer | None = None,
        deleted: bool = False,
    ) -> Checkout:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=status,
            created_at=created_at,
            customer=customer,
            external_customer_id="EXTERNAL_ID",
            customer_metadata={"key": "value"},
            payment_processor_metadata={"customer_id": "cus_123"},
            customer_billing_address=Address(country=CountryAlpha2("FR")),
            analytics_metadata={
                "opened_at": "2026-01-01T00:00:00+00:00",
                "distinct_id": "john@example.com",
            },
        )
        checkout.customer_name = "John Doe"
        checkout.customer_email = "john@example.com"
        checkout.customer_ip_address = "1.2.3.4"
        checkout.customer_billing_name = "John Doe"
        checkout.customer_tax_id = ("FR61954506077", TaxIDFormat.eu_vat)
        checkout.custom_field_data = {"phone": "+33600000000"}
        if deleted:
            checkout.deleted_at = utc_now()
        await save_fixture(checkout)
        return checkout

    async def test_scrubs_expired_checkout(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        checkout = await self._create_checkout_with_pii(
            save_fixture,
            product,
            status=CheckoutStatus.expired,
            created_at=utc_now() - timedelta(days=91),
            customer=customer,
        )

        repository = CheckoutRepository.from_session(session)
        anonymized = await repository.anonymize_expired(
            utc_now() - timedelta(days=90), batch_size=100
        )

        assert anonymized == 1
        await session.refresh(checkout)
        assert checkout.customer_id is None
        assert checkout.external_customer_id is None
        assert checkout.customer_name is None
        assert checkout.customer_email is None
        assert checkout.customer_ip_address is None
        assert checkout.customer_billing_name is None
        assert checkout.customer_billing_address is None
        assert checkout.customer_tax_id is None
        assert checkout.customer_metadata == {}
        assert checkout.custom_field_data == {}
        assert checkout.payment_processor_metadata == {}
        assert checkout.anonymized_at is not None

        # `distinct_id` falls back to the customer's email, `opened_at` is
        # needed by the checkout funnel metrics.
        assert checkout.analytics_metadata == {"opened_at": "2026-01-01T00:00:00+00:00"}

        # The ORM reads a JSONB `null` back as `None`, so assert SQL NULL.
        sql_null = await session.execute(
            select(Checkout.id).where(
                Checkout.id == checkout.id,
                Checkout.customer_billing_address.is_(None),
            )
        )
        assert sql_null.scalar_one_or_none() == checkout.id

    async def test_scrubs_soft_deleted_checkout(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        checkout = await self._create_checkout_with_pii(
            save_fixture,
            product,
            status=CheckoutStatus.expired,
            created_at=utc_now() - timedelta(days=91),
            customer=customer,
            deleted=True,
        )

        repository = CheckoutRepository.from_session(session)
        anonymized = await repository.anonymize_expired(
            utc_now() - timedelta(days=90), batch_size=100
        )

        assert anonymized == 1
        await session.refresh(checkout)
        assert checkout.customer_email is None

    @pytest.mark.parametrize(
        ("status", "age_days"),
        [
            (CheckoutStatus.expired, 89),
            (CheckoutStatus.open, 91),
            (CheckoutStatus.confirmed, 91),
            (CheckoutStatus.succeeded, 91),
            # Legacy status, migrated to `expired` by its own backfill.
            (CheckoutStatus.failed, 91),
        ],
    )
    async def test_preserves_out_of_scope_checkout(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        status: CheckoutStatus,
        age_days: int,
    ) -> None:
        checkout = await self._create_checkout_with_pii(
            save_fixture,
            product,
            status=status,
            created_at=utc_now() - timedelta(days=age_days),
            customer=customer,
        )

        repository = CheckoutRepository.from_session(session)
        anonymized = await repository.anonymize_expired(
            utc_now() - timedelta(days=90), batch_size=100
        )

        assert anonymized == 0
        await session.refresh(checkout)
        assert checkout.customer_id == customer.id
        assert checkout.customer_email == "john@example.com"
        assert checkout.anonymized_at is None

    async def test_skips_already_anonymized_checkout(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        await self._create_checkout_with_pii(
            save_fixture,
            product,
            status=CheckoutStatus.expired,
            created_at=utc_now() - timedelta(days=91),
            customer=customer,
        )

        repository = CheckoutRepository.from_session(session)
        older_than = utc_now() - timedelta(days=90)
        assert await repository.anonymize_expired(older_than, batch_size=100)
        assert await repository.anonymize_expired(older_than, batch_size=100) == 0

    async def test_honors_batch_size(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        for _ in range(3):
            await self._create_checkout_with_pii(
                save_fixture,
                product,
                status=CheckoutStatus.expired,
                created_at=utc_now() - timedelta(days=91),
                customer=customer,
            )

        repository = CheckoutRepository.from_session(session)
        older_than = utc_now() - timedelta(days=90)

        assert await repository.anonymize_expired(older_than, batch_size=2) == 2
        assert await repository.anonymize_expired(older_than, batch_size=2) == 1

    async def test_counts_only_pending(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        for status, age_days in (
            (CheckoutStatus.expired, 91),
            (CheckoutStatus.expired, 91),
            (CheckoutStatus.expired, 89),
            (CheckoutStatus.failed, 91),
            (CheckoutStatus.succeeded, 91),
        ):
            await self._create_checkout_with_pii(
                save_fixture,
                product,
                status=status,
                created_at=utc_now() - timedelta(days=age_days),
                customer=customer,
            )

        repository = CheckoutRepository.from_session(session)
        older_than = utc_now() - timedelta(days=90)

        assert await repository.count_expired_pending_anonymization(older_than) == 2

        await repository.anonymize_expired(older_than, batch_size=100)

        assert await repository.count_expired_pending_anonymization(older_than) == 0
