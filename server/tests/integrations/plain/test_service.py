import pytest

from polar.integrations.plain.schemas import (
    CustomerCardCustomer,
    CustomerCardKey,
    CustomerCardsRequest,
)
from polar.integrations.plain.service import PlainService
from polar.models import Customer, Organization, Product
from polar.postgres import AsyncSession
from tests.fixtures import SaveFixture
from tests.fixtures.random_objects import create_order


@pytest.mark.asyncio
class TestPlainServiceOrderCard:
    async def test_get_order_card_with_organization_email(
        self,
        session: AsyncSession,
        customer: Customer,
        product: Product,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        # Set up organization with email
        organization.email = "support@testorg.com"
        await save_fixture(organization)

        # Create order using the helper function
        order = await create_order(save_fixture, product=product, customer=customer)

        # Create Plain service
        plain_service = PlainService()

        # Create request
        request = CustomerCardsRequest(
            customer=CustomerCardCustomer(
                id=str(customer.id),
                email=customer.email,
                externalId=None,
            ),
            thread=None,
            cardKeys=[CustomerCardKey.order],
        )

        # Get order card
        card = await plain_service._get_order_card(session, request)

        assert card is not None
        assert card.key == CustomerCardKey.order
        assert card.components is not None
        assert len(card.components) > 0

        # Convert components to string to search for support email
        components_str = str(card.components)
        assert "Support Email" in components_str
        assert "support@testorg.com" in components_str
        assert "Copy Support Email" in components_str

    async def test_get_order_card_without_organization_email(
        self,
        session: AsyncSession,
        customer: Customer,
        product: Product,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        # Set up organization without email
        organization.email = None
        await save_fixture(organization)

        # Create order using the helper function
        order = await create_order(save_fixture, product=product, customer=customer)

        # Create Plain service
        plain_service = PlainService()

        # Create request
        request = CustomerCardsRequest(
            customer=CustomerCardCustomer(
                id=str(customer.id),
                email=customer.email,
                externalId=None,
            ),
            thread=None,
            cardKeys=[CustomerCardKey.order],
        )

        # Get order card
        card = await plain_service._get_order_card(session, request)

        assert card is not None
        assert card.key == CustomerCardKey.order
        assert card.components is not None
        assert len(card.components) > 0

        # Convert components to string to verify support email is not included
        components_str = str(card.components)
        assert "Support Email" not in components_str
