import pytest
import pytest_asyncio

from polar.auth.models import AuthSubject
from polar.custom_field.schemas import CustomFieldCreateText, CustomFieldUpdateText
from polar.custom_field.service import custom_field as custom_field_service
from polar.exceptions import PolarRequestValidationError
from polar.models import Customer, Order, Organization, Product, User, UserOrganization
from polar.models.custom_field import CustomFieldText, CustomFieldType
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_custom_field, create_order


@pytest_asyncio.fixture
async def text_field(
    save_fixture: SaveFixture, organization: Organization
) -> CustomFieldText:
    return await create_custom_field(
        save_fixture,
        type=CustomFieldType.text,
        slug="text1",
        organization=organization,
    )


@pytest_asyncio.fixture
async def order_text_field_data(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
    text_field: CustomFieldText,
) -> Order:
    custom_field_data = {"foo": "bar"}
    custom_field_data[text_field.slug] = "text1"
    return await create_order(
        save_fixture,
        product=product,
        customer=customer,
        custom_field_data=custom_field_data,
    )


@pytest.mark.asyncio
class TestCreate:
    @pytest.mark.auth
    async def test_existing_slug(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        text_field: CustomFieldText,
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await custom_field_service.create(
                session,
                CustomFieldCreateText(
                    type=CustomFieldType.text,
                    slug=text_field.slug,
                    name="New Field",
                    properties={},
                    organization_id=organization.id,
                ),
                auth_subject,
            )

    @pytest.mark.auth
    async def test_slug_of_soft_deleted_field(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        text_field: CustomFieldText,
    ) -> None:
        text_field.set_deleted_at()
        await save_fixture(text_field)

        custom_field = await custom_field_service.create(
            session,
            CustomFieldCreateText(
                type=CustomFieldType.text,
                slug=text_field.slug,
                name="New Field",
                properties={},
                organization_id=organization.id,
            ),
            auth_subject,
        )
        await session.flush()

        assert custom_field.slug == text_field.slug
        assert custom_field.id != text_field.id


@pytest.mark.asyncio
class TestUpdate:
    @pytest.mark.auth
    async def test_slug_update(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        text_field: CustomFieldText,
        order_text_field_data: Order,
    ) -> None:
        updated_field = await custom_field_service.update(
            session,
            text_field,
            CustomFieldUpdateText(type=text_field.type, slug="updatedslug"),
            auth_subject,
        )

        assert updated_field.slug == "updatedslug"

        order_repository = OrderRepository.from_session(session)
        updated_order = await order_repository.get_by_id(order_text_field_data.id)
        assert updated_order is not None
        assert updated_order.custom_field_data == {
            "foo": "bar",
            "updatedslug": "text1",
        }

    @pytest.mark.auth
    async def test_slug_of_soft_deleted_field(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        text_field: CustomFieldText,
    ) -> None:
        deleted_field = await create_custom_field(
            save_fixture,
            type=CustomFieldType.text,
            slug="deleted-slug",
            organization=organization,
        )
        deleted_field.set_deleted_at()
        await save_fixture(deleted_field)

        updated_field = await custom_field_service.update(
            session,
            text_field,
            CustomFieldUpdateText(type=text_field.type, slug=deleted_field.slug),
            auth_subject,
        )
        await session.flush()

        assert updated_field.slug == deleted_field.slug
