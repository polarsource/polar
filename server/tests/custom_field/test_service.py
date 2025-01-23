import pytest
import pytest_asyncio

from polar.custom_field.schemas import CustomFieldUpdateText
from polar.custom_field.service import custom_field as custom_field_service
from polar.models import Customer, Order, Organization, Product
from polar.models.custom_field import CustomFieldText, CustomFieldType
from polar.order.service import order as order_service
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
class TestUpdate:
    async def test_slug_update(
        self,
        session: AsyncSession,
        text_field: CustomFieldText,
        order_text_field_data: Order,
    ) -> None:
        updated_field = await custom_field_service.update(
            session,
            text_field,
            CustomFieldUpdateText(type=text_field.type, slug="updatedslug"),
        )

        assert updated_field.slug == "updatedslug"

        updated_order = await order_service.get(session, order_text_field_data.id)
        assert updated_order is not None
        assert updated_order.custom_field_data == {
            "foo": "bar",
            "updatedslug": "text1",
        }
