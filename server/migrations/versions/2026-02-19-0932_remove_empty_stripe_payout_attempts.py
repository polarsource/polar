"""Remove empty Stripe payout attempts

(Did it twice in a row, because the bug that caused it was not fixed before the previous one)

Revision ID: 11baed68732d
Revises: eaf853afbc67
Create Date: 2026-02-19 09:32:54.934988

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "11baed68732d"
down_revision = "eaf853afbc67"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM payout_attempts
        WHERE processor = 'stripe' AND processor_id IS NULL
        """
    )


def downgrade() -> None:
    pass
