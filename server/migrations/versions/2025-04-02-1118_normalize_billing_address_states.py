"""Normalize billing address states

Revision ID: 07905d0ea9a7
Revises: 0646123f765f
Create Date: 2025-04-02 11:18:10.361655

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "07905d0ea9a7"
down_revision = "0646123f765f"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE orders
        SET billing_address = jsonb_set(
            billing_address,
            '{state}',
            to_jsonb(concat_ws('-', billing_address->>'country', billing_address->>'state')),
            true
        )
        WHERE billing_address->>'state' IS NOT NULL
        AND billing_address->>'country' IN ('US', 'CA')
        AND billing_address->>'state' NOT LIKE '%-%'
        """
    )

    op.execute(
        """
        UPDATE customers
        SET billing_address = jsonb_set(
            billing_address,
            '{state}',
            to_jsonb(concat_ws('-', billing_address->>'country', billing_address->>'state')),
            true
        )
        WHERE billing_address->>'state' IS NOT NULL
        AND billing_address->>'country' IN ('US', 'CA')
        AND billing_address->>'state' NOT LIKE '%-%'
        """
    )

    op.execute(
        """
        UPDATE checkouts
        SET customer_billing_address = jsonb_set(
            customer_billing_address,
            '{state}',
            to_jsonb(concat_ws('-', customer_billing_address->>'country', customer_billing_address->>'state')),
            true
        )
        WHERE customer_billing_address->>'state' IS NOT NULL
        AND customer_billing_address->>'country' IN ('US', 'CA')
        AND customer_billing_address->>'state' NOT LIKE '%-%'
        """
    )


def downgrade() -> None:
    pass
