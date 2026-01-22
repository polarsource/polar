"""Fix free orders/subscriptions in foreign currencies

Revision ID: 81cb97134c21
Revises: 69ef1626e8db
Create Date: 2026-01-22 11:29:16.723578

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "81cb97134c21"
down_revision = "69ef1626e8db"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE orders
        SET currency = 'usd', invoice_path = NULL
        WHERE currency != 'usd' AND subtotal_amount = 0;
        """
    )
    op.execute(
        """
        UPDATE subscriptions
        SET currency = 'usd'
        WHERE currency != 'usd' AND amount = 0;
        """
    )


def downgrade() -> None:
    pass
