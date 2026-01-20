"""set default minimum_amount for PWYW prices

Revision ID: 7a2b3c4d5e6f
Revises: 6145195fc43a
Create Date: 2026-01-20 12:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7a2b3c4d5e6f"
down_revision = "6145195fc43a"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Set minimum_amount to 50 for all custom (PWYW) prices where it is NULL
    op.execute(
        """
        UPDATE product_prices
        SET minimum_amount = 50
        WHERE amount_type = 'custom' AND minimum_amount IS NULL
        """
    )


def downgrade() -> None:
    # We don't revert this since we can't distinguish between
    # prices that were explicitly set to 50 and ones that were NULL
    pass
