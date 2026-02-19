"""Remove empty Stripe payout attempts

Revision ID: eaf853afbc67
Revises: a13077e7c985
Create Date: 2026-02-19 08:57:33.048578

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "eaf853afbc67"
down_revision = "a13077e7c985"
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
