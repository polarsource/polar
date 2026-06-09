import uuid

import pytest
import pytest_asyncio
from pydantic import HttpUrl

from polar.auth.models import AuthSubject
from polar.checkout_link.schemas import (
    CheckoutLinkCreateProducts,
    CheckoutLinkUpdate,
)
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.enums import PaymentProcessor, SubscriptionRecurringInterval
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.models import Discount, Organization, Product, User, UserOrganization
from polar.models.checkout_link import CheckoutLink
from polar.models.product_price import ProductPriceFixed
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout_link,
    create_product,
    create_product_price_seat_unit,
)


@pytest_asyncio.fixture
async def product_seat_based(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    """Seat-based product allowing 1+ seats (no maximum)."""
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[],
    )
    price = await create_product_price_seat_unit(
        save_fixture, product=product, price_per_seat=1000
    )
    product.prices = [price]
    return product


@pytest_asyncio.fixture
async def product_seat_based_2_to_20(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    """Seat-based product requiring between 2 and 20 seats."""
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[],
    )
    price = await create_product_price_seat_unit(
        save_fixture,
        product=product,
        price_per_seat=1000,
        minimum_seats=2,
        maximum_seats=20,
    )
    product.prices = [price]
    return product


@pytest_asyncio.fixture
async def checkout_link(save_fixture: SaveFixture, product: Product) -> CheckoutLink:
    return await create_checkout_link(
        save_fixture,
        products=[product],
        success_url="https://example.com/success",
        user_metadata={"key": "value"},
    )


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_product_filter(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        checkout_link: CheckoutLink,
        product: Product,
    ) -> None:
        results, count = await checkout_link_service.list(
            session,
            auth_subject,
            product_id=[product.id],
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert checkout_link in results


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_not_existing_product(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[uuid.uuid4()],
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user_second"),
        AuthSubjectFixture(subject="organization_second"),
    )
    async def test_not_writable_product(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_one_time: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[product_one_time.id],
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_archived_product(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        product_one_time.is_archived = True
        await save_fixture(product_one_time)

        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[product_one_time.id],
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
    )
    async def test_products_different_organizations(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user: User,
        user_organization: UserOrganization,
        product: Product,
        product_organization_second: Product,
        organization_second: Organization,
    ) -> None:
        user_organization = UserOrganization(
            user_id=user.id, organization_id=organization_second.id
        )
        await save_fixture(user_organization)

        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[product.id, product_organization_second.id],
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        checkout_link = await checkout_link_service.create(
            session,
            CheckoutLinkCreateProducts(
                payment_processor=PaymentProcessor.stripe,
                products=[product_one_time.id],
                success_url=HttpUrl(
                    "https://example.com/success?checkout_id={CHECKOUT_ID}"
                ),
                metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout_link.products == [product_one_time]
        assert (
            checkout_link.success_url
            == "https://example.com/success?checkout_id={CHECKOUT_ID}"
        )
        assert checkout_link.user_metadata == {"key": "value"}
        assert checkout_link.client_secret is not None

    @pytest.mark.auth
    async def test_valid_discount(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_one_time: Product,
        discount_fixed_once: Discount,
    ) -> None:
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout_link = await checkout_link_service.create(
            session,
            CheckoutLinkCreateProducts(
                payment_processor=PaymentProcessor.stripe,
                products=[product_one_time.id],
                discount_id=discount_fixed_once.id,
                success_url=HttpUrl(
                    "https://example.com/success?checkout_id={CHECKOUT_ID}"
                ),
                metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout_link.discount == discount_fixed_once


@pytest.mark.asyncio
class TestCreateSeats:
    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
    ) -> None:
        checkout_link = await checkout_link_service.create(
            session,
            CheckoutLinkCreateProducts(
                payment_processor=PaymentProcessor.stripe,
                products=[product_seat_based_2_to_20.id],
                seats=5,
            ),
            auth_subject,
        )

        assert checkout_link.seats == 5

    @pytest.mark.auth
    async def test_non_seat_based_product(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[product_one_time.id],
                    seats=5,
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_mixed_seat_and_non_seat_products(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
        product_one_time: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[product_seat_based_2_to_20.id, product_one_time.id],
                    seats=5,
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_seats_below_minimum(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[product_seat_based_2_to_20.id],
                    seats=1,
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_seats_above_maximum(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreateProducts(
                    payment_processor=PaymentProcessor.stripe,
                    products=[product_seat_based_2_to_20.id],
                    seats=21,
                ),
                auth_subject,
            )


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.auth
    async def test_metadata(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        checkout_link: CheckoutLink,
    ) -> None:
        updated_checkout_link = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(
                metadata={"key": "updated"},
            ),
            auth_subject,
        )

        assert updated_checkout_link.user_metadata == {"key": "updated"}

    @pytest.mark.auth
    async def test_label(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        checkout_link: CheckoutLink,
    ) -> None:
        updated_checkout_link = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(
                label="Hello world link",
            ),
            auth_subject,
        )

        assert updated_checkout_link.label == "Hello world link"

    @pytest.mark.auth
    async def test_discount(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        checkout_link: CheckoutLink,
        discount_fixed_once: Discount,
    ) -> None:
        updated_checkout_link = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(discount_id=discount_fixed_once.id),
            auth_subject,
        )

        assert updated_checkout_link.discount == discount_fixed_once

    @pytest.mark.auth
    async def test_products(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        checkout_link: CheckoutLink,
        discount_fixed_once: Discount,
        product: Product,
        product_one_time: Product,
    ) -> None:
        updated_checkout_link = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(products=[product_one_time.id, product.id]),
            auth_subject,
        )
        await session.flush()

        assert updated_checkout_link.products == [product_one_time, product]

    @pytest.mark.auth
    async def test_products_different_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        checkout_link: CheckoutLink,
        user: User,
        user_organization: UserOrganization,
        product: Product,
        product_organization_second: Product,
        organization_second: Organization,
    ) -> None:
        user_organization = UserOrganization(
            user_id=user.id, organization_id=organization_second.id
        )
        await save_fixture(user_organization)

        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.update(
                session,
                checkout_link,
                CheckoutLinkUpdate(
                    products=[product.id, product_organization_second.id]
                ),
                auth_subject,
            )

        assert checkout_link.products == [product]

    @pytest.mark.auth
    async def test_products_to_one_time_clears_trial(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product: Product,
        product_one_time: Product,
    ) -> None:
        from polar.kit.trial import TrialInterval

        checkout_link_with_trial = await create_checkout_link(
            save_fixture,
            products=[product],
            trial_interval=TrialInterval.month,
            trial_interval_count=1,
        )

        assert checkout_link_with_trial.trial_interval is not None
        assert checkout_link_with_trial.trial_interval_count is not None

        updated = await checkout_link_service.update(
            session,
            checkout_link_with_trial,
            CheckoutLinkUpdate(products=[product_one_time.id]),
            auth_subject,
        )

        assert updated.trial_interval is None
        assert updated.trial_interval_count is None

    @pytest.mark.auth
    async def test_seats_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
    ) -> None:
        checkout_link = await create_checkout_link(
            save_fixture, products=[product_seat_based_2_to_20]
        )

        updated = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(seats=10),
            auth_subject,
        )

        assert updated.seats == 10

    @pytest.mark.auth
    async def test_seats_invalid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
    ) -> None:
        checkout_link = await create_checkout_link(
            save_fixture, products=[product_seat_based_2_to_20]
        )

        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.update(
                session,
                checkout_link,
                CheckoutLinkUpdate(seats=21),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_seats_explicit_clear(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
    ) -> None:
        checkout_link = await create_checkout_link(
            save_fixture, products=[product_seat_based_2_to_20], seats=5
        )

        updated = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(seats=None),
            auth_subject,
        )

        assert updated.seats is None

    @pytest.mark.auth
    async def test_products_change_auto_clears_incompatible_seats(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based_2_to_20: Product,
        product_one_time: Product,
    ) -> None:
        checkout_link = await create_checkout_link(
            save_fixture, products=[product_seat_based_2_to_20], seats=5
        )

        updated = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(products=[product_one_time.id]),
            auth_subject,
        )
        await session.flush()

        assert updated.seats is None

    @pytest.mark.auth
    async def test_products_change_keeps_compatible_seats(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        product_seat_based: Product,
        product_seat_based_2_to_20: Product,
    ) -> None:
        checkout_link = await create_checkout_link(
            save_fixture, products=[product_seat_based], seats=5
        )

        updated = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(products=[product_seat_based_2_to_20.id]),
            auth_subject,
        )
        await session.flush()

        assert updated.seats == 5


@pytest.mark.asyncio
class TestDelete:
    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        checkout_link: CheckoutLink,
        user_organization: UserOrganization,
    ) -> None:
        deleted_checkout_link = await checkout_link_service.delete(
            session, checkout_link, auth_subject
        )

        assert deleted_checkout_link.deleted_at is not None
