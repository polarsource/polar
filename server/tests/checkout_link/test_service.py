import uuid

import pytest
import pytest_asyncio
from pydantic import HttpUrl

from polar.auth.models import AuthSubject
from polar.checkout_link.schemas import CheckoutLinkCreate, CheckoutLinkUpdate
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.enums import PaymentProcessor
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
)


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
                CheckoutLinkCreate(
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
                CheckoutLinkCreate(
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
                CheckoutLinkCreate(
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
                CheckoutLinkCreate(
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
            CheckoutLinkCreate(
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
            CheckoutLinkCreate(
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
class TestUpdate:
    @pytest.mark.auth
    async def test_metadata(
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

    @pytest.mark.auth
    async def test_label(
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

    @pytest.mark.auth
    async def test_discount(
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


@pytest.mark.asyncio
class TestDelete:
    async def test_valid(
        self, session: AsyncSession, checkout_link: CheckoutLink
    ) -> None:
        deleted_checkout_link = await checkout_link_service.delete(
            session, checkout_link
        )

        assert deleted_checkout_link.deleted_at is not None
