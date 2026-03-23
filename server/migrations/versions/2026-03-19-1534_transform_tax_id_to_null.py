"""Transform tax_id to NULL

Revision ID: 817c66202639
Revises: 5dd64c82a092
Create Date: 2026-03-19 15:34:09.033767

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "817c66202639"
down_revision = "5dd64c82a092"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE customers
        SET tax_id = NULL
        WHERE tax_id = 'null'::jsonb
        """
    )
    op.execute(
        """
        UPDATE orders
        SET tax_id = NULL
        WHERE tax_id = 'null'::jsonb
        """
    )
    op.execute(
        """
        UPDATE checkouts
        SET customer_tax_id = NULL
        WHERE customer_tax_id = 'null'::jsonb
        """
    )


def downgrade() -> None:
    pass
