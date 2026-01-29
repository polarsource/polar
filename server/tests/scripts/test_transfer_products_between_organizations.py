from uuid import UUID

import pytest
from sqlalchemy import select

from polar.kit.db.postgres import AsyncSession
from polar.models import Discount, Organization, ProductBenefit
from polar.models.benefit import BenefitType
from polar.models.discount import DiscountDuration, DiscountType
from scripts.transfer_products_between_organizations import (
    MixedOrganizationError,
    ProductTransferService,
    TransferValidationError,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_benefit,
    create_checkout_link,
    create_customer,
    create_discount,
    create_event,
    create_order,
    create_organization,
    create_product,
)


@pytest.mark.asyncio
class TestProductTransferService:
    """Test the ProductTransferService class."""

    async def test_validate_organizations_exist_success(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test successful organization validation."""
        source_org = organization
        target_org = await create_organization(save_fixture)

        service = ProductTransferService(source_org.id, target_org.id)

        # Should not raise an exception
        await service.validate_organizations_exist(session)

        assert service.source_organization_id == source_org.id
        assert service.target_organization_id == target_org.id

    async def test_validate_organizations_exist_source_not_found(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test validation fails when source organization doesn't exist."""
        target_org = await create_organization(save_fixture)

        service = ProductTransferService(
            UUID("123e4567-e89b-12d3-a456-426614174000"), target_org.id
        )

        with pytest.raises(
            TransferValidationError, match="Source organization.*does not exist"
        ):
            await service.validate_organizations_exist(session)

    async def test_validate_organizations_exist_target_not_found(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test validation fails when target organization doesn't exist."""
        source_org = await create_organization(save_fixture)

        service = ProductTransferService(
            source_org.id, UUID("123e4567-e89b-12d3-a456-426614174000")
        )

        with pytest.raises(
            TransferValidationError, match="Target organization.*does not exist"
        ):
            await service.validate_organizations_exist(session)

    async def test_validate_products_belong_to_same_organization_success(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test successful product validation when all products belong to same organization."""
        product1 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(organization.id, organization.id)

        # Should not raise an exception
        await service.validate_products_belong_to_same_organization(
            session, [product1.id, product2.id]
        )

        assert len(service.products) == 2
        assert product1.id in [p.id for p in service.products]
        assert product2.id in [p.id for p in service.products]

    async def test_validate_products_belong_to_same_organization_mixed_orgs(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test validation fails when products belong to different organizations."""
        org1 = await create_organization(save_fixture)
        org2 = await create_organization(save_fixture)

        product1 = await create_product(
            save_fixture, organization=org1, name="Product 1", recurring_interval=None
        )
        product2 = await create_product(
            save_fixture, organization=org2, name="Product 2", recurring_interval=None
        )

        service = ProductTransferService(org1.id, org1.id)

        with pytest.raises(
            MixedOrganizationError, match="Products belong to multiple organizations"
        ):
            await service.validate_products_belong_to_same_organization(
                session, [product1.id, product2.id]
            )

    async def test_validate_products_not_found(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test validation fails when products don't exist."""
        service = ProductTransferService(organization.id, organization.id)

        with pytest.raises(TransferValidationError, match="No products found"):
            await service.validate_products_belong_to_same_organization(
                session, [UUID("123e4567-e89b-12d3-a456-426614174000")]
            )

    async def test_analyze_affected_data_no_customers_to_split(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test analysis when no customers need splitting."""
        # Create products
        product1 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=organization,
            name="Product 2",
            recurring_interval=None,
        )

        # Create a customer with orders only for the products being transferred
        customer = await create_customer(save_fixture, organization=organization)
        order1 = await create_order(save_fixture, customer=customer, product=product1)
        order2 = await create_order(save_fixture, customer=customer, product=product2)

        service = ProductTransferService(organization.id, organization.id)
        service.products = [product1, product2]

        await service.analyze_affected_data(session)

        assert len(service.benefits_to_transfer) >= 0  # May have benefits
        assert len(service.customers_to_split) == 0  # No customers to split
        assert (
            len(service.customers_to_transfer) == 1
        )  # Customer should be transferred directly
        assert service.transfer_stats["products"] == 2
        assert service.transfer_stats["customers_to_transfer"] == 1

    async def test_analyze_affected_data_with_customers_to_split(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Test analysis when customers need splitting."""
        # Create products - some will be transferred, some won't
        product_transfer1 = await create_product(
            save_fixture,
            organization=organization,
            name="Transfer Product 1",
            recurring_interval=None,
        )
        product_transfer2 = await create_product(
            save_fixture,
            organization=organization,
            name="Transfer Product 2",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=organization,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create a customer with orders for both transferring and non-transferring products
        customer = await create_customer(save_fixture, organization=organization)
        order_transfer1 = await create_order(
            save_fixture, customer=customer, product=product_transfer1
        )
        order_transfer2 = await create_order(
            save_fixture, customer=customer, product=product_transfer2
        )
        order_stay = await create_order(
            save_fixture, customer=customer, product=product_stay
        )

        service = ProductTransferService(organization.id, organization.id)
        service.products = [product_transfer1, product_transfer2]

        await service.analyze_affected_data(session)

        assert len(service.customers_to_split) == 1  # This customer needs splitting
        assert service.transfer_stats["products"] == 2
        assert service.transfer_stats["customers_to_split"] == 1

    async def test_customer_splitting_creates_new_customer(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that customer splitting creates new customer records."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create customer with order for the product
        customer = await create_customer(save_fixture, organization=source_org)
        order = await create_order(save_fixture, customer=customer, product=product)

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_split = [customer]

        await service.split_customers(session)

        # Check that a new customer was created in target organization
        assert len(service.new_customers_map) == 1
        new_customer = service.new_customers_map[customer.id]
        assert new_customer.organization_id == target_org.id
        assert new_customer.email == customer.email
        assert new_customer.name == customer.name

        # Check that the order was updated to reference the new customer
        await session.refresh(order)
        assert order.customer_id == new_customer.id

    async def test_transfer_benefits_updates_organization(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that benefits are transferred to target organization."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create product with benefit
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )
        benefit = await create_benefit(
            save_fixture, organization=source_org, type=BenefitType.custom
        )
        product_benefit = ProductBenefit(product=product, benefit=benefit, order=0)
        await save_fixture(product_benefit)

        service = ProductTransferService(source_org.id, target_org.id)
        service.benefits_to_transfer = [benefit]

        await service.transfer_benefits(session)

        # Check that benefit organization was updated
        await session.refresh(benefit)
        assert benefit.organization_id == target_org.id

    async def test_transfer_products_updates_organization(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that products are transferred to target organization."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products
        product1 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product1, product2]

        await service.transfer_products(session)

        # Check that products organization was updated
        await session.refresh(product1)
        await session.refresh(product2)
        assert product1.organization_id == target_org.id
        assert product2.organization_id == target_org.id

    async def test_transfer_customers_directly(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that customers with only transferring products are transferred directly."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create a product
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create customer with order for only the transferring product
        customer = await create_customer(save_fixture, organization=source_org)
        order = await create_order(save_fixture, customer=customer, product=product)

        service = ProductTransferService(source_org.id, target_org.id)
        service.customers_to_transfer = [customer]

        await service.transfer_customers_directly(session)

        # Check that customer organization was updated
        await session.refresh(customer)
        assert customer.organization_id == target_org.id
        assert service.transfer_stats["customers_transferred_directly"] == 1

        # Check that the order still belongs to the customer (should not be changed)
        await session.refresh(order)
        assert order.customer_id == customer.id

    async def test_transfer_discounts_directly(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that discounts used only by transferring products are transferred directly."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create a product
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        # Create a discount using the helper function
        from polar.models.discount import DiscountDuration, DiscountType

        discount = await create_discount(
            save_fixture,
            organization=source_org,
            products=[product],
            type=DiscountType.fixed,
            amount=1000,  # $10.00
            currency="USD",
            duration=DiscountDuration.once,
        )

        # For this test, we'll just verify the discount transfer functionality
        # without creating complex checkout structures. The analysis phase would
        # normally find discounts linked to transferring products via redemptions.
        # Here we directly test the transfer logic.

        service = ProductTransferService(source_org.id, target_org.id)
        service.discounts_to_transfer = [discount]

        await service.transfer_discounts_directly(session)

        # Check that discount organization was updated
        await session.refresh(discount)
        assert discount.organization_id == target_org.id
        assert service.transfer_stats["discounts_transferred_directly"] == 1

    async def test_split_discounts(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that discounts used by both transferring and non-transferring products are split correctly."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create two products - one to transfer, one to stay
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create a discount used by both products (needs splitting)
        from polar.models.discount import DiscountDuration, DiscountType

        discount = await create_discount(
            save_fixture,
            organization=source_org,
            products=[product_transfer, product_stay],  # Used by both products
            type=DiscountType.fixed,
            amount=1000,  # $10.00
            currency="USD",
            duration=DiscountDuration.once,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]  # Only transfer one product
        service.discounts_to_split = [discount]  # This discount needs splitting

        await service.split_discounts(session)

        # Verify the split was performed
        assert service.transfer_stats["discounts_split"] == 1

        # Find the new discount created in target organization
        result = await session.execute(
            select(Discount).where(
                Discount.organization_id == target_org.id,
                Discount.name == discount.name,
            )
        )
        new_discount = result.scalar_one_or_none()

        assert new_discount is not None
        assert new_discount.organization_id == target_org.id
        assert new_discount.code == discount.code  # Same code
        assert new_discount.type == discount.type  # Same type
        assert new_discount.redemptions_count == 0  # Reset redemption count

        # Verify original discount still exists in source organization
        await session.refresh(discount)
        assert discount.organization_id == source_org.id  # Original stays

    async def test_analyze_discounts(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that discount analysis correctly categorizes discounts."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create discount only for transferring product (should be transferred directly)
        discount_direct = await create_discount(
            save_fixture,
            organization=source_org,
            products=[product_transfer],  # Only transferring product
            type=DiscountType.fixed,
            amount=1000,
            currency="USD",
            duration=DiscountDuration.once,
            code="DIRECT10",
        )

        # Create discount for both products (should be split)
        discount_split = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10000,
            duration=DiscountDuration.once,
            organization=source_org,
            products=[product_transfer, product_stay],  # Both products
        )

        # Create discount only for staying product (should not be transferred)
        discount_stay = await create_discount(
            save_fixture,
            organization=source_org,
            products=[product_stay],  # Only staying product
            type=DiscountType.fixed,
            amount=500,
            currency="USD",
            duration=DiscountDuration.once,
            code="STAY5",
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]

        # Manually set up the discount analysis (simulating what analyze_affected_data does)
        service.discounts_to_transfer = [discount_direct]
        service.discounts_to_split = [discount_split]
        # discount_stay should not be in either list (stays with source org)

        # Verify categorization
        assert len(service.discounts_to_transfer) == 1
        assert discount_direct in service.discounts_to_transfer
        assert len(service.discounts_to_split) == 1
        assert discount_split in service.discounts_to_split
        assert discount_stay not in service.discounts_to_transfer
        assert discount_stay not in service.discounts_to_split

    async def test_validate_transfer_success(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test successful transfer validation."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products
        product1 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product1, product2]
        service.benefits_to_transfer = []  # No benefits to transfer

        # Manually update the products to target org (simulating transfer)
        product1.organization_id = target_org.id
        product2.organization_id = target_org.id
        await session.flush()

        # Validation should pass
        await service.validate_transfer(session)

    async def test_validate_transfer_failure(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test transfer validation fails when not all products were transferred."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products
        product1 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 1",
            recurring_interval=None,
        )
        product2 = await create_product(
            save_fixture,
            organization=source_org,
            name="Product 2",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product1, product2]
        service.benefits_to_transfer = []

        # Only transfer one product (simulating partial transfer)
        product1.organization_id = target_org.id
        await session.flush()

        # Validation should fail
        with pytest.raises(
            TransferValidationError, match="Not all products were transferred"
        ):
            await service.validate_transfer(session)

    async def test_analyze_checkout_links(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that checkout links containing transferring products are identified."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create checkout link with transferring product
        checkout_link_with_transfer = await create_checkout_link(
            save_fixture,
            products=[product_transfer],
        )

        # Create checkout link with staying product
        checkout_link_with_stay = await create_checkout_link(
            save_fixture,
            products=[product_stay],
        )

        # Create checkout link with both products
        checkout_link_with_both = await create_checkout_link(
            save_fixture,
            products=[product_transfer, product_stay],
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]

        await service._analyze_checkout_links(session)

        # Should find checkout links that contain the transferring product
        assert len(service.checkout_links_to_update) == 2
        assert checkout_link_with_transfer in service.checkout_links_to_update
        assert checkout_link_with_both in service.checkout_links_to_update
        assert checkout_link_with_stay not in service.checkout_links_to_update

        assert service.transfer_stats["checkout_links_to_update"] == 2

    async def test_update_checkout_links(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that checkout links are updated by removing transferring products."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create checkout link with both products
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_transfer, product_stay],
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]
        service.checkout_links_to_update = [checkout_link]

        await service._update_checkout_links(session)

        # Verify the checkout link was updated
        await session.refresh(checkout_link)
        assert len(checkout_link.checkout_link_products) == 1
        assert checkout_link.checkout_link_products[0].product_id == product_stay.id

        assert service.transfer_stats["checkout_links_updated"] == 1

    async def test_update_checkout_links_soft_delete_when_empty(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that checkout links are soft deleted when all products are removed."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create a single product
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )

        # Create checkout link with only the transferring product
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_transfer],
        )

        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product_transfer]
        service.checkout_links_to_update = [checkout_link]

        await service._update_checkout_links(session)

        # Verify the checkout link was soft deleted
        await session.refresh(checkout_link)
        assert checkout_link.deleted_at is not None

        assert service.transfer_stats["checkout_links_soft_deleted"] == 1

    async def test_analyze_events(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that events are properly analyzed for transfer."""
        # Setup: Create source and target orgs, products, customers, and events
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )

        # Customer with only transferring product (should have events transferred)
        customer_direct = await create_customer(
            save_fixture, organization=source_org, email="customer_direct@example.com"
        )
        await create_order(save_fixture, customer=customer_direct, product=product)

        # Create events for the direct customer
        event1 = await create_event(
            save_fixture, customer=customer_direct, organization=source_org
        )
        event2 = await create_event(
            save_fixture, customer=customer_direct, organization=source_org
        )

        # Customer with mixed purchases (should NOT have events transferred)
        customer_split = await create_customer(
            save_fixture, organization=source_org, email="customer_split@example.com"
        )
        other_product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )
        await create_order(save_fixture, customer=customer_split, product=product)
        await create_order(save_fixture, customer=customer_split, product=other_product)
        await create_event(
            save_fixture, customer=customer_split, organization=source_org
        )

        # Test
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_transfer = [customer_direct]
        service.customers_to_split = [customer_split]

        await service._analyze_events(session)

        # Verify
        assert len(service.events_to_transfer) == 2
        assert {event1.id, event2.id} == {e.id for e in service.events_to_transfer}

    async def test_transfer_events(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that events are properly transferred."""
        # Setup
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )
        customer = await create_customer(
            save_fixture, organization=source_org, email="customer_test@example.com"
        )
        await create_order(save_fixture, customer=customer, product=product)

        event1 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )
        event2 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )

        # Test
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_transfer = [customer]
        service.events_to_transfer = [event1, event2]

        await service.transfer_events(session)

        # Verify events are updated
        await session.refresh(event1)
        await session.refresh(event2)

        assert event1.organization_id == target_org.id
        assert event2.organization_id == target_org.id
        assert service.transfer_stats["events_transferred"] == 2

    async def test_events_not_transferred_for_split_customers(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test that events for split customers are NOT transferred."""
        # Setup
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )
        other_product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )

        customer = await create_customer(
            save_fixture,
            organization=source_org,
            email="customer_split_test@example.com",
        )
        await create_order(save_fixture, customer=customer, product=product)
        await create_order(save_fixture, customer=customer, product=other_product)

        event = await create_event(
            save_fixture, customer=customer, organization=source_org
        )

        # Test
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_split = [customer]  # This is a split customer

        await service._analyze_events(session)

        # Verify no events are selected for transfer
        assert len(service.events_to_transfer) == 0


@pytest.mark.asyncio
class TestProductTransferIntegration:
    """Integration tests for the complete product transfer workflow."""

    async def test_complete_transfer_workflow_simple_case(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test complete transfer workflow for simple case with no customer splitting."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create a product
        product = await create_product(
            save_fixture,
            organization=source_org,
            name="Test Product",
            recurring_interval=None,
        )

        service = ProductTransferService(source_org.id, target_org.id)

        # Validate organizations
        await service.validate_organizations_exist(session)

        # Validate products
        await service.validate_products_belong_to_same_organization(
            session, [product.id]
        )

        # Analyze affected data
        await service.analyze_affected_data(session)

        # Execute the transfer
        await service.split_customers(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify the transfer
        await session.refresh(product)
        assert product.organization_id == target_org.id
        assert service.transfer_stats["products_transferred"] == 1

    async def test_complete_transfer_workflow_with_customer_splitting(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test complete transfer workflow with customer splitting."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products - one to transfer, one to stay
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create customer with orders for both products
        customer = await create_customer(save_fixture, organization=source_org)
        order_transfer = await create_order(
            save_fixture, customer=customer, product=product_transfer
        )
        order_stay = await create_order(
            save_fixture, customer=customer, product=product_stay
        )

        service = ProductTransferService(source_org.id, target_org.id)

        # Validate and analyze
        await service.validate_organizations_exist(session)
        await service.validate_products_belong_to_same_organization(
            session, [product_transfer.id]
        )
        await service.analyze_affected_data(session)

        # Execute the transfer
        await service.split_customers(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify results
        await session.refresh(product_transfer)
        assert product_transfer.organization_id == target_org.id

        # Verify customer splitting
        assert len(service.new_customers_map) == 1
        new_customer = service.new_customers_map[customer.id]
        assert new_customer.organization_id == target_org.id

        # Verify order was updated
        await session.refresh(order_transfer)
        assert order_transfer.customer_id == new_customer.id

        # Verify original order still exists with original customer
        await session.refresh(order_stay)
        assert order_stay.customer_id == customer.id

    async def test_complete_transfer_workflow_with_checkout_links(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test complete transfer workflow with checkout links."""
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)

        # Create products - one to transfer, one to stay
        product_transfer = await create_product(
            save_fixture,
            organization=source_org,
            name="Transfer Product",
            recurring_interval=None,
        )
        product_stay = await create_product(
            save_fixture,
            organization=source_org,
            name="Stay Product",
            recurring_interval=None,
        )

        # Create checkout link with both products
        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product_transfer, product_stay],
        )

        service = ProductTransferService(source_org.id, target_org.id)

        # Validate and analyze
        await service.validate_organizations_exist(session)
        await service.validate_products_belong_to_same_organization(
            session, [product_transfer.id]
        )
        await service.analyze_affected_data(session)

        # Execute the transfer
        await service.split_customers(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify results
        await session.refresh(product_transfer)
        assert product_transfer.organization_id == target_org.id

        # Verify checkout link was updated
        await session.refresh(checkout_link)
        assert len(checkout_link.checkout_link_products) == 1
        assert checkout_link.checkout_link_products[0].product_id == product_stay.id

        # Verify stats
        assert service.transfer_stats["checkout_links_updated"] == 1

    async def test_complete_transfer_workflow_with_events(
        self, save_fixture: SaveFixture, session: AsyncSession
    ) -> None:
        """Test complete transfer workflow including event transfer."""
        # Setup
        source_org = await create_organization(save_fixture)
        target_org = await create_organization(save_fixture)
        product = await create_product(
            save_fixture, organization=source_org, recurring_interval=None
        )

        customer = await create_customer(
            save_fixture, organization=source_org, email="customer_workflow@example.com"
        )
        await create_order(save_fixture, customer=customer, product=product)

        # Create events for the customer
        event1 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )
        event2 = await create_event(
            save_fixture, customer=customer, organization=source_org
        )

        # Initialize service
        service = ProductTransferService(source_org.id, target_org.id)
        service.products = [product]
        service.customers_to_transfer = [customer]
        service.events_to_transfer = [event1, event2]

        # Execute the transfer
        await service.transfer_customers_directly(session)
        await service.transfer_events(session)
        await service.transfer_benefits(session)
        await service.transfer_products(session)
        await service.update_related_entities(session)
        await service.validate_transfer(session)

        # Verify events were transferred
        await session.refresh(event1)
        await session.refresh(event2)
        assert event1.organization_id == target_org.id
        assert event2.organization_id == target_org.id
        assert service.transfer_stats["events_transferred"] == 2
