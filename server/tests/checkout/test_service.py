import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from pydantic_core import Url
from pytest_mock import MockerFixture

from polar.auth.models import Anonymous, AuthMethod, AuthSubject
from polar.checkout.schemas import CheckoutCreate
from polar.checkout.service import checkout as checkout_service
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import StripeService
from polar.models import Organization, Product, User
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    add_product_benefits,
    create_benefit,
)

SUCCESS_URL = Url("https://example.com/success")


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.checkout.service.stripe_service", new=mock)
    return mock


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestCreate:
    async def test_not_existing_price(
        self, auth_subject: AuthSubject[Anonymous], session: AsyncSession
    ) -> None:
        create_schema = CheckoutCreate(
            product_price_id=uuid.uuid4(), success_url=SUCCESS_URL, customer_email=None
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(session, create_schema, auth_subject)

    async def test_archived_price(
        self,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[Anonymous],
        session: AsyncSession,
        product: Product,
    ) -> None:
        price = product.prices[0]
        price.is_archived = True
        await save_fixture(price)

        create_schema = CheckoutCreate(
            product_price_id=price.id, success_url=SUCCESS_URL, customer_email=None
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(session, create_schema, auth_subject)

    async def test_archived_product(
        self,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[Anonymous],
        session: AsyncSession,
        product: Product,
    ) -> None:
        product.is_archived = True
        await save_fixture(product)

        price = product.prices[0]
        create_schema = CheckoutCreate(
            product_price_id=price.id, success_url=SUCCESS_URL, customer_email=None
        )
        with pytest.raises(PolarRequestValidationError):
            await checkout_service.create(session, create_schema, auth_subject)

    async def test_valid_anonymous(
        self,
        auth_subject: AuthSubject[Anonymous],
        session: AsyncSession,
        product: Product,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_checkout_session_mock: MagicMock = (
            stripe_service_mock.create_checkout_session
        )
        create_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        price = product.prices[0]
        create_schema = CheckoutCreate(
            product_price_id=price.id, success_url=SUCCESS_URL, customer_email=None
        )
        checkout = await checkout_service.create(session, create_schema, auth_subject)

        assert checkout.id == "SESSION_ID"
        assert checkout.url == "STRIPE_URL"
        assert checkout.customer_email is None
        assert checkout.customer_name is None
        assert checkout.product.id == product.id
        assert checkout.product_price.id == price.id

        create_checkout_session_mock.assert_called_once_with(
            price.stripe_price_id,
            str(SUCCESS_URL),
            is_subscription=True,
            is_tax_applicable=False,
            metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
            subscription_metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
        )

    @pytest.mark.auth
    async def test_valid_user_cookie(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        stripe_service_mock: MagicMock,
        user: User,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_checkout_session_mock: MagicMock = (
            stripe_service_mock.create_checkout_session
        )
        create_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={},
        )

        price = product.prices[0]
        create_schema = CheckoutCreate(
            product_price_id=price.id, success_url=SUCCESS_URL, customer_email=None
        )
        checkout = await checkout_service.create(session, create_schema, auth_subject)

        assert checkout.id == "SESSION_ID"
        assert checkout.url == "STRIPE_URL"
        assert checkout.customer_email == "backer@example.com"
        assert checkout.customer_name == "John"
        assert checkout.product.id == product.id
        assert checkout.product_price.id == price.id

        create_checkout_session_mock.assert_called_once_with(
            price.stripe_price_id,
            str(SUCCESS_URL),
            is_subscription=True,
            is_tax_applicable=False,
            customer="STRIPE_CUSTOMER_ID",
            metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
                "user_id": str(user.id),
            },
            subscription_metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
                "user_id": str(user.id),
            },
        )

    @pytest.mark.auth(AuthSubjectFixture(method=AuthMethod.PERSONAL_ACCESS_TOKEN))
    async def test_valid_token(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        stripe_service_mock: MagicMock,
        user: User,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_checkout_session_mock: MagicMock = (
            stripe_service_mock.create_checkout_session
        )
        create_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        price = product.prices[0]
        create_schema = CheckoutCreate(
            product_price_id=price.id, success_url=SUCCESS_URL, customer_email=None
        )
        checkout = await checkout_service.create(session, create_schema, auth_subject)

        assert checkout.id == "SESSION_ID"
        assert checkout.url == "STRIPE_URL"
        assert checkout.customer_email is None
        assert checkout.customer_name is None
        assert checkout.product.id == product.id
        assert checkout.product_price.id == price.id

        create_checkout_session_mock.assert_called_once_with(
            price.stripe_price_id,
            str(SUCCESS_URL),
            is_subscription=True,
            is_tax_applicable=False,
            metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
            subscription_metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
        )

    @pytest.mark.auth(AuthSubjectFixture(method=AuthMethod.PERSONAL_ACCESS_TOKEN))
    async def test_valid_token_customer_email(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        stripe_service_mock: MagicMock,
        user: User,
    ) -> None:
        user.stripe_customer_id = "STRIPE_CUSTOMER_ID"

        create_checkout_session_mock: MagicMock = (
            stripe_service_mock.create_checkout_session
        )
        create_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email="backer@example.com",
            customer_details=None,
            metadata={},
        )

        price = product.prices[0]
        create_schema = CheckoutCreate(
            product_price_id=price.id,
            success_url=SUCCESS_URL,
            customer_email="backer@example.com",
        )
        checkout = await checkout_service.create(session, create_schema, auth_subject)

        assert checkout.id == "SESSION_ID"
        assert checkout.url == "STRIPE_URL"
        assert checkout.customer_email == "backer@example.com"
        assert checkout.customer_name is None
        assert checkout.product.id == product.id
        assert checkout.product_price.id == price.id

        create_checkout_session_mock.assert_called_once_with(
            price.stripe_price_id,
            str(SUCCESS_URL),
            is_subscription=True,
            is_tax_applicable=False,
            customer_email="backer@example.com",
            metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
            subscription_metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
        )

    async def test_valid_tax_applicable(
        self,
        auth_subject: AuthSubject[Anonymous],
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        stripe_service_mock: MagicMock,
        organization: Organization,
    ) -> None:
        applicable_tax_benefit = await create_benefit(
            save_fixture, is_tax_applicable=True, organization=organization
        )
        product = await add_product_benefits(
            save_fixture,
            product=product,
            benefits=[applicable_tax_benefit],
        )

        create_checkout_session_mock: MagicMock = (
            stripe_service_mock.create_checkout_session
        )
        create_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details=None,
            metadata={},
        )

        price = product.prices[0]
        create_schema = CheckoutCreate(
            product_price_id=price.id, success_url=SUCCESS_URL, customer_email=None
        )
        checkout = await checkout_service.create(session, create_schema, auth_subject)

        assert checkout.id == "SESSION_ID"
        assert checkout.url == "STRIPE_URL"
        assert checkout.customer_email is None
        assert checkout.customer_name is None
        assert checkout.product.id == product.id
        assert checkout.product_price.id == price.id

        create_checkout_session_mock.assert_called_once_with(
            price.stripe_price_id,
            str(SUCCESS_URL),
            is_subscription=True,
            is_tax_applicable=True,
            metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
            subscription_metadata={
                "type": ProductType.product,
                "product_id": str(product.id),
                "product_price_id": str(price.id),
            },
        )


