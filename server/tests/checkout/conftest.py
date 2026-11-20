import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.models import Checkout, Customer, Organization, ProductMedia
from polar.models.custom_field import CustomFieldType
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.file import FileServiceTypes, ProductMediaFile
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_checkout,
    create_custom_field,
    create_discount,
    create_product,
    set_product_benefits,
)


@pytest.fixture
async def checkout_multiple_products(
    save_fixture: SaveFixture, organization: Organization, customer: Customer
) -> Checkout:
    custom_field = await create_custom_field(
        save_fixture,
        type=CustomFieldType.text,
        slug="company",
        organization=organization,
    )
    products = []
    for name in ("Basic", "Pro"):
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            name=name,
            attached_custom_fields=[(custom_field, True)],
        )
        benefit = await create_benefit(save_fixture, organization=organization)
        await set_product_benefits(save_fixture, product=product, benefits=[benefit])
        media = ProductMediaFile(
            organization=organization,
            name=f"{name} cover",
            path=f"/{name}.jpg",
            mime_type="image/jpeg",
            size=1024,
            service=FileServiceTypes.product_media,
            is_enabled=True,
            is_uploaded=True,
        )
        product.product_medias.append(ProductMedia(file=media, order=0))
        await save_fixture(product)
        products.append(product)

    discount = await create_discount(
        save_fixture,
        type=DiscountType.percentage,
        basis_points=1000,
        duration=DiscountDuration.forever,
        organization=organization,
        products=products,
    )
    return await create_checkout(
        save_fixture, products=products, customer=customer, discount=discount
    )
