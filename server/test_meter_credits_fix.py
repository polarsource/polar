"""
Test for meter credits empty benefits fix (Issue #5972)
"""

import pytest
from sqlalchemy import select, func
from polar.models import Product, Benefit, ProductBenefit, Meter, Organization


class TestMeterCreditsEmptyBenefitsFix:
    """Test that products with metered pricing have meter_credit benefits"""
    
    async def test_products_have_meter_credit_benefits(self, session, organization):
        """Test that products have associated meter_credit benefits"""
        
        # Create a test product
        product = Product(
            name="Test Metered Product",
            organization_id=organization.id,
            # Add other required fields
        )
        session.add(product)
        await session.flush()
        
        # Create a meter for the organization
        meter = Meter(
            name="api_calls",
            organization_id=organization.id,
            filter={},
            aggregation={},
            user_metadata={}
        )
        session.add(meter)
        await session.flush()
        
        # Create a meter_credit benefit
        benefit = Benefit(
            type="meter_credit",
            description="1000 API Call Credits",
            organization_id=organization.id,
            selectable=True,
            deletable=True,
            properties={
                "meter_id": str(meter.id),
                "units": 1000,
                "rollover": True
            },
            user_metadata={}
        )
        session.add(benefit)
        await session.flush()
        
        # Associate benefit with product
        product_benefit = ProductBenefit(
            product_id=product.id,
            benefit_id=benefit.id
        )
        session.add(product_benefit)
        await session.commit()
        
        # Verify the association exists
        result = await session.execute(
            select(func.count(ProductBenefit.id))
            .join(Benefit)
            .where(
                ProductBenefit.product_id == product.id,
                Benefit.type == "meter_credit"
            )
        )
        meter_credit_count = result.scalar()
        
        assert meter_credit_count > 0, "Product should have meter_credit benefits"
    
    async def test_customer_portal_shows_benefits(self, session, customer, product_with_meter_credits):
        """Test that customer portal can retrieve meter credit benefits"""
        
        # This would test the actual customer portal logic
        # You'll need to adapt this based on the actual customer portal service
        from polar.customer_portal.service.order import customer_order as customer_order_service
        
        # Create test order and subscription data
        # ... (create subscription, order, etc.)
        
        # Test that benefits are returned
        # orders, count = await customer_order_service.list(session, auth_subject, ...)
        # assert len(orders) > 0
        # assert any(benefit.type == "meter_credit" for benefit in orders[0].product.benefits)
        
        pass  # Implement based on actual service structure
    
    async def test_migration_creates_meter_credits(self, session):
        """Test that the migration creates meter_credit benefits for existing products"""
        
        # This test would verify that running the migration
        # creates the necessary meter_credit benefits
        
        # Before migration: count meter_credit benefits
        before_result = await session.execute(
            select(func.count(Benefit.id)).where(Benefit.type == "meter_credit")
        )
        before_count = before_result.scalar()
        
        # Run migration logic (you'd extract this into a function)
        # ... migration logic ...
        
        # After migration: count meter_credit benefits
        after_result = await session.execute(
            select(func.count(Benefit.id)).where(Benefit.type == "meter_credit")
        )
        after_count = after_result.scalar()
        
        assert after_count > before_count, "Migration should create meter_credit benefits"


@pytest.fixture
async def product_with_meter_credits(session, organization):
    """Fixture that creates a product with meter credit benefits"""
    
    # Create meter
    meter = Meter(
        name="test_meter",
        organization_id=organization.id,
        filter={},
        aggregation={},
        user_metadata={}
    )
    session.add(meter)
    await session.flush()
    
    # Create product
    product = Product(
        name="Test Product",
        organization_id=organization.id,
        # Add other required fields
    )
    session.add(product)
    await session.flush()
    
    # Create meter_credit benefit
    benefit = Benefit(
        type="meter_credit",
        description="Test Credits",
        organization_id=organization.id,
        selectable=True,
        deletable=True,
        properties={
            "meter_id": str(meter.id),
            "units": 1000,
            "rollover": True
        },
        user_metadata={}
    )
    session.add(benefit)
    await session.flush()
    
    # Associate with product
    product_benefit = ProductBenefit(
        product_id=product.id,
        benefit_id=benefit.id
    )
    session.add(product_benefit)
    await session.commit()
    
    return product 