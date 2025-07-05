"""Fix meter credits empty benefits

Revision ID: 5972_fix_meter_credits
Revises: 4b8976c08210
Create Date: 2025-07-05 00:28:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "5972_fix_meter_credits"
down_revision = "4b8976c08210"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Create meters for orgs with metered products
    op.execute("""
        INSERT INTO meters (id, name, filter, aggregation, organization_id, created_at, modified_at, user_metadata)
        SELECT gen_random_uuid(), 'api_calls', '{}', '{"type": "count"}', p.organization_id, NOW(), NOW(), '{}'
        FROM products p
        JOIN product_prices pp ON p.id = pp.product_id
        WHERE pp.type = 'recurring' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(pp.pricing_tiers) AS tier
            WHERE tier->>'type' = 'metered'
        )
        AND NOT EXISTS (SELECT 1 FROM meters m WHERE m.organization_id = p.organization_id)
        AND p.deleted_at IS NULL;
    """)
    
    # Create meter_credit benefits
    op.execute("""
        INSERT INTO benefits (id, type, description, selectable, deletable, organization_id, created_at, modified_at, properties)
        SELECT gen_random_uuid(), 'meter_credit', '1000 API Call Credits', true, true, p.organization_id, NOW(), NOW(),
               jsonb_build_object('meter_id', m.id, 'units', 1000, 'rollover', true)
        FROM products p
        JOIN product_prices pp ON p.id = pp.product_id
        JOIN meters m ON m.organization_id = p.organization_id
        WHERE pp.type = 'recurring' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(pp.pricing_tiers) AS tier
            WHERE tier->>'type' = 'metered'
        )
        AND NOT EXISTS (
            SELECT 1 FROM benefits b JOIN product_benefits pb ON b.id = pb.benefit_id
            WHERE pb.product_id = p.id AND b.type = 'meter_credit'
        )
        AND p.deleted_at IS NULL;
    """)
    
    # Link benefits to products
    op.execute("""
        INSERT INTO product_benefits (product_id, benefit_id, "order")
        SELECT p.id, b.id, COALESCE((SELECT MAX(pb."order") FROM product_benefits pb WHERE pb.product_id = p.id), 0) + 1
        FROM products p
        JOIN product_prices pp ON p.id = pp.product_id
        JOIN benefits b ON b.organization_id = p.organization_id
        WHERE pp.type = 'recurring' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(pp.pricing_tiers) AS tier
            WHERE tier->>'type' = 'metered'
        )
        AND b.type = 'meter_credit'
        AND NOT EXISTS (SELECT 1 FROM product_benefits pb WHERE pb.product_id = p.id AND pb.benefit_id = b.id)
        AND p.deleted_at IS NULL AND b.deleted_at IS NULL;
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM product_benefits 
        WHERE benefit_id IN (SELECT id FROM benefits WHERE type = 'meter_credit' AND description = '1000 API Call Credits');
    """)
    
    op.execute("""
        DELETE FROM benefits WHERE type = 'meter_credit' AND description = '1000 API Call Credits';
    """)
    
    op.execute("""
        DELETE FROM meters WHERE name = 'api_calls' AND NOT EXISTS (
            SELECT 1 FROM benefits b WHERE b.type = 'meter_credit' AND (b.properties->>'meter_id')::uuid = meters.id
        );
    """) 