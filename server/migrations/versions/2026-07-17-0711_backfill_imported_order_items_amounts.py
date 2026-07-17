"""backfill imported order items amounts to zero

Revision ID: 48ad9dd02ff6
Revises: 638a2f04c7ce
Create Date: 2026-07-17 07:11:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "48ad9dd02ff6"
down_revision = "638a2f04c7ce"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Ensures we don't break app by applying a deadlock-inducing migration
    op.execute("SET LOCAL lock_timeout = '5s'")
    # Backfill imported order items: set amount and net_amount to 0 to be
    # consistent with the zero Order-level amounts (subtotal_amount=0, net_amount=0).
    # Imported order items are identified by label='Imported' joined to orders
    # with subtotal_amount=0 and net_amount=0.
    op.execute(
        sa.text(
            """
            UPDATE order_items
            SET amount_v2 = 0, net_amount_v2 = 0
            WHERE label = 'Imported'
              AND order_id IN (
                  SELECT id FROM orders
                  WHERE subtotal_amount = 0
                    AND net_amount = 0
              )
            """
        )
    )


def downgrade() -> None:
    pass
