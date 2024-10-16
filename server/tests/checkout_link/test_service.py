import uuid

import pytest
import pytest_asyncio
from pydantic_core import Url

from polar.auth.models import AuthSubject
from polar.checkout_link.schemas import CheckoutLinkCreate, CheckoutLinkUpdate
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.enums import PaymentProcessor
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization, Product, User, UserOrganization
from polar.models.checkout_link import CheckoutLink
from polar.models.product_price import ProductPriceFixed, ProductPriceType
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
        price=product.prices[0],
        success_url="https://example.com/success",
        user_metadata={"key": "value"},
    )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreate:
    @pytest.mark.auth
    async def test_not_existing_price(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreate(
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
                CheckoutLinkCreate(
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
            type=ProductPriceType.one_time,
            is_archived=True,
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_link_service.create(
                session,
                CheckoutLinkCreate(
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
                CheckoutLinkCreate(
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
            CheckoutLinkCreate(
                payment_processor=PaymentProcessor.stripe,
                product_price_id=price.id,
                success_url=Url(
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


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestUpdate:
    async def test_valid(
        self, session: AsyncSession, checkout_link: CheckoutLink
    ) -> None:
        updated_checkout_link = await checkout_link_service.update(
            session,
            checkout_link,
            CheckoutLinkUpdate(
                metadata={"key": "updated"},
            ),
        )

        assert updated_checkout_link.user_metadata == {"key": "updated"}


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestDelete:
    async def test_valid(
        self, session: AsyncSession, checkout_link: CheckoutLink
    ) -> None:
        deleted_checkout_link = await checkout_link_service.delete(
            session, checkout_link
        )

        assert deleted_checkout_link.deleted_at is not None
