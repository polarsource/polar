"""Deserialize Checkout.customer_billing_address

Revision ID: b608f7a7a743
Revises: db4153e8ea36
Create Date: 2024-10-10 12:39:50.344618

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "b608f7a7a743"
down_revision = "db4153e8ea36"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE checkouts
        SET customer_billing_address = (customer_billing_address #>> '{}')::jsonb
        WHERE jsonb_typeof(customer_billing_address) = 'string';
        """
    )


def downgrade() -> None:
    pass
