import uuid

import pytest
import pytest_asyncio
from pydantic import HttpUrl

from polar.auth.models import AuthSubject
from polar.checkout_link.schemas import CheckoutLinkPriceCreate, CheckoutLinkUpdate
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.enums import PaymentProcessor
from polar.exceptions import PolarRequestValidationError
from polar.models import Discount, Organization, Product, User, UserOrganization
from polar.models.checkout_link import CheckoutLink
from polar.models.product_price import ProductPriceFixed
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout_link,
    create_product_price_fixed,
)


@pytest_asyncio.fixture
async def checkout_link(save_fixture: SaveFixture, product: Product) -> CheckoutLink:
    return await create_checkout_link(
        save_fixture,
        product=product,
        price=product.prices[0],
        success_url="https://example.com/success",
        user_metadata={"key": "value"},
    )


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_not_existing_price(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkPriceCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=uuid.uuid4(),
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user_second"),
        AuthSubjectFixture(subject="organization_second"),
    )
    async def test_not_writable_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_one_time: Product,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkPriceCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=product_one_time.prices[0].id,
                ),
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_archived_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product_one_time: Product,
    ) -> None:
        price = await create_product_price_fixed(
            save_fixture,
            product=product_one_time,
            is_archived=True,
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkPriceCreate(
                    payment_processor=PaymentProcessor.stripe, product_price_id=price.id
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
                CheckoutLinkPriceCreate(
                    payment_processor=PaymentProcessor.stripe,
                    product_price_id=product_one_time.prices[0].id,
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
        price = product_one_time.prices[0]
        assert isinstance(price, ProductPriceFixed)
        checkout_link = await checkout_link_service.create(
            session,
            CheckoutLinkPriceCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                success_url=HttpUrl(
                    "https://example.com/success?checkout_id={CHECKOUT_ID}"
                ),
                metadata={"key": "value"},
            ),
            auth_subject,
        )

        assert checkout_link.product_price == price
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
            CheckoutLinkPriceCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
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
class TestUpdate:
    async def test_update_metadata(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
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

    async def test_change_label(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
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

    async def test_update_unset_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        checkout_link: CheckoutLink,
    ) -> None:
        assert checkout_link.product_price
        updated_checkout_link = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(product_price_id=None),
            auth_subject,
        )

        assert updated_checkout_link.product_price is None

    async def test_change_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_recurring_monthly_and_yearly: Product,
    ) -> None:
        product = product_recurring_monthly_and_yearly
        checkout_link = await create_checkout_link(
            save_fixture,
            product=product,
            price=product.prices[1],
        )
        new_price_id = product.prices[1].id
        updated_checkout_link = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(product_price_id=new_price_id),
            auth_subject,
        )

        assert updated_checkout_link.product_price_id == new_price_id

    async def test_deny_change_product_via_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        product_one_time: Product,
        product_recurring_monthly_and_yearly: Product,
    ) -> None:
        product = product_recurring_monthly_and_yearly
        checkout_link = await create_checkout_link(
            save_fixture,
            product=product,
            price=product.prices[1],
        )
        new_price_id = product_one_time.prices[0].id
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.update(
                session,
                checkout_link,
                CheckoutLinkUpdate(product_price_id=new_price_id),
                auth_subject,
            )

    async def test_set_discount(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
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


@pytest.mark.asyncio
class TestDelete:
    async def test_valid(
        self, session: AsyncSession, checkout_link: CheckoutLink
    ) -> None:
        deleted_checkout_link = await checkout_link_service.delete(
            session, checkout_link
        )

        assert deleted_checkout_link.deleted_at is not None
