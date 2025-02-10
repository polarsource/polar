"""Remove DiscountRedemption saved for failed Checkout

Revision ID: 7c77579439b1
Revises: 13d285d30848
Create Date: 2025-02-10 15:45:23.448336

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "7c77579439b1"
down_revision = "13d285d30848"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM discount_redemptions
        USING checkouts
        WHERE discount_redemptions.checkout_id = checkouts.id
        AND checkouts.status = 'failed';
        """
    )


def downgrade() -> None:
    pass