@pytest.mark.asyncio
@pytest.mark.skip_db_asserts
class TestGetById:
    @pytest.mark.parametrize("metadata", [None, {}, {"product_id": str(uuid.uuid4())}])
    async def test_invalid(
        self,
        metadata: dict[str, str] | None,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata=metadata,
        )

        with pytest.raises(ResourceNotFound):
            await checkout_service.get_by_id(session, "SESSION_ID")

    async def test_valid(
        self,
        session: AsyncSession,
        stripe_service_mock: MagicMock,
        product: Product,
    ) -> None:
        get_checkout_session_mock: MagicMock = stripe_service_mock.get_checkout_session
        get_checkout_session_mock.return_value = SimpleNamespace(
            id="SESSION_ID",
            url="STRIPE_URL",
            customer_email=None,
            customer_details={"name": "John", "email": "backer@example.com"},
            metadata={
                "product_id": str(product.id),
                "product_price_id": str(product.prices[0].id),
            },
        )

        # then
        session.expunge_all()

        checkout = await checkout_service.get_by_id(session, "SESSION_ID")

        assert checkout.id == "SESSION_ID"
        assert checkout.url == "STRIPE_URL"
        assert checkout.customer_email == "backer@example.com"
        assert checkout.customer_name == "John"
        assert checkout.product.id == product.id
        assert checkout.product_price.id == product.prices[0].id
