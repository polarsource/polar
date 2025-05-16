import uuid
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, call

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.models import (
    Benefit,
    File,
    Meter,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.file import FileServiceTypes, ProductMediaFile
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceFixed,
)
from polar.postgres import AsyncSession
from polar.product.guard import is_static_price
from polar.product.schemas import (
    ExistingProductPrice,
    ProductCreate,
    ProductPriceCustomCreate,
    ProductPriceFixedCreate,
    ProductPriceFreeCreate,
    ProductPriceMeteredUnitCreate,
    ProductUpdate,
)
from polar.product.service import product as product_service
from polar.product.sorting import ProductSortProperty
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_ID,
    create_benefit,
    create_checkout_link,
    create_product,
    set_product_benefits,
)


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.product.service.enqueue_job")


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        products: list[Product],
        user: User,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await product_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
        )

        assert count == 0
        assert len(results) == 0

    @pytest.mark.auth
    async def test_user_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        products: list[Product],
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await product_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
        )

        assert count == 2
        assert len(results) == 2

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        products: list[Product],
    ) -> None:
        # then
        session.expunge_all()

        results, count = await product_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert count == 2
        assert len(results) == 2

    @pytest.mark.auth
    async def test_filter_is_recurring(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        recurring_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        one_time_product = await create_product(
            save_fixture, organization=organization, recurring_interval=None
        )

        # then
        session.expunge_all()

        results, count = await product_service.list(
            session,
            auth_subject,
            organization_id=[recurring_product.organization_id],
            is_recurring=True,
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == recurring_product.id

        results, count = await product_service.list(
            session,
            auth_subject,
            organization_id=[recurring_product.organization_id],
            is_recurring=False,
            pagination=PaginationParams(1, 10),
        )

        assert count == 1
        assert len(results) == 1
        assert results[0].id == one_time_product.id

    @pytest.mark.auth
    async def test_filter_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        products: list[Product],
        product: Product,
        product_second: Product,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await product_service.list(
            session,
            auth_subject,
            organization_id=[organization.id],
            pagination=PaginationParams(1, 10),
            sorting=[(ProductSortProperty.created_at, False)],
        )

        assert count == 2
        assert len(results) == 2
        assert results[0].id == product.id
        assert results[1].id == product_second.id

    @pytest.mark.auth
    async def test_filter_is_archived(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        archived_product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            is_archived=True,
        )

        # then
        session.expunge_all()

        results, count = await product_service.list(
            session,
            auth_subject,
            organization_id=[archived_product.organization_id],
            is_archived=False,
            pagination=PaginationParams(1, 10),
        )
        assert count == 0
        assert len(results) == 0
        results, count = await product_service.list(
            session,
            auth_subject,
            organization_id=[archived_product.organization_id],
            pagination=PaginationParams(1, 10),
        )
        assert count == 1
        assert len(results) == 1
        assert results[0].id == archived_product.id

    @pytest.mark.auth
    async def test_filter_benefit_id(
        self,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        products: list[Product],
        benefit_organization: Benefit,
        benefit_organization_second: Benefit,
        user_organization: UserOrganization,
    ) -> None:
        for product in products[:2]:
            await set_product_benefits(
                save_fixture,
                product=product,
                benefits=[benefit_organization, benefit_organization_second],
            )

        # then
        session.expunge_all()

        results, count = await product_service.list(
            session,
            auth_subject,
            organization_id=[organization.id],
            benefit_id=[benefit_organization.id],
            pagination=PaginationParams(1, 10),
            sorting=[(ProductSortProperty.created_at, False)],
        )

        assert count == 2
        assert len(results) == 2
        assert results[0].id == products[0].id
        assert results[1].id == products[1].id


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.auth
    async def test_user(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
    ) -> None:
        # then
        session.expunge_all()

        retrieved_product = await product_service.get(session, auth_subject, product.id)
        assert retrieved_product is None

    @pytest.mark.auth
    async def test_user_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_product = await product_service.get(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_product is None

        accessible_product = await product_service.get(
            session, auth_subject, product.id
        )
        assert accessible_product is not None
        assert accessible_product.id == product.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        product: Product,
    ) -> None:
        # then
        session.expunge_all()

        not_existing_product = await product_service.get(
            session, auth_subject, uuid.uuid4()
        )
        assert not_existing_product is None

        accessible_product = await product_service.get(
            session, auth_subject, product.id
        )
        assert accessible_product is not None
        assert accessible_product.id == product.id


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_user_not_existing_organization(
        self, auth_subject: AuthSubject[User], session: AsyncSession
    ) -> None:
        create_schema = ProductCreate(
            name="Product",
            organization_id=uuid.uuid4(),
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.create(session, create_schema, auth_subject)

    @pytest.mark.auth
    async def test_user_not_writable_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        create_schema = ProductCreate(
            name="Product",
            organization_id=organization.id,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.create(session, create_schema, auth_subject)

    @pytest.mark.auth
    async def test_user_valid_organization(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        create_schema = ProductCreate(
            name="Product",
            organization_id=organization.id,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
        )

        product = await product_service.create(session, create_schema, auth_subject)
        assert product.organization_id == organization.id

        create_product_mock.assert_called_once()
        create_price_for_product_mock.assert_called_once()
        assert product.stripe_product_id == "PRODUCT_ID"

        assert len(product.prices) == 1
        price = product.prices[0]
        assert is_static_price(price)
        assert price.stripe_price_id == "PRICE_ID"

    @pytest.mark.auth
    async def test_user_empty_description(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")
        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        create_schema = ProductCreate(
            name="Product",
            description="",
            organization_id=organization.id,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
        )

        product = await product_service.create(session, create_schema, auth_subject)
        assert product.description is None

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_set_organization_id(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        create_schema = ProductCreate(
            name="Product",
            organization_id=organization.id,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.create(session, create_schema, auth_subject)

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_organization_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        organization: Organization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        create_schema = ProductCreate(
            name="Product",
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
        )

        product = await product_service.create(session, create_schema, auth_subject)
        assert product.organization_id == organization.id

    @pytest.mark.auth
    async def test_not_existing_media(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )

        create_schema = ProductCreate(
            name="Product",
            organization_id=organization.id,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
            medias=[uuid.uuid4()],
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.create(session, create_schema, auth_subject)

        create_product_mock.assert_not_called()
        create_price_for_product_mock.assert_not_called()

    @pytest.mark.auth
    @pytest.mark.parametrize(
        "file_kwargs",
        [
            {"service": FileServiceTypes.downloadable},
            {"is_enabled": False},
            {"is_uploaded": False},
        ],
    )
    async def test_invalid_media(
        self,
        file_kwargs: dict[str, Any],
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        file = File(
            **{
                "organization": organization,
                "name": "Product Cover",
                "path": "/product-cover.jpg",
                "mime_type": "image/jpeg",
                "size": 1024,
                "service": FileServiceTypes.product_media,
                "is_enabled": True,
                "is_uploaded": True,
                **file_kwargs,
            }
        )
        await save_fixture(file)

        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )

        create_schema = ProductCreate(
            name="Product",
            organization_id=organization.id,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
            medias=[file.id],
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.create(session, create_schema, auth_subject)

        create_product_mock.assert_not_called()
        create_price_for_product_mock.assert_not_called()

    @pytest.mark.auth
    async def test_valid_media(
        self,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        file = ProductMediaFile(
            **{
                "organization": organization,
                "name": "Product Cover",
                "path": "/product-cover.jpg",
                "mime_type": "image/jpeg",
                "size": 1024,
                "service": FileServiceTypes.product_media,
                "is_enabled": True,
                "is_uploaded": True,
            }
        )
        await save_fixture(file)

        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        create_schema = ProductCreate(
            name="Product",
            organization_id=organization.id,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=1000,
                    price_currency="usd",
                )
            ],
            medias=[file.id],
        )

        product = await product_service.create(session, create_schema, auth_subject)

        assert len(product.medias) == 1

    @pytest.mark.parametrize(
        "create_schema",
        (
            ProductCreate(
                name="One-time fixed",
                recurring_interval=None,
                prices=[
                    ProductPriceFixedCreate(
                        amount_type=ProductPriceAmountType.fixed,
                        price_amount=1000,
                        price_currency="usd",
                    )
                ],
            ),
            ProductCreate(
                name="One-time custom",
                recurring_interval=None,
                prices=[
                    ProductPriceCustomCreate(
                        amount_type=ProductPriceAmountType.custom,
                        minimum_amount=1000,
                        maximum_amount=2000,
                        preset_amount=1500,
                        price_currency="usd",
                    ),
                ],
            ),
            ProductCreate(
                name="One-time free",
                recurring_interval=None,
                prices=[
                    ProductPriceFreeCreate(
                        amount_type=ProductPriceAmountType.free,
                    ),
                ],
            ),
            ProductCreate(
                name="Recurring free",
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[
                    ProductPriceFreeCreate(
                        amount_type=ProductPriceAmountType.free,
                    )
                ],
            ),
            ProductCreate(
                name="Recurring metered unit",
                recurring_interval=SubscriptionRecurringInterval.month,
                prices=[
                    ProductPriceMeteredUnitCreate(
                        amount_type=ProductPriceAmountType.metered_unit,
                        price_currency="usd",
                        unit_amount=Decimal(100),
                        meter_id=METER_ID,
                    )
                ],
            ),
        ),
    )
    @pytest.mark.auth
    async def test_valid_prices(
        self,
        create_schema: ProductCreate,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        meter: Meter,
    ) -> None:
        create_product_mock: MagicMock = stripe_service_mock.create_product
        create_product_mock.return_value = SimpleNamespace(id="PRODUCT_ID")

        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="PRICE_ID")

        create_schema.organization_id = organization.id
        product = await product_service.create(session, create_schema, auth_subject)
        assert product.organization_id == organization.id

        create_product_mock.assert_called_once()
        assert product.stripe_product_id == "PRODUCT_ID"

        assert len(product.prices) == len(create_schema.prices)
        for price in product.prices:
            if is_static_price(price):
                assert price.stripe_price_id == "PRICE_ID"

    @pytest.mark.auth
    async def test_invalid_several_static_prices(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        meter: Meter,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await product_service.create(
                session,
                ProductCreate(
                    name="Product",
                    recurring_interval=None,
                    prices=[
                        ProductPriceFixedCreate(
                            amount_type=ProductPriceAmountType.fixed,
                            price_amount=1000,
                            price_currency="usd",
                        ),
                        ProductPriceFixedCreate(
                            amount_type=ProductPriceAmountType.fixed,
                            price_amount=2000,
                            price_currency="usd",
                        ),
                    ],
                    organization_id=organization.id,
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_invalid_metered_not_existing_meter(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await product_service.create(
                session,
                ProductCreate(
                    name="Product",
                    recurring_interval=SubscriptionRecurringInterval.month,
                    prices=[
                        ProductPriceMeteredUnitCreate(
                            amount_type=ProductPriceAmountType.metered_unit,
                            price_currency="usd",
                            unit_amount=Decimal(100),
                            meter_id=uuid.uuid4(),
                        ),
                    ],
                    organization_id=organization.id,
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_invalid_metered_one_time_product(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        meter: Meter,
    ) -> None:
        with pytest.raises(PolarRequestValidationError) as e:
            await product_service.create(
                session,
                ProductCreate(
                    name="Product",
                    recurring_interval=None,
                    prices=[
                        ProductPriceMeteredUnitCreate(
                            amount_type=ProductPriceAmountType.metered_unit,
                            price_currency="usd",
                            unit_amount=Decimal(100),
                            meter_id=meter.id,
                        ),
                    ],
                    organization_id=organization.id,
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_invalid_metered_duplicate_meters(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
        meter: Meter,
    ) -> None:
        with pytest.raises(PolarRequestValidationError) as e:
            await product_service.create(
                session,
                ProductCreate(
                    name="Product",
                    recurring_interval=SubscriptionRecurringInterval.month,
                    prices=[
                        ProductPriceMeteredUnitCreate(
                            amount_type=ProductPriceAmountType.metered_unit,
                            price_currency="usd",
                            unit_amount=Decimal(100),
                            meter_id=meter.id,
                        ),
                        ProductPriceMeteredUnitCreate(
                            amount_type=ProductPriceAmountType.metered_unit,
                            price_currency="usd",
                            unit_amount=Decimal(200),
                            meter_id=meter.id,
                        ),
                    ],
                    organization_id=organization.id,
                ),
                auth_subject,
            )


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_no_price(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        update_schema = ProductUpdate(prices=[])
        with pytest.raises(PolarRequestValidationError):
            await product_service.update(
                session,
                product,
                update_schema,
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_name_change(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        organization: Organization,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        update_product_mock: MagicMock = stripe_service_mock.update_product

        update_schema = ProductUpdate(name="Product Update")
        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )
        assert updated_product.name == "Product Update"

        update_product_mock.assert_called_once_with(
            updated_product.stripe_product_id,
            name=f"{organization.slug} - Product Update",
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_description_change(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        update_product_mock: MagicMock = stripe_service_mock.update_product

        update_schema = ProductUpdate(description="Description update")
        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )
        assert updated_product.description == "Description update"

        update_product_mock.assert_called_once_with(
            updated_product.stripe_product_id,
            description="Description update",
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_empty_description_update(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        update_product_mock: MagicMock = stripe_service_mock.update_product

        update_schema = ProductUpdate(description="")
        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )
        assert updated_product.description == product.description

        assert len(updated_product.prices) == 1
        assert len(updated_product.all_prices) == 1

        update_product_mock.assert_not_called()

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_price_kept(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )

        update_schema = ProductUpdate(
            prices=[
                ExistingProductPrice(id=product.prices[0].id),
            ]
        )
        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )

        create_price_for_product_mock.assert_not_called()

        assert len(updated_product.prices) == 1
        assert updated_product.prices[0].id == product.prices[0].id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_price_replaced(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="NEW_PRICE_ID")
        archive_price_mock: MagicMock = stripe_service_mock.archive_price

        update_schema = ProductUpdate(
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=12000,
                    price_currency="usd",
                ),
            ]
        )
        deleted_price = product.prices[0]
        assert is_static_price(deleted_price)
        deleted_price_id = deleted_price.stripe_price_id

        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )

        await session.flush()

        create_price_for_product_mock.assert_called_once()
        archive_price_mock.assert_called_once_with(deleted_price_id)

        assert len(updated_product.prices) == 1

        new_price = updated_product.prices[0]
        assert isinstance(new_price, ProductPriceFixed)
        assert new_price.price_amount == 12000
        assert new_price.stripe_price_id == "NEW_PRICE_ID"

        assert len(updated_product.all_prices) == 2
        assert deleted_price in updated_product.all_prices

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_archive(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        product_second: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        checkout_link_one_product = await create_checkout_link(
            save_fixture, products=[product]
        )
        checkout_link_two_products = await create_checkout_link(
            save_fixture, products=[product, product_second]
        )
        archive_product_mock: MagicMock = stripe_service_mock.archive_product

        update_schema = ProductUpdate(is_archived=True)
        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )

        archive_product_mock.assert_called_once_with(product.stripe_product_id)

        assert updated_product.is_archived

        # Ensure we remove archived product from related checkout links
        await session.refresh(
            checkout_link_one_product, {"deleted_at", "checkout_link_products"}
        )
        assert checkout_link_one_product.deleted_at is not None
        assert checkout_link_one_product.checkout_link_products == []

        await session.refresh(
            checkout_link_two_products, {"deleted_at", "checkout_link_products"}
        )
        assert checkout_link_two_products.deleted_at is None
        assert len(checkout_link_two_products.checkout_link_products) == 1

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_unarchive(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        product.is_archived = True
        await save_fixture(product)

        unarchive_product: MagicMock = stripe_service_mock.unarchive_product

        update_schema = ProductUpdate(is_archived=False)
        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )

        unarchive_product.assert_called_once_with(product.stripe_product_id)

        assert not updated_product.is_archived

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_not_existing_media(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        update_schema = ProductUpdate(medias=[uuid.uuid4()])
        with pytest.raises(PolarRequestValidationError):
            await product_service.update(
                session,
                product,
                update_schema,
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    @pytest.mark.parametrize(
        "file_kwargs",
        [
            {"service": FileServiceTypes.downloadable},
            {"is_enabled": False},
            {"is_uploaded": False},
        ],
    )
    async def test_invalid_media(
        self,
        file_kwargs: dict[str, Any],
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = File(
            **{
                "organization": organization,
                "name": "Product Cover",
                "path": "/product-cover.jpg",
                "mime_type": "image/jpeg",
                "size": 1024,
                "service": FileServiceTypes.product_media,
                "is_enabled": True,
                "is_uploaded": True,
                **file_kwargs,
            }
        )
        await save_fixture(file)

        update_schema = ProductUpdate(medias=[file.id])
        with pytest.raises(PolarRequestValidationError):
            await product_service.update(
                session,
                product,
                update_schema,
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_media(
        self,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        file = ProductMediaFile(
            **{
                "organization": organization,
                "name": "Product Cover",
                "path": "/product-cover.jpg",
                "mime_type": "image/jpeg",
                "size": 1024,
                "service": FileServiceTypes.product_media,
                "is_enabled": True,
                "is_uploaded": True,
            }
        )
        await save_fixture(file)

        update_schema = ProductUpdate(medias=[file.id])
        updated_product = await product_service.update(
            session,
            product,
            update_schema,
            auth_subject,
        )

        assert len(updated_product.medias) == 1

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_change_recurring_interval_on_non_legacy_product(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        update_schema = ProductUpdate(
            recurring_interval=SubscriptionRecurringInterval.year
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.update(
                session,
                product,
                update_schema,
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_legacy_product_price_with_new_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_recurring_monthly_and_yearly: Product,
        user_organization: UserOrganization,
    ) -> None:
        update_schema = ProductUpdate(
            prices=[
                ExistingProductPrice(
                    id=product_recurring_monthly_and_yearly.prices[0].id
                ),
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=12000,
                    price_currency="usd",
                ),
            ]
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.update(
                session,
                product_recurring_monthly_and_yearly,
                update_schema,
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_legacy_product_price_kept(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_recurring_monthly_and_yearly: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )

        update_schema = ProductUpdate(
            prices=[
                ExistingProductPrice(
                    id=product_recurring_monthly_and_yearly.prices[0].id
                ),
                ExistingProductPrice(
                    id=product_recurring_monthly_and_yearly.prices[1].id
                ),
            ]
        )
        updated_product = await product_service.update(
            session,
            product_recurring_monthly_and_yearly,
            update_schema,
            auth_subject,
        )

        create_price_for_product_mock.assert_not_called()

        assert len(updated_product.prices) == 2
        assert (
            updated_product.prices[0].id
            == product_recurring_monthly_and_yearly.prices[0].id
        )
        assert (
            updated_product.prices[1].id
            == product_recurring_monthly_and_yearly.prices[1].id
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid_legacy_product_price_replaced(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_recurring_monthly_and_yearly: Product,
        user_organization: UserOrganization,
        stripe_service_mock: MagicMock,
    ) -> None:
        create_price_for_product_mock: MagicMock = (
            stripe_service_mock.create_price_for_product
        )
        create_price_for_product_mock.return_value = SimpleNamespace(id="NEW_PRICE_ID")
        archive_price_mock: MagicMock = stripe_service_mock.archive_price

        old_price_ids = [
            p.stripe_price_id
            for p in product_recurring_monthly_and_yearly.prices
            if is_static_price(p)
        ]

        update_schema = ProductUpdate(
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=12000,
                    price_currency="usd",
                ),
            ],
        )
        updated_product = await product_service.update(
            session,
            product_recurring_monthly_and_yearly,
            update_schema,
            auth_subject,
        )

        create_price_for_product_mock.assert_called_once()
        for old_price_id in old_price_ids:
            archive_price_mock.assert_any_call(old_price_id)

        assert len(updated_product.prices) == 1

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_several_static_prices(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        update_schema = ProductUpdate(
            prices=[
                ExistingProductPrice(id=product.prices[0].id),
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=2000,
                    price_currency="usd",
                ),
            ]
        )
        with pytest.raises(PolarRequestValidationError):
            await product_service.update(
                session,
                product,
                update_schema,
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_metered_not_existing_meter(
        self,
        auth_subject: AuthSubject[User],
        session: AsyncSession,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        update_schema = ProductUpdate(
            prices=[
                ProductPriceMeteredUnitCreate(
                    amount_type=ProductPriceAmountType.metered_unit,
                    price_currency="usd",
                    unit_amount=Decimal(100),
                    meter_id=uuid.uuid4(),
                ),
            ]
        )
        with pytest.raises(PolarRequestValidationError):
            await product_service.update(
                session,
                product,
                update_schema,
                auth_subject,
            )


@pytest.mark.asyncio
class TestUpdateBenefits:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_not_existing_benefit(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        product = await set_product_benefits(
            save_fixture, product=product, benefits=benefits
        )
        assert len(product.product_benefits) == len(benefits)

        with pytest.raises(PolarRequestValidationError):
            await product_service.update_benefits(
                session,
                product,
                [uuid.uuid4()],
                auth_subject,
            )

        assert len(product.product_benefits) == len(benefits)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_added_benefits(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        enqueue_job_mock: AsyncMock,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        await set_product_benefits(save_fixture, product=product, benefits=[])

        (
            product,
            added,
            deleted,
        ) = await product_service.update_benefits(
            session,
            product,
            [benefit.id for benefit in benefits],
            auth_subject,
        )
        await session.flush()

        assert len(product.product_benefits) == len(benefits)
        for i, product_benefit in enumerate(product.product_benefits):
            assert product_benefit.order == i
            assert benefits[i].id == product_benefit.benefit_id

        assert len(added) == len(benefits)
        assert len(deleted) == 0

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "subscription.subscription.update_product_benefits_grants",
                    product.id,
                ),
                call("order.update_product_benefits_grants", product.id),
            ]
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_order(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        enqueue_job_mock: AsyncMock,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        await set_product_benefits(save_fixture, product=product, benefits=[])

        (
            product,
            added,
            deleted,
        ) = await product_service.update_benefits(
            session,
            product,
            [benefit.id for benefit in benefits[::-1]],
            auth_subject,
        )
        await session.flush()

        assert len(product.product_benefits) == len(benefits)
        for i, product_benefit in enumerate(product.product_benefits):
            assert product_benefit.order == i
            assert benefits[-i - 1].id == product_benefit.benefit_id

        assert len(added) == len(benefits)
        assert len(deleted) == 0

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "subscription.subscription.update_product_benefits_grants",
                    product.id,
                ),
                call("order.update_product_benefits_grants", product.id),
            ]
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_deleted(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: AsyncMock,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        (
            product,
            added,
            deleted,
        ) = await product_service.update_benefits(session, product, [], auth_subject)
        await session.flush()

        assert len(product.product_benefits) == 0
        assert len(added) == 0
        assert len(deleted) == len(benefits)

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "subscription.subscription.update_product_benefits_grants",
                    product.id,
                ),
                call("order.update_product_benefits_grants", product.id),
            ]
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_reordering(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: AsyncMock,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        product: Product,
        benefits: list[Benefit],
    ) -> None:
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=benefits,
        )

        (
            product,
            added,
            deleted,
        ) = await product_service.update_benefits(
            session,
            product,
            [benefit.id for benefit in benefits[::-1]],
            auth_subject,
        )

        assert len(product.product_benefits) == len(benefits)
        for i, product_benefit in enumerate(product.product_benefits):
            assert product_benefit.order == i
            assert benefits[-i - 1].id == product_benefit.benefit_id

        assert len(added) == 0
        assert len(deleted) == 0

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "subscription.subscription.update_product_benefits_grants",
                    product.id,
                ),
                call("order.update_product_benefits_grants", product.id),
            ]
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_add_not_selectable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
    ) -> None:
        not_selectable_benefit = await create_benefit(
            save_fixture,
            type=BenefitType.custom,
            is_tax_applicable=True,
            organization=organization,
            selectable=False,
            properties={"note": None},
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.update_benefits(
                session,
                product,
                [not_selectable_benefit.id],
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_remove_not_selectable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
    ) -> None:
        not_selectable_benefit = await create_benefit(
            save_fixture,
            type=BenefitType.custom,
            is_tax_applicable=True,
            organization=organization,
            selectable=False,
            properties={"note": None},
        )

        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=[not_selectable_benefit],
        )

        with pytest.raises(PolarRequestValidationError):
            await product_service.update_benefits(
                session,
                product,
                [],
                auth_subject,
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_add_with_existing_not_selectable(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        enqueue_job_mock: AsyncMock,
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
    ) -> None:
        not_selectable_benefit = await create_benefit(
            save_fixture,
            type=BenefitType.custom,
            is_tax_applicable=True,
            organization=organization,
            selectable=False,
            properties={"note": None},
        )
        selectable_benefit = await create_benefit(
            save_fixture,
            type=BenefitType.custom,
            is_tax_applicable=True,
            organization=organization,
            description="SELECTABLE",
        )
        product = await set_product_benefits(
            save_fixture,
            product=product,
            benefits=[not_selectable_benefit],
        )

        (
            _,
            added,
            deleted,
        ) = await product_service.update_benefits(
            session,
            product,
            [not_selectable_benefit.id, selectable_benefit.id],
            auth_subject,
        )
        assert len(added) == 1
        assert selectable_benefit.id in [a.id for a in added]
        assert len(deleted) == 0

        enqueue_job_mock.assert_has_calls(
            [
                call(
                    "subscription.subscription.update_product_benefits_grants",
                    product.id,
                ),
                call("order.update_product_benefits_grants", product.id),
            ]
        )
