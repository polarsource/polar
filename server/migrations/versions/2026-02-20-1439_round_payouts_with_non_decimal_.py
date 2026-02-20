"""Round payouts with non-decimal currencies

Revision ID: 138febbc19df
Revises: f87fb3683171
Create Date: 2026-02-20 14:39:55.462721

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "138febbc19df"
down_revision = "f87fb3683171"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE transactions
        SET account_amount = account_amount - account_amount % 100
        WHERE account_currency IN ('isk', 'huf', 'twd', 'ugx')
        AND account_amount % 100 != 0
        AND payout_id IN (
            SELECT id FROM payouts
            WHERE status != 'succeeded'
        )
        """
    )
    op.execute(
        """
        UPDATE payouts
        SET account_amount = account_amount - account_amount % 100
        WHERE account_currency IN ('isk', 'huf', 'twd', 'ugx')
        AND account_amount % 100 != 0
        AND status != 'succeeded'
        """
    )


def downgrade() -> None:
    pass
